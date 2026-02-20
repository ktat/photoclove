use actix_web::{web, App, HttpServer, HttpRequest, HttpResponse, Result, http::Method};
use tokio::fs::File;
use tokio::io::{AsyncSeekExt, AsyncReadExt, SeekFrom};
use tokio_util::io::ReaderStream;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct VideoServer {
    pub server_url: String,
    pub video_mappings: Arc<tokio::sync::RwLock<HashMap<String, String>>>,
    pub is_running: Arc<AtomicBool>,
}

impl VideoServer {
    pub async fn start() -> Result<Self, String> {
        let mappings = Arc::new(tokio::sync::RwLock::new(HashMap::new()));
        let mappings_clone = mappings.clone();
        let is_running = Arc::new(AtomicBool::new(false));
        let is_running_clone = is_running.clone();
        
        // Try to find an available port starting from 3030
        let port = find_available_port(3030).await?;
        let server_url = format!("http://127.0.0.1:{}", port);
        
        std::thread::spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Failed to create tokio runtime");
                
            runtime.block_on(async move {
                let server = HttpServer::new(move || {
                    App::new()
                        .app_data(web::Data::new(mappings_clone.clone()))
                        .route("/video/{video_id}", web::get().to(stream_video))
                        .route("/video/{video_id}", web::method(Method::OPTIONS).to(options_handler))
                        .route("/health", web::get().to(health_check))
                });
                
                log::info!(target: "video_server", "starting_server; port={}", port);
                is_running_clone.store(true, Ordering::Relaxed);
                
                if let Err(e) = server
                    .bind(format!("127.0.0.1:{}", port))
                    .expect("Failed to bind server")
                    .system_exit()  // Exit cleanly
                    .run()
                    .await
                {
                    log::error!(target: "video_server", "server_error; error={:?}", e);
                    is_running_clone.store(false, Ordering::Relaxed);
                }
            });
        });
        
        // Wait a moment for server to start
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        Ok(Self {
            server_url,
            video_mappings: mappings,
            is_running,
        })
    }
    
    pub async fn register_video(&self, video_path: String) -> Result<String, String> {
        use base64::Engine;
        let video_id = base64::engine::general_purpose::STANDARD.encode(&video_path);
        
        // Verify file exists and is accessible
        match tokio::fs::metadata(&video_path).await {
            Ok(metadata) => {
                if !metadata.is_file() {
                    return Err(format!("Path is not a file: {}", video_path));
                }
            },
            Err(e) => return Err(format!("Cannot access video file: {}: {}", video_path, e)),
        }
        
        let mut mappings = self.video_mappings.write().await;
        mappings.insert(video_id.clone(), video_path.clone());
        
        let streaming_url = format!("{}/video/{}", self.server_url, video_id);
        log::info!(target: "video_server", "video_registered; path={}; url={}", video_path, streaming_url);
        
        Ok(streaming_url)
    }
    
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }
}

async fn find_available_port(start_port: u16) -> Result<u16, String> {
    for port in start_port..start_port + 10 {
        match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            Ok(_) => return Ok(port),
            Err(_) => continue,
        }
    }
    Err("No available ports found".to_string())
}

async fn stream_video(
    req: HttpRequest,
    path: web::Path<String>,
    mappings: web::Data<Arc<tokio::sync::RwLock<HashMap<String, String>>>>,
) -> Result<HttpResponse> {
    let video_id = path.into_inner();
    let mappings = mappings.read().await;
    
    let file_path = match mappings.get(&video_id) {
        Some(path) => path.clone(),
        None => {
            log::warn!(target: "video_server", "video_not_found; video_id={}", video_id);
            return Ok(HttpResponse::NotFound().body("Video not found"));
        }
    };
    
    let mut file = match File::open(&file_path).await {
        Ok(file) => file,
        Err(e) => {
            log::error!(target: "video_server", "file_open_error; path={}; error={:?}", file_path, e);
            return Ok(HttpResponse::NotFound().body("File not accessible"));
        }
    };
    
    let file_size = match file.metadata().await {
        Ok(metadata) => metadata.len(),
        Err(e) => {
            log::error!(target: "video_server", "metadata_error; path={}; error={:?}", file_path, e);
            return Ok(HttpResponse::InternalServerError().body("Cannot read file metadata"));
        }
    };
    
    log::debug!(target: "video_server", "streaming_request; path={}; size={}", file_path, file_size);
    
    // Handle range requests for seeking/streaming
    if let Some(range_header) = req.headers().get("range") {
        if let Ok(range_str) = range_header.to_str() {
            if let Some((start, end)) = parse_range(range_str, file_size) {
                if let Err(e) = file.seek(SeekFrom::Start(start)).await {
                    log::error!(target: "video_server", "seek_error; path={}; start={}; error={:?}", file_path, start, e);
                    return Ok(HttpResponse::InternalServerError().body("Seek failed"));
                }
                
                let content_length = end - start + 1;
                // Use massive buffer for local video streaming (32MB)
                let stream = ReaderStream::with_capacity(file.take(content_length), 33554432);
                
                let transfer_speed_mbps = content_length as f64 / 1024.0 / 1024.0;
                log::debug!(target: "video_server", "range_response; path={}; chunk_size_mb={:.2}", 
                    file_path, transfer_speed_mbps);
                
                return Ok(HttpResponse::PartialContent()
                    .insert_header(("Content-Range", 
                        format!("bytes {}-{}/{}", start, end, file_size)))
                    .insert_header(("Accept-Ranges", "bytes"))
                    .insert_header(("Content-Length", content_length.to_string()))
                    .insert_header(("Content-Type", get_video_content_type(&file_path)))
                    .insert_header(("Access-Control-Allow-Origin", "*"))
                    .insert_header(("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS"))
                    .insert_header(("Access-Control-Allow-Headers", "Range, Content-Type"))
                    .streaming(stream));
            }
        }
    }
    
    // Full file streaming (fallback)
    // Use massive buffer for local streaming (32MB)
    let stream = ReaderStream::with_capacity(file, 33554432);
    log::debug!(target: "video_server", "full_stream_response; path={}; size={}", 
        file_path, file_size);
    
    Ok(HttpResponse::Ok()
        .insert_header(("Accept-Ranges", "bytes"))
        .insert_header(("Content-Length", file_size.to_string()))
        .insert_header(("Content-Type", get_video_content_type(&file_path)))
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .insert_header(("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS"))
        .insert_header(("Access-Control-Allow-Headers", "Range, Content-Type"))
        .streaming(stream))
}

fn parse_range(range: &str, file_size: u64) -> Option<(u64, u64)> {
    if !range.starts_with("bytes=") {
        return None;
    }
    
    let range = &range[6..]; // Remove "bytes="
    let parts: Vec<&str> = range.split('-').collect();
    
    if parts.len() != 2 {
        return None;
    }
    
    let start = if parts[0].is_empty() {
        0
    } else {
        parts[0].parse::<u64>().ok()?
    };
    
    let end = if parts[1].is_empty() {
        file_size - 1
    } else {
        parts[1].parse::<u64>().ok()?.min(file_size - 1)
    };
    
    if start > end || start >= file_size {
        return None;
    }
    
    Some((start, end))
}

fn get_video_content_type(file_path: &str) -> &'static str {
    if file_path.ends_with(".mp4") {
        "video/mp4"
    } else if file_path.ends_with(".webm") {
        "video/webm"
    } else if file_path.ends_with(".avi") {
        "video/x-msvideo"
    } else if file_path.ends_with(".mov") {
        "video/quicktime"
    } else if file_path.ends_with(".mkv") {
        "video/x-matroska"
    } else {
        "video/mp4" // Default fallback
    }
}

async fn options_handler() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .insert_header(("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS"))
        .insert_header(("Access-Control-Allow-Headers", "Range, Content-Type"))
        .insert_header(("Access-Control-Max-Age", "86400"))
        .body(""))
}

async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "application/json"))
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .body(r#"{"status":"ok","service":"video_streaming"}"#))
}