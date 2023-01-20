use crate::domain_service::file_service;
use domain::config::Config;
use std::{
    fs,
    future::Future,
    path,
    sync::{Arc, Mutex},
    thread,
};
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, Submenu};

use crate::domain::importer;
use crate::domain::*;
use crate::repository::RepositoryDB;
use crate::repository::*;
use crate::value::*;

mod domain;
mod domain_service;
mod repository;
mod value;

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

struct AppState {
    repo_db: repository::RepoDB,
    import_progress: Mutex<importer::ImportProgress>,
    config: Config,
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_dates(window: tauri::Window, state: tauri::State<AppState>) -> String {
    println!("get_dats is called from {}", window.label());
    let db = &state.repo_db;
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
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let db = &state.repo_db;
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
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let db = &state.repo_db;
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
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let db = &state.repo_db;
    let photo = db.get_prev_photo_in_date(path, date, repository::sort_from_int(sort_value));
    if photo.is_some() {
        let f = photo.unwrap().file.path;
        // println!("path: {}", f);
        return f;
    } else {
        return "".to_string();
    }
}

#[tauri::command]
fn get_photo_info(path_str: &str, window: tauri::Window, state: tauri::State<AppState>) -> String {
    let db = &state.repo_db;
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
    let cp: String;
    if path_str.is_none() || path_str.unwrap() == "" {
        path = &state.config.export_from[0];
    } else {
        let p = path_str.unwrap();
        let cpp = fs::canonicalize(path::Path::new(p));
        if cpp.is_err() {
            path = "/";
        } else {
            cp = cpp.unwrap().display().to_string();
            path = cp.as_str();
        }
    }
    let mut importer = importer::Importer::new(path.to_string(), page, num);
    importer.paths = state.config.export_from.clone();
    let json = serde_json::to_string(&importer).unwrap();
    // println!("{:?}", &json);
    return json;
}

#[tauri::command]
fn import_photos(files: Vec<&str>, state: tauri::State<'_, AppState>) {
    // When now importing, do nothing.
    if state.import_progress.lock().unwrap().now_importing {
        eprintln!("now importing ...");
        return;
    }
    let c = Config::new();
    let import_dir = file::Dir::new(c.import_to.to_string());
    let arc_path = Arc::new(path::PathBuf::from(import_dir.path));
    let np = state.config.copy_parallel.clone();
    let mut importer_selected = importer::ImporterSelectedFiles::new();
    for file in files {
        importer_selected.add_photo_file(file::File::new(file.to_string()));
    }
    importer_selected.import_photos(
        &state.repo_db,
        arc_path,
        np,
        Arc::new(&state.import_progress),
    );
}

#[tauri::command]
fn get_import_progress(state: tauri::State<AppState>) -> String {
    let ip = &state.import_progress;
    let num = ip.lock().unwrap().num;
    let finished = ip.lock().unwrap().get_import_progress();

    let mut locked = ip.lock().unwrap();
    if num <= finished {
        locked.reset_import_progress();
    } else {
        locked.progress = finished;
        locked.num_per_sec = (locked.num - locked.progress) as f32 / locked.current_time as f32;
    }
    drop(locked);
    return serde_json::to_string(ip).unwrap();
}

#[tauri::command]
fn get_photos_path_to_import_under_directory(
    pathStr: &str,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let d = dir::Dir::new(pathStr.to_string());
    let files = d.find_all_files();
    let mut ret_files: Vec<String> = Vec::new();
    for f in files.files {
        ret_files.push(f.path);
    }
    return serde_json::to_string(&ret_files).unwrap();
}

#[tauri::command]
fn move_to_trash(
    path_str: &str,
    date_str: &str,
    sort_value: i32,
    state: tauri::State<AppState>,
) -> Option<String> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let db = &state.repo_db;
    let mut photo =
        db.get_next_photo_in_date(path_str, date, repository::sort_from_int(sort_value));
    if photo.is_none() {
        let date = date::Date::from_string(&date_str.to_string(), Option::None);
        photo = db.get_prev_photo_in_date(path_str, date, repository::sort_from_int(sort_value));
    }
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());
    file_service::move_to_trash(file, trash);

    if photo.is_none() {
        return Option::None;
    } else {
        return Option::Some(photo.unwrap().file.path);
    }
}
fn main() {
    use crate::repository::*;
    let c = config::Config::new();
    // if c.repository.store == "memory".to_string() {
    //     db = repository::RepoDB::new();
    // } else {
    //     db = repository::RepoDB::new("".to_string());
    // }
    let ip: importer::ImportProgress = importer::ImportProgress::new();
    let state = AppState {
        repo_db: repository::RepoDB::new(c.import_to.to_string()),
        import_progress: Mutex::new(ip),
        config: c,
    };

    let menu: Menu;
    {
        let load_dates = CustomMenuItem::new("load_dates".to_string(), "Load Date List");
        let import = CustomMenuItem::new("import".to_string(), "Import");
        let quit = CustomMenuItem::new("quit".to_string(), "Quit");
        let about = CustomMenuItem::new("about".to_string(), "About");
        let github = CustomMenuItem::new("github".to_string(), "Github");
        let submenu = Submenu::new(
            "File",
            Menu::new()
                .add_item(load_dates)
                .add_item(import)
                .add_item(quit),
        );
        let help_submenu = Submenu::new("?", Menu::new().add_item(github).add_item(about));

        menu = Menu::new()
            .add_native_item(MenuItem::Copy)
            .add_submenu(submenu)
            .add_submenu(help_submenu);
    };

    state.repo_db.connect();
    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| match event.menu_item_id() {
            "quit" => {
                eprintln!("{:?}", event);
                std::process::exit(0);
            }
            "close" => {
                eprintln!("{:?}", event);
                event.window().close().unwrap();
            }
            "about" => {
                eprintln!("{:?}", event);
                event
                    .window()
                    .emit_all("click_menu_static", "about")
                    .unwrap();
            }
            "github" => {
                eprintln!("{:?}", event);
                event
                    .window()
                    .emit_all("click_menu_static", "github")
                    .unwrap();
            }
            "load_dates" => {
                eprintln!("{:?}", event);
                event.window().emit_all("click_menu", "load_dates").unwrap();
            }
            "import" => {
                eprintln!("{:?}", event);
                event.window().emit_all("click_menu", "import").unwrap();
            }
            e => {
                eprintln!("{:?}", e);
            }
        })
        .setup(|app| {
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_dates,
            get_photos,
            get_photo_info,
            get_next_photo,
            get_prev_photo,
            show_importer,
            import_photos,
            get_import_progress,
            get_photos_path_to_import_under_directory,
            move_to_trash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
