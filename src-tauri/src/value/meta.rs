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
                    rexif::ExifTag::LensMake => {
                        if data.LensMake != String::new() {
                            data.LensMake = e.value.to_string();
                        }
                    }
                    rexif::ExifTag::Make => data.Make = e.value_more_readable.to_string(),
                    rexif::ExifTag::Model => data.Model = e.value_more_readable.to_string(),
                    rexif::ExifTag::Orientation => {
                        data.Orientation = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::XResolution => data.XResolution = e.value.to_string(),
                    rexif::ExifTag::YResolution => data.YResolution = e.value.to_string(),
                    rexif::ExifTag::ResolutionUnit => data.ResolutionUnit = e.value.to_string(),
                    rexif::ExifTag::Copyright => data.Copyright = e.value.to_string(),
                    rexif::ExifTag::ExposureTime => {
                        data.ExposureTime = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::ShutterSpeedValue => {
                        data.ShutterSpeedValue = e.value.to_string()
                    }
                    rexif::ExifTag::FocalLength => {
                        data.FocalLength = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::FocalLengthIn35mmFilm => {
                        data.FocalLengthIn35mmFilm = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::MakerNote => {
                        let d = get_lens_from_maker_note(e.ifd.ext_data);
                        if d != "" {
                            data.LensModel = d;
                        }
                    }
                    rexif::ExifTag::ExposureMode => {
                        data.ExposureMode = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::WhiteBalanceMode => {
                        data.WhiteBalanceMode = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::DigitalZoomRatio => {
                        data.DigitalZoomRatio = e.value_more_readable.to_string()
                    }
                    // rexif::ExifTag::UnknownToMe => todo!(),
                    // rexif::ExifTag::ImageDescription => todo!(),
                    // rexif::ExifTag::Software => todo!(),
                    // rexif::ExifTag::HostComputer => todo!(),
                    // rexif::ExifTag::WhitePoint => todo!(),
                    // rexif::ExifTag::PrimaryChromaticities => todo!(),
                    // rexif::ExifTag::YCbCrCoefficients => todo!(),
                    // rexif::ExifTag::ReferenceBlackWhite => todo!(),
                    // rexif::ExifTag::ExifOffset => todo!(),
                    // rexif::ExifTag::GPSOffset => todo!(),
                    // rexif::ExifTag::ExposureProgram => todo!(),
                    // rexif::ExifTag::SpectralSensitivity => todo!(),
                    // rexif::ExifTag::OECF => todo!(),
                    // rexif::ExifTag::SensitivityType => todo!(),
                    // rexif::ExifTag::ExifVersion => todo!(),
                    // rexif::ExifTag::DateTimeOriginal => todo!(),
                    // rexif::ExifTag::DateTimeDigitized => todo!(),
                    // rexif::ExifTag::SubjectArea => todo!(),
                    // rexif::ExifTag::ApertureValue => todo!(),
                    // rexif::ExifTag::BrightnessValue => todo!(),
                    // rexif::ExifTag::ExposureBiasValue => todo!(),
                    // rexif::ExifTag::MaxApertureValue => todo!(),
                    // rexif::ExifTag::SubjectDistance => todo!(),
                    // rexif::ExifTag::MeteringMode => todo!(),
                    // rexif::ExifTag::LightSource => todo!(),
                    // rexif::ExifTag::Flash => todo!(),
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
    if data.len() < 12 {
        return "".to_string();
    }

    // Panasonic
    let panasonic: Vec<u8> = [80, 97, 110, 97, 115, 111, 110, 105, 99, 0, 0, 0].to_vec();
    let first9chars = &data[0..12];

    // return when first 9 char is not "Panasonic"
    if first9chars != panasonic {
        return "".to_string();
    }

    // Lens name prefix regex(I only confirmed LUMIX, LEICA, OLYNMUS, SIGMA)
    let re = regex::Regex::new("(?i)(LUMIX|LEICA|OLYMPUS|SIGMA|TAMRON|KOWA|COSINA|VOIGT|VENUS)$")
        .unwrap();

    let mut i = 9;
    let mut str = String::new();
    while i < data.len() {
        if data[i] < 32 || 126 < data[i] {
            i += 1;
            continue;
        }
        str.push(std::char::from_u32(data[i].into()).unwrap());
        let captures = re.captures(&str);
        if captures.is_some() {
            let cap = captures.unwrap();
            let mut lens = cap[0].to_string();
            let mut i2 = i;
            while i2 < data.len() {
                i2 += 1;
                if data[i2] < 32 || 126 < data[i2] {
                    return lens.to_string();
                }
                lens.push(std::char::from_u32(data[i2].into()).unwrap());
            }
        }
        i += 1;
    }
    return "".to_string();
}
