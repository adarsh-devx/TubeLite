use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum DownloadKind {
    #[default]
    #[serde(rename = "video")]
    Video,
    #[serde(rename = "mp3")]
    Mp3,
}

// ── Error types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadError {
    pub code: String,
    pub message: String,
}

impl DownloadError {
    fn invalid_url(msg: &str) -> Self {
        Self {
            code: "INVALID_URL".into(),
            message: msg.into(),
        }
    }

    fn unsupported_url() -> Self {
        Self {
            code: "UNSUPPORTED_URL".into(),
            message: "Only YouTube URLs are supported.".into(),
        }
    }

    fn ytdlp_not_found() -> Self {
        Self {
            code: "YTDLP_NOT_FOUND".into(),
            message: "Required downloader component is missing. Please reinstall TubeLite.".into(),
        }
    }

    fn ffmpeg_not_found() -> Self {
        Self {
            code: "FFMPEG_NOT_FOUND".into(),
            message: "Required audio converter is missing. Please reinstall TubeLite.".into(),
        }
    }

    fn conversion_failed(msg: &str) -> Self {
        Self {
            code: "CONVERSION_FAILED".into(),
            message: format!("Audio conversion failed: {msg}"),
        }
    }

    fn no_format_available() -> Self {
        Self {
            code: "NO_FORMAT_AVAILABLE".into(),
            message: "The selected quality is not available for this video.".into(),
        }
    }

    fn download_failed(msg: &str) -> Self {
        Self {
            code: "DOWNLOAD_FAILED".into(),
            message: format!("Download failed: {msg}"),
        }
    }

    fn output_error(msg: &str) -> Self {
        Self {
            code: "OUTPUT_ERROR".into(),
            message: format!("Could not save file: {msg}"),
        }
    }

    fn already_downloading() -> Self {
        Self {
            code: "ALREADY_DOWNLOADING".into(),
            message: "A download is already in progress.".into(),
        }
    }
}

// ── Progress event payload ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub progress: u32,
    pub downloaded: String,
    pub total: String,
    pub speed: String,
    pub eta: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadCompletePayload {
    pub title: String,
    pub filename: String,
    pub filepath: String,
    pub format: String,
    pub size: String,
    pub duration: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadErrorPayload {
    pub code: String,
    pub message: String,
}

// ── Request type ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDownloadRequest {
    pub url: String,
    pub quality: String,
    #[serde(default)]
    pub kind: DownloadKind,
}

// ── Download state (singleton) ───────────────────────────────────────

struct ActiveDownload {
    /// The yt-dlp child process (or None if yt-dlp already finished)
    ytdlp_child: Option<Child>,
    /// The FFmpeg child process during MP3 conversion (or None)
    ffmpeg_child: Option<Child>,
    /// Temporary audio file from yt-dlp before FFmpeg conversion
    temp_audio_path: Option<PathBuf>,
}

static ACTIVE_DOWNLOAD: once_cell::sync::Lazy<Arc<Mutex<Option<ActiveDownload>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

// ── URL validation ───────────────────────────────────────────────────

fn is_valid_youtube_url(url: &str) -> bool {
    if url.is_empty() {
        return false;
    }
    let lower = url.to_lowercase();
    lower.contains("youtube.com") || lower.contains("youtu.be")
}

// ── yt-dlp path resolution ───────────────────────────────────────────

fn mp3_format_selector() -> &'static str {
    "bestaudio/best"
}

// ── Quality → yt-dlp format selector ─────────────────────────────────

fn quality_to_format_selector(quality: &str) -> Result<String, DownloadError> {
    let height = parse_quality_height(quality)?;
    Ok(format!(
        "bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
    ))
}

fn parse_quality_height(quality: &str) -> Result<u32, DownloadError> {
    let q = quality.to_lowercase();
    if let Some(num) = q.strip_suffix('p') {
        if let Ok(h) = num.parse::<u32>() {
            return Ok(h);
        }
    }
    match q.as_str() {
        s if s.contains("4k") || s.contains("2160") => Ok(2160),
        s if s.contains("2k") || s.contains("1440") => Ok(1440),
        s if s.contains("1080") => Ok(1080),
        s if s.contains("720") => Ok(720),
        s if s.contains("480") => Ok(480),
        s if s.contains("360") => Ok(360),
        s if s.contains("240") => Ok(240),
        s if s.contains("144") => Ok(144),
        _ => Err(DownloadError::no_format_available()),
    }
}

// ── Output directory ─────────────────────────────────────────────────

fn get_download_dir() -> Result<PathBuf, DownloadError> {
    let base = dirs::download_dir().or_else(|| dirs::home_dir().map(|h| h.join("Downloads")));
    match base {
        Some(dir) => {
            let tubelite_dir = dir.join("TubeLite");
            fs::create_dir_all(&tubelite_dir).map_err(|e| {
                DownloadError::output_error(&format!("Could not create download directory: {e}"))
            })?;
            Ok(tubelite_dir)
        }
        None => Err(DownloadError::output_error(
            "Could not determine download directory.",
        )),
    }
}

// ── Safe filename ────────────────────────────────────────────────────

fn sanitize_filename(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .filter(|c| {
            *c != '\0'
                && *c != '/'
                && *c != '\\'
                && *c != ':'
                && *c != '*'
                && *c != '?'
                && *c != '"'
                && *c != '<'
                && *c != '>'
                && *c != '|'
        })
        .collect();
    let cleaned = cleaned.trim().replace(['\t', '\r', '\n'], " ");
    let mut result = String::with_capacity(cleaned.len());
    let mut prev_space = false;
    for c in cleaned.chars() {
        if c == ' ' {
            if !prev_space {
                result.push(' ');
                prev_space = true;
            }
        } else {
            result.push(c);
            prev_space = false;
        }
    }
    let result = result.trim();
    if result.len() > 200 {
        result[..200].trim().to_string()
    } else {
        result.to_string()
    }
}

fn unique_filepath(dir: &Path, filename: &str, ext: &str) -> PathBuf {
    let mut path = dir.join(format!("{filename}.{ext}"));
    if !path.exists() {
        return path;
    }
    let mut counter = 1u32;
    loop {
        path = dir.join(format!("{filename} ({counter}).{ext}"));
        if !path.exists() {
            return path;
        }
        counter += 1;
    }
}

fn format_filesize(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.0} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.1} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

// ── Progress line parsing ────────────────────────────────────────────

fn parse_progress_line(line: &str) -> Option<ProgressPayload> {
    let line = line.trim();
    if !line.starts_with("[download]") {
        return None;
    }
    let line = line.trim_start_matches("[download]").trim();

    if let Some(pct_end) = line.find('%') {
        let pct_str = line[..pct_end].trim();
        if let Ok(progress) = pct_str.parse::<f64>() {
            let progress = progress.min(100.0) as u32;
            let total = extract_size_after(line, "of ");
            let speed = extract_speed(line);
            let eta = extract_eta(line);
            let downloaded = if !total.is_empty() {
                if let Ok(total_bytes) = parse_size_bytes(&total) {
                    let dl_bytes = (total_bytes as f64 * progress as f64 / 100.0) as u64;
                    format_filesize(dl_bytes)
                } else {
                    String::new()
                }
            } else {
                String::new()
            };
            return Some(ProgressPayload {
                progress,
                downloaded,
                total,
                speed,
                eta,
                stage: None,
            });
        }
    }

    if line.starts_with("100%") {
        let total = extract_size_after(line, "of ");
        return Some(ProgressPayload {
            progress: 100,
            downloaded: total.clone(),
            total,
            speed: "—".into(),
            eta: "00:00".into(),
            stage: None,
        });
    }

    None
}

fn extract_size_after(line: &str, marker: &str) -> String {
    if let Some(pos) = line.find(marker) {
        let after = &line[pos + marker.len()..];
        let size: String = after.chars().take_while(|c| !c.is_whitespace()).collect();
        if !size.is_empty() {
            return normalize_size_unit(&size);
        }
    }
    String::new()
}

fn normalize_size_unit(s: &str) -> String {
    s.replace("MiB", " MB")
        .replace("GiB", " GB")
        .replace("KiB", " KB")
        .replace("TiB", " TB")
}

fn extract_speed(line: &str) -> String {
    if let Some(pos) = line.find(" at ") {
        let after = &line[pos + 4..];
        let speed: String = after
            .chars()
            .take_while(|c| !c.is_whitespace() && *c != '\t')
            .collect();
        if !speed.is_empty() {
            let normalized = normalize_size_unit(&speed);
            return format!("{normalized}/s");
        }
    }
    "—".into()
}

fn extract_eta(line: &str) -> String {
    if let Some(pos) = line.find("ETA ") {
        let after = &line[pos + 4..];
        let eta: String = after
            .chars()
            .take_while(|c| *c != ' ' && *c != '\t' && *c != '\n')
            .collect();
        if !eta.is_empty() {
            return eta;
        }
    }
    "—".into()
}

fn parse_size_bytes(s: &str) -> Result<u64, ()> {
    let s = s.trim().replace(' ', "");
    if let Some(v) = s.strip_suffix("GB") {
        v.parse::<f64>()
            .map(|v| (v * 1024.0 * 1024.0 * 1024.0) as u64)
            .map_err(|_| ())
    } else if let Some(v) = s.strip_suffix("MB") {
        v.parse::<f64>()
            .map(|v| (v * 1024.0 * 1024.0) as u64)
            .map_err(|_| ())
    } else if let Some(v) = s.strip_suffix("KB") {
        v.parse::<f64>()
            .map(|v| (v * 1024.0) as u64)
            .map_err(|_| ())
    } else if let Some(v) = s.strip_suffix('B') {
        v.parse::<u64>().map_err(|_| ())
    } else {
        Err(())
    }
}

// ── Download command ─────────────────────────────────────────────────

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    request: StartDownloadRequest,
) -> Result<String, DownloadError> {
    let url = request.url.trim();
    if url.is_empty() {
        return Err(DownloadError::invalid_url("URL cannot be empty."));
    }
    if !is_valid_youtube_url(url) {
        return Err(DownloadError::unsupported_url());
    }

    {
        let active = ACTIVE_DOWNLOAD.lock().await;
        if active.is_some() {
            return Err(DownloadError::already_downloading());
        }
    }

    let ytdlp_path = crate::runtime::resolve_ytdlp().ok_or_else(DownloadError::ytdlp_not_found)?;
    let download_dir = get_download_dir()?;
    let is_mp3 = request.kind == DownloadKind::Mp3;

    if is_mp3 {
        // Ensure FFmpeg is available for MP3 conversion
        let _ = crate::runtime::resolve_ffmpeg().ok_or_else(DownloadError::ffmpeg_not_found)?;
    }

    let (format_selector, extra_args) = if is_mp3 {
        (mp3_format_selector().to_string(), vec![])
    } else {
        (
            quality_to_format_selector(&request.quality)?,
            vec!["--merge-output-format", "mp4"],
        )
    };

    // For MP3: yt-dlp outputs to a temp file, then FFmpeg converts
    let output_template = if is_mp3 {
        // Temp template — yt-dlp will produce an audio file, FFmpeg converts to .mp3
        download_dir
            .join(".tmp_%(title)s.%(ext)s")
            .to_string_lossy()
            .to_string()
    } else {
        download_dir
            .join("%(title)s.%(ext)s")
            .to_string_lossy()
            .to_string()
    };

    let mut ytdlp_args = vec![
        url,
        "-f",
        &format_selector,
        "-o",
        &output_template,
        "--no-playlist",
        "--no-warnings",
        "--no-check-certificates",
        "--newline",
        "--progress",
        "--progress-delta",
        "1",
        "--no-colors",
    ];
    ytdlp_args.extend(extra_args);

    let mut child = Command::new(&ytdlp_path)
        .args(&ytdlp_args)
        .stdout(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                DownloadError::ytdlp_not_found()
            } else {
                DownloadError::download_failed(&e.to_string())
            }
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| DownloadError::download_failed("Could not capture yt-dlp output."))?;

    {
        let mut active = ACTIVE_DOWNLOAD.lock().await;
        *active = Some(ActiveDownload {
            ytdlp_child: Some(child),
            ffmpeg_child: None,
            temp_audio_path: None,
        });
    }

    let app_handle = app.clone();
    let download_dir_clone = download_dir.clone();
    let _kind = request.kind;

    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut last_file: Option<String> = None;

        // Phase 1: yt-dlp download
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(mut progress) = parse_progress_line(&line) {
                progress.stage = Some("downloading".into());
                let _ = app_handle.emit("download-progress", progress);
            }

            if line.contains("[download] Destination:") {
                if let Some(path_str) = line.strip_prefix("[download] Destination: ") {
                    last_file = Some(path_str.trim().to_string());
                }
            }

            if line.contains("[Merger]") || line.contains("[VideoConvertor]") {
                let _ = app_handle.emit(
                    "download-progress",
                    ProgressPayload {
                        progress: 99,
                        downloaded: "Processing...".into(),
                        total: String::new(),
                        speed: "—".into(),
                        eta: "—".into(),
                        stage: Some("downloading".into()),
                    },
                );
            }
        }

        // yt-dlp finished — get exit status
        let ytdlp_exit = {
            let mut active = ACTIVE_DOWNLOAD.lock().await;
            if let Some(ref mut dl) = *active {
                dl.ytdlp_child.as_mut().unwrap().wait().await.ok()
            } else {
                None
            }
        };

        let ytdlp_success = ytdlp_exit.map(|s| s.success()).unwrap_or(false);

        if !ytdlp_success {
            // Clean up active state
            let _ = ACTIVE_DOWNLOAD.lock().await.take();
            let _ = app_handle.emit(
                "download-error",
                DownloadErrorPayload {
                    code: "DOWNLOAD_FAILED".into(),
                    message:
                        "Download failed. The video may be unavailable or the format may not exist."
                            .into(),
                },
            );
            return;
        }

        // Find the yt-dlp output file
        let ytdlp_output = if let Some(ref path) = last_file {
            PathBuf::from(path)
        } else {
            find_latest_file(&download_dir_clone).unwrap_or_default()
        };

        if !ytdlp_output.exists() {
            let _ = ACTIVE_DOWNLOAD.lock().await.take();
            let _ = app_handle.emit(
                "download-error",
                DownloadErrorPayload {
                    code: "OUTPUT_ERROR".into(),
                    message: "Download completed but the output file could not be found.".into(),
                },
            );
            return;
        }

        if is_mp3 {
            // Phase 2: FFmpeg conversion to MP3
            let final_title = ytdlp_output
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Unknown".into());
            // Strip the .tmp_ prefix if present
            let final_title = final_title
                .strip_prefix(".tmp_ ")
                .unwrap_or(&final_title)
                .to_string();
            let final_title = final_title
                .strip_prefix(".tmp_")
                .unwrap_or(&final_title)
                .to_string();

            let final_mp3 = unique_filepath(&download_dir_clone, &final_title, "mp3");

            // Emit converting stage
            let _ = app_handle.emit(
                "download-progress",
                ProgressPayload {
                    progress: 0,
                    downloaded: "Converting...".into(),
                    total: String::new(),
                    speed: "—".into(),
                    eta: "—".into(),
                    stage: Some("converting".into()),
                },
            );

            let ffmpeg_path = crate::runtime::resolve_ffmpeg();
            let ffmpeg_path = match ffmpeg_path {
                Some(p) => p,
                None => {
                    let _ = ACTIVE_DOWNLOAD.lock().await.take();
                    let _ = fs::remove_file(&ytdlp_output);
                    let _ = app_handle.emit(
                        "download-error",
                        DownloadErrorPayload {
                            code: "FFMPEG_NOT_FOUND".into(),
                            message: "FFmpeg is not installed. Cannot convert audio.".into(),
                        },
                    );
                    return;
                }
            };

            // Spawn FFmpeg
            let ffmpeg = Command::new(&ffmpeg_path)
                .args([
                    "-y",
                    "-i",
                    &ytdlp_output.to_string_lossy(),
                    "-codec:a",
                    "libmp3lame",
                    "-b:a",
                    "320k",
                    "-q:a",
                    "0",
                    &final_mp3.to_string_lossy(),
                ])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn();

            let mut ffmpeg = match ffmpeg {
                Ok(f) => f,
                Err(e) => {
                    let _ = ACTIVE_DOWNLOAD.lock().await.take();
                    let _ = fs::remove_file(&ytdlp_output);
                    let _ = app_handle.emit(
                        "download-error",
                        DownloadErrorPayload {
                            code: "FFMPEG_NOT_FOUND".into(),
                            message: format!("Could not start FFmpeg: {e}"),
                        },
                    );
                    return;
                }
            };

            // Take stderr BEFORE moving child into ACTIVE_DOWNLOAD
            let ffmpeg_stderr = ffmpeg.stderr.take();

            // Store FFmpeg child + temp path for cancellation
            {
                let mut active = ACTIVE_DOWNLOAD.lock().await;
                if let Some(ref mut dl) = *active {
                    dl.ffmpeg_child = Some(ffmpeg);
                    dl.temp_audio_path = Some(ytdlp_output.clone());
                }
            }

            // FFmpeg writes progress to stderr
            if let Some(stderr) = ffmpeg_stderr {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    // FFmpeg outputs: frame= 1234 fps= 45 ... time=00:01:23.45 ...
                    if let Some(time_pos) = line.find("time=") {
                        let after = &line[time_pos + 5..];
                        let time_str: String = after
                            .chars()
                            .take_while(|c| *c != ' ' && *c != '\t')
                            .collect();
                        // Parse HH:MM:SS.ss
                        if let Some((_, rest)) = time_str.split_once(':') {
                            if let Some((mins, rest)) = rest.split_once(':') {
                                if let Ok(secs) = rest.parse::<f64>() {
                                    let total_secs =
                                        mins.parse::<f64>().unwrap_or(0.0) * 60.0 + secs;
                                    // Assume ~4 min average for a song — rough progress
                                    let progress = ((total_secs / 240.0) * 100.0).min(99.0) as u32;
                                    let _ = app_handle.emit(
                                        "download-progress",
                                        ProgressPayload {
                                            progress,
                                            downloaded: "Converting...".into(),
                                            total: String::new(),
                                            speed: "—".into(),
                                            eta: "—".into(),
                                            stage: Some("converting".into()),
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // Wait for FFmpeg to finish
            let ffmpeg_exit = {
                let mut active = ACTIVE_DOWNLOAD.lock().await;
                if let Some(ref mut dl) = *active {
                    dl.ffmpeg_child.as_mut().unwrap().wait().await.ok()
                } else {
                    None
                }
            };
            let ffmpeg_success = ffmpeg_exit.map(|s| s.success()).unwrap_or(false);

            // Clean up: remove temp audio file
            let _ = fs::remove_file(&ytdlp_output);

            // Clean up active state
            let _ = ACTIVE_DOWNLOAD.lock().await.take();

            if ffmpeg_success && final_mp3.exists() {
                let metadata = fs::metadata(&final_mp3).ok();
                let size = metadata
                    .map(|m| format_filesize(m.len()))
                    .unwrap_or_default();
                let filename = final_mp3
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let title = final_mp3
                    .file_stem()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Unknown".into());

                let _ = app_handle.emit(
                    "download-complete",
                    DownloadCompletePayload {
                        title,
                        filename,
                        filepath: final_mp3.to_string_lossy().to_string(),
                        format: "MP3".into(),
                        size,
                        duration: String::new(),
                        thumbnail: String::new(),
                    },
                );
            } else {
                let _ = app_handle.emit(
                    "download-error",
                    DownloadErrorPayload {
                        code: "CONVERSION_FAILED".into(),
                        message: "Audio conversion failed. The source file may be corrupted."
                            .into(),
                    },
                );
            }
        } else {
            // Video: done — clean up active state and emit complete
            let _ = ACTIVE_DOWNLOAD.lock().await.take();

            let metadata = fs::metadata(&ytdlp_output).ok();
            let size = metadata
                .map(|m| format_filesize(m.len()))
                .unwrap_or_default();
            let filename = ytdlp_output
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let title = ytdlp_output
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Unknown".into());

            let _ = app_handle.emit(
                "download-complete",
                DownloadCompletePayload {
                    title,
                    filename,
                    filepath: ytdlp_output.to_string_lossy().to_string(),
                    format: "MP4".into(),
                    size,
                    duration: String::new(),
                    thumbnail: String::new(),
                },
            );
        }
    });

    Ok("Download started".into())
}

// ── Cancel command ───────────────────────────────────────────────────

#[tauri::command]
pub async fn cancel_download() -> Result<String, DownloadError> {
    let mut active = ACTIVE_DOWNLOAD.lock().await;
    if let Some(dl) = active.take() {
        // Kill yt-dlp if still running
        if let Some(mut child) = dl.ytdlp_child {
            let _ = child.kill().await;
        }
        // Kill FFmpeg if still running
        if let Some(mut child) = dl.ffmpeg_child {
            let _ = child.kill().await;
        }
        // Clean up temp audio file if it exists
        if let Some(ref path) = dl.temp_audio_path {
            let _ = fs::remove_file(path);
        }
        Ok("Download cancelled".into())
    } else {
        Ok("No active download to cancel".into())
    }
}

// ── Helper ───────────────────────────────────────────────────────────

fn find_latest_file(dir: &Path) -> Option<PathBuf> {
    let mut latest_time = std::time::UNIX_EPOCH;
    let mut latest_path = None;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        if modified > latest_time {
                            latest_time = modified;
                            latest_path = Some(path);
                        }
                    }
                }
            }
        }
    }
    latest_path
}
