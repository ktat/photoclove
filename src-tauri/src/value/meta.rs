use crate::value::file;
use rexif;
use serde::{Deserialize,Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MetaData {
    pub ISO: String,
    pub FNumber: String,
    pub DateTime: String,
    pub LensModel: String,
    // TODO
}

impl MetaData {
    pub fn empty() -> MetaData {
        MetaData{ ISO: String::from(""), FNumber: String::from(""), DateTime: String::from(""), LensModel: String::from("") }
    }

    pub fn new(file: file::File) -> MetaData {
        let exif_data = rexif::parse_file(file.path.to_string()).unwrap();
        let mut data  = MetaData::empty();
        for e in exif_data.entries {
            match e.tag {
                rexif::ExifTag::FNumber => { data.FNumber = e.value_more_readable.to_string() }
                rexif::ExifTag::ISOSpeedRatings => { data.ISO = e.value_more_readable.to_string()}
                rexif::ExifTag::DateTime => { data.DateTime = e.value_more_readable.to_string() }
                rexif::ExifTag::LensModel => { data.LensModel = e.value_more_readable.to_string() }
                default => {}
            }
        }
        data
    }
}