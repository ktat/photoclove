use warp::Filter;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::path::{Path, PathBuf};
use base64::Engine;
use tokio::io::{AsyncSeekExt, AsyncReadExt};
use warp::http::{StatusCode, HeaderMap, HeaderValue};
use tokio::task::JoinHandle;
use tokio_util::io::ReaderStream;
use futures_util::stream::StreamExt;

#[derive(Debug)]
struct StreamingError;

impl warp::reject::Reject for StreamingError {}

pub struct VideoServer {
    pub server_url: String,
    pub video_mappings: Arc<tokio::sync::RwLock<HashMap<String, PathBuf>>>,
    pub is_running: Arc<AtomicBool>,
    pub port: Arc<AtomicU16>,
    pub server_handle: Arc<tokio::sync::Mutex<Option<JoinHandle<()>>>>,
}

impl VideoServer {
    pub async fn start() -> Result<Self, String> {
        let mappings = Arc::new(tokio::sync::RwLock::new(HashMap::new()));
        let is_running = Arc::new(AtomicBool::new(false));
        let port = Arc::new(AtomicU16::new(0));
        let server_handle = Arc::new(tokio::sync::Mutex::new(None));

        // Clone for async move
        let mappings_clone = mappings.clone();
        let is_running_clone = is_running.clone();
        let port_clone = port.clone();

        // Start warp server in background and capture JoinHandle
        let handle = tokio::spawn(async move {
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

        // Store the JoinHandle
        *server_handle.lock().await = Some(handle);

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
            server_handle,
        })
    }

    pub async fn register_video(&self, video_path: String) -> Result<String, String> {
        // Canonicalize path for security (prevent directory traversal)
        let path = PathBuf::from(&video_path);
        let canonical_path = path.canonicalize()
            .map_err(|e| format!("Failed to resolve path '{}': {}", video_path, e))?;

        // Verify file exists and is accessible
        if !canonical_path.exists() {
            return Err(format!("Video file not found: {}", video_path));
        }
        if !canonical_path.is_file() {
            return Err(format!("Path is not a file: {}", video_path));
        }

        // Additional security: verify it's a video file
        let extension = canonical_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !matches!(extension.as_str(), "mp4" | "webm" | "avi" | "mov" | "mkv" | "m4v" | "3gp" | "flv") {
            return Err(format!("File is not a supported video format: {}", video_path));
        }

        // Use base64 encoding of canonical path as video ID
        let canonical_path_str = canonical_path.to_string_lossy().to_string();
        let video_id = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&canonical_path_str);

        // Store mapping with canonical path
        let mut mappings = self.video_mappings.write().await;
        mappings.insert(video_id.clone(), canonical_path.clone());

        let streaming_url = format!("{}/video/{}", self.server_url, video_id);

        log::info!(target: "video_server", "video_registered; original={}; canonical={:?}; url={}",
            video_path, canonical_path, streaming_url);

        Ok(streaming_url)
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    pub fn get_port(&self) -> u16 {
        self.port.load(Ordering::Relaxed)
    }

    /// Gracefully shutdown the video server
    pub async fn shutdown(&self) -> Result<(), String> {
        log::info!(target: "video_server", "shutting_down_server");

        // Mark server as not running
        self.is_running.store(false, Ordering::Relaxed);

        // Abort the server task
        let mut handle_guard = self.server_handle.lock().await;
        if let Some(handle) = handle_guard.take() {
            handle.abort();
            log::info!(target: "video_server", "server_task_aborted");
        }

        // Clear video mappings
        let mut mappings = self.video_mappings.write().await;
        mappings.clear();

        log::info!(target: "video_server", "server_shutdown_complete");
        Ok(())
    }

    /// Get server statistics for debugging
    pub async fn get_stats(&self) -> serde_json::Value {
        let mappings = self.video_mappings.read().await;
        serde_json::json!({
            "running": self.is_running(),
            "port": self.get_port(),
            "server_url": self.server_url,
            "registered_videos": mappings.len(),
            "has_server_handle": self.server_handle.lock().await.is_some(),
        })
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

                // Create streaming response with content-length (enables precise seeking)
                let stream = ReaderStream::with_capacity(file.take(content_length), 65536);
                let body_stream = stream.map(|result| {
                    result.map_err(|e| {
                        log::error!(target: "video_server", "stream_read_error; error={:?}", e);
                        e
                    })
                });

                log::info!(target: "video_server", "range_response_stream; start={}; end={}; size={}",
                    start, end, content_length);

                let response = warp::http::Response::builder()
                    .status(StatusCode::PARTIAL_CONTENT)
                    .header("content-range", format!("bytes {}-{}/{}", start, end, file_size))
                    .header("accept-ranges", "bytes")
                    .header("content-length", content_length.to_string())
                    .header("content-type", get_video_content_type(&file_path))
                    .body(warp::hyper::Body::wrap_stream(body_stream))
                    .map_err(|_| warp::reject::custom(StreamingError))?;

                return Ok(Box::new(response));
            }
        }
    }

    // Full file streaming response (avoids loading entire file into memory)
    log::info!(target: "video_server", "full_file_response; size={}", file_size);

    let stream = ReaderStream::with_capacity(file, 65536);
    let body_stream = stream.map(|result| {
        result.map_err(|e| {
            log::error!(target: "video_server", "stream_read_error; error={:?}", e);
            e
        })
    });

    let response = warp::http::Response::builder()
        .status(StatusCode::OK)
        .header("accept-ranges", "bytes")
        .header("content-length", file_size.to_string())
        .header("content-type", get_video_content_type(&file_path))
        .header("cache-control", "public, max-age=3600")
        .body(warp::hyper::Body::wrap_stream(body_stream))
        .map_err(|_| warp::reject::custom(StreamingError))?;

    Ok(Box::new(response))
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

fn get_video_content_type(file_path: &Path) -> HeaderValue {
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
