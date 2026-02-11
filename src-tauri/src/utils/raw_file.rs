//! RAW file detection utility
//!
//! Provides shared functions to identify RAW camera file formats
//! and check for all supported image types (standard + RAW).

/// RAW file extensions supported by PhotoClove
const RAW_EXTENSIONS: &[&str] = &["cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2", "3fr"];

/// Standard image extensions
const STANDARD_IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];

/// Check if a file path has a RAW file extension
pub fn is_raw_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    RAW_EXTENSIONS.iter().any(|ext| lower.ends_with(&format!(".{}", ext)))
}

/// Check if a file path is a supported image (standard + RAW)
pub fn is_supported_image(path: &str) -> bool {
    let lower = path.to_lowercase();
    STANDARD_IMAGE_EXTENSIONS
        .iter()
        .chain(RAW_EXTENSIONS.iter())
        .any(|ext| lower.ends_with(&format!(".{}", ext)))
}

/// Get RAW extensions as a regex alternation pattern (e.g., "cr2|cr3|nef|arw|dng|raf|orf|rw2")
#[allow(dead_code)]
pub fn raw_extensions_regex_pattern() -> &'static str {
    "cr2|cr3|nef|arw|dng|raf|orf|rw2"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_raw_file() {
        assert!(is_raw_file("/photos/DSC001.CR2"));
        assert!(is_raw_file("/photos/DSC001.cr2"));
        assert!(is_raw_file("/photos/DSC001.NEF"));
        assert!(is_raw_file("/photos/DSC001.arw"));
        assert!(is_raw_file("/photos/DSC001.DNG"));
        assert!(is_raw_file("/photos/DSC001.raf"));
        assert!(is_raw_file("/photos/DSC001.orf"));
        assert!(is_raw_file("/photos/DSC001.rw2"));
        assert!(is_raw_file("/photos/DSC001.CR3"));
        assert!(!is_raw_file("/photos/DSC001.jpg"));
        assert!(!is_raw_file("/photos/DSC001.png"));
        assert!(!is_raw_file("/photos/DSC001.mp4"));
    }

    #[test]
    fn test_is_supported_image() {
        assert!(is_supported_image("/photos/DSC001.jpg"));
        assert!(is_supported_image("/photos/DSC001.JPEG"));
        assert!(is_supported_image("/photos/DSC001.png"));
        assert!(is_supported_image("/photos/DSC001.gif"));
        assert!(is_supported_image("/photos/DSC001.webp"));
        assert!(is_supported_image("/photos/DSC001.heic"));
        assert!(is_supported_image("/photos/DSC001.heif"));
        assert!(is_supported_image("/photos/DSC001.CR2"));
        assert!(is_supported_image("/photos/DSC001.nef"));
        assert!(!is_supported_image("/photos/DSC001.mp4"));
        assert!(!is_supported_image("/photos/DSC001.txt"));
    }
}
