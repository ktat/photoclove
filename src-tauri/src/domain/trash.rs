use crate::value::file;
pub struct Trash {
    pub dir: file::Dir,
}

impl Trash {
    pub fn new(path: String) -> Trash {
        Trash{dir: file::Dir::new(path)}
    }
}