use chrono::{Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::SystemTime;

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
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
        *self
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
            let this = &Utc;
            match NaiveDate::from_ymd_opt(year, month, day).and_then(|d| d.and_hms_opt(0, 0, 0)) {
                Some(dt) => this.from_local_datetime(&dt),
                None => LocalResult::None,
            }
        };
        if result == LocalResult::None {
            return None;
        }

        Some(Date {
            year,
            month,
            day,
        })
    }

    /// Safe version that returns Result instead of panicking
    pub fn try_from_string(date_str: &String, delimitor: Option<&str>) -> Result<Date, String> {
        // Basic validation
        if date_str.trim().is_empty() {
            return Err("empty date string".to_string());
        }

        let del = delimitor.unwrap_or("/");

        // Validate basic date format before processing
        if !Self::is_valid_date_format(date_str, delimitor) {
            return Err(format!(
                "invalid date format: {} (expected format with delimiter '{}')",
                date_str, del
            ));
        }

        let re = regex::Regex::new(r" .+$").unwrap();
        let replaced = re.replace(date_str, "").to_string();
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

    /// Parse from database format "YYYY-MM-DD" directly
    /// This is a convenience method that uses "-" as the delimiter
    pub fn try_from_db_format(date_str: &str) -> Result<Date, String> {
        Self::try_from_string(&date_str.to_string(), Some("-"))
    }

    /// Get the next day
    /// Returns None if the resulting date would be invalid
    pub fn next_day(&self) -> Option<Date> {
        let naive_date = NaiveDate::from_ymd_opt(self.year, self.month, self.day)?;
        let next = naive_date.succ_opt()?;
        Date::new(next.year(), next.month(), next.day())
    }

    /// Create Date from SystemTime (file modification time, etc.)
    pub fn from_system_time(time: SystemTime) -> Option<Date> {
        let datetime = chrono::DateTime::<Utc>::from(time);
        Date::new(datetime.year(), datetime.month(), datetime.day())
    }

    /// Add days to the date (positive or negative)
    pub fn add_days(&self, days: i64) -> Option<Date> {
        let naive_date = NaiveDate::from_ymd_opt(self.year, self.month, self.day)?;
        let new_date = naive_date + Duration::days(days);
        Date::new(new_date.year(), new_date.month(), new_date.day())
    }
}

impl fmt::Display for Date {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

impl Dates {
    pub fn new(dates: &[Date]) -> Dates {
        let mut d = Dates { dates: Vec::new() };
        for date in dates {
            let d2 = *date;
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

/// Time period for filtering statistics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase")]
#[derive(Default)]
pub enum TimePeriod {
    /// All time (no filtering)
    #[default]
    All,
    /// Specific year (e.g., 2023)
    Yearly { year: i32 },
    /// Specific month (e.g., 2023-04)
    Monthly { year: i32, month: u32 },
    /// Specific week starting from a date (7 days from start_date)
    Weekly { start_date: Date },
}


impl TimePeriod {
    /// Parse from Option<String>, defaulting to All
    pub fn from_option(period: Option<String>) -> Self {
        period
            .map(|p| Self::from_str(&p))
            .unwrap_or_default()
    }

    /// Get SQL date condition for this period
    pub fn date_condition(&self) -> String {
        match self {
            TimePeriod::All => String::new(),
            TimePeriod::Yearly { year } => format!(
                " AND strftime('%Y', date(COALESCE(exif_date_time_original, photo_date))) = '{}'",
                year
            ),
            TimePeriod::Monthly { year, month } => format!(
                " AND strftime('%Y-%m', date(COALESCE(exif_date_time_original, photo_date))) = '{}-{:02}'",
                year, month
            ),
            TimePeriod::Weekly { start_date } => {
                let end_date = start_date.add_days(6).unwrap_or(*start_date);
                format!(
                    " AND date(COALESCE(exif_date_time_original, photo_date)) BETWEEN '{}' AND '{}'",
                    start_date, end_date
                )
            }
        }
    }

    /// Parse from string format:
    /// - "all" -> All
    /// - "yearly:2023" -> Yearly { year: 2023 }
    /// - "monthly:2023-04" -> Monthly { year: 2023, month: 4 }
    /// - "weekly:2023-04-10" -> Weekly { start_date: Date }
    pub fn from_str(s: &str) -> Self {
        let s = s.to_lowercase();
        if s == "all" {
            return TimePeriod::All;
        }

        let parts: Vec<&str> = s.splitn(2, ':').collect();
        if parts.len() != 2 {
            return TimePeriod::All;
        }

        let (period_type, value) = (parts[0], parts[1]);

        match period_type {
            "yearly" => {
                if let Ok(year) = value.parse::<i32>() {
                    TimePeriod::Yearly { year }
                } else {
                    TimePeriod::All
                }
            }
            "monthly" => {
                let date_parts: Vec<&str> = value.split('-').collect();
                if date_parts.len() >= 2 {
                    if let (Ok(year), Ok(month)) = (
                        date_parts[0].parse::<i32>(),
                        date_parts[1].parse::<u32>(),
                    ) {
                        if (1..=12).contains(&month) {
                            return TimePeriod::Monthly { year, month };
                        }
                    }
                }
                TimePeriod::All
            }
            "weekly" => {
                if let Ok(start_date) = Date::try_from_db_format(value) {
                    TimePeriod::Weekly { start_date }
                } else {
                    TimePeriod::All
                }
            }
            _ => TimePeriod::All,
        }
    }

    /// Convert to string format
    pub fn as_str(&self) -> String {
        match self {
            TimePeriod::All => "all".to_string(),
            TimePeriod::Yearly { year } => format!("yearly:{}", year),
            TimePeriod::Monthly { year, month } => format!("monthly:{}-{:02}", year, month),
            TimePeriod::Weekly { start_date } => {
                format!("weekly:{}", start_date)
            }
        }
    }

    /// Get the period type as a simple string (for UI display)
    #[allow(dead_code)]
    pub fn period_type(&self) -> &'static str {
        match self {
            TimePeriod::All => "all",
            TimePeriod::Yearly { .. } => "yearly",
            TimePeriod::Monthly { .. } => "monthly",
            TimePeriod::Weekly { .. } => "weekly",
        }
    }

    /// Get display label for this period
    #[allow(dead_code)]
    pub fn display_label(&self) -> String {
        match self {
            TimePeriod::All => "All Time".to_string(),
            TimePeriod::Yearly { year } => format!("{}", year),
            TimePeriod::Monthly { year, month } => format!("{}-{:02}", year, month),
            TimePeriod::Weekly { start_date } => {
                let end_date = start_date.add_days(6).unwrap_or(*start_date);
                format!(
                    "{} - {}",
                    start_date,
                    end_date
                )
            }
        }
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

    #[test]
    fn test_try_from_db_format() {
        let d = date::Date::try_from_db_format("2025-01-15").unwrap();
        assert_eq!(d.year, 2025);
        assert_eq!(d.month, 1);
        assert_eq!(d.day, 15);
    }

    #[test]
    fn test_try_from_db_format_invalid() {
        let result = date::Date::try_from_db_format("invalid");
        assert!(result.is_err());
    }

    #[test]
    fn test_next_day() {
        let d = date::Date::new(2025, 1, 15).unwrap();
        let next = d.next_day().unwrap();
        assert_eq!(next.year, 2025);
        assert_eq!(next.month, 1);
        assert_eq!(next.day, 16);
    }

    #[test]
    fn test_next_day_month_boundary() {
        let d = date::Date::new(2025, 1, 31).unwrap();
        let next = d.next_day().unwrap();
        assert_eq!(next.year, 2025);
        assert_eq!(next.month, 2);
        assert_eq!(next.day, 1);
    }

    #[test]
    fn test_next_day_year_boundary() {
        let d = date::Date::new(2025, 12, 31).unwrap();
        let next = d.next_day().unwrap();
        assert_eq!(next.year, 2026);
        assert_eq!(next.month, 1);
        assert_eq!(next.day, 1);
    }

    #[test]
    fn test_from_system_time() {
        use std::time::{Duration, UNIX_EPOCH};
        // 2025-01-15 00:00:00 UTC = 1736899200 seconds since UNIX epoch
        let time = UNIX_EPOCH + Duration::from_secs(1736899200);
        let d = date::Date::from_system_time(time).unwrap();
        assert_eq!(d.year, 2025);
        assert_eq!(d.month, 1);
        assert_eq!(d.day, 15);
    }

    #[test]
    fn test_add_days() {
        let d = date::Date::new(2025, 1, 15).unwrap();
        let future = d.add_days(6).unwrap();
        assert_eq!(future.year, 2025);
        assert_eq!(future.month, 1);
        assert_eq!(future.day, 21);
    }

    #[test]
    fn test_time_period_from_str_all() {
        let period = date::TimePeriod::from_str("all");
        assert_eq!(period, date::TimePeriod::All);
    }

    #[test]
    fn test_time_period_from_str_yearly() {
        let period = date::TimePeriod::from_str("yearly:2023");
        assert_eq!(period, date::TimePeriod::Yearly { year: 2023 });
    }

    #[test]
    fn test_time_period_from_str_monthly() {
        let period = date::TimePeriod::from_str("monthly:2023-04");
        assert_eq!(period, date::TimePeriod::Monthly { year: 2023, month: 4 });
    }

    #[test]
    fn test_time_period_from_str_weekly() {
        let period = date::TimePeriod::from_str("weekly:2023-04-10");
        let expected_date = date::Date::new(2023, 4, 10).unwrap();
        assert_eq!(period, date::TimePeriod::Weekly { start_date: expected_date });
    }

    #[test]
    fn test_time_period_from_option_some() {
        let period = date::TimePeriod::from_option(Some("yearly:2024".to_string()));
        assert_eq!(period, date::TimePeriod::Yearly { year: 2024 });
    }

    #[test]
    fn test_time_period_from_option_none() {
        let period = date::TimePeriod::from_option(None);
        assert_eq!(period, date::TimePeriod::All);
    }

    #[test]
    fn test_time_period_as_str() {
        let period = date::TimePeriod::Yearly { year: 2023 };
        assert_eq!(period.as_str(), "yearly:2023");

        let period = date::TimePeriod::Monthly { year: 2023, month: 4 };
        assert_eq!(period.as_str(), "monthly:2023-04");
    }
}
