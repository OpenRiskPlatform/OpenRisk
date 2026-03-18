use diesel::{prelude::*, SqliteConnection};
use serde::{Deserialize, Serialize};
#[allow(unused)]
use std::{
    fs::{self, File},
    path::PathBuf,
    str::FromStr,
};
use ts_rs::TS;

use crate::{
    interface::project_manager::ProjectManager,
    models::project::{Project, ProjectSettings},
};

const DATABASE_REL_PATH: &'static str = "./database.db";
const SETTINGS_REL_PATH: &'static str = "./settings.json";

pub struct FileSystemProjectManager {
    options: FSPMOptions,
}

pub struct FSPMOptions {
    pub name: String,
    pub path: PathBuf,
}

#[derive(Debug, TS, Serialize, Deserialize)]
#[ts(export)]
pub enum FSPMError {
    Message(&'static str),
    Serialization,
    Deserialization,
    DBConnection,
}

// TODO: Add file locking so two project don't use the same file
impl FileSystemProjectManager {
    pub fn project_path(&self) -> PathBuf {
        self.options.path.clone()
    }

    pub fn settings_path(&self) -> PathBuf {
        self.project_path().join(SETTINGS_REL_PATH)
    }

    pub fn database_path(&self) -> PathBuf {
        self.project_path().join(DATABASE_REL_PATH)
    }
}

impl ProjectManager for FileSystemProjectManager {
    type Options = FSPMOptions;

    type Error = FSPMError;

    fn new(options: Self::Options) -> Self {
        Self { options }
    }

    fn create_project(&mut self) -> Result<Project, Self::Error> {
        // let name_path = PathBuf::from_str(&self.options.name).expect("Cannot create PathBuf");
        // let full_path = self.options.path.join(&name_path);

        let new_project = Project::new(self.options.name.clone(), ProjectSettings::default());

        if fs::create_dir_all(&self.options.path).is_err() {
            return Err(FSPMError::Message("Failed to create project folder"));
        };

        self.save_project(&new_project)?;

        Ok(new_project)
    }

    fn load_project(&mut self) -> Result<Project, Self::Error> {
        let Ok(file) = File::open(self.options.path.join(SETTINGS_REL_PATH)) else {
            return Err(FSPMError::Message("Failed to open project folder"));
        };

        let Ok::<Project, _>(project) = serde_json::from_reader(file) else {
            return Err(FSPMError::Deserialization);
        };

        Ok(project)
    }

    fn save_project(&self, project: &Project) -> Result<(), Self::Error> {
        let Ok(file) = File::create(self.settings_path()) else {
            return Err(FSPMError::Message("Failed to create project file"));
        };

        if serde_json::to_writer_pretty(file, project).is_err() {
            return Err(FSPMError::Serialization);
        };

        Ok(())
    }

    fn db_connection(&self) -> Result<SqliteConnection, Self::Error> {
        let Ok(conn) = SqliteConnection::establish(&self.database_path().to_string_lossy()) else {
            return Err(FSPMError::DBConnection);
        };

        Ok(conn)
    }
}

impl FSPMOptions {
    fn new(name: impl Into<String>, path: impl Into<PathBuf>) -> Self {
        Self {
            name: name.into(),
            path: path.into(),
        }
    }
}

#[test]
fn project_test() {
    let mut pm = FileSystemProjectManager::new(FSPMOptions {
        name: "ExampleProject".to_string(),
        path: PathBuf::from_str("./testing/example_project").unwrap(),
    });

    let mut new_project = pm.create_project().unwrap();

    new_project.settings.description = "This is a description".to_string();

    pm.save_project(&new_project).unwrap();

    // let mut pm2 = FileSystemProjectManager::new(FSPMOptions {
    //     name: "ExampleProject".to_string(),
    //     path: PathBuf::from_str("./example_project").unwrap()
    // });

    // pm2.load_project().unwrap();

    // let loaded_project = pm2.get_mut_project().unwrap();

    // loaded_project.settings.locale = "Updated".to_string();

    // pm2.save_project().unwrap();
}
