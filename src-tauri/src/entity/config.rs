use dirs::home_dir;
use serde::{Deserialize, Serialize};
use serde_yaml;
use std::{fs, io::BufReader, io::BufWriter, io::Write};

fn default_download_dir() -> String {
    let home = match home_dir() {
        Some(path) => path,
        None => {
            log::error!(target: "config", "home_directory_error; status=failed");
            return "Downloads".to_string();
        }
    };

    dirs::download_dir()
        .unwrap_or_else(|| home.join("Downloads"))
        .display()
        .to_string()
}

fn default_max_photos_per_fetch() -> u32 {
    1000
}

fn default_logging_enabled() -> bool {
    cfg!(debug_assertions) // true in dev, false in production
}

fn default_logging_level() -> String {
    if cfg!(debug_assertions) {
        "debug".to_string()
    } else {
        "info".to_string()
    }
}

fn default_use_exif_thumbnail() -> bool {
    false
}

fn default_google_auth_auto_reauth() -> bool {
    false
}

fn default_thumbnail_orientation_correction() -> bool {
    false
}

fn default_color_theme() -> String {
    "dark".to_string()
}

fn default_photo_grid_theme() -> String {
    "default".to_string()
}

fn default_progressive_image_loading() -> bool {
    false
}

fn default_startup_images() -> Option<StartupImageConfig> {
    None
}

fn default_grouping() -> GroupingConfig {
    GroupingConfig::default()
}

fn default_ai_tagging() -> AiTaggingConfig {
    AiTaggingConfig::default()
}

fn default_s3() -> Option<S3Config> {
    None
}

/// S3 Backup configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct S3Config {
    /// Whether S3 backup is enabled
    pub enabled: bool,
    /// Storage type (AWS S3 or S3-compatible)
    pub storage_type: S3StorageType,
    /// Bucket URI (e.g., s3://my-bucket/photos/)
    pub bucket_uri: String,
    /// AWS Region (e.g., ap-northeast-1)
    pub region: String,
    /// Authentication method
    pub auth_method: S3AuthMethod,
    /// AWS profile name (for AwsCredentials auth method)
    #[serde(default)]
    pub profile: Option<String>,
    /// Custom endpoint URL (for S3-compatible storage)
    #[serde(default)]
    pub custom_endpoint: Option<String>,
    /// Auto sync on import
    #[serde(default)]
    pub auto_sync: bool,
    /// Backup SQLite database
    #[serde(default)]
    pub backup_db: bool,
    /// Maximum file size in MB (None = no limit)
    #[serde(default)]
    pub max_file_size_mb: Option<u32>,
    /// Last sync timestamp
    #[serde(default)]
    pub last_sync_at: Option<String>,
}

impl Default for S3Config {
    fn default() -> Self {
        Self {
            enabled: false,
            storage_type: S3StorageType::AwsS3,
            bucket_uri: String::new(),
            region: "ap-northeast-1".to_string(),
            auth_method: S3AuthMethod::AwsCredentials,
            profile: None,
            custom_endpoint: None,
            auto_sync: false,
            backup_db: true,
            max_file_size_mb: None,
            last_sync_at: None,
        }
    }
}

/// S3 storage provider types
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum S3StorageType {
    #[serde(rename = "aws_s3")]
    AwsS3,
    #[serde(rename = "minio")]
    MinIO,
    #[serde(rename = "wasabi")]
    Wasabi,
    #[serde(rename = "cloudflare_r2")]
    CloudflareR2,
    #[serde(rename = "digitalocean")]
    DigitalOcean,
    #[serde(rename = "custom")]
    Custom,
}

/// S3 authentication methods
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum S3AuthMethod {
    /// Use AWS CLI credentials (~/.aws/credentials)
    #[serde(rename = "aws_credentials")]
    AwsCredentials,
    /// Use IAM Role (EC2/ECS environment)
    #[serde(rename = "iam_role")]
    IAMRole,
    /// Use Access Key ID + Secret Access Key directly
    #[serde(rename = "access_key")]
    AccessKey,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupingConfig {
    pub enabled: bool,
    pub burst_threshold_seconds: u32,
    pub min_group_size: u32,
}

impl Default for GroupingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            burst_threshold_seconds: 2,
            min_group_size: 2,
        }
    }
}

/// AI Auto-Tagging configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiTaggingConfig {
    /// Whether AI tagging is enabled
    pub enabled: bool,
    /// Whether to auto-tag photos on import
    pub auto_tag_on_import: bool,
    /// Confidence threshold (0.0 to 1.0) - tags below this are not applied
    pub confidence_threshold: f32,
    /// Maximum number of tags to apply per photo
    pub max_tags_per_image: u32,
    /// Model type: "mobilenet", "openclip", or "siglip"
    #[serde(default = "default_model_type")]
    pub model_type: String,
    /// Model preset: "light", "standard", or "accurate" (for MobileNet only)
    pub model_preset: String,
    /// Enabled categories (empty = all enabled) - for MobileNet
    pub enabled_categories: Vec<String>,
    /// Custom labels for OpenCLIP/SigLIP models
    #[serde(default)]
    pub custom_labels: Vec<String>,
    /// Use EXIF thumbnail for faster tagging (may reduce accuracy for small details)
    #[serde(default = "default_ai_tagging_use_exif_thumbnail")]
    pub use_exif_thumbnail: bool,
    /// Minimum EXIF thumbnail size (px) for AI tagging. 0 = always use full image
    #[serde(default = "default_ai_tagging_min_thumbnail_size")]
    pub min_thumbnail_size: u32,
}

fn default_model_type() -> String {
    "mobilenet".to_string()
}

fn default_ai_tagging_use_exif_thumbnail() -> bool {
    true
}

fn default_ai_tagging_min_thumbnail_size() -> u32 {
    160
}

impl Default for AiTaggingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_tag_on_import: false,
            confidence_threshold: 0.7,
            max_tags_per_image: 5,
            model_type: "mobilenet".to_string(),
            model_preset: "standard".to_string(),
            enabled_categories: Vec::new(), // empty = all enabled
            custom_labels: Vec::new(),
            use_exif_thumbnail: true,
            min_thumbnail_size: default_ai_tagging_min_thumbnail_size(),
        }
    }
}

/// Face Detection configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FaceDetectionConfig {
    /// Confidence threshold for face detection (0.0 to 1.0)
    pub confidence_threshold: f32,
    /// Maximum number of faces to detect per image
    pub max_faces: u32,
    /// Whether to generate face embeddings for recognition
    pub generate_embeddings: bool,
    /// Minimum EXIF thumbnail size (px) for fast detection. 0 = always use full image
    #[serde(default = "default_min_thumbnail_size")]
    pub min_thumbnail_size: u32,
}

fn default_min_thumbnail_size() -> u32 {
    160
}

impl Default for FaceDetectionConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.7,
            max_faces: 50,
            generate_embeddings: true,
            min_thumbnail_size: default_min_thumbnail_size(),
        }
    }
}

fn default_face_detection() -> FaceDetectionConfig {
    FaceDetectionConfig::default()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StartupImageConfig {
    pub mode: String,  // "default" or "custom"
    pub images: Vec<StartupImage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StartupImage {
    pub path: String,       // Image path (relative to import_to)
    pub enabled: bool,      // enabled/disabled
    pub photo_date: String, // Photo date for sorting
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub repository: RepositoryConfig,
    pub import_to: String,
    pub export_from: Vec<String>,
    pub trash_path: String,
    pub data_path: String,
    pub thumbnail_store: String,
    pub thumbnail_ratio: f32,
    pub thumbnail_compression_quality: f32,
    pub thumbnail_ignore_file_size: u32,
    pub copy_parallel: usize,
    pub thumbnail_parallel: usize,
    pub use_count: i32,
    #[serde(default = "default_download_dir")]
    pub download_dir: String,
    #[serde(default = "default_max_photos_per_fetch")]
    pub max_photos_per_fetch: u32,
    #[serde(default = "default_logging_enabled")]
    pub logging_enabled: bool,
    #[serde(default = "default_logging_level")]
    pub logging_level: String,
    #[serde(default = "default_use_exif_thumbnail")]
    pub use_exif_thumbnail: bool,
    #[serde(default = "default_google_auth_auto_reauth")]
    pub google_auth_auto_reauth: bool,
    #[serde(default = "default_thumbnail_orientation_correction")]
    pub thumbnail_orientation_correction: bool,
    #[serde(default = "default_color_theme")]
    pub color_theme: String,
    #[serde(default = "default_photo_grid_theme")]
    pub photo_grid_theme: String,
    #[serde(default = "default_progressive_image_loading")]
    pub progressive_image_loading: bool,
    #[serde(default = "default_startup_images")]
    pub startup_images: Option<StartupImageConfig>,
    #[serde(default = "default_grouping")]
    pub grouping: GroupingConfig,
    #[serde(default = "default_ai_tagging")]
    pub ai_tagging: AiTaggingConfig,
    #[serde(default = "default_face_detection")]
    pub face_detection: FaceDetectionConfig,
    #[serde(default = "default_s3")]
    pub s3: Option<S3Config>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepositoryConfig {
    pub store: String,
    pub option: RepositoryOption,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepositoryOption {}
impl Config {
    #[allow(dead_code)]
    pub fn reload(&mut self) {
        let config = Config::new();
        self.repository = config.repository;
        self.import_to = config.import_to;
        self.export_from = config.export_from;
        self.trash_path = config.trash_path;
        self.data_path = config.data_path;
        self.thumbnail_store = config.thumbnail_store;
        self.copy_parallel = config.copy_parallel;
        self.thumbnail_parallel = config.thumbnail_parallel;
        self.thumbnail_ratio = config.thumbnail_ratio;
        self.thumbnail_compression_quality = config.thumbnail_compression_quality;
        self.thumbnail_ignore_file_size = config.thumbnail_ignore_file_size;
        self.use_count = config.use_count;
        self.download_dir = config.download_dir;
        self.max_photos_per_fetch = config.max_photos_per_fetch;
        self.logging_enabled = config.logging_enabled;
        self.logging_level = config.logging_level;
        self.use_exif_thumbnail = config.use_exif_thumbnail;
        self.google_auth_auto_reauth = config.google_auth_auto_reauth;
        self.thumbnail_orientation_correction = config.thumbnail_orientation_correction;
        self.color_theme = config.color_theme;
        self.photo_grid_theme = config.photo_grid_theme;
        self.progressive_image_loading = config.progressive_image_loading;
        self.startup_images = config.startup_images;
        self.grouping = config.grouping;
        self.ai_tagging = config.ai_tagging;
        self.face_detection = config.face_detection;
        self.s3 = config.s3;
    }

    pub fn config_path() -> String {
        let home = match home_dir() {
            Some(path) => path,
            None => {
                panic!("Cannot get HOME directory!");
            }
        };
        let config_file = home.join(".photoclove.yml");
        if !config_file.exists() {
            let file = std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .open(config_file.display().to_string())
                .unwrap();
            let writer = BufWriter::new(file);
            let config = Config::template();
            config.prepare_directory_if_required();
            serde_yaml::to_writer(writer, &config).unwrap();
        }
        config_file.display().to_string()
    }

    fn prepare_directory_if_required(&self) {
        for f in [&self.import_to, &self.trash_path] {
            let result = fs::DirBuilder::new().recursive(true).create(f);
            if !result.is_err() {
                result.unwrap();
            } else {
                log::error!(target: "config", "directory_creation_failed; error={:?}", result.err());
            }
        }
    }

    pub fn save(&self) -> bool {
        let path = Config::config_path();
        let file = match fs::OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(&path) {
                Ok(f) => f,
                Err(e) => {
                    log::error!(target: "config", "config_file_open_failed; path={}; error={:?}", path, e);
                    return false;
                }
            };
        let mut writer = BufWriter::new(file);
        let result = serde_yaml::to_writer(&mut writer, self);
        if let Err(ref error) = result {
            log::error!(target: "config", "config_serialize_failed; error={:?}", error);
            return false;
        }
        // Explicitly flush the buffer to ensure data is written to disk
        if let Err(e) = writer.flush() {
            log::error!(target: "config", "config_flush_failed; error={:?}", e);
            return false;
        }
        log::debug!(target: "config", "config_saved_to_file; path={}", path);
        true
    }

    pub fn template() -> Config {
        let home = match home_dir() {
            Some(path) => path,
            None => {
                panic!("Cannot get HOME directory!");
            }
        };
        Config {
            repository: RepositoryConfig {
                store: "".to_string(),
                option: RepositoryOption {},
            },
            import_to: home.join(".photoclove/import/").display().to_string(),
            export_from: vec!["/".to_string()],
            trash_path: home.join(".photoclove/trash/").display().to_string(),
            data_path: home.join(".photoclove/data/").display().to_string(),
            thumbnail_store: home.join(".photoclove/thumbnail/").display().to_string(),
            thumbnail_ratio: 0.05,
            thumbnail_compression_quality: 0.5,
            thumbnail_ignore_file_size: 1024 * 1024, // Don't create thumbnail if photo size <= 1MB
            copy_parallel: 2,
            thumbnail_parallel: 1,
            use_count: 0,
            download_dir: dirs::download_dir()
                .unwrap_or_else(|| home.join("Downloads"))
                .display()
                .to_string(),
            max_photos_per_fetch: 1000,
            logging_enabled: default_logging_enabled(),
            logging_level: default_logging_level(),
            use_exif_thumbnail: default_use_exif_thumbnail(),
            google_auth_auto_reauth: default_google_auth_auto_reauth(),
            thumbnail_orientation_correction: default_thumbnail_orientation_correction(),
            color_theme: default_color_theme(),
            photo_grid_theme: default_photo_grid_theme(),
            progressive_image_loading: default_progressive_image_loading(),
            startup_images: default_startup_images(),
            grouping: default_grouping(),
            ai_tagging: default_ai_tagging(),
            face_detection: default_face_detection(),
            s3: default_s3(),
        }
    }

    pub fn new() -> Config {
        let config_path = Config::config_path();
        let file = fs::File::open(config_path).unwrap();
        let reader = BufReader::new(file);
        let config: Config = serde_yaml::from_reader(reader).unwrap();
        config.prepare_directory_if_required();
        return config;
    }
}
