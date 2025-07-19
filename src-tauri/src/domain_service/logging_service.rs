use chrono::{DateTime, Utc};
use log::{info, warn, error, debug};
use std::fs::{File, OpenOptions, create_dir_all};
use std::io::{Write, BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use uuid::Uuid;
use dirs;

pub struct LoggingService {
    correlation_counter: AtomicU64,
    log_directory: PathBuf,
    frontend_logs: Mutex<Vec<FrontendLogEntry>>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct FrontendLogEntry {
    pub timestamp: String,
    pub session_id: String,
    pub level: String,
    pub component: String,
    pub event: String,
    pub message: String,
    pub data: serde_json::Value,
    pub correlation_id: String,
}

impl LoggingService {
    pub fn new() -> Result<Self, String> {
        let log_directory = Self::get_log_directory()?;
        
        // Ensure log directory exists
        create_dir_all(&log_directory)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;

        Ok(Self {
            correlation_counter: AtomicU64::new(0),
            log_directory,
            frontend_logs: Mutex::new(Vec::new()),
        })
    }

    fn get_log_directory() -> Result<PathBuf, String> {
        if let Some(app_data_dir) = dirs::data_local_dir() {
            Ok(app_data_dir.join("photoclove").join("logs"))
        } else {
            Err("Failed to get application data directory".to_string())
        }
    }

    pub fn generate_correlation_id(&self) -> String {
        let counter = self.correlation_counter.fetch_add(1, Ordering::SeqCst);
        format!("backend_corr_{}", counter)
    }

    pub fn submit_frontend_logs(&self, logs_json: &str) -> Result<(), String> {
        let frontend_logs: Vec<FrontendLogEntry> = serde_json::from_str(logs_json)
            .map_err(|e| format!("Failed to parse frontend logs: {}", e))?;

        // Store in memory for retrieval
        if let Ok(mut stored_logs) = self.frontend_logs.lock() {
            stored_logs.extend(frontend_logs.clone());
            
            // Keep only last 1000 logs to prevent memory issues
            let current_len = stored_logs.len();
            if current_len > 1000 {
                stored_logs.drain(0..current_len - 1000);
            }
        }

        // Write to file
        self.write_frontend_logs_to_file(&frontend_logs)?;

        // Note: Removed frontend_logs_received log to reduce noise

        Ok(())
    }

    fn write_frontend_logs_to_file(&self, logs: &[FrontendLogEntry]) -> Result<(), String> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let frontend_log_file = self.log_directory.join(format!("photoclove-frontend-{}.log", today));

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&frontend_log_file)
            .map_err(|e| format!("Failed to open frontend log file: {}", e))?;

        for log_entry in logs {
            let log_line = format!(
                "{} [{}] {}:{} - {} | data: {} | correlation_id: {}\n",
                log_entry.timestamp,
                log_entry.level,
                log_entry.component,
                log_entry.event,
                log_entry.message,
                log_entry.data,
                log_entry.correlation_id
            );

            file.write_all(log_line.as_bytes())
                .map_err(|e| format!("Failed to write frontend log: {}", e))?;
        }

        file.flush()
            .map_err(|e| format!("Failed to flush frontend log file: {}", e))?;

        Ok(())
    }

    pub fn get_logs(&self, log_type: &str, lines: Option<usize>, since: Option<&str>) -> Result<String, String> {
        match log_type {
            "frontend" => self.get_frontend_logs(lines, since),
            "backend" => self.get_backend_logs(lines, since),
            "all" => {
                let frontend = self.get_frontend_logs(lines, since)?;
                let backend = self.get_backend_logs(lines, since)?;
                
                let combined = serde_json::json!({
                    "frontend": frontend,
                    "backend": backend
                });
                
                Ok(combined.to_string())
            }
            _ => Err(format!("Unknown log type: {}", log_type))
        }
    }

    fn get_frontend_logs(&self, _lines: Option<usize>, _since: Option<&str>) -> Result<String, String> {
        if let Ok(logs) = self.frontend_logs.lock() {
            serde_json::to_string(&*logs)
                .map_err(|e| format!("Failed to serialize frontend logs: {}", e))
        } else {
            Err("Failed to access frontend logs".to_string())
        }
    }

    fn get_backend_logs(&self, lines: Option<usize>, _since: Option<&str>) -> Result<String, String> {
        // For now, return recent backend logs from the current log file
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let backend_log_file = self.log_directory.join(format!("photoclove-{}.log", today));

        if !backend_log_file.exists() {
            return Ok("[]".to_string());
        }

        let file = File::open(&backend_log_file)
            .map_err(|e| format!("Failed to open backend log file: {}", e))?;

        let reader = BufReader::new(file);
        let mut log_lines: Vec<String> = reader.lines()
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read backend log file: {}", e))?;

        // Get last N lines if specified
        if let Some(line_limit) = lines {
            if log_lines.len() > line_limit {
                log_lines = log_lines.into_iter().rev().take(line_limit).rev().collect();
            }
        }

        Ok(log_lines.join("\n"))
    }

    pub fn setup_backend_logging(&self) -> Result<(), String> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let log_file_path = self.log_directory.join(format!("photoclove-{}.log", today));

        // Initialize env_logger with file output
        let target = Box::new(
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file_path)
                .map_err(|e| format!("Failed to open log file: {}", e))?
        );

        env_logger::Builder::from_default_env()
            .target(env_logger::Target::Pipe(target))
            .filter_level(log::LevelFilter::Debug)
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{} [{}] {} - {}",
                    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                    record.level(),
                    record.target(),
                    record.args()
                )
            })
            .init();

        info!(
            target: "logging",
            "backend_logging_initialized; log_file={}",
            log_file_path.display()
        );

        Ok(())
    }
}

impl Default for LoggingService {
    fn default() -> Self {
        Self::new().expect("Failed to initialize logging service")
    }
}