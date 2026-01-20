//! Recovery Queue entity for failed operations
//!
//! This module defines entities for tracking operations that failed
//! and can be retried when the user is ready.

use serde::{Deserialize, Serialize};

/// Type of operation that failed
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationType {
    #[serde(rename = "move_to_trash")]
    MoveToTrash,
    #[serde(rename = "restore")]
    Restore,
    #[serde(rename = "import")]
    Import,
    #[serde(rename = "permanently_delete")]
    PermanentlyDelete,
}

impl ToString for OperationType {
    fn to_string(&self) -> String {
        match self {
            OperationType::MoveToTrash => "move_to_trash".to_string(),
            OperationType::Restore => "restore".to_string(),
            OperationType::Import => "import".to_string(),
            OperationType::PermanentlyDelete => "permanently_delete".to_string(),
        }
    }
}

impl From<String> for OperationType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "move_to_trash" => OperationType::MoveToTrash,
            "restore" => OperationType::Restore,
            "import" => OperationType::Import,
            "permanently_delete" => OperationType::PermanentlyDelete,
            _ => OperationType::MoveToTrash, // default
        }
    }
}

/// Status of a recovery item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RecoveryStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "unrecoverable")]
    Unrecoverable,
    #[serde(rename = "resolved")]
    Resolved,
    #[serde(rename = "discarded")]
    Discarded,
}

impl ToString for RecoveryStatus {
    fn to_string(&self) -> String {
        match self {
            RecoveryStatus::Pending => "pending".to_string(),
            RecoveryStatus::Unrecoverable => "unrecoverable".to_string(),
            RecoveryStatus::Resolved => "resolved".to_string(),
            RecoveryStatus::Discarded => "discarded".to_string(),
        }
    }
}

impl From<String> for RecoveryStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending" => RecoveryStatus::Pending,
            "unrecoverable" => RecoveryStatus::Unrecoverable,
            "resolved" => RecoveryStatus::Resolved,
            "discarded" => RecoveryStatus::Discarded,
            _ => RecoveryStatus::Pending, // default
        }
    }
}

/// A single recovery item representing a failed operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryItem {
    pub id: i64,
    pub operation_type: OperationType,
    pub target_path: String,
    pub error_reason: String,
    pub failed_at: String,
    pub retry_count: i32,
    pub last_retry_at: Option<String>,
    pub status: RecoveryStatus,
    pub created_at: String,
    pub updated_at: String,
}

impl RecoveryItem {
    /// Get a human-readable description of the operation type
    #[allow(dead_code)]
    pub fn operation_description(&self) -> &str {
        match self.operation_type {
            OperationType::MoveToTrash => "Move to Trash",
            OperationType::Restore => "Restore from Trash",
            OperationType::Import => "Import",
            OperationType::PermanentlyDelete => "Permanently Delete",
        }
    }
}
