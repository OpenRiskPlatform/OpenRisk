use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

fn migration_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read migrations dir {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read migrations entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("sql") {
            files.push(path);
        }
    }

    files.sort();
    Ok(files)
}

fn regenerate_sqlx_schema_db() -> Result<(), String> {
    let manifest_dir = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| format!("CARGO_MANIFEST_DIR is missing: {}", e))?,
    );

    let migrations_dir = manifest_dir.join("migrations");
    let sqlx_dir = manifest_dir.join(".sqlx");
    let schema_db_path = sqlx_dir.join("schema.db");

    if !migrations_dir.exists() {
        return Err(format!(
            "Migrations directory does not exist: {}",
            migrations_dir.display()
        ));
    }

    fs::create_dir_all(&sqlx_dir)
        .map_err(|e| format!("Failed to create {}: {}", sqlx_dir.display(), e))?;

    if schema_db_path.exists() {
        fs::remove_file(&schema_db_path).map_err(|e| {
            format!(
                "Failed to remove old schema db {}: {}",
                schema_db_path.display(),
                e
            )
        })?;
    }

    let migration_files = migration_files(&migrations_dir)?;
    if migration_files.is_empty() {
        return Err(format!(
            "No .sql migration files found in {}",
            migrations_dir.display()
        ));
    }

    let conn = Connection::open(&schema_db_path)
        .map_err(|e| format!("Failed to open {}: {}", schema_db_path.display(), e))?;

    for file in migration_files {
        let sql = fs::read_to_string(&file)
            .map_err(|e| format!("Failed to read {}: {}", file.display(), e))?;
        conn.execute_batch(&sql)
            .map_err(|e| format!("Failed to apply {}: {}", file.display(), e))?;
        println!("cargo:rerun-if-changed={}", file.display());
    }

    println!("cargo:rerun-if-changed={}", migrations_dir.display());
    Ok(())
}

fn main() {
    if let Err(error) = regenerate_sqlx_schema_db() {
        panic!("Failed to regenerate .sqlx/schema.db: {}", error);
    }

    tauri_build::build();
}
