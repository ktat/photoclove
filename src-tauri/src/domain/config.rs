pub struct Config<'a> {
    pub repository: RepositoryConfig,
    pub import_to: &'a str,
    pub export_from: &'a str,
    pub trash_path: &'a str,
    pub data_path: &'a str,
    pub thumbnail_store: &'a str,
    pub copy_parallel: usize,
    pub thumbnail_parallel: usize,
}
pub struct RepositoryConfig {
    pub store: String,
    pub option: RepositoryOption
}
pub struct RepositoryOption {
}
impl Config<'static> {
    pub fn new() -> Config<'static> {
        // TODO: config from JSON
        Config{
            repository: RepositoryConfig {  
                store: "memory".to_string(),
                option: RepositoryOption {
                }
            },
            data_path: "/home/ktat/.config/photoclove/",
            trash_path: "/mnt/picture/.photoclove_trash/",
            import_to: "/mnt/picture/00 pictures/",
            export_from: "/media/ktat/",
            thumbnail_store: "",
            copy_parallel: 1,
            thumbnail_parallel: 1,
        }
    }
} 
