use chrono::{Datelike, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Timelike, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Date {
    pub year: i32,
    pub month: u32,
    pub day: u32,
}

/// DateTime value object for handling EXIF date-time values
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct DateTime {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub second: u32,
}

impl Clone for DateTime {
    fn clone(&self) -> DateTime {
        DateTime {
            year: self.year,
            month: self.month,
            day: self.day,
            hour: self.hour,
            minute: self.minute,
            second: self.second,
        }
    }
}

impl DateTime {
    pub fn new(year: i32, month: u32, day: u32, hour: u32, minute: u32, second: u32) -> Option<DateTime> {
        // Validate using chrono
        let date = NaiveDate::from_ymd_opt(year, month, day)?;
        let time = NaiveTime::from_hms_opt(hour, minute, second)?;
        let _dt = NaiveDateTime::new(date, time);

        Some(DateTime {
            year,
            month,
            day,
            hour,
            minute,
            second,
        })
    }

    /// Parse datetime string with flexible date delimiter
    /// Supports formats like:
    /// - "2025:11:23 06:17:23" (EXIF format with colon)
    /// - "2025/11/23 06:17:23" (slash format)
    /// - "2025-11-23 06:17:23" (ISO format)
    pub fn try_from_string(datetime_str: &str) -> Result<DateTime, String> {
        let trimmed = datetime_str.trim();
        if trimmed.is_empty() {
            return Err("empty datetime string".to_string());
        }

        // Split into date and time parts
        let parts: Vec<&str> = trimmed.splitn(2, ' ').collect();
        if parts.is_empty() {
            return Err(format!("invalid datetime format: {}", datetime_str));
        }

        let date_part = parts[0];

        // Detect delimiter and parse date
        let date_delimiter = if date_part.contains(':') {
            ":"
        } else if date_part.contains('/') {
            "/"
        } else if date_part.contains('-') {
            "-"
        } else {
            return Err(format!("unknown date delimiter in: {}", date_part));
        };

        let date_components: Vec<&str> = date_part.split(date_delimiter).collect();
        if date_components.len() < 3 {
            return Err(format!("invalid date format: {}", date_part));
        }

        let year = date_components[0]
            .parse::<i32>()
            .map_err(|_| format!("invalid year: {}", date_components[0]))?;
        let month = date_components[1]
            .parse::<u32>()
            .map_err(|_| format!("invalid month: {}", date_components[1]))?;
        let day = date_components[2]
            .parse::<u32>()
            .map_err(|_| format!("invalid day: {}", date_components[2]))?;

        // Parse time if present
        let (hour, minute, second) = if parts.len() > 1 {
            let time_part = parts[1];
            let time_components: Vec<&str> = time_part.split(':').collect();
            if time_components.len() >= 3 {
                let h = time_components[0]
                    .parse::<u32>()
                    .map_err(|_| format!("invalid hour: {}", time_components[0]))?;
                let m = time_components[1]
                    .parse::<u32>()
                    .map_err(|_| format!("invalid minute: {}", time_components[1]))?;
                let s = time_components[2]
                    .parse::<u32>()
                    .map_err(|_| format!("invalid second: {}", time_components[2]))?;
                (h, m, s)
            } else {
                (0, 0, 0)
            }
        } else {
            (0, 0, 0)
        };

        DateTime::new(year, month, day, hour, minute, second)
            .ok_or_else(|| format!("invalid datetime: {}", datetime_str))
    }

    /// Check if two datetime strings represent the same datetime
    /// Returns true if they are equal, false if different or parsing fails
    pub fn are_equal(dt1: &str, dt2: &str) -> bool {
        match (Self::try_from_string(dt1), Self::try_from_string(dt2)) {
            (Ok(d1), Ok(d2)) => d1 == d2,
            _ => false,
        }
    }

    /// Create DateTime from current UTC time
    pub fn now() -> DateTime {
        let now = Utc::now();
        DateTime {
            year: now.year(),
            month: now.month(),
            day: now.day(),
            hour: now.hour(),
            minute: now.minute(),
            second: now.second(),
        }
    }

    /// Format for database storage: "YYYY-MM-DD HH:MM:SS"
    pub fn to_db_string(&self) -> String {
        format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
            self.year, self.month, self.day, self.hour, self.minute, self.second
        )
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Dates {
    pub dates: Vec<Date>,
}

impl Copy for Date {}
impl Clone for Date {
    fn clone(&self) -> Date {
        Date::new(self.year, self.month, self.day).unwrap()
    }
}

impl Date {
    /// Validates if a string has a valid date format
    pub fn is_valid_date_format(date_str: &str, delimitor: Option<&str>) -> bool {
        if date_str.trim().is_empty() {
            return false;
        }

        let del = delimitor.unwrap_or("/");
        let expected_pattern = match del {
            "-" => regex::Regex::new(r"^\d{4}-\d{1,2}-\d{1,2}").unwrap(),
            "/" => regex::Regex::new(r"^\d{4}/\d{1,2}/\d{1,2}").unwrap(),
            _ => match regex::Regex::new(&format!(
                r"^\d{{4}}\{}\d{{1,2}}\{}\d{{1,2}}",
                regex::escape(del),
                regex::escape(del)
            )) {
                Ok(regex) => regex,
                Err(_) => return false,
            },
        };

        expected_pattern.is_match(date_str)
    }

    pub fn new(year: i32, month: u32, day: u32) -> Option<Date> {
        let result = {
            let ref this = Utc;
            match NaiveDate::from_ymd_opt(year, month, day).and_then(|d| d.and_hms_opt(0, 0, 0)) {
                Some(dt) => this.from_local_datetime(&dt),
                None => LocalResult::None,
            }
        };
        if result == LocalResult::None {
            return None;
        }

        Some(Date {
            year: year,
            month: month,
            day: day,
        })
    }

    pub fn to_string(&self) -> String {
        format!("{}-{:02}-{:02}", self.year, self.month, self.day)
    }

    /// Safe version that returns Result instead of panicking
    pub fn try_from_string(date_str: &String, delimitor: Option<&str>) -> Result<Date, String> {
        // Basic validation
        if date_str.trim().is_empty() {
            return Err("empty date string".to_string());
        }

        let mut del = "/";
        if delimitor.is_some() {
            del = delimitor.unwrap();
        }

        // Validate basic date format before processing
        if !Self::is_valid_date_format(date_str, delimitor) {
            return Err(format!(
                "invalid date format: {} (expected format with delimiter '{}')",
                date_str, del
            ));
        }

        let re = regex::Regex::new(r" .+$").unwrap();
        let replaced = re.replace(&date_str, "").to_string();
        let mut splitted = replaced.split(del);

        let year = match splitted.next().unwrap().parse::<i32>() {
            Ok(year) => year,
            _ => return Err(format!("invalid year in date string: {}", date_str)),
        };
        let month = match splitted.next().unwrap().parse::<u32>() {
            Ok(month) => month,
            _ => return Err(format!("invalid month in date string: {}", date_str)),
        };
        let day = match splitted.next().unwrap().parse::<u32>() {
            Ok(day) => day,
            _ => return Err(format!("invalid day in date string: {}", date_str)),
        };

        match Date::new(year, month, day) {
            Some(date) => Ok(date),
            None => Err(format!("invalid date: {}-{}-{}", year, month, day)),
        }
    }

    pub fn from_string(date_str: &String, delimiter: Option<&str>) -> Date {
        match Self::try_from_string(date_str, delimiter) {
            Ok(date) => date,
            Err(err) => panic!(
                "Date parsing failed: {}, delimiter: {}, error: {}",
                date_str,
                delimiter.unwrap_or("/"),
                err
            ),
        }
    }
}

impl Dates {
    pub fn new(dates: &[Date]) -> Dates {
        let mut d = Dates { dates: Vec::new() };
        for date in dates {
            let d2 = date.clone();
            d.dates.push(d2)
        }
        d
    }

    pub fn empty() -> Dates {
        Dates { dates: Vec::new() }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.dates).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use crate::value::date;
    #[test]
    fn test_date() {
        let d = date::Date::new(2022, 1, 1).unwrap();
        assert_eq!(d.year, 2022);
        assert_eq!(d.month, 1);
        assert_eq!(d.day, 1);
    }

    #[test]
    fn test_invalid_date() {
        let d = date::Date::new(2022, 2, 32);
        assert_eq!(d.is_none(), true);
    }

    #[test]
    fn test_dates() {
        let d1 = date::Date::new(2022, 2, 1).unwrap();
        let d2 = date::Date::new(2022, 2, 28).unwrap();
        let dates = date::Dates::new(&[d1, d2]);
        assert_eq!(dates.dates.len(), 2);
    }

    #[test]
    fn test_datetime_parse_colon_format() {
        let dt = date::DateTime::try_from_string("2025:11:23 06:17:23").unwrap();
        assert_eq!(dt.year, 2025);
        assert_eq!(dt.month, 11);
        assert_eq!(dt.day, 23);
        assert_eq!(dt.hour, 6);
        assert_eq!(dt.minute, 17);
        assert_eq!(dt.second, 23);
    }

    #[test]
    fn test_datetime_parse_slash_format() {
        let dt = date::DateTime::try_from_string("2025/11/23 06:17:23").unwrap();
        assert_eq!(dt.year, 2025);
        assert_eq!(dt.month, 11);
        assert_eq!(dt.day, 23);
        assert_eq!(dt.hour, 6);
        assert_eq!(dt.minute, 17);
        assert_eq!(dt.second, 23);
    }

    #[test]
    fn test_datetime_are_equal_different_formats() {
        // Same datetime with different date delimiters should be equal
        assert!(date::DateTime::are_equal(
            "2025:11:23 06:17:23",
            "2025/11/23 06:17:23"
        ));
        assert!(date::DateTime::are_equal(
            "2025-11-23 06:17:23",
            "2025:11:23 06:17:23"
        ));
    }

    #[test]
    fn test_datetime_are_equal_different_values() {
        // Different datetimes should not be equal
        assert!(!date::DateTime::are_equal(
            "2025:11:23 06:17:23",
            "2025:11:23 06:17:24"
        ));
        assert!(!date::DateTime::are_equal(
            "2025:11:23 06:17:23",
            "2025:11:24 06:17:23"
        ));
    }
}
