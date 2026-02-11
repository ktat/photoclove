/**
 * Menu action constants for App event handling
 */

export const MENU_ACTIONS = {
    // Static menu actions
    SHOW_LOG: "show_log",
    ABOUT: "about",
    GITHUB: "github",
    SPONSOR: "sponsor",
    PRIVACY_POLICY: "privacy_policy",
    TERMS_OF_USE: "terms_of_use",
    LICENSES: "licenses",
    ACHIEVEMENTS: "achievements",
    NOTIFICATION: "notification",

    // Dynamic menu actions
    HOME: "HOME",
    SEARCH: "search",
    IMPORT: "import",
    PREFERENCES: "pref",
    JOB_QUEUE: "job_queue",
    LOGIN: "login",
};

export const MENU_EVENTS = {
    MENU: "menu",
    CLICK_MENU_STATIC: "click_menu_static",
    CLICK_MENU: "click_menu",
    CREATE_DB: "create_db",
    CREATE_THUMBNAILS: "create_thumbnails",
    MOVE_FILES: "move_files",
    PENDING_JOBS_FOUND: "pending_jobs_found",
    IMPORT: "import",
    ACHIEVEMENT_UNLOCKED: "achievement_unlocked",
};
