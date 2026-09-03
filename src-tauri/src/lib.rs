mod commands;
pub mod runtime;

use commands::{
    analyze_url, cancel_download, download_backend_file, open_local_file, ping, start_download,
};
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeVersions {
    pub ytdlp: Option<String>,
    pub ffmpeg: Option<String>,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub is_development: bool,
}

#[tauri::command]
fn get_runtime_versions() -> RuntimeVersions {
    RuntimeVersions {
        ytdlp: runtime::ytdlp_version(),
        ffmpeg: runtime::ffmpeg_version(),
        ytdlp_path: runtime::resolve_ytdlp().map(|p| p.to_string_lossy().to_string()),
        ffmpeg_path: runtime::resolve_ffmpeg().map(|p| p.to_string_lossy().to_string()),
        is_development: runtime::is_development(),
    }
}

/// Android bridge command — calls the Kotlin YtDlpPlugin via run_mobile_plugin.
/// On desktop, returns an error (desktop uses analyze_url with bundled yt-dlp).
#[tauri::command]
async fn android_extract_info(
    _app: tauri::AppHandle,
    _url: String,
) -> Result<tauri_plugin_ytdlp::AnalyzedVideo, tauri_plugin_ytdlp::AnalyzeError> {
    #[cfg(target_os = "android")]
    {
        let state = _app.state::<tauri_plugin_ytdlp::YtDlp<tauri::Wry>>();
        let result = state.extract_info(&_url);
        match &result {
            Ok(video) => {
                eprintln!(
                    "[ANDROID BRIDGE] success: title='{}', {} video formats, {} audio formats",
                    video.title,
                    video.video_formats.len(),
                    video.audio_formats.len()
                );
            }
            Err(e) => {
                eprintln!(
                    "[ANDROID BRIDGE] plugin error: code={}, message={}",
                    e.code, e.message
                );
            }
        }
        result
    }
    #[cfg(not(target_os = "android"))]
    {
        Err(tauri_plugin_ytdlp::AnalyzeError {
            code: "NOT_ANDROID".into(),
            message: "This command is only available on Android.".into(),
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_ytdlp::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            analyze_url,
            start_download,
            cancel_download,
            get_runtime_versions,
            android_extract_info,
            download_backend_file,
            open_local_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
