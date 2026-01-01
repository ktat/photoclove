use chrono::{LocalResult, NaiveDate, TimeZone, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Date {
    pub year: i32,
    pub month: u32,
    pub day: u32,
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
}
