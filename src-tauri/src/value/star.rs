use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Star {
    data: i32,
}

impl Star {
    pub fn new(star: i32) -> Star {
        if star > 5 {
            log::warn!(target: "star", "star_validation; requested={}; max=5; clamped=5", star);
            return Star { data: 5 };
        }
        Star { data: star }
    }

    #[allow(dead_code)]
    pub fn set_star(&mut self, star: i32) {
        self.data = star;
    }

    pub fn star(&self) -> i32 {
        self.data
    }
}
