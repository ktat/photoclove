#[derive(Debug, Clone)]
pub struct Star {
    data: i32,
}

impl Star {
    pub fn new(star: i32) -> Star {
        if star > 4 {
            panic!("star must be leser than 5: {}", star);
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
