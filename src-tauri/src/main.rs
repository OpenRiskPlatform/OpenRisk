// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// create tauri event "greet"


fn main() {
  app_lib::run();
}
