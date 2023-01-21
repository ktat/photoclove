use dirs::home_dir;
use serde::{Deserialize, Serialize};
use serde_yaml;
use std::{fs, io::BufReader, io::BufWriter};

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub repository: RepositoryConfig,
    pub import_to: String,
    pub export_from: Vec<String>,
    pub trash_path: String,
    pub data_path: String,
    pub thumbnail_store: String,
    pub copy_parallel: usize,
    pub thumbnail_parallel: usize,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct RepositoryConfig {
    pub store: String,
    pub option: RepositoryOption,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct RepositoryOption {}
impl Config {
    pub fn config_path() -> String {
        let home = match home_dir() {
            Some(path) => path,
            None => {
                panic!("Cannot get HOME directory!");
            }
        };
        let config_file = home.join(".photoclove.yml");
        if !config_file.exists() {
            let file = std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .open(config_file.display().to_string())
                .unwrap();
            let writer = BufWriter::new(file);
            let config = Config::template();
            config.prepare_directory_if_required();
            serde_yaml::to_writer(writer, &config).unwrap();
        }
        config_file.display().to_string()
    }

    fn prepare_directory_if_required(&self) {
        for f in [&self.import_to, &self.trash_path] {
            let result = fs::DirBuilder::new()
                .recursive(true)
                .create(&self.import_to);
            if !result.is_err() {
                result.unwrap();
            } else {
                eprintln!("{:?}", result.err());
            }
        }
    }

    pub fn template() -> Config {
        let home = match home_dir() {
            Some(path) => path,
            None => {
                panic!("Cannot get HOME directory!");
            }
        };
        Config {
            repository: RepositoryConfig {
                store: "".to_string(),
                option: RepositoryOption {},
            },
            import_to: home.join(".photoclove/import/").display().to_string(),
            export_from: vec!["/".to_string()],
            trash_path: home.join(".photoclove/trash/").display().to_string(),
            data_path: home.join(".photoclove/data/").display().to_string(),
            thumbnail_store: home.join(".photoclove/thumbnail/").display().to_string(),
            copy_parallel: 2,
            thumbnail_parallel: 1,
        }
    }

    pub fn new() -> Config {
        let config_path = Config::config_path();
        let file = fs::File::open(config_path).unwrap();
        let reader = BufReader::new(file);
        let config: Config = serde_yaml::from_reader(reader).unwrap();
        config.prepare_directory_if_required();
        return config;
    }
}
