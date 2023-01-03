use crate::comain::config::*;

mod json {
    impl RepositoryConfig for JSON {
        fn get_cofnig(&mut self) {
            config::Config {
                    respository: RepositoryConfig {  
                        store: "directory".to_string(),
                        option: RepositoryOption {
                        }
                    },
                    import_to: "example/import_to".to_string(),
                    export_from: "example/export_from".to_string(),
            }                
        }
    }
}
