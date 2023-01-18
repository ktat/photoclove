use crate::value::{file,meta};
use regex;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photo {
    pub file: file::File,
    pub dir: file::Dir,
    pub time: String,
    pub meta_data: meta::MetaData,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Photos {
    pub files: Vec<Photo>,
    pub has_next: bool,
    pub has_prev: bool,
}

impl Photo {
    pub fn new(file: file::File) -> Photo {
        let created_time = file.created_datetime();
        let d = file.path.clone();
        let p = std::path::Path::new(&d);

        Photo {
            file: file,
            time: created_time,
            dir: file::Dir::new(p.parent().unwrap().display().to_string()),
            meta_data: meta::MetaData::empty(),
        }
    }

    pub fn embed_meta(&mut self, meta: meta::MetaData) {
        self.time = meta.DateTime.clone();
        self.meta_data = meta;
    }

    pub fn created_date(&self) -> String {
        let re = regex::Regex::new(r"^([0-9]{4})/([0-9]{1,2})/([0-9]{1,2})").unwrap();
        re.replace(&self.time, "$1-$2-$3").to_string()
    }
}

impl Photos {
    pub fn new () -> Photos {
        Photos{ files: Vec::new(), has_next: false, has_prev: false }
    }
    pub fn to_json (&self) -> String {
        serde_json::to_string(&self).unwrap()
    }        
}


#[cfg(test)]
mod tests {
    use crate::value::file;
    use crate::domain::photo;

    #[test]
    fn test_constructor() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = photo::Photo::new(f);
        assert_eq!(p.file.path, "/tmp/photoclove.test.dummy.jpg".to_string())
    }
    #[test]
    fn test_photos() {
        let f = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let f2 = file::File::new("/tmp/photoclove.test.dummy.jpg".to_string());
        let p = photo::Photo::new(f);
        let p2 = photo::Photo::new(f2);
        let mut photos = photo::Photos::new();
        photos.files.push(p);
        photos.files.push(p2);

        assert_eq!(photos.files.len(), 2);
    }
}
