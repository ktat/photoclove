use crate::domain::photo;
use crate::value::file;

pub fn photos_from_dir (files: file::Files) -> photo::Photos {
    let mut photos = photo::Photos::new();
    for file in files.files {
        let p = photo::Photo::new(file);
        photos.files.push(p)
    }
    photos
}

#[cfg(test)]
mod tests {
    use crate::value::file;
    use crate::domain_service::photo_service;
    #[test]
    fn test_make_photos() {
        let dir = file::Dir::new("tests/assets/files".to_string());
        let files = dir.find_files();
        let photos = photo_service::photos_from_dir(files);
        assert_eq!(photos.files.len(), 3)
    }
}