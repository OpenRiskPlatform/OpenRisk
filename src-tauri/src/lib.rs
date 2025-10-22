use std::rc::Rc;

fn run_js(file_content: &str) -> String {
    let mut runtime = deno_core::JsRuntime::new(deno_core::RuntimeOptions {
        module_loader: Some(Rc::new(deno_core::FsModuleLoader)),
        ..Default::default()
    });

    // Execute the JavaScript code passed in and wrap it to return a string
    // let wrapped_code = format!("String((function() {{ return {}; }})())", file_content);
    let wrapped_code = file_content.to_string();

    let js_result = runtime
        .execute_script("<main>", wrapped_code)
        .expect("Failed to execute script");

    let scope = &mut runtime.handle_scope();
    let local = deno_core::v8::Local::new(scope, js_result);
    local.to_rust_string_lossy(scope)
}

#[tauri::command]
async fn execute_js(code: String) -> String {
    run_js(&code)
}

#[tauri::command]
async fn greet(name: String) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, execute_js])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
