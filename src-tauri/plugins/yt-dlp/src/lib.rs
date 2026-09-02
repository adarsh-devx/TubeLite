use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzedVideo {
    pub title: String,
    pub channel: String,
    pub duration: String,
    pub thumbnail: String,
    pub video_formats: Vec<serde_json::Value>,
    pub audio_formats: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFileRequest {
    pub path: String,
}

const PLUGIN_IDENTIFIER: &str = "com.tubelite.downloader";

pub struct YtDlp<R: Runtime> {
    #[cfg(target_os = "android")]
    mobile_plugin_handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    handle: tauri::AppHandle<R>,
}

impl<R: Runtime> YtDlp<R> {
    /// On Android, forward to Kotlin plugin via Tauri mobile plugin system.
    #[cfg(target_os = "android")]
    pub fn extract_info(&self, url: &str) -> Result<AnalyzedVideo, AnalyzeError> {
        let request = AnalyzeRequest {
            url: url.to_string(),
        };
        eprintln!("[ANDROID BRIDGE] calling run_mobile_plugin(extractInfo)");
        let result: Result<AnalyzedVideo, _> = self.mobile_plugin_handle
            .run_mobile_plugin("extractInfo", request)
            .map_err(|e| {
                let msg = format!("Plugin call failed: {e}");
                eprintln!("[ANDROID BRIDGE] plugin call error: {msg}");
                AnalyzeError {
                    code: "PLUGIN_ERROR".into(),
                    message: msg,
                }
            });
        if let Ok(ref video) = result {
            eprintln!("[ANDROID BRIDGE] plugin response: title='{}', video_fmts={}, audio_fmts={}",
                video.title, video.video_formats.len(), video.audio_formats.len());
        }
        result
    }

    #[cfg(target_os = "android")]
    pub fn open_file(&self, path: &str) -> Result<(), String> {
        let request = OpenFileRequest {
            path: path.to_string(),
        };
        eprintln!("[ANDROID BRIDGE] calling run_mobile_plugin(openFile)");
        self.mobile_plugin_handle
            .run_mobile_plugin::<()>("openFile", request)
            .map_err(|e| format!("Plugin openFile call failed: {e}"))
    }

    /// On desktop, this is a stub — desktop uses Rust analyze_url command directly.
    #[cfg(not(target_os = "android"))]
    pub fn extract_info(&self, _url: &str) -> Result<AnalyzedVideo, AnalyzeError> {
        Err(AnalyzeError {
            code: "NOT_IMPLEMENTED".into(),
            message: "Use the Rust analyze_url command on desktop.".into(),
        })
    }

    #[cfg(not(target_os = "android"))]
    pub fn open_file(&self, _path: &str) -> Result<(), String> {
        Err("Use desktop open_path command on desktop.".to_string())
    }
}

impl<R: Runtime> Clone for YtDlp<R> {
    fn clone(&self) -> Self {
        #[cfg(target_os = "android")]
        {
            Self {
                mobile_plugin_handle: self.mobile_plugin_handle.clone(),
            }
        }
        #[cfg(not(target_os = "android"))]
        {
            Self {
                handle: self.handle.clone(),
            }
        }
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ytdlp")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api
                    .register_android_plugin(PLUGIN_IDENTIFIER, "YtDlpPlugin")
                    .expect("Failed to register Android yt-dlp plugin");
                app.manage(YtDlp {
                    mobile_plugin_handle: handle,
                });
                eprintln!("[YTDLP PLUGIN] Android plugin registered successfully");
            }
            #[cfg(not(target_os = "android"))]
            {
                let handle = app.app_handle().clone();
                app.manage(YtDlp { handle });
                eprintln!("[YTDLP PLUGIN] Desktop mode (no Kotlin plugin)");
            }
            Ok(())
        })
        .build()
}
