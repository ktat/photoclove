use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs::File;
use std::io::Read;
use crate::repository::meta_db::sqlite::SQLite;

static USER_AGENT: &str = "photoclove/1.0";

pub struct GooglePhotos {
    access_token: String,
    refresh_token: String,
    db_path: String,
}

pub struct GooglePhotosAlbum {
    id: String,
    title: String,
    product_url: String,
    is_writeable: bool,
    media_items_count: String,
    cover_photo_base_url: String,
    cover_photo_media_item_id: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GooglePhotosAlbumResponse {
    id: String,
    title: String,
    product_url: String,
    is_writeable: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GooglePhotosAlbumItemForWrite {
    title: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GooglePhotosAlbumForWrite {
    album: GooglePhotosAlbumItemForWrite,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAlbumData {
    new_media_items: Vec<GoogleNewMediaItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleNewMediaItem {
    description: String,
    simple_media_item: GoogleSimpleMediaItem,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleSimpleMediaItem {
    file_name: String,
    upload_token: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleBatchCreateResponse {
    new_media_item_results: Vec<GoogleNewMediaItemResult>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleNewMediaItemResult {
    upload_token: String,
    status: GoogleStatus,
    media_item: Option<GoogleMediaItem>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleStatus {
    message: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleMediaItem {
    id: String,
    product_url: String,
    #[serde(rename = "baseUrl")]
    base_url: Option<String>,
    mime_type: Option<String>,
    filename: Option<String>,
}

static API_END_POINT_URL: &str = "https://photoslibrary.googleapis.com/v1/";

impl GooglePhotos {
    pub fn new(access_token: String, refresh_token: String, db_path: String) -> GooglePhotos {
        GooglePhotos {
            access_token: access_token,
            refresh_token,
            db_path,
        }
    }

    pub async fn get_album(&self, mut album_id: String) -> GooglePhotosAlbum {
        album_id = album_id + ".photoclove";
        let mut path = "albums/".to_string();
        path += &album_id;
        self.get_request(&path).await;
        GooglePhotosAlbum {
            id: todo!(),
            title: todo!(),
            product_url: todo!(),
            is_writeable: todo!(),
            media_items_count: todo!(),
            cover_photo_base_url: todo!(),
            cover_photo_media_item_id: todo!(),
        }
    }

    pub async fn create_album(&self, mut album_id: String) -> GooglePhotosAlbumResponse {
        let album_title = album_id.clone();
        album_id = album_id + ".photoclove";
        let path = "albums";
        let item = GooglePhotosAlbumItemForWrite { title: album_title };
        let data = GooglePhotosAlbumForWrite { album: item };
        let data_string = serde_json::to_string(&data).unwrap();
        let response = self.post_request(&path, data_string).await;

        let album_response: GooglePhotosAlbumResponse = match response {
            Ok(response_text) => serde_json::from_str(&response_text).unwrap(),
            Err(e) => {
                // For now, panic to maintain existing behavior, but ideally this should return a Result
                panic!("Failed to create Google Photos album: {}", e);
            }
        };
        return album_response;
    }

    pub async fn upload_photo(&self, files: Vec<&str>) -> Result<(), String> {
        log::info!(target: "google_photos", "upload_start; files_count={}", files.len());
        
        // Step 1: Upload all files in parallel to collect upload tokens (Google Photos API allows parallel uploads)
        let upload_uri = API_END_POINT_URL.to_string() + "uploads";
        let auth = "Bearer ".to_string() + &self.access_token;
        
        // Create parallel upload tasks
        let upload_tasks: Vec<_> = files.iter().map(|&file_path| {
            let upload_uri = upload_uri.clone();
            let auth = auth.clone();
            let file_path = file_path.to_string();
            
            tokio::spawn(async move {
                log::info!(target: "google_photos", "uploading_file; file={}", file_path);
                
                let mut file = File::open(&file_path).unwrap();
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer).unwrap();

                let client = reqwest::Client::new();
                let response = client
                    .post(&upload_uri)
                    .header(reqwest::header::USER_AGENT, USER_AGENT)
                    .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
                    .header(reqwest::header::AUTHORIZATION, &auth)
                    .header("X-Google-Upload-Content-Type", "image/jpeg")
                    .header("X-Google-Upload-Protocol", "raw")
                    .body(buffer)
                    .send()
                    .await;
                    
                match response {
                    Ok(response) => {
                        let upload_token = response.text().await.unwrap();
                        log::info!(target: "google_photos", "upload_token_received; file={}", file_path);
                        Ok((file_path, upload_token))
                    }
                    Err(err) => {
                        log::error!(target: "google_photos", "upload_failed; file={}; error={:?}", file_path, err);
                        Err(err)
                    }
                }
            })
        }).collect();
        
        // Wait for all upload tasks to complete and collect results
        let mut upload_tokens = Vec::new();
        for task in upload_tasks {
            match task.await {
                Ok(Ok((file_path, upload_token))) => {
                    upload_tokens.push((file_path, upload_token));
                }
                Ok(Err(err)) => {
                    log::error!(target: "google_photos", "upload_task_failed; error={:?}", err);
                }
                Err(join_err) => {
                    log::error!(target: "google_photos", "upload_task_join_failed; error={:?}", join_err);
                }
            }
        }
        
        // Step 2: Batch the upload tokens into groups of 50 and create media items
        const BATCH_SIZE: usize = 50;
        let batches: Vec<&[(String, String)]> = upload_tokens.chunks(BATCH_SIZE).collect();
        
        log::info!(target: "google_photos", "batching_tokens; total_tokens={}; batches={}", upload_tokens.len(), batches.len());
        
        for (batch_index, batch) in batches.iter().enumerate() {
            log::info!(target: "google_photos", "processing_batch; batch={}/{}", batch_index + 1, batches.len());
            
            // Add delay between batches to reduce API load
            if batch_index > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
            
            let mut items = Vec::new();
            for (file_name, upload_token) in batch.iter() {
                let item = GoogleSimpleMediaItem {
                    file_name: file_name.clone(),
                    upload_token: upload_token.clone(),
                };
                let media_item = GoogleNewMediaItem {
                    description: "".to_string(),
                    simple_media_item: item,
                };
                items.push(media_item);
            }
            
            let data = GoogleAlbumData {
                new_media_items: items.clone(),
            };
            
            // Call batchCreate API
            let res_post_request = self
                .post_request(
                    "mediaItems:batchCreate",
                    serde_json::to_string(&data).unwrap(),
                )
                .await;
            
            // Parse the response and store URLs in database
            match res_post_request {
                Ok(response_text) => {
                    log::info!(target: "google_photos", "batch_create_response; batch={}", batch_index + 1);
                    log::debug!(target: "google_photos", "batch_create_raw_response; response={}", response_text);
                    
                    match serde_json::from_str::<GoogleBatchCreateResponse>(&response_text) {
                        Ok(batch_response) => {
                            let sqlite_db = SQLite::new(self.db_path.clone());
                            
                            // Create a mapping from upload_token to file_name
                            let mut token_to_filename: std::collections::HashMap<String, String> = std::collections::HashMap::new();
                            for item in &items {
                                token_to_filename.insert(
                                    item.simple_media_item.upload_token.clone(),
                                    item.simple_media_item.file_name.clone()
                                );
                            }
                            
                            // Process each result
                            for result in batch_response.new_media_item_results {
                                if let Some(media_item) = result.media_item {
                                    if let Some(file_path) = token_to_filename.get(&result.upload_token) {
                                        match sqlite_db.save_google_photos_url(file_path, &media_item.product_url) {
                                            Ok(()) => {
                                                log::info!(target: "google_photos", "url_saved; file={}; url={}", file_path, media_item.product_url);
                                            }
                                            Err(e) => {
                                                log::error!(target: "google_photos", "url_save_failed; file={}; error={}", file_path, e);
                                            }
                                        }
                                    }
                                } else {
                                    log::error!(target: "google_photos", "upload_failed; token={}; message={}", result.upload_token, result.status.message);
                                }
                            }
                        }
                        Err(e) => {
                            let error_msg = format!("Failed to parse Google Photos API response: {}", e);
                            log::error!(target: "google_photos", "batch_create_parse_error; error={}", e);
                            return Err(error_msg);
                        }
                    }
                }
                Err(e) => {
                    let error_msg = format!("Google Photos API request failed: {}", e);
                    log::error!(target: "google_photos", "batch_create_request_failed; batch={}; error={}", batch_index + 1, e);
                    return Err(error_msg);
                }
            }
        }
        
        log::info!(target: "google_photos", "upload_complete; files_processed={}", upload_tokens.len());
        Ok(())
    }


    async fn get_request(&self, path: &str) -> Result<String, reqwest::Error> {
        let uri = API_END_POINT_URL.to_string() + path;
        let auth = "Bearer ".to_string() + &self.access_token;

        let client = reqwest::Client::new();
        let response = client
            .get(&uri)
            .header(reqwest::header::USER_AGENT, USER_AGENT)
            .header(reqwest::header::AUTHORIZATION, &auth)
            .header(reqwest::header::ACCEPT, "application/json")
            .send()
            .await?;

        eprintln!("!!!!!!!!!!!!============== {}", response.status());

        if response.status().is_success() {
            return response.text().await;
        }

        return response.text().await;
    }

    async fn post_request(&self, path: &str, data: String) -> Result<String, String> {
        let uri = API_END_POINT_URL.to_string() + path;
        let auth = "Bearer ".to_string() + &self.access_token;

        let client = reqwest::Client::new();
        let response = client
            .post(&uri)
            .header(reqwest::header::USER_AGENT, USER_AGENT)
            .header(reqwest::header::ACCEPT, "application/json")
            .header(reqwest::header::AUTHORIZATION, &auth)
            .body(data)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        let status = response.status();
        let response_text = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        
        // Check for API errors in the response
        if !status.is_success() || response_text.contains("\"error\"") {
            log::error!(target: "google_photos", "api_error; status={}; response={}", status, response_text);
            return Err(format!("Google Photos API error: {} - {}", status, response_text));
        }
        
        Ok(response_text)
    }
}
