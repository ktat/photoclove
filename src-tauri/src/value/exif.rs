use crate::value::file;
use regex;
use rexif;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExifData {
    pub iso: String,
    pub fnumber: String,
    pub date_time: String,
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
        let exif_data = rexif::parse_file(file.path.to_string());
        let mut data = ExifData::empty();
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
                    rexif::ExifTag::FNumber => data.fnumber = e.value_more_readable.to_string(),
                    rexif::ExifTag::ISOSpeedRatings => data.iso = e.value_more_readable.to_string(),
                    rexif::ExifTag::DateTime => data.date_time = e.value_more_readable.to_string(),
                    rexif::ExifTag::LensModel => data.lens_model = e.value.to_string(),
                    rexif::ExifTag::LensMake => {
                        if data.lens_make != String::new() {
                            data.lens_make = e.value.to_string();
                        }
                    }
                    rexif::ExifTag::Make => data.make = e.value_more_readable.to_string(),
                    rexif::ExifTag::Model => data.model = e.value_more_readable.to_string(),
                    rexif::ExifTag::Orientation => {
                        data.orientation = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::XResolution => data.xresolution = e.value.to_string(),
                    rexif::ExifTag::YResolution => data.yresolution = e.value.to_string(),
                    rexif::ExifTag::ResolutionUnit => data.resolution_unit = e.value.to_string(),
                    rexif::ExifTag::Copyright => data.copyright = e.value.to_string(),
                    rexif::ExifTag::ExposureTime => {
                        data.exposure_time = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::ShutterSpeedValue => {
                        data.shutter_speed_value = e.value.to_string()
                    }
                    rexif::ExifTag::FocalLength => {
                        data.focal_length = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::FocalLengthIn35mmFilm => {
                        data.focal_length_in35mm_film = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::MakerNote => {
                        let d = get_lens_from_maker_note(e.ifd.ext_data);
                        if d != "" {
                            data.lens_model = d;
                        }
                    }
                    rexif::ExifTag::ExposureMode => {
                        data.exposure_mode = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::WhiteBalanceMode => {
                        data.white_balance_mode = e.value_more_readable.to_string()
                    }
                    rexif::ExifTag::DigitalZoomRatio => {
                        data.digital_zoom_ratio = e.value_more_readable.to_string()
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
            let t = data.date_time.clone();
            let re = regex::Regex::new(r"^([0-9]{4}):([0-9]{1,2}):([0-9]{1,2})").unwrap();
            data.date_time = re.replace(&t, "$1/$2/$3").to_string();
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
    let panasonic: [u8; 12] = [80, 97, 110, 97, 115, 111, 110, 105, 99, 0, 0, 0];
    let first12chars = &data[0..12];

    // return when first 9 char is not "Panasonic"
    if first12chars != &panasonic {
        return "".to_string();
    }

    // Lens name prefix regex(I only confirmed LUMIX, LEICA, OLYNMUS, SIGMA)
    let re = regex::Regex::new("(?i)(LUMIX|LEICA|OLYMPUS|SIGMA|TAMRON|KOWA|COSINA|VOIGT|VENUS)$")
        .unwrap();

    // safely skip 12byte x (data[12](num of entries) + 1("Panasonic\0\0\0"))
    let mut i: usize = usize::from(data[12] + 1) * 12;

    let mut str = "         ".to_string(); // dummy 9 chars
    while i < data.len() {
        if data[i] < 32 || 126 < data[i] {
            i += 1;
            continue;
        }
        // enough length for regex
        str = str[str.len() - 9..str.len()].to_string();
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
