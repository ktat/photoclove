pub mod config {
    pub struct Config {
        pub repository: RepositoryConfig,
        pub import_to: String,
        pub export_from: String,
    }
    pub struct RepositoryConfig {
        pub store: String,
        pub option: RepositoryOption
    }
    pub struct RepositoryOption {
    }
    impl Config {
        pub fn new() -> Config {
            // TODO: config from JSON
            Config{
                repository: RepositoryConfig {  
                    store: "memory".to_string(),
                    option: RepositoryOption {
                    }
                },
                import_to: "example/import_to".to_string(),
                export_from: "example/export_from".to_string(),
            }
        }
    } 
}