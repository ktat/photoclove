use crate::value::file;
use regex;
use rexif;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MetaData {
    pub ISO: String,
    pub FNumber: String,
    pub DateTime: String,
    pub LensModel: String,
    pub Make: String,
    pub LensMake: String,
    pub Model: String,
    pub XResolution: String,
    pub YResolution: String,
    pub ResolutionUnit: String,
    pub Copyright: String,
    pub ExposureTime: String,
    pub ShutterSpeedValue: String,
    pub FocalLength: String,
    pub FocalLengthIn35mmFilm: String,
    pub DigitalZoomRatio: String,
    pub ExposureMode: String,
    pub WhiteBalanceMode: String,
    pub Orientation: String,
    // TODO
}

impl MetaData {
    pub fn empty() -> MetaData {
        MetaData {
            ISO: String::from(""),
            FNumber: String::from(""),
            DateTime: String::from(""),
            LensModel: String::from(""),
            Make: String::from(""),
            Model: String::from(""),
            LensMake: String::from(""),
            XResolution: String::from(""),
            YResolution: String::from(""),
            ResolutionUnit: String::from(""),
            Copyright: String::from(""),
            ExposureTime: String::from(""),
            ShutterSpeedValue: String::from(""),
            FocalLength: String::from(""),
            FocalLengthIn35mmFilm: String::from(""),
            DigitalZoomRatio: String::from(""),
            ExposureMode: String::from(""),
            WhiteBalanceMode: String::from(""),
            Orientation: String::from(""),
        }
    }

    pub fn new(file: file::File) -> MetaData {
        let exif_data = rexif::parse_file(file.path.to_string());
        let mut data = MetaData::empty();
        if exif_data.is_ok() {
            for e in exif_data.unwrap().entries {
                match e.tag {
                    _ => {
                        // eprintln!("{:?}", e.tag);
                        // eprintln!("{:?}", e.ifd.ext_data);
                        // eprintln!("{:?}", e.value.to_string());
                        // eprintln!("{:?}", e.value_more_readable.to_string());
                    }
                }
            }
            let exif_data = rexif::parse_file(file.path.to_string());
            for e in exif_data.unwrap().entries {
                match e.tag {
                    rexif::ExifTag::FNumber => data.FNumber = e.value_more_readable.to_string(),
                    rexif::ExifTag::ISOSpeedRatings => data.ISO = e.value_more_readable.to_string(),
                    rexif::ExifTag::DateTime => data.DateTime = e.value_more_readable.to_string(),
                    rexif::ExifTag::LensModel => data.LensModel = e.value.to_string(),
                    rexif::ExifTag::LensMake => data.LensMake = e.value.to_string(),
                    rexif::ExifTag::Make => data.Make = e.value_more_readable.to_string(),
                    rexif::ExifTag::Model => data.Model = e.value_more_readable.to_string(),
                    // rexif::ExifTag::UnknownToMe => todo!(),
                    // rexif::ExifTag::ImageDescription => todo!(),
                    rexif::ExifTag::Orientation => {
                        data.Orientation = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::XResolution => data.XResolution = e.value.to_string(),
                    rexif::ExifTag::YResolution => data.YResolution = e.value.to_string(),
                    rexif::ExifTag::ResolutionUnit => data.ResolutionUnit = e.value.to_string(),
                    // rexif::ExifTag::Software => todo!(),
                    // rexif::ExifTag::HostComputer => todo!(),
                    // rexif::ExifTag::WhitePoint => todo!(),
                    // rexif::ExifTag::PrimaryChromaticities => todo!(),
                    // rexif::ExifTag::YCbCrCoefficients => todo!(),
                    // rexif::ExifTag::ReferenceBlackWhite => todo!(),
                    rexif::ExifTag::Copyright => data.Copyright = e.value.to_string(),
                    // rexif::ExifTag::ExifOffset => todo!(),
                    // rexif::ExifTag::GPSOffset => todo!(),
                    rexif::ExifTag::ExposureTime => {
                        data.ExposureTime = e.value_more_readable.to_string()
                    }
                    // rexif::ExifTag::ExposureProgram => todo!(),
                    // rexif::ExifTag::SpectralSensitivity => todo!(),
                    // rexif::ExifTag::OECF => todo!(),
                    // rexif::ExifTag::SensitivityType => todo!(),
                    // rexif::ExifTag::ExifVersion => todo!(),
                    // rexif::ExifTag::DateTimeOriginal => todo!(),
                    // rexif::ExifTag::DateTimeDigitized => todo!(),
                    rexif::ExifTag::ShutterSpeedValue => {
                        data.ShutterSpeedValue = e.value.to_string()
                    }
                    // rexif::ExifTag::ApertureValue => todo!(),
                    // rexif::ExifTag::BrightnessValue => todo!(),
                    // rexif::ExifTag::ExposureBiasValue => todo!(),
                    // rexif::ExifTag::MaxApertureValue => todo!(),
                    // rexif::ExifTag::SubjectDistance => todo!(),
                    // rexif::ExifTag::MeteringMode => todo!(),
                    // rexif::ExifTag::LightSource => todo!(),
                    // rexif::ExifTag::Flash => todo!(),
                    rexif::ExifTag::FocalLength => {
                        data.FocalLength = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::FocalLengthIn35mmFilm => {
                        data.FocalLengthIn35mmFilm = e.value_more_readable.to_string()
                    }
                    // rexif::ExifTag::SubjectArea => todo!(),
                    rexif::ExifTag::MakerNote => {
                        let d = get_lens_from_maker_note(e.ifd.ext_data);
                        if d != "" {
                            data.LensModel = d;
                        }
                    }
                    // rexif::ExifTag::UserComment => todo!(),
                    // rexif::ExifTag::FlashPixVersion => todo!(),
                    // rexif::ExifTag::ColorSpace => todo!(),
                    // rexif::ExifTag::RelatedSoundFile => todo!(),
                    // rexif::ExifTag::FlashEnergy => todo!(),
                    // rexif::ExifTag::FocalPlaneXResolution => todo!(),
                    // rexif::ExifTag::FocalPlaneYResolution => todo!(),
                    // rexif::ExifTag::FocalPlaneResolutionUnit => todo!(),
                    // rexif::ExifTag::SubjectLocation => todo!(),
                    // rexif::ExifTag::ExposureIndex => todo!(),
                    // rexif::ExifTag::SensingMethod => todo!(),
                    // rexif::ExifTag::FileSource => todo!(),
                    // rexif::ExifTag::SceneType => todo!(),
                    // rexif::ExifTag::CFAPattern => todo!(),
                    // rexif::ExifTag::CustomRendered => todo!(),
                    rexif::ExifTag::ExposureMode => {
                        data.ExposureMode = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::WhiteBalanceMode => {
                        data.WhiteBalanceMode = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::DigitalZoomRatio => {
                        data.DigitalZoomRatio = e.value_more_readable.to_string()
                    }
                    // rexif::ExifTag::SceneCaptureType => todo!(),
                    // rexif::ExifTag::GainControl => todo!(),
                    // rexif::ExifTag::Contrast => todo!(),
                    // rexif::ExifTag::Saturation => todo!(),
                    // rexif::ExifTag::Sharpness => todo!(),
                    // rexif::ExifTag::DeviceSettingDescription => todo!(),
                    // rexif::ExifTag::SubjectDistanceRange => todo!(),
                    // rexif::ExifTag::ImageUniqueID => todo!(),
                    // rexif::ExifTag::LensSpecification => todo!(),
                    // rexif::ExifTag::Gamma => todo!(),
                    // rexif::ExifTag::GPSVersionID => todo!(),
                    // rexif::ExifTag::GPSLatitudeRef => todo!(),
                    // rexif::ExifTag::GPSLatitude => todo!(),
                    // rexif::ExifTag::GPSLongitudeRef => todo!(),
                    // rexif::ExifTag::GPSLongitude => todo!(),
                    // rexif::ExifTag::GPSAltitudeRef => todo!(),
                    // rexif::ExifTag::GPSAltitude => todo!(),
                    // rexif::ExifTag::GPSTimeStamp => todo!(),
                    // rexif::ExifTag::GPSSatellites => todo!(),
                    // rexif::ExifTag::GPSStatus => todo!(),
                    // rexif::ExifTag::GPSMeasureMode => todo!(),
                    // rexif::ExifTag::GPSDOP => todo!(),
                    // rexif::ExifTag::GPSSpeedRef => todo!(),
                    // rexif::ExifTag::GPSSpeed => todo!(),
                    // rexif::ExifTag::GPSTrackRef => todo!(),
                    // rexif::ExifTag::GPSTrack => todo!(),
                    // rexif::ExifTag::GPSImgDirectionRef => todo!(),
                    // rexif::ExifTag::GPSImgDirection => todo!(),
                    // rexif::ExifTag::GPSMapDatum => todo!(),
                    // rexif::ExifTag::GPSDestLatitudeRef => todo!(),
                    // rexif::ExifTag::GPSDestLatitude => todo!(),
                    // rexif::ExifTag::GPSDestLongitudeRef => todo!(),
                    // rexif::ExifTag::GPSDestLongitude => todo!(),
                    // rexif::ExifTag::GPSDestBearingRef => todo!(),
                    // rexif::ExifTag::GPSDestBearing => todo!(),
                    // rexif::ExifTag::GPSDestDistanceRef => todo!(),
                    // rexif::ExifTag::GPSDestDistance => todo!(),
                    // rexif::ExifTag::GPSProcessingMethod => todo!(),
                    // rexif::ExifTag::GPSAreaInformation => todo!(),
                    // rexif::ExifTag::GPSDateStamp => todo!(),
                    // rexif::ExifTag::GPSDifferential => todo!(),
                    _ => {}
                }
            }
            let t = data.DateTime.clone();
            let re = regex::Regex::new(r"^([0-9]{4}):([0-9]{1,2}):([0-9]{1,2})").unwrap();
            data.DateTime = re.replace(&t, "$1/$2/$3").to_string();
        }
        data
    }
}

// currently only for Panasonic camera
fn get_lens_from_maker_note(data: Vec<u8>) -> String {
    let mut str = String::new();
    let mut i = 0;

    let re = regex::Regex::new("(LUMIX|LEICA|OLYMPUS)$").unwrap();
    while i < data.len() {
        let d = data[i];
        let c = std::char::from_u32(d.into());
        match c {
            Some(c) => str.push(c),
            _ => (),
        }
        if str.len() == 9 && str != "Panasonic" {
            // eprintln!("{:?}", str);
            return "".to_string();
        }

        if re.is_match(&str) {
            let cap = re.captures(&str).unwrap();
            if cap.len() > 0 {
                let name = &cap[0];
                let mut i2 = i;
                let mut lens = name.to_string();
                while i2 < data.len() {
                    i2 += 1;
                    if data[i2] < 32 || 126 < data[i2] {
                        eprintln!("{:?}", lens);
                        return lens.to_string();
                    }
                    let c = std::char::from_u32(data[i2].into());
                    match c {
                        Some(c) => lens.push(c),
                        _ => {
                            return lens.to_string();
                        }
                    }
                }
            }
        }
        i += 1;
    }
    return "".to_string();
}
