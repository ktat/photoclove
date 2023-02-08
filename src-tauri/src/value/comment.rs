#[derive(Debug, Clone)]
pub struct Comment {
    data: String,
}

impl Comment {
    pub fn new(comment: &str) -> Comment {
        Comment {
            data: comment.to_string(),
        }
    }

    pub fn set_comment(&mut self, comment: String) {
        self.data = comment;
    }

    pub fn comment(&self) -> String {
        self.data.clone()
    }
}
