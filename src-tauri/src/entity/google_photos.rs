use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs::File;
use std::io::Read;

static USER_AGENT: &str = "photoclove/1.0";

pub struct GooglePhotos {
    access_token: String,
    refresh_token: String,
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

static API_END_POINT_URL: &str = "https://photoslibrary.googleapis.com/v1/";

impl GooglePhotos {
    pub fn new(access_token: String, refresh_token: String) -> GooglePhotos {
        GooglePhotos {
            access_token: access_token,
            refresh_token,
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

        let album_response: GooglePhotosAlbumResponse =
            serde_json::from_str(&response.unwrap()).unwrap();
        return album_response;
    }

    pub async fn upload_photo(&self, files: Vec<&str>) {
        let uri = API_END_POINT_URL.to_string() + "uploads";
        eprintln!(" upload_photo !!!!!!!!!!!");

        for f in files {
            let mut file = File::open(f).unwrap();

            // Read the contents of the file into a buffer
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer).unwrap();

            let auth = "Bearer ".to_string() + &self.access_token;
            let client = reqwest::Client::new();
            let response = client
                .post(&uri)
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
                    self.success_response(response, f).await;
                }
                Err(err) => if err.status().unwrap() == reqwest::StatusCode::UNAUTHORIZED {},
            }
        }
    }

    async fn success_response(&self, response: reqwest::Response, f: &str) {
        let mut items_list: Vec<Vec<GoogleNewMediaItem>> = vec![];
        let mut items = vec![];
        let r = response.text().await;
        let item = GoogleSimpleMediaItem {
            file_name: f.to_string(),
            upload_token: r.unwrap(),
        };
        let media_item = GoogleNewMediaItem {
            description: "".to_string(),
            simple_media_item: item,
        };
        items.push(media_item);
        if items.len() == 50 {
            items_list.push(items.clone());
            items = Vec::new();
        }
        if items.len() != 0 {
            items_list.push(items.clone());
        }
        for target_items in items_list {
            eprintln!("{:?}", &target_items);
            let data = GoogleAlbumData {
                new_media_items: target_items,
            };

            let res_post_request = self
                .post_request(
                    "mediaItems:batchCreate",
                    serde_json::to_string(&data).unwrap(),
                )
                .await;
            eprintln!("{:?}", res_post_request);
        }
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

    async fn post_request(&self, path: &str, data: String) -> Result<String, reqwest::Error> {
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
            .unwrap()
            .text()
            .await;
        return response;
    }
}
