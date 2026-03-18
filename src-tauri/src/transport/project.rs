use std::{path::PathBuf, str::FromStr, sync::Mutex};

use tauri::State;

use crate::{
    interface::project_manager::ProjectManager,
    local_persistance::projects::{FSPMOptions, FileSystemProjectManager},
    models::{ir::BackendResult, project::Project},
    ActiveProject,
};

#[tauri::command]
pub async fn get_active_project(
    project: State<'_, Mutex<ActiveProject>>,
) -> Result<Project, String> {
    let ap = project.lock().unwrap();

    let Some(project_clone) = ap.project.clone() else {
        return Err("No active project".to_string());
    };

    Ok(project_clone)
}

#[tauri::command]
pub fn create_project(
    name: String,
    path: String,
    active_project: State<Mutex<ActiveProject>>,
) -> BackendResult<Project, String> {
    let mut ap = active_project.lock().unwrap();

    let mut new_pm = FileSystemProjectManager::new(FSPMOptions {
        name,
        path: PathBuf::from_str(&path)
            .map_err(|_| "Invalid path")
            .unwrap(),
    });

    let Ok(project) = new_pm.create_project() else {
        // return Err("Creating project failed".to_string());

        return BackendResult::Err("Creating project failed".to_string());
    };

    let project_clone = project.clone();

    ap.project = Some(project);

    BackendResult::Ok(project_clone)
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
        return Err("Loading project failed".to_string());
    };

    let project_clone = project.clone();

    ap.project = Some(project);

    Ok(project_clone)
}
