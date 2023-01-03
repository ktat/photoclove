pub mod date {
    use chrono::{TimeZone, Utc, NaiveDate, LocalResult};
    use serde::{Serialize, Deserialize};

    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct Date {
        pub year: i32,
        pub month: u32,
        pub day: u32,
    }
    
    #[derive(Serialize, Deserialize, Debug)]
    pub struct Dates {
        pub dates: Vec<Date>,
    }

    impl Date {
        pub fn new (year: i32, month: u32, day: u32) -> Option<Date> {
            let result= {
                let ref this = Utc;
                match NaiveDate::from_ymd_opt(year, month, day).and_then(|d| d.and_hms_opt(0, 0, 0))
                {
                    Some(dt) => this.from_local_datetime(&dt),
                    None => LocalResult::None,
                }
            };
            if result == LocalResult::None {
                return None
            }

            Some(Date{ year: year, month: month, day: day })
        }

        pub fn to_string(&self) -> String{
            format!("{}-{:02}-{:02}", self.year, self.month, self.day)
        }

        pub fn from_string (date_str: &String) -> Date {
            let mut splitted = date_str.split("/");
            let year = splitted.next().unwrap().parse::<i32>().unwrap();
            let month = splitted.next().unwrap().parse::<u32>().unwrap();
            let day =  splitted.next().unwrap().parse::<u32>().unwrap();
            return Date::new(year, month, day).unwrap();
        }
    }
    impl Dates {
        pub fn new (dates: &[Date]) -> Dates {
            let mut d = Dates { dates: Vec::new(), };
            for date in dates {
                let d2 = date.clone();
                d.dates.push(d2)
            }
            d
        }
        pub fn to_json (&self) -> String {
            serde_json::to_string(&self.dates).unwrap()
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::value::date::*;
    #[test]
    fn test_date() {
        let d = date::Date::new(2022,1,1).unwrap();
        assert_eq!(d.year, 2022);
        assert_eq!(d.month, 1);
        assert_eq!(d.day, 1);
    }

    #[test]
    fn test_invalid_date() {
        let d = date::Date::new(2022,2,32);
        assert_eq!(d.is_none(), true);
    }

    #[test]
    fn test_dates() {
        let d1 = date::Date::new(2022,2,1).unwrap();
        let d2 = date::Date::new(2022,2,28).unwrap();
        let dates = date::Dates::new(&[d1, d2]);
        assert_eq!(dates.dates.len(), 2);
    }

}