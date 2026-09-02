pub mod analyze;
pub mod download;
pub mod file;

pub use analyze::analyze_url;
pub use download::{cancel_download, start_download};
pub use file::{download_backend_file, open_local_file};

/// Simple ping command to verify frontend ↔ Rust communication.
#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}
