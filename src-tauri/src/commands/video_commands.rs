use crate::commands::video_streaming::VideoServer;
use std::sync::Arc;
use tokio::sync::OnceCell;

static VIDEO_SERVER: OnceCell<Arc<VideoServer>> = OnceCell::const_new();

/// Start the video streaming server (idempotent - safe to call multiple times)
#[tauri::command]
pub async fn start_video_server() -> Result<String, String> {
    let server = VIDEO_SERVER.get_or_try_init(|| async {
        log::info!(target: "video_commands", "initializing_video_server");
        match VideoServer::start().await {
            Ok(server) => Ok(Arc::new(server)),
            Err(e) => {
                log::error!(target: "video_commands", "video_server_start_failed; error={}", e);
                Err(e)
            }
        }
    }).await.map_err(|e| e.clone())?;
    
    if !server.is_running() {
        return Err("Video server failed to start".to_string());
    }
    
    log::info!(target: "video_commands", "video_server_ready; url={}", server.server_url);
    Ok(server.server_url.clone())
}

/// Register a video file for streaming and get the streaming URL
#[tauri::command]
pub async fn register_video_path(video_path: String) -> Result<String, String> {
    let server = VIDEO_SERVER.get()
        .ok_or("Video server not started. Call start_video_server() first.")?;
    
    log::info!(target: "video_commands", "registering_video; path={}", video_path);
    
    match server.register_video(video_path.clone()).await {
        Ok(streaming_url) => {
            log::info!(target: "video_commands", "video_registration_success; path={}; url={}", 
                video_path, streaming_url);
            Ok(streaming_url)
        },
        Err(e) => {
            log::error!(target: "video_commands", "video_registration_failed; path={}; error={}", 
                video_path, e);
            Err(e)
        }
    }
}

/// Get video server status and diagnostics
#[tauri::command]
pub async fn get_video_server_status() -> Result<serde_json::Value, String> {
    if let Some(server) = VIDEO_SERVER.get() {
        let mappings = server.video_mappings.read().await;
        let status = serde_json::json!({
            "running": server.is_running(),
            "url": server.server_url,
            "registered_videos": mappings.len(),
            "registered_paths": mappings.values().collect::<Vec<_>>()
        });
        
        log::debug!(target: "video_commands", "server_status_requested; status={}", status);
        Ok(status)
    } else {
        Ok(serde_json::json!({
            "running": false,
            "error": "Server not initialized"
        }))
    }
}

/// Clear all registered video mappings (for cleanup/testing)
#[tauri::command]
pub async fn clear_video_mappings() -> Result<(), String> {
    if let Some(server) = VIDEO_SERVER.get() {
        let mut mappings = server.video_mappings.write().await;
        let count = mappings.len();
        mappings.clear();
        
        log::info!(target: "video_commands", "video_mappings_cleared; count={}", count);
        Ok(())
    } else {
        Err("Video server not initialized".to_string())
    }
}