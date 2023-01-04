use crate::value::file;
use serde::{Serialize, Deserialize};
use rexif;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photo {
    pub file: file::File,
    pub exif_entries: ExifEntries,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photos {
    pub files: Vec<Photo>
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
pub struct ExifEntries {
    pub ISO: u32,
    pub FNumber: f32,
    // TODO
}

impl Photo {
    pub fn new(file: file::File) -> Photo {
        Photo {
            file: file,
            exif_entries: ExifEntries{
                ISO: 0,
                FNumber: 0.0,
            },
        }
    }

    pub fn exif(&self) -> ExifEntries {
        let entry = rexif::parse_file(self.file.path.to_string()).unwrap();
        // TODO
        return ExifEntries{ 
            FNumber:0.0,
            ISO: 0,
        };
    }

    pub fn to_json(&self) -> String {
        return "{}".to_string();

        // TODO
        // let r  = serde_json::to_string(self);
        // if r.is_ok() {
        //     return r.unwrap()
        // } else {
        //     return "{}".to_string()
        // }
    }
}

impl Photos {
    pub fn to_json (&self) -> String {
        serde_json::to_string(&self.files).unwrap()
    }        
}


#[cfg(test)]
mod tests {
    use crate::value::file::*;
    use crate::domain::photo::*;

    #[test]
    fn test_constructor() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = Photo::new(f);
        assert_eq!(p.file.path, "/tmp/photoclove.test.dummy.jpg".to_string())
    }
    #[test]
    fn test_photos() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let f2 = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = Photo::new(f);
        let p2 = Photo::new(f2);
        let mut photos = Photos{files: Vec::new()};
        photos.files.push(p);
        photos.files.push(p2);

        assert_eq!(photos.files.len(), 2);
    }
}
