use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollectionType {
    Album,
    Tag,
}

#[allow(dead_code)]
impl CollectionType {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.to_lowercase().as_str() {
            "album" => Ok(CollectionType::Album),
            "tag" => Ok(CollectionType::Tag),
            _ => Err(format!("Unknown collection type: {}", s)),
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            CollectionType::Album => "album".to_string(),
            CollectionType::Tag => "tag".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoCollection {
    pub id: i64,
    pub collection_type: CollectionType,
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
    pub cover_photo_path: Option<String>,
    pub settings: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub photo_count: Option<i32>,
}

#[allow(dead_code)]
impl PhotoCollection {
    pub fn new(
        id: i64,
        collection_type: CollectionType,
        name: String,
        color: Option<String>,
        description: Option<String>,
        cover_photo_path: Option<String>,
        settings: HashMap<String, serde_json::Value>,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            collection_type,
            name,
            color,
            description,
            cover_photo_path,
            settings,
            created_at,
            updated_at,
            photo_count: None,
        }
    }

    pub fn is_album(&self) -> bool {
        matches!(self.collection_type, CollectionType::Album)
    }

    pub fn is_tag(&self) -> bool {
        matches!(self.collection_type, CollectionType::Tag)
    }

    pub fn supports_ordering(&self) -> bool {
        self.is_album()
    }

    pub fn supports_description(&self) -> bool {
        self.is_album()
    }

    pub fn supports_cover_photo(&self) -> bool {
        self.is_album()
    }

    pub fn supports_color(&self) -> bool {
        self.is_tag()
    }

    pub fn get_display_icon(&self) -> &'static str {
        if self.is_album() {
            "📚"
        } else {
            "🏷️"
        }
    }

    pub fn get_visual_identifier(&self) -> VisualIdentifier {
        if self.is_album() && self.cover_photo_path.is_some() {
            VisualIdentifier::Image(self.cover_photo_path.clone().unwrap())
        } else if self.is_tag() && self.color.is_some() {
            VisualIdentifier::Color(self.color.clone().unwrap())
        } else {
            VisualIdentifier::Icon(self.get_display_icon().to_string())
        }
    }

    pub fn get_photo_count(&self) -> i32 {
        self.photo_count.unwrap_or(0)
    }

    pub fn set_photo_count(&mut self, count: i32) {
        self.photo_count = Some(count);
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Collection name cannot be empty".to_string());
        }

        if self.is_tag() && self.description.is_some() {
            return Err("Tags cannot have descriptions".to_string());
        }

        if self.is_tag() && self.cover_photo_path.is_some() {
            return Err("Tags cannot have cover photos".to_string());
        }

        if self.is_album() && self.color.is_some() {
            return Err("Albums cannot have colors".to_string());
        }

        Ok(())
    }

    pub fn to_json_value(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap_or(serde_json::Value::Null)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VisualIdentifier {
    Image(String),
    Color(String),
    Icon(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoCollectionItem {
    pub collection_id: i64,
    pub photo_path: String,
    pub order_index: i32,
    pub added_at: DateTime<Utc>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[allow(dead_code)]
impl PhotoCollectionItem {
    pub fn new(
        collection_id: i64,
        photo_path: String,
        order_index: i32,
        added_at: DateTime<Utc>,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Self {
        Self {
            collection_id,
            photo_path,
            order_index,
            added_at,
            metadata,
        }
    }

    pub fn get_metadata_value(&self, key: &str) -> Option<&serde_json::Value> {
        self.metadata.get(key)
    }

    pub fn set_metadata_value(&mut self, key: String, value: serde_json::Value) {
        self.metadata.insert(key, value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collection_type_from_str() {
        assert!(matches!(
            CollectionType::from_str("album"),
            Ok(CollectionType::Album)
        ));
        assert!(matches!(
            CollectionType::from_str("tag"),
            Ok(CollectionType::Tag)
        ));
        assert!(matches!(
            CollectionType::from_str("Album"),
            Ok(CollectionType::Album)
        ));
        assert!(matches!(
            CollectionType::from_str("TAG"),
            Ok(CollectionType::Tag)
        ));
        assert!(CollectionType::from_str("invalid").is_err());
    }

    #[test]
    fn test_photo_collection_validation() {
        let album = PhotoCollection::new(
            1,
            CollectionType::Album,
            "Test Album".to_string(),
            None,
            Some("Description".to_string()),
            None,
            HashMap::new(),
            Utc::now(),
            Utc::now(),
        );
        assert!(album.validate().is_ok());

        let tag = PhotoCollection::new(
            2,
            CollectionType::Tag,
            "Test Tag".to_string(),
            Some("#ff0000".to_string()),
            None,
            None,
            HashMap::new(),
            Utc::now(),
            Utc::now(),
        );
        assert!(tag.validate().is_ok());

        // Invalid: tag with description
        let invalid_tag = PhotoCollection::new(
            3,
            CollectionType::Tag,
            "Invalid Tag".to_string(),
            None,
            Some("Invalid description".to_string()),
            None,
            HashMap::new(),
            Utc::now(),
            Utc::now(),
        );
        assert!(invalid_tag.validate().is_err());
    }

    #[test]
    fn test_collection_capabilities() {
        let album = PhotoCollection::new(
            1,
            CollectionType::Album,
            "Test".to_string(),
            None,
            None,
            None,
            HashMap::new(),
            Utc::now(),
            Utc::now(),
        );

        assert!(album.is_album());
        assert!(!album.is_tag());
        assert!(album.supports_ordering());
        assert!(album.supports_description());
        assert!(album.supports_cover_photo());
        assert!(!album.supports_color());

        let tag = PhotoCollection::new(
            2,
            CollectionType::Tag,
            "Test".to_string(),
            None,
            None,
            None,
            HashMap::new(),
            Utc::now(),
            Utc::now(),
        );

        assert!(!tag.is_album());
        assert!(tag.is_tag());
        assert!(!tag.supports_ordering());
        assert!(!tag.supports_description());
        assert!(!tag.supports_cover_photo());
        assert!(tag.supports_color());
    }
}
