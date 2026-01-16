use diesel::{prelude::*, SqliteConnection};
use std::{
    fs::{self, File},
    path::PathBuf,
    str::FromStr,
    sync::Mutex,
};
use tauri::State;

use crate::{
    interface::project_manager::ProjectManager,
    models::project::{Project, ProjectSettings},
    ActiveProject,
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
    fn project_path(&self) -> PathBuf {
        self.options.path.clone()
    }

    fn settings_path(&self) -> PathBuf {
        self.project_path().join(SETTINGS_REL_PATH)
    }

    fn database_path(&self) -> PathBuf {
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

#[tauri::command]
pub fn create_project(
    name: String,
    path: String,
    active_project: State<Mutex<ActiveProject>>,
) -> BackendResult<Project>, String> {
    let mut ap = active_project.lock().unwrap();

    let mut new_pm = FileSystemProjectManager::new(FSPMOptions {
        name,
        path: PathBuf::from_str(&path).map_err(|_| "Invalid path")?,
    });

    let Ok(project) = new_pm.create_project() else {
        // return Err("Creating project failed".to_string());

        return Ok(BackendResult::Err("Creating project failed".to_string()));
    };

    let project_clone = project.clone();

    ap.project = Some(project);

    Ok(project_clone)
}

#[tauri::command]
pub fn load_project(
    path: String,
    active_project: State<Mutex<ActiveProject>>,
) -> Result<Project, String> {
    let mut ap = active_project.lock().unwrap();

    let mut new_pm = FileSystemProjectManager::new(FSPMOptions {
        // This is ugly af
        name: "n/a".to_string(),
        path: PathBuf::from_str(&path).map_err(|_| "Invalid path")?,
    });

    let Ok(project) = new_pm.load_project() else {
        return Err("Creating project failed".to_string());
    };

    let project_clone = project.clone();

    ap.project = Some(project);

    Ok(project_clone)
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
