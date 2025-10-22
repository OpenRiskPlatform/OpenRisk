pub mod adversea;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO) // log INFO+ messages
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(
            tauri::generate_handler![
                greet,
                adversea::social_media_scan,
                adversea::screening_rpo,
            ]
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
