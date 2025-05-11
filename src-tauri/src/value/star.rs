use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Star {
    data: i32,
}

impl Star {
    pub fn new(star: i32) -> Star {
        if star > 5 {
            eprintln!("star must be less than 5: {}", star);
            return Star { data: 5 };
        }
        Star { data: star }
    }

    pub fn set_star(&mut self, star: i32) {
        self.data = star;
    }

    pub fn star(&self) -> i32 {
        self.data
    }
}
