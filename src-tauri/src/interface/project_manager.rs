use diesel::SqliteConnection;

use crate::models::project::Project;

pub trait ProjectManager {
    type Options;

    type Error;

    fn new(options: Self::Options) -> Self
    where
        Self: Sized;

    fn create_project(&mut self) -> Result<Project, Self::Error>;

    fn load_project(&mut self) -> Result<Project, Self::Error>;

    fn save_project(&self, project: &Project) -> Result<(), Self::Error>;

    fn db_connection(&self) -> Result<SqliteConnection, Self::Error>;
}
