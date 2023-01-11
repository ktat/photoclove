use std::ops::{Deref,DerefMut};

use domain::config::Config;
use tauri::Manager;

use crate::repository::*;
use crate::domain::importer;
use crate::repository::RepositoryDB;
use crate::value::*;
use crate::domain::*;

mod value;
mod domain;
mod domain_service;
mod repository;

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

struct AppState {
    database: repository::RepoDB,
    importer: importer::Importer,
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_dates(
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    println!("get_dats is called from {}", window.label());
    let db = &state.database;
    let dates = db.get_dates();
    dates.to_json()
}

#[tauri::command]
fn get_photos(
    date_str: &str,
    page: u32,
    sort_value: i32,
    num: u32,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let date = date::Date::from_string(&date_str.to_string());
    println!("get_photos is called from {}", window.label());
    let db = &state.database;
    let photos = db.get_photos_in_date(date, repository::sort_from_int(sort_value), num, page);
    photos.to_json()
}

#[tauri::command]
fn get_next_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let date = date::Date::from_string(&date_str.to_string());
    println!("get_photos is called from {}", window.label());
    let db = &state.database;
    let photo = db.get_next_photo_in_date(path, date, repository::sort_from_int(sort_value));
    if photo.is_some() {
        return photo.unwrap().file.path;
    } else {
        return "".to_string();
    }
}

#[tauri::command]
fn get_prev_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let date = date::Date::from_string(&date_str.to_string());
    println!("get_photos is called from {}", window.label());
    let db = &state.database;
    let photo = db.get_prev_photo_in_date(path, date, repository::sort_from_int(sort_value));
    if photo.is_some() {
        let f = photo.unwrap().file.path;
        println!("path: {}", f);
        return f;
    } else {
        return "".to_string();
    }
}

#[tauri::command]
fn get_photo_info(
    path_str: &str,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let db = &state.database;
    let photo = photo::Photo::new(file::File::new(path_str.to_string()));
    let meta = meta::MetaData::new(photo.file);
    let json = serde_json::to_string(&meta).unwrap();
    return json;
}

#[tauri::command]
fn show_importer(
    path_str: Option<&str>,
    window: tauri::Window,
    page: u32,
    num: u32,
    state: tauri::State<AppState>,
) -> String {
    let mut path = "";
    let c = Config::new();
    if path_str.is_none() || path_str.unwrap() == "" {
        path = c.export_from.as_str();
    } else {
        path = path_str.unwrap();
    }
    let importer = importer::Importer::new(path.to_string(), page, num);
    let json = serde_json::to_string(&importer).unwrap();
    return json;
}

#[tauri::command]
fn import_photos(
    files: Vec<&str>,
    state: tauri::State<AppState>,
) {
    let importer = &state.importer;
    let c = Config::new();
    let import_dir = file::Dir::new(c.import_to.to_string());
    let path = &importer.dirs_files.dir.path;
    let mut importer = importer::Importer::new(path.to_string(), importer.page, importer.num);
    for file in files {
        importer.add_photo_file(file::File::new(file.to_string()));
    }
    importer.import_photos(import_dir);
}

#[tauri::command]
fn select_file(
    selected: Vec<&str>,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let importer = &state.importer;
    let path = &importer.dirs_files.dir.path;
    let mut importer = importer::Importer::new(path.to_string(), importer.page, importer.num);
    for path in selected {
        importer.add_photo_file(file::File::new(path.to_string()));
    }
    let json = serde_json::to_string(&state.importer).unwrap();
    return json;
}

fn main() {
    use domain::config;
    use crate::repository::*;
    let c = config::Config::new();
    // if c.repository.store == "memory".to_string() {
    //     db = repository::RepoDB::new();
    // } else {
    //     db = repository::RepoDB::new("".to_string());
    // }
    let mut state = AppState {
         database: repository::RepoDB::new(c.import_to),
         importer: importer::Importer::new(c.export_from, 1, 20),
    };
    state.database.connect();
    tauri::Builder::default()
        .setup(|app| {app.manage(state); Ok(())})
        .invoke_handler(tauri::generate_handler![
            greet,get_dates,
            get_photos,
            get_photo_info,
            get_next_photo,
            get_prev_photo,
            show_importer,
            select_file,
            import_photos,
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
