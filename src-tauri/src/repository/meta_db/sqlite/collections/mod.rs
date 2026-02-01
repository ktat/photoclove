//! Collections module for album and tag operations
//!
//! This module is split into three submodules:
//! - `crud`: Create, Read, Update, Delete operations for collections
//! - `items`: Photo-collection relationship operations (add/remove photos, reorder)
//! - `queries`: Query operations (get photos by collection, search)

mod crud;
mod items;
mod queries;

// Re-export CRUD operations
pub(crate) use crud::{
    create_collection,
    delete_collection,
    get_all_collections,
    get_collection_type,
    get_or_create_collection,
    update_collection,
};

// Re-export item operations
pub(crate) use items::{
    add_photo_to_collection,
    add_photo_to_collection_with_metadata,
    add_photos_to_collection_bulk,
    remove_all_collections_from_photo,
    remove_photo_from_collection,
    reorder_collection_items,
};

// Re-export query operations
pub(crate) use queries::{
    get_collection_photos,
    get_collections_for_photo,
    get_photos_by_collection_ids,
};
