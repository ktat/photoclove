use tauri::Manager;

use crate::repository::RepositoryDB;
use crate::value::date::*;
use crate::value::file::*;
use crate::domain::photo::*;

mod value;
mod domain;
mod domain_service;
mod repository;

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_dates(
    window: tauri::Window,
    database: tauri::State<repository::db::directory::directory::Directory>,
) -> String {
    println!("get_dats is called from {}", window.label());
    let db = &*database;
    let dates = db.get_dates();
    dates.to_json()
}

#[tauri::command]
fn get_photos(
    date_str: &str,
    window: tauri::Window,
    database: tauri::State<repository::RepoDB>,
) -> String {
    let date = date::Date::from_string(&date_str.to_string());
    println!("get_photos is called from {}", window.label());
    let db = &*database;
    let photos = db.get_photos_in_date(date);
    photos.to_json()
}

#[tauri::command]
fn get_photo_info(
    path_str: &str,
    window: tauri::Window,
    database: tauri::State<repository::RepoDB>,
) -> String {
    let db = &*database;
    let photo = photo::Photo::new(file::File::new(path_str.to_string()));
    db.embed_photo_exif_data(photo);
    // photo.to_json();
    return "{}".to_string()
}

fn main() {
    use domain::config::*;
    use crate::repository::*;
    use crate::repository::db::memory::*;
    use crate::repository::db::sqlite::*;
    use crate::repository::db::directory::*;
    let c = config::Config::new();
    // if c.repository.store == "memory".to_string() {
    //     db = repository::RepoDB::new();
    // } else {
    //     db = repository::RepoDB::new("".to_string());
    // }
    let db = repository::RepoDB::new(c.import_to);
    db.connect();
    tauri::Builder::default()
        .setup(|app| {app.manage(db); Ok(())})
        .invoke_handler(tauri::generate_handler![greet,get_dates,get_photos,get_photo_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
