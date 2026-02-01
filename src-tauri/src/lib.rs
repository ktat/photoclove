extern crate kexif;

use crate::domain_service::{job_queue_service, logging_service};
use crate::entity::importer;
use crate::repository::*;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, SubmenuBuilder},
    Emitter, Manager,
};

mod app_state;
mod commands;
mod domain_service;
mod entity;
mod error;
mod repository;
mod utils;
mod value;

use app_state::AppState;

// Import all commands from the commands module
use commands::*;

/// Queue insights calculation on startup if cache is stale (>1 hour) or missing
fn queue_startup_insights(config: &entity::config::Config, app_handle: tauri::AppHandle) {
    use crate::domain_service::job_queue::handlers::insights;
    use crate::entity::job_queue::{Job, JobType, JobUnit, QueuedJob};

    // Check if cache is stale (older than 1 hour) or missing
    let should_refresh = match insights::get_cache_metadata(config) {
        Some(metadata) => metadata.age_secs > 3600, // Older than 1 hour
        None => true, // No cache
    };

    if !should_refresh {
        log::info!(target: "stats", "startup_insights; status=cache_valid; skipping");
        return;
    }

    log::info!(target: "stats", "startup_insights; status=queueing");

    let sqlite = repository::meta_db::sqlite::SQLite::new(config.import_to.clone());

    // Create job unit
    let job_types = vec!["insights_calculation".to_string()];
    let job_unit = JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit
    if let Err(e) = sqlite.create_job_unit(&job_unit) {
        log::error!(target: "stats", "startup_insights; status=error; error={}", e);
        return;
    }

    // Create the job
    let job = Job::new(job_unit_id.clone(), JobType::InsightsCalculation, vec![]);
    let queued_job = QueuedJob::new(job_unit_id.clone(), job);

    // Save job to queue
    if let Err(e) = sqlite.create_job(&queued_job) {
        log::error!(target: "stats", "startup_insights; status=error; error={}", e);
        return;
    }

    log::info!(target: "stats", "startup_insights; status=queued; job_unit_id={}", job_unit_id);

    // Trigger job processing
    let db_arc = Arc::new(sqlite);
    domain_service::job_queue::executor::process_new_jobs(db_arc, 1, app_handle);
}

#[cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

pub fn run() {
    use crate::entity::config;
    use crate::repository::*;

    // Set ORT_DYLIB_PATH early, before any ONNX Runtime code could be triggered
    // This is required for face detection and AI tagging to find the library
    if std::env::var("ORT_DYLIB_PATH").is_err() {
        if let Some(data_dir) = dirs::data_local_dir() {
            let lib_path = data_dir.join("photoclove").join("lib").join("libonnxruntime.so");
            if lib_path.exists() {
                std::env::set_var("ORT_DYLIB_PATH", &lib_path);
            }
        }
    }

    let c = config::Config::new();
    // if c.repository.store == "memory".to_string() {
    //     db = repository::RepoDB::new();
    // } else {
    //     db = repository::RepoDB::new("".to_string());
    // }
    let ip: importer::ImportProgress = importer::ImportProgress::new();

    // Create job queue manager with same database instance
    let sqlite_db = repository::meta_db::sqlite::SQLite::new(c.import_to.clone());
    // Initialize the database to ensure job queue tables are created
    log::info!(target: "app", "initializing_job_queue_database");
    if let Err(e) = sqlite_db.init_db() {
        log::error!(target: "app", "job_queue_database_init_failed; error={}", e);
        panic!("Failed to initialize job queue database: {}", e);
    }
    log::info!(target: "app", "job_queue_database_initialized");
    let job_queue_manager =
        job_queue_service::JobQueueManager::new(sqlite_db, c.copy_parallel as usize);

    // Initialize logging service
    let logging_service =
        logging_service::LoggingService::new().expect("Failed to initialize logging service");

    // Clean up log files if logging is disabled
    if let Err(e) = logging_service.cleanup_log_files_if_disabled(c.logging_enabled) {
        log::warn!(target: "app", "cleanup_log_files_failed; error={}", e);
    }

    // Setup backend logging to file only if logging is enabled
    if c.logging_enabled {
        if let Err(e) = logging_service.setup_backend_logging() {
            log::warn!(target: "app", "setup_backend_logging_failed; error={}", e);
            // Continue without file logging
            env_logger::Builder::from_default_env()
                .filter_level(log::LevelFilter::Debug)
                .init();
        }
    } else {
        // When logging is disabled, setup minimal console logging for critical messages only
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Error)
            .init();
    }

    let state = AppState {
        repo_db: repository::RepoDB::new(c.import_to.to_string()),
        meta_db: repository::MetaDB::new(c.import_to.to_string()),
        import_progress: Arc::new(Mutex::new(ip)),
        job_queue_manager: Arc::new(Mutex::new(job_queue_manager)),
        logging_service: Arc::new(logging_service),
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
                .text("login", "Login to Google")
                .text("job_queue", "Job Queue")
                .text("pref", "Preferences")
                .text("quit", "Quit")
                .build()?;

            let help_submenu = SubmenuBuilder::new(app, "?")
                .text("show_log", "Show log")
                .text("achievements", "Achievements")
                .text("github", "GitHub")
                .text("sponsor", "Sponsor")
                .separator()
                .text("privacy_policy", "Privacy Policy")
                .text("terms_of_use", "Terms of Use")
                .text("licenses", "Licenses & Credits")
                .separator()
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
                } else if e.id == "show_log" {
                    app.emit("click_menu_static", "show_log").unwrap();
                } else if e.id == "about" {
                    app.emit("click_menu_static", "about").unwrap();
                } else if e.id == "github" {
                    app.emit("click_menu_static", "github").unwrap();
                } else if e.id == "sponsor" {
                    app.emit("click_menu_static", "sponsor").unwrap();
                } else if e.id == "privacy_policy" {
                    app.emit("click_menu_static", "privacy_policy").unwrap();
                } else if e.id == "terms_of_use" {
                    app.emit("click_menu_static", "terms_of_use").unwrap();
                } else if e.id == "licenses" {
                    app.emit("click_menu_static", "licenses").unwrap();
                } else if e.id == "achievements" {
                    app.emit("click_menu_static", "achievements").unwrap();
                } else if e.id == "load_dates" {
                    app.emit("click_menu", "load_dates").unwrap();
                } else if e.id == "create_db" {
                    app.emit("click_menu", "create_db").unwrap();
                } else if e.id == "import" {
                    app.emit("click_menu", "import").unwrap();
                } else if e.id == "login" {
                    app.emit("click_menu", "login").unwrap();
                } else if e.id == "job_queue" {
                    app.emit("click_menu", "job_queue").unwrap();
                } else if e.id == "pref" {
                    app.emit("click_menu", "pref").unwrap();
                } else {
                    log::debug!(target: "app", "unhandled_menu_event; event={:?}", e);
                }
            });

            // Cleanup any stale kill files from previous sessions
            domain_service::job_queue::handlers::cleanup_all_kill_files();

            // Start background job processing
            log::info!(target: "job_queue", "starting_background_job_processing");
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            let job_queue_manager = state.job_queue_manager.lock().unwrap();
            job_queue_manager.start_background_processing(app_handle.clone());
            log::info!(target: "job_queue", "background_job_processing_started");

            // Queue insights calculation on startup if cache is stale or missing
            let config = state.config.clone();
            std::thread::spawn(move || {
                queue_startup_insights(&config, app_handle);
            });

            Ok(())
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            get_filter_options,
            get_dates,
            get_photos_unified,
            get_photo_info,
            get_next_photo,
            get_prev_photo,
            show_importer,
            get_resized_image,
            get_thumbnail_path,
            clear_import_cache,
            import_photos,
            get_import_progress,
            get_job_progress,
            get_all_job_units,
            get_all_jobs,
            retry_job,
            resume_job,
            restart_job,
            stop_job,
            get_job_config,
            delete_job,
            delete_job_unit,
            cleanup_completed_jobs,
            run_ai_tagging_for_date,
            run_ai_tagging_for_all,
            run_ai_tagging_for_photo,
            get_ai_models,
            get_ai_model_info,
            is_ai_model_downloaded,
            download_ai_model,
            delete_ai_model,
            get_ai_models_dir,
            get_default_clip_labels,
            get_photos_to_import_under_directory,
            get_dates_num,
            move_to_trash_batch,
            restore_from_trash_batch,
            delete_permanently_batch,
            empty_trash,
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
            store_google_tokens,
            is_google_authenticated,
            get_google_auth_status,
            logout_google,
            #[cfg(debug_assertions)]
            get_google_token_info,
            save_css_style,
            get_css_style,
            get_download_dir,
            open_file_in_default_app,
            save_styled_copy_from_frontend,
            get_logs,
            submit_frontend_logs,
            set_logging_enabled,
            get_logging_status,
            clear_backend_logs,
            clear_frontend_logs,
            export_logs_to_download_dir,
            create_tag,
            delete_tag,
            add_tag_to_photo,
            remove_tag_from_photo,
            remove_all_tags_from_photo,
            get_tags_for_photo,
            get_tags_for_photo_with_metadata,
            create_album,
            update_album,
            delete_album,
            add_photo_to_album,
            add_photos_to_album_bulk,
            remove_photo_from_album,
            get_album_photos,
            get_album_photos_with_metadata,
            reorder_album_photos,
            // Unified PhotoCollection API
            create_collection,
            get_all_collections,
            update_collection,
            delete_collection,
            add_photo_to_collection,
            add_photos_to_collection_bulk,
            remove_photo_from_collection,
            get_collection_photos,
            // Recovery Queue commands
            get_recovery_pending_count,
            get_recovery_pending_items,
            get_recovery_all_items,
            discard_recovery_item,
            delete_recovery_item,
            retry_recovery_item,
            retry_all_recovery_items,
            cleanup_recovery_items,
            // Burst Group commands
            create_burst_group,
            remove_from_burst_group,
            recalculate_grouping,
            recalculate_grouping_in_date,
            // S3 Backup commands
            list_aws_profiles,
            test_s3_connection,
            save_s3_config,
            get_s3_config,
            get_s3_sync_stats,
            enqueue_s3_incremental_sync,
            enqueue_s3_full_sync,
            enqueue_s3_sync_by_date,
            store_s3_credentials,
            has_s3_credentials,
            delete_s3_credentials,
            get_s3_credentials_preview,
            // Face Detection commands
            get_face_detection_model_status,
            get_face_detection_model_info,
            download_face_detection_model,
            delete_face_detection_model,
            detect_faces_in_photo,
            get_detected_faces_for_photo,
            has_photo_faces,
            get_face_detection_stats,
            get_all_persons,
            get_all_persons_for_list,
            get_persons_with_faces,
            create_person,
            update_person_name,
            assign_face_to_person,
            get_photos_for_person,
            delete_person,
            delete_detected_face,
            delete_detected_faces_batch,
            assign_faces_to_person_batch,
            set_face_person_name,
            run_face_detection_for_date,
            get_unknown_faces_count,
            get_unknown_faces,
            // Face Thumbnail commands
            get_face_thumbnail_path,
            has_face_thumbnail,
            regenerate_face_thumbnails,
            // Statistics commands
            stats_commands::get_photography_insights,
            stats_commands::get_cached_insights,
            stats_commands::get_insights_cache_status,
            stats_commands::queue_insights_refresh,
            // Achievement commands
            achievement_commands::get_achievements,
            achievement_commands::check_all_achievements,
            achievement_commands::check_first_action_achievement,
            achievement_commands::check_photo_count_achievements,
            achievement_commands::check_monthly_achievements,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
