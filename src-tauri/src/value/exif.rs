use crate::utils::exif_parser::{self, ExifTagKind};
use crate::value::file;
use regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExifData {
    pub iso: String,
    pub fnumber: String,
    pub date_time: String,
    pub date_time_original: String,
    pub lens_model: String,
    pub make: String,
    pub lens_make: String,
    pub model: String,
    pub xresolution: String,
    pub yresolution: String,
    pub resolution_unit: String,
    pub copyright: String,
    pub exposure_time: String,
    pub shutter_speed_value: String,
    pub focal_length: String,
    pub focal_length_in35mm_film: String,
    pub digital_zoom_ratio: String,
    pub exposure_mode: String,
    pub white_balance_mode: String,
    pub orientation: String,
    // TODO
}

impl ExifData {
    pub fn empty() -> ExifData {
        ExifData {
            iso: String::from(""),
            fnumber: String::from(""),
            date_time: String::from(""),
            date_time_original: String::from(""),
            lens_model: String::from(""),
            make: String::from(""),
            model: String::from(""),
            lens_make: String::from(""),
            xresolution: String::from(""),
            yresolution: String::from(""),
            resolution_unit: String::from(""),
            copyright: String::from(""),
            exposure_time: String::from(""),
            shutter_speed_value: String::from(""),
            focal_length: String::from(""),
            focal_length_in35mm_film: String::from(""),
            digital_zoom_ratio: String::from(""),
            exposure_mode: String::from(""),
            white_balance_mode: String::from(""),
            orientation: String::from(""),
        }
    }

    pub fn new(file: file::File) -> ExifData {
        let mut data = ExifData::empty();
        let exif_result = exif_parser::parse_exif(&file.path);

        match exif_result {
            Err(_) => {
                // Fall back to file creation time
                let file_created_time = file.created_datetime();
                if let Ok(re) = regex::Regex::new(r"^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})") {
                    data.date_time = re.replace(&file_created_time, "$1/$2/$3").to_string();
                } else {
                    data.date_time = file_created_time;
                }
            }
            Ok(parse_result) => {
                for e in parse_result.entries {
                    match e.tag {
                        ExifTagKind::FNumber => data.fnumber = e.value_readable.clone(),
                        ExifTagKind::ISOSpeedRatings => data.iso = e.value_readable.clone(),
                        ExifTagKind::DateTime => data.date_time = e.value_readable.clone(),
                        ExifTagKind::DateTimeOriginal => {
                            data.date_time_original = e.value_readable.clone()
                        }
                        ExifTagKind::LensModel => data.lens_model = e.value.clone(),
                        ExifTagKind::LensMake => {
                            if data.lens_make != String::new() {
                                data.lens_make = e.value.clone();
                            }
                        }
                        ExifTagKind::Make => data.make = e.value_readable.clone(),
                        ExifTagKind::Model => data.model = e.value_readable.clone(),
                        ExifTagKind::Orientation => data.orientation = e.value_readable.clone(),
                        ExifTagKind::XResolution => data.xresolution = e.value.clone(),
                        ExifTagKind::YResolution => data.yresolution = e.value.clone(),
                        ExifTagKind::ResolutionUnit => data.resolution_unit = e.value.clone(),
                        ExifTagKind::Copyright => data.copyright = e.value.clone(),
                        ExifTagKind::ExposureTime => data.exposure_time = e.value_readable.clone(),
                        ExifTagKind::ShutterSpeedValue => {
                            data.shutter_speed_value = e.value.clone()
                        }
                        ExifTagKind::FocalLength => data.focal_length = e.value_readable.clone(),
                        ExifTagKind::FocalLengthIn35mmFilm => {
                            data.focal_length_in35mm_film = e.value_readable.clone()
                        }
                        ExifTagKind::DigitalZoomRatio => {
                            data.digital_zoom_ratio = e.value_readable.clone()
                        }
                        ExifTagKind::ExposureMode => data.exposure_mode = e.value_readable.clone(),
                        ExifTagKind::WhiteBalanceMode => {
                            data.white_balance_mode = e.value_readable.clone()
                        }
                        ExifTagKind::MakerNote => {
                            let d = get_lens_from_maker_note(e.ext_data);
                            if !d.is_empty() {
                                data.lens_model = d;
                            }
                        }
                        ExifTagKind::Unknown(_) => {}
                    }
                }
                let mut t = data.date_time.clone();
                if t.is_empty() {
                    t = data.date_time_original.clone();
                }
                // Convert EXIF colon format to ISO 8601 hyphen format (2025:11:23 -> 2025-11-23)
                if let Ok(re) = regex::Regex::new(r"^([0-9]{4}):([0-9]{1,2}):([0-9]{1,2})") {
                    if !t.is_empty() {
                        data.date_time = re.replace(&t, "$1-$2-$3").to_string();
                    } else {
                        let file_created_time = file.created_datetime();
                        // File created time is already in hyphen format, keep it as is
                        data.date_time = file_created_time;
                    }
                    // Also convert date_time_original to hyphen format for consistency
                    if !data.date_time_original.is_empty() {
                        data.date_time_original =
                            re.replace(&data.date_time_original, "$1-$2-$3").to_string();
                    }
                }
            }
        }
        data
    }
}

// currently only for Panasonic camera
fn get_lens_from_maker_note(data: Vec<u8>) -> String {
    if data.len() < 13 {
        return String::new();
    }

    // Panasonic signature: "Panasonic\0\0\0"
    let panasonic: [u8; 12] = [80, 97, 110, 97, 115, 111, 110, 105, 99, 0, 0, 0];
    if data[0..12] != panasonic {
        return String::new();
    }

    // Lens name prefix regex (LUMIX, LEICA, OLYMPUS, SIGMA, etc.)
    let re = match regex::Regex::new(
        "(?i)(LUMIX|LEICA|OLYMPUS|SIGMA|TAMRON|KOWA|COSINA|VOIGT|VENUS)$",
    ) {
        Ok(r) => r,
        Err(_) => return String::new(),
    };

    // safely skip 12byte x (data[12](num of entries) + 1("Panasonic\0\0\0"))
    let mut i: usize = usize::from(data[12] + 1) * 12;

    let mut buffer = "         ".to_string(); // dummy 9 chars
    while i < data.len() {
        if data[i] < 32 || data[i] > 126 {
            i += 1;
            continue;
        }
        // Keep last 9 chars for regex matching
        buffer = buffer[buffer.len().saturating_sub(9)..].to_string();
        if let Some(c) = std::char::from_u32(data[i].into()) {
            buffer.push(c);
        }

        if let Some(cap) = re.captures(&buffer) {
            let mut lens = cap[0].to_string();
            let mut i2 = i + 1;
            while i2 < data.len() {
                if data[i2] < 32 || data[i2] > 126 {
                    return lens;
                }
                if let Some(c) = std::char::from_u32(data[i2].into()) {
                    lens.push(c);
                }
                i2 += 1;
            }
            return lens;
        }
        i += 1;
    }
    String::new()
}
