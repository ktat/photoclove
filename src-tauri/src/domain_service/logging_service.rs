use chrono::{DateTime, Utc};
use dirs;
use log::{debug, error, info, warn};
use std::fs::{create_dir_all, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use uuid::Uuid;

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
        let frontend_log_file = self
            .log_directory
            .join(format!("photoclove-frontend-{}.log", today));

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

    pub fn get_logs(
        &self,
        log_type: &str,
        lines: Option<usize>,
        since: Option<&str>,
    ) -> Result<String, String> {
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
            _ => Err(format!("Unknown log type: {}", log_type)),
        }
    }

    fn get_frontend_logs(
        &self,
        _lines: Option<usize>,
        _since: Option<&str>,
    ) -> Result<String, String> {
        if let Ok(logs) = self.frontend_logs.lock() {
            serde_json::to_string(&*logs)
                .map_err(|e| format!("Failed to serialize frontend logs: {}", e))
        } else {
            Err("Failed to access frontend logs".to_string())
        }
    }

    fn get_backend_logs(
        &self,
        lines: Option<usize>,
        _since: Option<&str>,
    ) -> Result<String, String> {
        // For now, return recent backend logs from the current log file
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let backend_log_file = self.log_directory.join(format!("photoclove-{}.log", today));

        if !backend_log_file.exists() {
            return Ok("[]".to_string());
        }

        let file = File::open(&backend_log_file)
            .map_err(|e| format!("Failed to open backend log file: {}", e))?;

        let reader = BufReader::new(file);
        let mut log_lines: Vec<String> = reader
            .lines()
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
                .map_err(|e| format!("Failed to open log file: {}", e))?,
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

    pub fn cleanup_log_files_if_disabled(&self, logging_enabled: bool) -> Result<(), String> {
        if logging_enabled {
            return Ok(()); // Don't clean if logging is enabled
        }

        info!(
            target: "logging",
            "cleanup_log_files_requested; logging_enabled={}",
            logging_enabled
        );

        // Remove all log files in the log directory
        match std::fs::read_dir(&self.log_directory) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() && path.extension().map_or(false, |ext| ext == "log") {
                            match std::fs::remove_file(&path) {
                                Ok(()) => {
                                    info!(
                                        target: "logging",
                                        "log_file_removed; file={}",
                                        path.display()
                                    );
                                }
                                Err(e) => {
                                    warn!(
                                        target: "logging",
                                        "failed_to_remove_log_file; file={}; error={}",
                                        path.display(),
                                        e
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    target: "logging",
                    "failed_to_read_log_directory; directory={}; error={}",
                    self.log_directory.display(),
                    e
                );
            }
        }

        // Also clear in-memory frontend logs
        if let Ok(mut logs) = self.frontend_logs.lock() {
            logs.clear();
        }

        Ok(())
    }

    pub fn clear_backend_logs(&self) -> Result<(), String> {
        info!(
            target: "logging",
            "clear_backend_logs_requested"
        );

        // Remove all backend log files in the log directory
        match std::fs::read_dir(&self.log_directory) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file()
                            && path.extension().map_or(false, |ext| ext == "log")
                            && path.file_name().map_or(false, |name| {
                                let name_str = name.to_string_lossy();
                                name_str.starts_with("photoclove-")
                                    && !name_str.contains("frontend")
                            })
                        {
                            match std::fs::remove_file(&path) {
                                Ok(()) => {
                                    info!(
                                        target: "logging",
                                        "backend_log_file_cleared; file={}",
                                        path.display()
                                    );
                                }
                                Err(e) => {
                                    warn!(
                                        target: "logging",
                                        "failed_to_clear_backend_log_file; file={}; error={}",
                                        path.display(),
                                        e
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    target: "logging",
                    "failed_to_read_log_directory_for_clearing; directory={}; error={}",
                    self.log_directory.display(),
                    e
                );
                return Err(format!("Failed to read log directory: {}", e));
            }
        }

        Ok(())
    }

    pub fn clear_frontend_logs(&self) -> Result<(), String> {
        info!(
            target: "logging",
            "clear_frontend_logs_requested"
        );

        // Clear in-memory frontend logs
        if let Ok(mut logs) = self.frontend_logs.lock() {
            logs.clear();
        }

        // Remove frontend log files
        match std::fs::read_dir(&self.log_directory) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file()
                            && path.extension().map_or(false, |ext| ext == "log")
                            && path
                                .file_name()
                                .map_or(false, |name| name.to_string_lossy().contains("frontend"))
                        {
                            match std::fs::remove_file(&path) {
                                Ok(()) => {
                                    info!(
                                        target: "logging",
                                        "frontend_log_file_cleared; file={}",
                                        path.display()
                                    );
                                }
                                Err(e) => {
                                    warn!(
                                        target: "logging",
                                        "failed_to_clear_frontend_log_file; file={}; error={}",
                                        path.display(),
                                        e
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    target: "logging",
                    "failed_to_read_log_directory_for_frontend_clearing; directory={}; error={}",
                    self.log_directory.display(),
                    e
                );
            }
        }

        Ok(())
    }

    pub fn export_logs_to_file(
        &self,
        export_path: &str,
        log_type: &str,
        filtered_logs: Option<String>,
    ) -> Result<String, String> {
        info!(
            target: "logging",
            "export_logs_requested; export_path={}; log_type={}",
            export_path,
            log_type
        );

        let timestamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
        let filename = format!("photoclove-logs-{}-{}.json", log_type, timestamp);
        let full_path = std::path::Path::new(export_path).join(&filename);

        let logs_data = if let Some(filtered) = filtered_logs {
            // Use provided filtered logs
            filtered
        } else {
            // Get all logs
            match log_type {
                "all" => {
                    let frontend = self.get_frontend_logs(None, None)?;
                    let backend = self.get_backend_logs(None, None)?;

                    let combined = serde_json::json!({
                        "frontend": serde_json::from_str::<Vec<FrontendLogEntry>>(&frontend).unwrap_or_default(),
                        "backend": backend,
                        "export_timestamp": chrono::Utc::now().to_rfc3339(),
                        "export_type": "all_logs"
                    });

                    serde_json::to_string_pretty(&combined)
                        .map_err(|e| format!("Failed to serialize logs: {}", e))?
                }
                "frontend" => {
                    let frontend_logs = self.get_frontend_logs(None, None)?;
                    let parsed_logs: Vec<FrontendLogEntry> =
                        serde_json::from_str(&frontend_logs).unwrap_or_default();

                    let export_data = serde_json::json!({
                        "frontend": parsed_logs,
                        "export_timestamp": chrono::Utc::now().to_rfc3339(),
                        "export_type": "frontend_logs"
                    });

                    serde_json::to_string_pretty(&export_data)
                        .map_err(|e| format!("Failed to serialize frontend logs: {}", e))?
                }
                "backend" => {
                    let backend_logs = self.get_backend_logs(None, None)?;

                    let export_data = serde_json::json!({
                        "backend": backend_logs,
                        "export_timestamp": chrono::Utc::now().to_rfc3339(),
                        "export_type": "backend_logs"
                    });

                    serde_json::to_string_pretty(&export_data)
                        .map_err(|e| format!("Failed to serialize backend logs: {}", e))?
                }
                _ => return Err(format!("Unknown log type: {}", log_type)),
            }
        };

        std::fs::write(&full_path, logs_data)
            .map_err(|e| format!("Failed to write log file: {}", e))?;

        info!(
            target: "logging",
            "logs_exported_successfully; file={}; size_bytes={}",
            full_path.display(),
            std::fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0)
        );

        Ok(full_path.to_string_lossy().to_string())
    }
}

impl Default for LoggingService {
    fn default() -> Self {
        Self::new().expect("Failed to initialize logging service")
    }
}
