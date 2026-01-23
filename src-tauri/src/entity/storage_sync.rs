//! Storage sync entity for tracking cloud backup status
//!
//! This module defines the data structures for tracking photo sync status
//! across multiple storage providers (AWS S3, Wasabi, etc.)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Information about a single storage provider sync
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageSyncInfo {
    /// The URL where the photo is stored (e.g., s3://bucket/path/photo.jpg)
    pub url: String,
    /// When the photo was synced (ISO 8601 format)
    pub synced_at: String,
}

/// Storage sync status for a photo
///
/// Stores sync information for multiple storage providers using a HashMap.
/// The key is the provider name (e.g., "aws_s3", "wasabi").
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct StorageSync {
    #[serde(flatten)]
    pub providers: HashMap<String, StorageSyncInfo>,
}

impl StorageSync {
    /// Create a new empty StorageSync
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    /// Check if the photo is synced to a specific provider
    pub fn is_synced(&self, provider: &str) -> bool {
        self.providers.contains_key(provider)
    }

    /// Get the URL for a specific provider
    pub fn get_url(&self, provider: &str) -> Option<&str> {
        self.providers.get(provider).map(|info| info.url.as_str())
    }

    /// Get the sync time for a specific provider
    pub fn get_synced_at(&self, provider: &str) -> Option<&str> {
        self.providers
            .get(provider)
            .map(|info| info.synced_at.as_str())
    }

    /// Add or update sync info for a provider
    pub fn set_sync(&mut self, provider: &str, url: String, synced_at: String) {
        self.providers.insert(
            provider.to_string(),
            StorageSyncInfo { url, synced_at },
        );
    }

    /// Remove sync info for a provider
    pub fn remove_sync(&mut self, provider: &str) {
        self.providers.remove(provider);
    }

    /// Parse from JSON string (from database)
    pub fn from_json(json: &str) -> Option<Self> {
        serde_json::from_str(json).ok()
    }

    /// Serialize to JSON string (for database)
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string())
    }

    /// Check if any provider has synced
    pub fn has_any_sync(&self) -> bool {
        !self.providers.is_empty()
    }

    /// Get all synced provider names
    pub fn get_providers(&self) -> Vec<&str> {
        self.providers.keys().map(|s| s.as_str()).collect()
    }
}

/// Provider name constants
pub mod providers {
    pub const AWS_S3: &str = "aws_s3";
    pub const WASABI: &str = "wasabi";
    pub const MINIO: &str = "minio";
    pub const CLOUDFLARE_R2: &str = "cloudflare_r2";
    pub const DIGITALOCEAN: &str = "digitalocean";
    pub const CUSTOM: &str = "custom";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_sync_basic() {
        let mut sync = StorageSync::new();
        assert!(!sync.is_synced("aws_s3"));

        sync.set_sync(
            "aws_s3",
            "s3://bucket/photo.jpg".to_string(),
            "2024-01-15T10:30:00Z".to_string(),
        );

        assert!(sync.is_synced("aws_s3"));
        assert_eq!(sync.get_url("aws_s3"), Some("s3://bucket/photo.jpg"));
    }

    #[test]
    fn test_storage_sync_json() {
        let mut sync = StorageSync::new();
        sync.set_sync(
            "aws_s3",
            "s3://bucket/photo.jpg".to_string(),
            "2024-01-15T10:30:00Z".to_string(),
        );

        let json = sync.to_json();
        let parsed = StorageSync::from_json(&json).unwrap();

        assert!(parsed.is_synced("aws_s3"));
        assert_eq!(parsed.get_url("aws_s3"), Some("s3://bucket/photo.jpg"));
    }
}
