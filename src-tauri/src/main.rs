use crate::domain::importer;
use crate::domain::*;
use crate::domain_service::{file_service, photo_service};
use crate::repository::RepositoryDB;
use crate::repository::*;
use crate::value::*;
use domain::config::Config;
use std::sync::atomic::{AtomicBool, Ordering};
use std::{
    fs, path,
    sync::{Arc, Mutex},
    thread,
};
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, Submenu};

mod domain;
mod domain_service;
mod repository;
mod value;

static IN_LOCKING: AtomicBool = AtomicBool::new(false);

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

struct AppState {
    repo_db: repository::RepoDB,
    meta_db: repository::MetaDB,
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
async fn get_dates_num(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    dates_str: &str,
) -> Result<String, ()> {
    let mut dates = date::Dates::empty();
    eprintln!("{:?}", dates_str);
    let splitted = dates_str.split(",");
    for date_tupple in splitted.enumerate() {
        let date_str = date_tupple.1;
        eprintln!("{:?}", date_str);
        dates.dates.push(date::Date::from_string(
            &date_str.to_string(),
            Option::Some("-"),
        ));
    }
    let meta_db = &state.meta_db;
    let db = &state.repo_db;
    let meta_data = meta_db.get_photo_count_per_dates(dates.clone());
    let dates_num = db.get_photo_count_per_dates(dates, meta_data);
    Ok(dates_num.to_json())
}

#[tauri::command]
async fn copy_file_to_public(
    from_file_path: &str,
    to_file_name: &str,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let from = path::Path::new(from_file_path);
    let to = path::Path::new("../public/").join(to_file_name.to_string());
    eprintln!("{:?} => {:?}", from, to);

    return match std::fs::copy(from, to) {
        Ok(_) => Ok("true".to_string()),
        Err(e) => {
            eprintln!("{:?}", e);
            Ok("false".to_string())
        }
    };
}

#[tauri::command]
async fn get_photos(
    date_str: &str,
    page: u32,
    sort_value: i32,
    num: u32,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(e) => photo_meta::PhotoMetas::new(),
    };
    let photos = repo_db
        .get_photos_in_date(
            &meta_data,
            date,
            repository::sort_from_int(sort_value),
            num,
            page,
        )
        .await;
    Ok(photos.to_json())
}

#[tauri::command]
async fn get_next_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(e) => photo_meta::PhotoMetas::new(),
    };
    let photo = repo_db
        .get_next_photo_in_date(
            &meta_data,
            path,
            date,
            repository::sort_from_int(sort_value),
        )
        .await;
    if photo.is_some() {
        return Ok(photo.unwrap().file.path);
    } else {
        return Ok("".to_string());
    }
}

#[tauri::command]
async fn get_prev_photo(
    path: &str,
    date_str: &str,
    sort_value: i32,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    println!("get_photos is called from {}", window.label());
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(e) => photo_meta::PhotoMetas::new(),
    };
    let photo = repo_db
        .get_prev_photo_in_date(
            &meta_data,
            path,
            date,
            repository::sort_from_int(sort_value),
        )
        .await;
    if photo.is_some() {
        let f = photo.unwrap().file.path;
        // println!("path: {}", f);
        return Ok(f);
    } else {
        return Ok("".to_string());
    }
}

#[tauri::command]
fn get_photo_info(path_str: &str, window: tauri::Window, state: tauri::State<AppState>) -> String {
    match file::File::new_if_exists(path_str.to_string()) {
        Some(f) => {
            let photo = photo::Photo::new(f);
            let exif_data = exif::ExifData::new(photo.file.clone());
            let photo_meta = photo_meta::PhotoMeta::new_with_data(photo, &state.meta_db);
            let photo_meta_with_exif = photo_meta::PhotoMetaWithExif::new(photo_meta, exif_data);
            let json = serde_json::to_string(&photo_meta_with_exif).unwrap();
            return json;
        }
        None => {
            return "{}".to_string();
        }
    }
}

#[tauri::command]
fn save_star(window: tauri::Window, state: tauri::State<AppState>, path_str: &str, star_num: i32) {
    let db = &state.meta_db;
    let photo = photo::Photo::new(file::File::new(path_str.to_string()));
    let star = star::Star::new(star_num);
    photo_service::save_photo_star(db, &photo, star);
}

#[tauri::command]
fn save_comment(
    window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    comment_str: &str,
) {
    let db = &state.meta_db;
    let comment = comment::Comment::new(comment_str);
    let photo = photo::Photo::new(file::File::new(path_str.to_string()));
    photo_service::save_photo_comment(db, &photo, comment);
}

#[tauri::command]
fn show_importer(
    path_str: Option<&str>,
    date_str: Option<&str>,
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
    let filter: Option<date::Date>;
    if date_str.is_none() || date_str.unwrap() == "" {
        filter = Option::None;
    } else {
        let date = date::Date::from_string(&date_str.unwrap().to_string(), Option::Some("-"));
        filter = Option::Some(date);
    }

    let mut importer = importer::Importer::new(path.to_string(), page, num, filter);
    importer.set_importer_paths(state.config.export_from.clone());

    let json = serde_json::to_string(&importer).unwrap();
    // println!("{:?}", &json);
    return json;
}

#[tauri::command]
async fn import_photos(
    window: tauri::Window,
    files: Vec<&str>,
    state: tauri::State<'_, AppState>,
) -> Result<bool, ()> {
    // When now importing, do nothing.
    if state.import_progress.lock().unwrap().now_importing {
        eprintln!("now importing ...");
        return Ok(false);
    }
    let c = Config::new();
    let arc_trash_path = Arc::new(path::PathBuf::from(c.trash_path.to_string()));
    let arc_import_path = Arc::new(path::PathBuf::from(c.import_to.to_string()));
    let np = state.config.copy_parallel.clone();
    let mut importer_selected = importer::ImporterSelectedFiles::new();
    for file in files {
        importer_selected.add_photo_file(file::File::new(file.to_string()));
    }
    let result = importer_selected.import_photos(
        &window,
        &state.repo_db,
        &state.meta_db,
        arc_import_path,
        arc_trash_path,
        np,
        Arc::new(&state.import_progress),
    );
    if result {
        window.emit_all("import", "finish");
    }
    return Ok(result);
}

#[tauri::command]
fn get_import_progress(state: tauri::State<AppState>) -> String {
    let ip = &state.import_progress;
    let num = ip.lock().unwrap().num;
    let finished = ip.lock().unwrap().get_import_progress();
    return serde_json::to_string(ip).unwrap();
}

#[tauri::command]
fn get_photos_path_to_import_under_directory(
    pathStr: &str,
    date_after_str: Option<&str>,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> String {
    let d = dir::Dir::new(pathStr.to_string());
    let filter: Option<date::Date>;
    if date_after_str.is_none() || date_after_str.unwrap() == "" {
        filter = Option::None;
    } else {
        let date = date::Date::from_string(&date_after_str.unwrap().to_string(), Option::Some("-"));
        filter = Option::Some(date);
    }

    let files = d.find_all_files(filter);
    let mut ret_files: Vec<String> = Vec::new();
    for f in files.files {
        ret_files.push(f.path);
    }
    return serde_json::to_string(&ret_files).unwrap();
}

#[tauri::command]
async fn move_photos_to_exif_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    window.emit("move_files", "start");
    eprintln!("target date: {:?}", date);
    let dates = state.repo_db.move_photos_to_exif_date(date).await;
    eprintln!("date: {:?}", dates);
    window.emit("move_files", "end_move");
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("move_files", "finish");
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("move_files", "faile");
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_db(window: tauri::Window, state: tauri::State<'_, AppState>) -> Result<String, ()> {
    let dates = state.repo_db.get_dates();
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("create_db", "finish");
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_db", "failed");
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_db_in_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    let dates = date::Dates::new(&[date]);
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("create_db", "finish");
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_db", "failed");
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> String {
    let new_config = Config::new();
    serde_json::to_string(&new_config).unwrap()
}

#[tauri::command]
fn save_config(state: tauri::State<AppState>, config: Config) -> String {
    if config.save() {
        return "{result: true}".to_string();
    } else {
        return "{result: false}".to_string();
    }
}

// to avoid event happens twice in same time.
#[tauri::command]
fn lock(t: bool) -> bool {
    if !t {
        IN_LOCKING.store(false, Ordering::SeqCst);
        return true;
    } else {
        if IN_LOCKING.load(Ordering::SeqCst) {
            return false;
        } else {
            IN_LOCKING.store(true, Ordering::SeqCst);
            return true;
        }
    }
}

#[tauri::command]
async fn move_to_trash(
    path_str: &str,
    date_str: &str,
    sort_value: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(e) => photo_meta::PhotoMetas::new(),
    };
    let mut photo = repo_db
        .get_next_photo_in_date(
            &meta_data,
            path_str,
            date,
            repository::sort_from_int(sort_value),
        )
        .await;
    if photo.is_none() {
        let date = date::Date::from_string(&date_str.to_string(), Option::None);
        photo = repo_db
            .get_prev_photo_in_date(
                &meta_data,
                path_str,
                date,
                repository::sort_from_int(sort_value),
            )
            .await;
    }
    eprintln!("to Trash: {:?}", path_str);
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());
    file_service::move_to_trash(file, trash);

    if photo.is_none() {
        return Ok(Option::None);
    } else {
        return Ok(Option::Some(photo.unwrap().file.path));
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
        meta_db: repository::MetaDB::new(c.import_to.to_string()),
        import_progress: Mutex::new(ip),
        config: c,
    };

    let menu: Menu;
    {
        let load_dates = CustomMenuItem::new("load_dates".to_string(), "Load Date List");
        let import = CustomMenuItem::new("import".to_string(), "Import");
        let create_db = CustomMenuItem::new("create_db".to_string(), "Create DB");
        let quit = CustomMenuItem::new("quit".to_string(), "Quit");
        let pref = CustomMenuItem::new("pref".to_string(), "Preferences");
        let about = CustomMenuItem::new("about".to_string(), "About");
        let github = CustomMenuItem::new("github".to_string(), "Github");
        let submenu = Submenu::new(
            "File",
            Menu::new()
                .add_item(load_dates)
                .add_item(import)
                .add_item(create_db)
                .add_item(pref)
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
                std::process::exit(0);
            }
            "close" => {
                event.window().close().unwrap();
            }
            "about" => {
                event
                    .window()
                    .emit_all("click_menu_static", "about")
                    .unwrap();
            }
            "github" => {
                event
                    .window()
                    .emit_all("click_menu_static", "github")
                    .unwrap();
            }
            "load_dates" => {
                event.window().emit_all("click_menu", "load_dates").unwrap();
            }
            "create_db" => {
                event.window().emit_all("click_menu", "create_db").unwrap();
            }
            "import" => {
                event.window().emit_all("click_menu", "import").unwrap();
            }
            "pref" => {
                event.window().emit_all("click_menu", "pref").unwrap();
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
            get_dates_num,
            move_to_trash,
            lock,
            create_db,
            create_db_in_date,
            get_config,
            save_config,
            save_star,
            save_comment,
            copy_file_to_public,
            move_photos_to_exif_date,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
