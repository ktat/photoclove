use video_server::VideoServer;
use std::sync::Arc;
use tokio::sync::OnceCell;

static VIDEO_SERVER: OnceCell<Arc<VideoServer>> = OnceCell::const_new();

/// Start the video streaming server (idempotent - safe to call multiple times)  
#[tauri::command]
pub async fn start_video_server() -> Result<String, String> {
    let server = VIDEO_SERVER.get_or_try_init(|| async {
        log::info!(target: "video_commands", "initializing_warp_video_server");
        match VideoServer::start().await {
            Ok(server) => {
                log::info!(target: "video_commands", "warp_server_initialized_successfully; port={}", server.get_port());
                Ok(Arc::new(server))
            },
            Err(e) => {
                log::error!(target: "video_commands", "warp_server_initialization_failed; error={}", e);
                Err(e)
            }
        }
    }).await.map_err(|e| e.clone())?;
    
    if !server.is_running() {
        let error_msg = "Warp video server failed to start properly";
        log::error!(target: "video_commands", "server_not_running_after_init");
        return Err(error_msg.to_string());
    }
    
    log::info!(target: "video_commands", "warp_server_ready; url={}", server.server_url);
    Ok(server.server_url.clone())
}

/// Register a video file for streaming and get the streaming URL
#[tauri::command]
pub async fn register_video_path(video_path: String) -> Result<String, String> {
    let server = VIDEO_SERVER.get()
        .ok_or("Warp video server not started. Call start_video_server() first.")?;
    
    log::debug!(target: "video_commands", "registering_video_with_warp; path={}", video_path);
    
    match server.register_video(video_path.clone()).await {
        Ok(streaming_url) => {
            log::info!(target: "video_commands", "warp_video_registration_success; path={}; url={}", 
                video_path, streaming_url);
            Ok(streaming_url)
        },
        Err(e) => {
            log::error!(target: "video_commands", "warp_video_registration_failed; path={}; error={}", 
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
            "port": server.get_port(),
            "server_type": "warp",
            "registered_videos": mappings.len(),
            "os_assigned_port": server.get_port() > 0
        });
        
        log::debug!(target: "video_commands", "warp_server_status; status={}", status);
        Ok(status)
    } else {
        Ok(serde_json::json!({
            "running": false,
            "server_type": "warp",
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
        
        log::info!(target: "video_commands", "warp_video_mappings_cleared; count={}", count);
        Ok(())
    } else {
        Err("Warp video server not initialized".to_string())
    }
}

/// Shutdown the video server (for cleanup/restart scenarios)
#[tauri::command]
pub async fn shutdown_video_server() -> Result<String, String> {
    if let Some(server) = VIDEO_SERVER.get() {
        server.shutdown().await?;
        log::info!(target: "video_commands", "video_server_shutdown_requested");
        Ok("Video server shutdown successfully".to_string())
    } else {
        Err("Video server not initialized".to_string())
    }
}

/// Get detailed server statistics for debugging
#[tauri::command] 
pub async fn get_video_server_stats() -> Result<serde_json::Value, String> {
    if let Some(server) = VIDEO_SERVER.get() {
        let stats = server.get_stats().await;
        log::debug!(target: "video_commands", "server_stats_requested; stats={}", stats);
        Ok(stats)
    } else {
        Ok(serde_json::json!({
            "running": false,
            "error": "Server not initialized",
            "server_type": "warp"
        }))
    }
}