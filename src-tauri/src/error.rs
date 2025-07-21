use serde::{Deserialize, Serialize};
use std::fmt;

/// Error severity levels for user feedback
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Error categories for different operation types
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ErrorCategory {
    User,
    System,
    Network,
    Database,
    FileSystem,
    Import,
    Export,
    Search,
    Thumbnail,
}

/// Comprehensive error types for PhotoClove operations
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PhotoCloveError {
    // User Errors
    InvalidInput {
        field: String,
        message: String,
        suggestion: Option<String>,
    },
    PermissionDenied {
        operation: String,
        path: String,
        suggestion: String,
    },
    FileNotFound {
        path: String,
        suggestion: String,
    },
    
    // System Errors
    DatabaseError {
        operation: String,
        message: String,
        recoverable: bool,
        suggestion: String,
    },
    FileSystemError {
        operation: String,
        path: String,
        message: String,
        suggestion: String,
    },
    MemoryError {
        operation: String,
        message: String,
        suggestion: String,
    },
    
    // Network Errors
    NetworkTimeout {
        operation: String,
        timeout_seconds: u64,
        suggestion: String,
    },
    ConnectionError {
        service: String,
        message: String,
        suggestion: String,
    },
    
    // Import/Export Errors
    ImportError {
        source_path: String,
        message: String,
        files_processed: u32,
        files_failed: u32,
        suggestion: String,
    },
    ExportError {
        destination_path: String,
        message: String,
        suggestion: String,
    },
    InsufficientSpace {
        required_bytes: u64,
        available_bytes: u64,
        suggestion: String,
    },
    
    // Search Errors
    SearchIndexCorrupted {
        suggestion: String,
    },
    SearchTimeout {
        query: String,
        timeout_seconds: u64,
        suggestion: String,
    },
    
    // Thumbnail Errors
    ThumbnailGenerationFailed {
        path: String,
        format: String,
        message: String,
        suggestion: String,
    },
    UnsupportedFormat {
        path: String,
        format: String,
        supported_formats: Vec<String>,
    },
    
    // Critical Errors
    DatabaseCorrupted {
        message: String,
        backup_available: bool,
        suggestion: String,
    },
    ConfigurationCorrupted {
        message: String,
        suggestion: String,
    },
    
    // Generic fallback
    Unknown {
        operation: String,
        message: String,
        suggestion: String,
    },
}

impl PhotoCloveError {
    /// Get the error category
    pub fn category(&self) -> ErrorCategory {
        match self {
            PhotoCloveError::InvalidInput { .. } 
            | PhotoCloveError::PermissionDenied { .. }
            | PhotoCloveError::FileNotFound { .. } => ErrorCategory::User,
            
            PhotoCloveError::DatabaseError { .. }
            | PhotoCloveError::DatabaseCorrupted { .. } => ErrorCategory::Database,
            
            PhotoCloveError::FileSystemError { .. }
            | PhotoCloveError::InsufficientSpace { .. } => ErrorCategory::FileSystem,
            
            PhotoCloveError::NetworkTimeout { .. }
            | PhotoCloveError::ConnectionError { .. } => ErrorCategory::Network,
            
            PhotoCloveError::ImportError { .. } => ErrorCategory::Import,
            PhotoCloveError::ExportError { .. } => ErrorCategory::Export,
            
            PhotoCloveError::SearchIndexCorrupted { .. }
            | PhotoCloveError::SearchTimeout { .. } => ErrorCategory::Search,
            
            PhotoCloveError::ThumbnailGenerationFailed { .. }
            | PhotoCloveError::UnsupportedFormat { .. } => ErrorCategory::Thumbnail,
            
            PhotoCloveError::MemoryError { .. }
            | PhotoCloveError::ConfigurationCorrupted { .. }
            | PhotoCloveError::Unknown { .. } => ErrorCategory::System,
        }
    }
    
    /// Get the error severity
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            PhotoCloveError::InvalidInput { .. }
            | PhotoCloveError::FileNotFound { .. }
            | PhotoCloveError::UnsupportedFormat { .. } => ErrorSeverity::Warning,
            
            PhotoCloveError::PermissionDenied { .. }
            | PhotoCloveError::FileSystemError { .. }
            | PhotoCloveError::NetworkTimeout { .. }
            | PhotoCloveError::ConnectionError { .. }
            | PhotoCloveError::ImportError { .. }
            | PhotoCloveError::ExportError { .. }
            | PhotoCloveError::SearchTimeout { .. }
            | PhotoCloveError::ThumbnailGenerationFailed { .. }
            | PhotoCloveError::InsufficientSpace { .. } => ErrorSeverity::Error,
            
            PhotoCloveError::DatabaseError { recoverable: true, .. } => ErrorSeverity::Error,
            PhotoCloveError::DatabaseError { recoverable: false, .. }
            | PhotoCloveError::MemoryError { .. }
            | PhotoCloveError::SearchIndexCorrupted { .. }
            | PhotoCloveError::DatabaseCorrupted { .. }
            | PhotoCloveError::ConfigurationCorrupted { .. } => ErrorSeverity::Critical,
            
            PhotoCloveError::Unknown { .. } => ErrorSeverity::Error,
        }
    }
    
    /// Get user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            PhotoCloveError::InvalidInput { field, message, .. } => {
                format!("Invalid input for {}: {}", field, message)
            }
            PhotoCloveError::PermissionDenied { operation, path, .. } => {
                format!("Permission denied when trying to {} at: {}", operation, path)
            }
            PhotoCloveError::FileNotFound { path, .. } => {
                format!("File not found: {}", path)
            }
            PhotoCloveError::DatabaseError { operation, .. } => {
                format!("Database error during {}", operation)
            }
            PhotoCloveError::FileSystemError { operation, path, .. } => {
                format!("File system error during {} at: {}", operation, path)
            }
            PhotoCloveError::MemoryError { operation, .. } => {
                format!("Not enough memory for {}", operation)
            }
            PhotoCloveError::NetworkTimeout { operation, timeout_seconds, .. } => {
                format!("{} timed out after {} seconds", operation, timeout_seconds)
            }
            PhotoCloveError::ConnectionError { service, .. } => {
                format!("Failed to connect to {}", service)
            }
            PhotoCloveError::ImportError { source_path, files_processed, files_failed, .. } => {
                format!("Import from {} completed with issues: {} processed, {} failed", 
                       source_path, files_processed, files_failed)
            }
            PhotoCloveError::ExportError { destination_path, .. } => {
                format!("Export to {} failed", destination_path)
            }
            PhotoCloveError::InsufficientSpace { required_bytes, available_bytes, .. } => {
                format!("Not enough disk space: need {} MB, have {} MB available", 
                       required_bytes / 1024 / 1024, available_bytes / 1024 / 1024)
            }
            PhotoCloveError::SearchIndexCorrupted { .. } => {
                "Search index is corrupted and needs to be rebuilt".to_string()
            }
            PhotoCloveError::SearchTimeout { query, timeout_seconds, .. } => {
                format!("Search for '{}' timed out after {} seconds", query, timeout_seconds)
            }
            PhotoCloveError::ThumbnailGenerationFailed { path, .. } => {
                format!("Failed to generate thumbnail for: {}", path)
            }
            PhotoCloveError::UnsupportedFormat { format, supported_formats, .. } => {
                format!("Unsupported format '{}'. Supported formats: {}", 
                       format, supported_formats.join(", "))
            }
            PhotoCloveError::DatabaseCorrupted { backup_available, .. } => {
                if *backup_available {
                    "Database is corrupted, but a backup is available for restoration".to_string()
                } else {
                    "Database is corrupted and no backup is available".to_string()
                }
            }
            PhotoCloveError::ConfigurationCorrupted { .. } => {
                "Application configuration is corrupted".to_string()
            }
            PhotoCloveError::Unknown { operation, message, .. } => {
                format!("Unexpected error during {}: {}", operation, message)
            }
        }
    }
    
    /// Get suggestion for resolving the error
    pub fn suggestion(&self) -> String {
        match self {
            PhotoCloveError::InvalidInput { suggestion, .. } => {
                suggestion.as_ref().unwrap_or(&"Please check your input and try again".to_string()).clone()
            }
            PhotoCloveError::PermissionDenied { suggestion, .. }
            | PhotoCloveError::FileNotFound { suggestion, .. }
            | PhotoCloveError::DatabaseError { suggestion, .. }
            | PhotoCloveError::FileSystemError { suggestion, .. }
            | PhotoCloveError::MemoryError { suggestion, .. }
            | PhotoCloveError::NetworkTimeout { suggestion, .. }
            | PhotoCloveError::ConnectionError { suggestion, .. }
            | PhotoCloveError::ImportError { suggestion, .. }
            | PhotoCloveError::ExportError { suggestion, .. }
            | PhotoCloveError::InsufficientSpace { suggestion, .. }
            | PhotoCloveError::SearchIndexCorrupted { suggestion, .. }
            | PhotoCloveError::SearchTimeout { suggestion, .. }
            | PhotoCloveError::ThumbnailGenerationFailed { suggestion, .. }
            | PhotoCloveError::DatabaseCorrupted { suggestion, .. }
            | PhotoCloveError::ConfigurationCorrupted { suggestion, .. }
            | PhotoCloveError::Unknown { suggestion, .. } => suggestion.clone(),
            
            PhotoCloveError::UnsupportedFormat { supported_formats, .. } => {
                format!("Please use one of these supported formats: {}", supported_formats.join(", "))
            }
        }
    }
    
    /// Check if the error is recoverable (can be retried)
    pub fn is_recoverable(&self) -> bool {
        match self {
            PhotoCloveError::DatabaseError { recoverable, .. } => *recoverable,
            PhotoCloveError::NetworkTimeout { .. }
            | PhotoCloveError::ConnectionError { .. }
            | PhotoCloveError::ThumbnailGenerationFailed { .. }
            | PhotoCloveError::MemoryError { .. } => true,
            
            PhotoCloveError::InvalidInput { .. }
            | PhotoCloveError::PermissionDenied { .. }
            | PhotoCloveError::FileNotFound { .. }
            | PhotoCloveError::UnsupportedFormat { .. }
            | PhotoCloveError::DatabaseCorrupted { .. }
            | PhotoCloveError::ConfigurationCorrupted { .. }
            | PhotoCloveError::SearchIndexCorrupted { .. } => false,
            
            _ => false,
        }
    }
    
    /// Generate a correlation ID for error tracking
    pub fn with_correlation_id(self, correlation_id: String) -> ErrorWithContext {
        ErrorWithContext {
            error: self,
            correlation_id,
            timestamp: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
            user_action: None,
        }
    }
}

impl fmt::Display for PhotoCloveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for PhotoCloveError {}

/// Error with additional context for debugging and user feedback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorWithContext {
    pub error: PhotoCloveError,
    pub correlation_id: String,
    pub timestamp: String,
    pub user_action: Option<String>,
}

impl ErrorWithContext {
    pub fn with_user_action(mut self, action: String) -> Self {
        self.user_action = Some(action);
        self
    }
}

/// Result type for PhotoClove operations
pub type PhotoCloveResult<T> = Result<T, PhotoCloveError>;

/// Helper functions for creating common errors
impl PhotoCloveError {
    pub fn permission_denied(operation: &str, path: &str) -> Self {
        PhotoCloveError::PermissionDenied {
            operation: operation.to_string(),
            path: path.to_string(),
            suggestion: "Please check file permissions or run as administrator if needed".to_string(),
        }
    }
    
    pub fn file_not_found(path: &str) -> Self {
        PhotoCloveError::FileNotFound {
            path: path.to_string(),
            suggestion: "Please verify the file path and ensure the file exists".to_string(),
        }
    }
    
    pub fn database_error(operation: &str, message: &str, recoverable: bool) -> Self {
        PhotoCloveError::DatabaseError {
            operation: operation.to_string(),
            message: message.to_string(),
            recoverable,
            suggestion: if recoverable {
                "This is a temporary issue. Please try again in a moment".to_string()
            } else {
                "Please restart the application or check the database integrity".to_string()
            },
        }
    }
    
    pub fn insufficient_space(required: u64, available: u64) -> Self {
        PhotoCloveError::InsufficientSpace {
            required_bytes: required,
            available_bytes: available,
            suggestion: "Please free up disk space and try again".to_string(),
        }
    }
    
    pub fn import_error(source: &str, processed: u32, failed: u32, message: &str) -> Self {
        PhotoCloveError::ImportError {
            source_path: source.to_string(),
            message: message.to_string(),
            files_processed: processed,
            files_failed: failed,
            suggestion: "Check the import log for detailed information about failed files".to_string(),
        }
    }
    
    pub fn thumbnail_failed(path: &str, format: &str, message: &str) -> Self {
        PhotoCloveError::ThumbnailGenerationFailed {
            path: path.to_string(),
            format: format.to_string(),
            message: message.to_string(),
            suggestion: "The image may be corrupted or in an unsupported format".to_string(),
        }
    }
}