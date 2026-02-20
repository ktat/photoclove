use warp::Filter;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::path::PathBuf;
use base64::Engine;
use tokio::io::{AsyncSeekExt, AsyncReadExt};
use warp::http::{StatusCode, HeaderMap, HeaderValue};

pub struct VideoServer {
    pub server_url: String,
    pub video_mappings: Arc<tokio::sync::RwLock<HashMap<String, PathBuf>>>,
    pub is_running: Arc<AtomicBool>,
    pub port: Arc<AtomicU16>,
}

impl VideoServer {
    pub async fn start() -> Result<Self, String> {
        let mappings = Arc::new(tokio::sync::RwLock::new(HashMap::new()));
        let is_running = Arc::new(AtomicBool::new(false));
        let port = Arc::new(AtomicU16::new(0));
        
        // Clone for async move
        let mappings_clone = mappings.clone();
        let is_running_clone = is_running.clone();
        let port_clone = port.clone();
        
        // Start warp server in background using tokio::spawn for non-blocking execution
        tokio::spawn(async move {
            // Create CORS filter
            let cors = warp::cors()
                .allow_any_origin()
                .allow_headers(vec!["content-type", "range"])
                .allow_methods(vec!["GET", "HEAD", "OPTIONS"]);
            
            // Video file serving route with Range Request support
            let video_route = warp::path("video")
                .and(warp::path::param::<String>())
                .and(warp::get())
                .and(warp::header::headers_cloned())
                .and(with_mappings(mappings_clone.clone()))
                .and_then(serve_video_file)
                .with(cors.clone());
            
            // Health check route
            let health_route = warp::path("health")
                .and(warp::get())
                .map(|| {
                    warp::reply::json(&serde_json::json!({
                        "status": "ok",
                        "service": "video_streaming_warp"
                    }))
                })
                .with(cors);
            
            let routes = video_route.or(health_route);
            
            // Bind to port 0 for automatic OS assignment
            let server = warp::serve(routes);
            let (addr, server_future) = server.bind_ephemeral(std::net::SocketAddr::from(([127, 0, 0, 1], 0)));
            
            let assigned_port = addr.port();
            port_clone.store(assigned_port, Ordering::Relaxed);
            is_running_clone.store(true, Ordering::Relaxed);
            
            log::info!(target: "video_server", "warp_server_started; port={}", assigned_port);
            
            // Run the server
            server_future.await;
            
            is_running_clone.store(false, Ordering::Relaxed);
            log::info!(target: "video_server", "warp_server_stopped");
        });
        
        // Wait for server to start and get assigned port
        let mut attempts = 0;
        while !is_running.load(Ordering::Relaxed) && attempts < 50 {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            attempts += 1;
        }
        
        if !is_running.load(Ordering::Relaxed) {
            return Err("Failed to start video server".to_string());
        }
        
        let assigned_port = port.load(Ordering::Relaxed);
        let server_url = format!("http://127.0.0.1:{}", assigned_port);
        
        Ok(Self {
            server_url,
            video_mappings: mappings,
            is_running,
            port,
        })
    }
    
    pub async fn register_video(&self, video_path: String) -> Result<String, String> {
        // Verify file exists and is accessible
        let path = PathBuf::from(&video_path);
        if !path.exists() {
            return Err(format!("Video file not found: {}", video_path));
        }
        if !path.is_file() {
            return Err(format!("Path is not a file: {}", video_path));
        }
        
        // Use base64 encoding of path as video ID
        let video_id = base64::engine::general_purpose::STANDARD.encode(&video_path);
        
        // Store mapping
        let mut mappings = self.video_mappings.write().await;
        mappings.insert(video_id.clone(), path);
        
        let streaming_url = format!("{}/video/{}", self.server_url, video_id);
        
        log::info!(target: "video_server", "video_registered; path={}; url={}", video_path, streaming_url);
        
        Ok(streaming_url)
    }
    
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }
    
    pub fn get_port(&self) -> u16 {
        self.port.load(Ordering::Relaxed)
    }
}

// Warp filter helper for dependency injection
fn with_mappings(
    mappings: Arc<tokio::sync::RwLock<HashMap<String, PathBuf>>>,
) -> impl Filter<Extract = (Arc<tokio::sync::RwLock<HashMap<String, PathBuf>>>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || mappings.clone())
}

// Handler function for serving video files with Range Request support
async fn serve_video_file(
    video_id: String,
    headers: HeaderMap,
    mappings: Arc<tokio::sync::RwLock<HashMap<String, PathBuf>>>,
) -> Result<Box<dyn warp::Reply>, warp::Rejection> {
    let mappings_read = mappings.read().await;
    
    let file_path = match mappings_read.get(&video_id) {
        Some(path) => path.clone(),
        None => {
            log::warn!(target: "video_server", "video_not_found; video_id={}", video_id);
            return Err(warp::reject::not_found());
        }
    };
    
    // Verify file still exists
    if !file_path.exists() {
        log::warn!(target: "video_server", "video_file_missing; path={:?}", file_path);
        return Err(warp::reject::not_found());
    }
    
    log::debug!(target: "video_server", "serving_video_file; path={:?}", file_path);
    
    // Open file and get metadata
    let mut file = tokio::fs::File::open(&file_path).await
        .map_err(|e| {
            log::error!(target: "video_server", "file_open_error; path={:?}; error={:?}", file_path, e);
            warp::reject::not_found()
        })?;
    
    let metadata = file.metadata().await
        .map_err(|_| warp::reject::not_found())?;
    
    let file_size = metadata.len();
    
    // Check for Range header
    if let Some(range_header) = headers.get("range") {
        if let Ok(range_str) = range_header.to_str() {
            log::debug!(target: "video_server", "range_request; range={}", range_str);
            
            if let Some((start, end)) = parse_range(range_str, file_size) {
                // Seek to start position
                file.seek(std::io::SeekFrom::Start(start)).await
                    .map_err(|_| warp::reject::not_found())?;
                
                let content_length = end - start + 1;
                let mut buffer = vec![0u8; content_length as usize];
                
                file.read_exact(&mut buffer).await
                    .map_err(|_| warp::reject::not_found())?;
                
                
                log::info!(target: "video_server", "range_response; start={}; end={}; size={}", start, end, content_length);
                
                let reply = warp::reply::with_status(buffer, StatusCode::PARTIAL_CONTENT);
                let reply = warp::reply::with_header(reply, "content-range", 
                    format!("bytes {}-{}/{}", start, end, file_size));
                let reply = warp::reply::with_header(reply, "accept-ranges", "bytes");
                let reply = warp::reply::with_header(reply, "content-length", content_length.to_string());
                let reply = warp::reply::with_header(reply, "content-type", get_video_content_type(&file_path));
                
                return Ok(Box::new(reply));
            }
        }
    }
    
    // Full file response
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).await
        .map_err(|_| warp::reject::not_found())?;
    
    log::info!(target: "video_server", "full_file_response; size={}", file_size);
    
    let reply = warp::reply::with_header(buffer, "accept-ranges", "bytes");
    let reply = warp::reply::with_header(reply, "content-length", file_size.to_string());
    let reply = warp::reply::with_header(reply, "content-type", get_video_content_type(&file_path));
    let reply = warp::reply::with_header(reply, "cache-control", "public, max-age=3600");
    
    Ok(Box::new(reply))
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

fn get_video_content_type(file_path: &PathBuf) -> HeaderValue {
    let path_str = file_path.to_string_lossy();
    if path_str.ends_with(".mp4") {
        HeaderValue::from_static("video/mp4")
    } else if path_str.ends_with(".webm") {
        HeaderValue::from_static("video/webm")
    } else if path_str.ends_with(".avi") {
        HeaderValue::from_static("video/x-msvideo")
    } else if path_str.ends_with(".mov") {
        HeaderValue::from_static("video/quicktime")
    } else if path_str.ends_with(".mkv") {
        HeaderValue::from_static("video/x-matroska")
    } else {
        HeaderValue::from_static("video/mp4") // Default fallback
    }
}