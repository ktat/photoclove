use crate::value::file;
use rexif;
use serde::{Deserialize,Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MetaData {
    pub ISO: String,
    pub FNumber: String,
    pub DateTime: String,
    pub LensModel: String,
    pub Make: String,
    pub LensMake: String,
    pub Model: String,
    // TODO
}

impl MetaData {
    pub fn empty() -> MetaData {
        MetaData{
            ISO: String::from(""),
            FNumber: String::from(""),
            DateTime: String::from(""),
            LensModel: String::from(""),
            Make: String::from(""),
            Model: String::from(""),
            LensMake: String::from(""),
         }
    }

    pub fn new(file: file::File) -> MetaData {
        let exif_data = rexif::parse_file(file.path.to_string());
        let mut data  = MetaData::empty();
        if exif_data.is_ok() {
            for e in exif_data.unwrap().entries {
                match e.tag {
                    rexif::ExifTag::FNumber => { data.FNumber = e.value_more_readable.to_string() }
                    rexif::ExifTag::ISOSpeedRatings => { data.ISO = e.value_more_readable.to_string()}
                    rexif::ExifTag::DateTime => { data.DateTime = e.value_more_readable.to_string() }
                    rexif::ExifTag::LensModel => { data.LensModel = e.value_more_readable.to_string() }
                    rexif::ExifTag::LensMake => {data.LensMake = e.value_more_readable.to_string()},
                    rexif::ExifTag::Make => {data.Make = e.value_more_readable.to_string()},
                    rexif::ExifTag::Model => {data.Model = e.value_more_readable.to_string()},
                    // rexif::ExifTag::UnknownToMe => todo!(),
                    // rexif::ExifTag::ImageDescription => todo!(),
                    // rexif::ExifTag::Orientation => todo!(),
                    // rexif::ExifTag::XResolution => todo!(),
                    // rexif::ExifTag::YResolution => todo!(),
                    // rexif::ExifTag::ResolutionUnit => todo!(),
                    // rexif::ExifTag::Software => todo!(),
                    // rexif::ExifTag::HostComputer => todo!(),
                    // rexif::ExifTag::WhitePoint => todo!(),
                    // rexif::ExifTag::PrimaryChromaticities => todo!(),
                    // rexif::ExifTag::YCbCrCoefficients => todo!(),
                    // rexif::ExifTag::ReferenceBlackWhite => todo!(),
                    // rexif::ExifTag::Copyright => todo!(),
                    // rexif::ExifTag::ExifOffset => todo!(),
                    // rexif::ExifTag::GPSOffset => todo!(),
                    // rexif::ExifTag::ExposureTime => todo!(),
                    // rexif::ExifTag::ExposureProgram => todo!(),
                    // rexif::ExifTag::SpectralSensitivity => todo!(),
                    // rexif::ExifTag::OECF => todo!(),
                    // rexif::ExifTag::SensitivityType => todo!(),
                    // rexif::ExifTag::ExifVersion => todo!(),
                    // rexif::ExifTag::DateTimeOriginal => todo!(),
                    // rexif::ExifTag::DateTimeDigitized => todo!(),
                    // rexif::ExifTag::ShutterSpeedValue => todo!(),
                    // rexif::ExifTag::ApertureValue => todo!(),
                    // rexif::ExifTag::BrightnessValue => todo!(),
                    // rexif::ExifTag::ExposureBiasValue => todo!(),
                    // rexif::ExifTag::MaxApertureValue => todo!(),
                    // rexif::ExifTag::SubjectDistance => todo!(),
                    // rexif::ExifTag::MeteringMode => todo!(),
                    // rexif::ExifTag::LightSource => todo!(),
                    // rexif::ExifTag::Flash => todo!(),
                    // rexif::ExifTag::FocalLength => todo!(),
                    // rexif::ExifTag::SubjectArea => todo!(),
                    // rexif::ExifTag::MakerNote => todo!(),
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
                    // rexif::ExifTag::ExposureMode => todo!(),
                    // rexif::ExifTag::WhiteBalanceMode => todo!(),
                    // rexif::ExifTag::DigitalZoomRatio => todo!(),
                    // rexif::ExifTag::FocalLengthIn35mmFilm => todo!(),
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
        }
        data
    }
}