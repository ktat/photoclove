use crate::domain_service::{file_service, photo_service};
use crate::entity::importer;
use crate::entity::*;
use crate::repository::RepositoryDB;
use crate::repository::*;
use crate::value::*;
use entity::config::Config;
use std::{
    error::Error,
    fs, path,
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    sync::{Arc, Mutex},
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Builder, Emitter, Event, Manager,
};

#[cfg(unix)]
use std::os::unix::fs::symlink;

#[cfg(windows)]
use std::os::windows::fs::symlink_file;

mod domain_service;
mod entity;
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
    println!("get_dates is called from {}", window.label());
    
    // First try to get dates from SQLite metadata database
    let meta_db = &state.meta_db;
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());
    
    if sqlite_db.has_metadata() {
        println!("Using SQLite database for dates");
        match sqlite_db.get_available_dates() {
            Ok(dates) => {
                println!("get_dates() - SQLite returned {} dates", dates.len());
                let mut date_list = date::Dates::empty();
                date_list.dates = dates;
                let json_result = date_list.to_json();
                println!("get_dates() - JSON result: {}", json_result);
                println!("get_dates() - FINAL JSON SENT TO REACT: {}", json_result);
                return json_result;
            }
            Err(e) => {
                eprintln!("Error getting dates from SQLite: {}", e);
                // Fall through to filesystem scanning
            }
        }
    } else {
        println!("SQLite database has no metadata, falling back to filesystem scanning");
    }
    
    // Fallback to filesystem directory scanning
    println!("Using filesystem directory scanning for dates");
    let db = &state.repo_db;
    let dates = db.get_dates();
    let filesystem_json = dates.to_json();
    println!("get_dates() - FINAL JSON SENT TO REACT: {}", filesystem_json);
    filesystem_json
}

#[tauri::command]
async fn get_dates_num(
    _window: tauri::Window,
    state: tauri::State<'_, AppState>,
    dates_str: &str,
) -> Result<String, ()> {
    println!("get_dates_num() - Input dates_str: {:?}", dates_str);
    let mut dates = date::Dates::empty();
    let splitted = dates_str.split(",");
    for date_tupple in splitted.enumerate() {
        let date_str = date_tupple.1;
        println!("get_dates_num() - Processing date: {:?}", date_str);
        dates.dates.push(date::Date::from_string(
            &date_str.to_string(),
            Option::Some("-"),
        ));
    }
    println!("get_dates_num() - Parsed {} dates", dates.dates.len());
    
    let meta_db = &state.meta_db;
    let db = &state.repo_db;
    
    println!("get_dates_num() - Getting photo count from meta_db (SQLite)");
    let meta_data = meta_db.get_photo_count_per_dates(dates.clone());
    println!("get_dates_num() - Meta data result: {}", meta_data.to_json());
    
    println!("get_dates_num() - Getting photo count from repo_db (filesystem)");
    let dates_num = db.get_photo_count_per_dates(dates, meta_data);
    let final_json = dates_num.to_json();
    println!("get_dates_num() - FINAL RESULT JSON: {}", final_json);
    
    Ok(final_json)
}

#[tauri::command]
async fn link_file_to_public(
    from_file_path: &str,
    to_file_name: &str,
    _state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let from = path::Path::new(from_file_path);
    let to = path::Path::new("../public/").join(to_file_name.to_string());
    eprintln!("{:?} => {:?}", from, to);

    if cfg!(target_os = "windows") {
        return match std::fs::copy(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                eprintln!("Cannot copy file {:?} => {:?}: {:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    } else {
        match fs::remove_file(to.as_path()) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Cannot delete file {:?} : {:?}", to.clone(), e);
                // return Ok("false".to_string());
            }
        };

        #[cfg(unix)]
        return match symlink(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                eprintln!("Cannot create symlink {:?} => {:?}: {:?}", from, to, e);
                Ok("false".to_string())
            }
        };
        #[cfg(windows)]
        return match symlink_file(from, to.clone()) {
            Ok(_) => Ok("true".to_string()),
            Err(e) => {
                eprintln!("Cannot create symlink {:?} => {:?}: {:?}", from, to, e);
                Ok("false".to_string())
            }
        };
    }
}

#[tauri::command]
async fn get_photos(
    date_str: &str,
    page: u32,
    sort_value: i32,
    num: u32,
    state: tauri::State<'_, AppState>,
    offset: u32,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photos = repo_db
        .get_photos_in_date(
            &meta_data,
            date,
            repository::sort_from_int(sort_value),
            num,
            page,
            offset as usize,
            0,
            false,
            Option::Some(state.config.clone()),
        )
        .await;
    Ok(photos.to_json())
}

#[tauri::command]
async fn get_photos_with_filter(
    date_str: &str,
    page: u32,
    sort_value: i32,
    num: u32,
    star: i32,
    has_comment: bool,
    state: tauri::State<'_, AppState>,
    offset: u32,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::None);
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photos = repo_db
        .get_photos_in_date(
            &meta_data,
            date,
            repository::sort_from_int(sort_value),
            num,
            page,
            offset as usize,
            star,
            has_comment,
            Option::Some(state.config.clone()),
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
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photo = repo_db
        .get_next_photo_in_date(
            &meta_data,
            path,
            date,
            repository::sort_from_int(sort_value),
            Option::None,
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
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    let photo = repo_db
        .get_prev_photo_in_date(
            &meta_data,
            path,
            date,
            repository::sort_from_int(sort_value),
            Option::None,
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
            let photo = photo::Photo::new(f, Option::None);
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
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let star = star::Star::new(star_num);
    photo_service::save_photo_star(db, &photo, star);
}

#[tauri::command]
fn save_comment(
    _window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    comment_str: &str,
) {
    let db = &state.meta_db;
    let comment = comment::Comment::new(comment_str);
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    photo_service::save_photo_comment(db, &photo, comment);
}

#[tauri::command]
fn show_importer(
    path_str: Option<&str>,
    date_str: Option<&str>,
    _window: tauri::Window,
    page: usize,
    num: usize,
    state: tauri::State<AppState>,
) -> String {
    let path: &str;
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
    let t = result.is_ok();
    if t {
        let dates = result.unwrap();
        window.emit("import", "start thumbnail creation").unwrap();

        match photo_service::create_thumbnails(
            dates,
            &path::PathBuf::from(&c.import_to.to_string()),
            &path::PathBuf::from(&c.thumbnail_store.to_string()),
            c.thumbnail_parallel as u32,
            c.thumbnail_compression_quality,
            c.thumbnail_ratio,
            c.thumbnail_ignore_file_size,
        )
        .await
        {
            Ok(ret) => {
                window.emit("import", "thumbnail creation finish").unwrap();
            }
            Err(_) => {
                window.emit("import", "thumbnail creation failed").unwrap();
            }
        }
        window.emit("import", "finish").unwrap();
    } else {
        window.emit("import", "error").unwrap();
    }
    return Ok(t);
}

#[tauri::command]
fn get_import_progress(state: tauri::State<AppState>) -> String {
    let ip = &state.import_progress;
    _ = ip.lock().unwrap().get_import_progress();
    return serde_json::to_string(ip).unwrap();
}

#[tauri::command]
fn get_photos_to_import_under_directory(
    path_str: &str,
    date_after_str: Option<&str>,
    _window: tauri::Window,
    _state: tauri::State<AppState>,
) -> String {
    let d = dir::Dir::new(path_str.to_string());
    let filter: Option<date::Date>;
    if date_after_str.is_none() || date_after_str.unwrap() == "" {
        filter = Option::None;
    } else {
        let date = date::Date::from_string(&date_after_str.unwrap().to_string(), Option::Some("-"));
        filter = Option::Some(date);
    }

    let files = d.find_all_files(filter);
    return serde_json::to_string(&files.files).unwrap();
}

#[tauri::command]
async fn move_photos_to_exif_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    window.emit("move_files", "start").unwrap();
    eprintln!("target date: {:?}", date);
    let dates = state.repo_db.move_photos_to_exif_date(date).await;
    eprintln!("date: {:?}", dates);
    window.emit("move_files", "end_move").unwrap();
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("move_files", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("move_files", "faile").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_db(window: tauri::Window, state: tauri::State<'_, AppState>) -> Result<String, ()> {
    let dates = state.repo_db.get_dates();
    match state.meta_db.record_photos_all_meta_data(dates) {
        Ok(ret) => {
            window.emit("create_db", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_db", "failed").unwrap();
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
            window.emit("create_db", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_db", "failed").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_thumbnails(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    let dates = state.repo_db.get_dates();
    let c = &state.config;
    let origin = PathBuf::from(c.import_to.clone());
    let dest = PathBuf::from(c.thumbnail_store.clone());
    match photo_service::create_thumbnails(
        dates,
        &origin,
        &dest,
        c.thumbnail_parallel as u32,
        c.thumbnail_compression_quality,
        c.thumbnail_ratio,
        c.thumbnail_ignore_file_size,
    )
    .await
    {
        Ok(ret) => {
            window.emit("create_thumbnails", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_thumbnails", "failed").unwrap();
            return Ok("false".to_string());
        }
    }
}

#[tauri::command]
async fn create_thumbnails_in_date(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    date_str: &str,
) -> Result<String, ()> {
    let date = date::Date::from_string(&date_str.to_string(), Option::Some("/"));
    let dates = date::Dates::new(&[date]);
    let c = &state.config;
    let origin = PathBuf::from(c.import_to.clone());
    let dest = PathBuf::from(c.thumbnail_store.clone());
    match photo_service::create_thumbnails(
        dates,
        &origin,
        &dest,
        c.thumbnail_parallel as u32,
        c.thumbnail_compression_quality,
        c.thumbnail_ratio,
        c.thumbnail_ignore_file_size,
    )
    .await
    {
        Ok(ret) => {
            window.emit("create_thumbnails", "finish").unwrap();
            return Ok(serde_json::to_string(&ret).unwrap());
        }
        Err(_) => {
            window.emit("create_thumbnails", "failed").unwrap();
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
async fn upload_to_google_photos(
    _window: tauri::Window,
    _state: tauri::State<'_, AppState>,
    date_str: &str,
    access_token: &str,
    reflesh_token: &str,
    selected_files: Vec<&str>,
) -> Result<bool, ()> {
    eprintln!("{:?}", date_str);
    eprintln!("{:?}", selected_files);
    let photos =
        google_photos::GooglePhotos::new(access_token.to_string(), reflesh_token.to_string());
    photos.upload_photo(selected_files).await;
    return Ok(true);
}

#[tauri::command]
async fn move_to_trash(
    path_str: &str,
    sort_value: i32,
    state: tauri::State<'_, AppState>,
) -> Result<String, ()> {
    let photo = photo::Photo::new(file::File::new(path_str.to_string()), Option::None);
    let date = photo.get_imported_dir_date(state.config.import_to.clone());
    let repo_db = &state.repo_db;
    let meta_db = &state.meta_db;
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };
    eprintln!("to Trash: {:?}", path_str);
    let trash = trash::Trash::new(state.config.trash_path.to_string());
    let file = file::File::new(path_str.to_string());
    file_service::move_to_trash(file, trash);
    return Ok(date.to_string());
}

#[tauri::command]
async fn migrate_tsv_to_sqlite(
    root_path: Option<&str>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let path_to_scan = root_path.unwrap_or(&state.config.import_to);
    
    // Create a new SQLite instance for migration
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(state.config.import_to.clone());
    
    match sqlite_db.migrate_from_tsv_files(path_to_scan) {
        Ok(count) => Ok(format!("Successfully migrated {} records from TSV files to SQLite database", count)),
        Err(e) => Err(format!("Migration failed: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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

    state.repo_db.connect();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|app| {
            let submenu = SubmenuBuilder::new(app, "File")
                .text("home", "HOME")
                .text("load_dates", "Load Date List")
                .text("import", "Import")
                .text("create_db", "Create DB")
                .text("migrate_tsv", "Migrate TSV to SQLite")
                .text("login", "Login to Google")
                .text("pref", "Preferences")
                .text("quit", "Quit")
                .build()?;

            let help_submenu = SubmenuBuilder::new(app, "?")
                .text("github", "GitHub")
                .text("about", "About")
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&submenu)
                .item(&help_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, e| {
                if e.id == "quit" {
                    std::process::exit(0)
                } else if e.id == "close" {
                    app.exit(0)
                } else if e.id == "home" {
                    app.emit("click_menu", "HOME").unwrap();
                } else if e.id == "about" {
                    app.emit("click_menu_static", "about").unwrap();
                } else if e.id == "github" {
                    app.emit("click_menu_static", "github").unwrap();
                } else if e.id == "load_dates" {
                    app.emit("click_menu", "load_dates").unwrap();
                } else if e.id == "create_db" {
                    app.emit("click_menu", "create_db").unwrap();
                } else if e.id == "import" {
                    app.emit("click_menu", "import").unwrap();
                } else if e.id == "migrate_tsv" {
                    app.emit("click_menu", "migrate_tsv").unwrap();
                } else if e.id == "login" {
                    app.emit("click_menu", "login").unwrap();
                } else if e.id == "pref" {
                    app.emit("click_menu", "pref").unwrap();
                } else {
                    eprintln!("{:?}", e);
                }
            });
            Ok(())
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            get_dates,
            get_photos,
            get_photos_with_filter,
            get_photo_info,
            get_next_photo,
            get_prev_photo,
            show_importer,
            import_photos,
            get_import_progress,
            get_photos_to_import_under_directory,
            get_dates_num,
            move_to_trash,
            lock,
            create_db,
            create_db_in_date,
            create_thumbnails,
            create_thumbnails_in_date,
            get_config,
            save_config,
            save_star,
            save_comment,
            link_file_to_public,
            move_photos_to_exif_date,
            upload_to_google_photos,
            migrate_tsv_to_sqlite,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
