use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;

// ── Error types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeError {
    pub code: String,
    pub message: String,
}

impl AnalyzeError {
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

    fn extraction_failed(msg: &str) -> Self {
        Self {
            code: "EXTRACTION_FAILED".into(),
            message: format!("Could not extract video info: {msg}"),
        }
    }

    fn ytdlp_not_found() -> Self {
        Self {
            code: "YTDLP_NOT_FOUND".into(),
            message: "Required downloader component is missing. Please reinstall TubeLite.".into(),
        }
    }

    fn network_error() -> Self {
        Self {
            code: "NETWORK_ERROR".into(),
            message: "Network error. Please check your connection and try again.".into(),
        }
    }
}

// ── Normalized output models ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzedVideo {
    pub title: String,
    pub channel: String,
    pub duration: String,
    pub thumbnail: String,
    pub video_formats: Vec<NormalizedVideoFormat>,
    pub audio_formats: Vec<NormalizedAudioFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedVideoFormat {
    pub quality: String,
    pub label: String,
    pub format: String,
    pub size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedAudioFormat {
    pub quality: String,
    pub label: String,
    pub bitrate: String,
    pub size: String,
}

// ── yt-dlp JSON output models (partial) ──────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YtdlpInfo {
    title: Option<String>,
    uploader: Option<String>,
    channel: Option<String>,
    duration: Option<f64>,
    thumbnail: Option<String>,
    formats: Option<Vec<YtdlpFormat>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YtdlpFormat {
    format_id: Option<String>,
    ext: Option<String>,
    resolution: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
    vcodec: Option<String>,
    acodec: Option<String>,
    filesize: Option<i64>,
    filesize_approx: Option<i64>,
    abr: Option<f64>,
    fps: Option<f64>,
    tbr: Option<f64>,
}

// ── URL validation ───────────────────────────────────────────────────

fn is_valid_youtube_url(url: &str) -> bool {
    if url.is_empty() {
        return false;
    }
    let lower = url.to_lowercase();
    lower.contains("youtube.com") || lower.contains("youtu.be")
}

// ── Format helpers ───────────────────────────────────────────────────

fn format_duration(seconds: f64) -> String {
    let total = seconds as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    if h > 0 {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{m}:{s:02}")
    }
}

fn format_filesize(bytes: i64) -> String {
    if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.0} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.1} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

fn quality_label(height: Option<i64>, fps: Option<f64>) -> String {
    match height {
        Some(h) => {
            let fps_suffix = fps.map_or("".into(), |f| if f > 50.0 { "60" } else { "" });
            format!("{h}p{fps_suffix}")
        }
        None => "Unknown".into(),
    }
}

fn quality_tier(height: Option<i64>) -> &'static str {
    match height {
        Some(h) if h >= 2160 => "4K Ultra HD",
        Some(h) if h >= 1440 => "2K Quad HD",
        Some(h) if h >= 1080 => "Full HD",
        Some(h) if h >= 720 => "HD",
        Some(h) if h >= 480 => "SD",
        Some(h) if h >= 360 => "Low",
        _ => "Data Saver",
    }
}

// ── Core analyze logic ───────────────────────────────────────────────

async fn run_ytdlp(url: &str) -> Result<YtdlpInfo, AnalyzeError> {
    let ytdlp_path = crate::runtime::resolve_ytdlp().ok_or_else(AnalyzeError::ytdlp_not_found)?;

    let output = Command::new(&ytdlp_path)
        .args([
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            "--no-check-certificates",
            "--flat-playlist",
            "--skip-download",
            url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AnalyzeError::ytdlp_not_found()
            } else {
                AnalyzeError::extraction_failed(&e.to_string())
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("Unable to download webpage")
            || stderr.contains("Network")
            || stderr.contains("connection")
        {
            return Err(AnalyzeError::network_error());
        }
        return Err(AnalyzeError::extraction_failed(&stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<YtdlpInfo>(&stdout).map_err(|e| {
        AnalyzeError::extraction_failed(&format!("Failed to parse yt-dlp output: {e}"))
    })
}

fn normalize_formats(info: &YtdlpInfo) -> (Vec<NormalizedVideoFormat>, Vec<NormalizedAudioFormat>) {
    let formats = match &info.formats {
        Some(f) if !f.is_empty() => f,
        _ => return (vec![], vec![]),
    };

    let mut video_formats: Vec<NormalizedVideoFormat> = Vec::new();
    let mut audio_formats: Vec<NormalizedAudioFormat> = Vec::new();

    // Track seen video qualities to deduplicate
    let mut seen_video_qualities: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    for fmt in formats {
        let has_video = fmt.vcodec.as_deref() != Some("none") && fmt.vcodec.is_some();
        let has_audio = fmt.acodec.as_deref() != Some("none") && fmt.acodec.is_some();

        if has_video && fmt.height.is_some() {
            let quality = quality_label(fmt.height, fmt.fps);
            let tier = quality_tier(fmt.height);

            // Only keep MP4 video formats, deduplicate by quality
            let ext = fmt.ext.as_deref().unwrap_or("mp4");
            if ext != "mp4" {
                continue;
            }

            if seen_video_qualities.contains(&quality) {
                continue;
            }
            seen_video_qualities.insert(quality.clone());

            let size = fmt
                .filesize
                .or(fmt.filesize_approx)
                .map(format_filesize)
                .unwrap_or_default();

            let label = if size.is_empty() {
                tier.to_string()
            } else {
                format!("{tier} · {size}")
            };

            video_formats.push(NormalizedVideoFormat {
                quality,
                label,
                format: "MP4".into(),
                size,
            });
        } else if has_audio && !has_video {
            let abr = fmt.abr.unwrap_or(0.0) as u64;
            if abr == 0 {
                continue;
            }

            let ext = fmt.ext.as_deref().unwrap_or("mp3");

            let size = fmt
                .filesize
                .or(fmt.filesize_approx)
                .map(format_filesize)
                .unwrap_or_default();

            let quality = format!("{} {}", ext.to_uppercase(), abr);
            let bitrate = format!("{abr} kbps");

            let tier = if abr >= 256 {
                "High Quality"
            } else {
                "Standard"
            };

            let label = if size.is_empty() {
                tier.to_string()
            } else {
                format!("{tier} · {size}")
            };

            audio_formats.push(NormalizedAudioFormat {
                quality,
                label,
                bitrate,
                size,
            });
        }
    }

    // Sort video by height descending (best first)
    video_formats.sort_by(|a, b| {
        let a_h: i64 = a.quality.replace(['p', 'P'], "").parse().unwrap_or(0);
        let b_h: i64 = b.quality.replace(['p', 'P'], "").parse().unwrap_or(0);
        b_h.cmp(&a_h)
    });

    // Sort audio by bitrate descending
    audio_formats.sort_by(|a, b| {
        let a_br: u64 = a.bitrate.replace(" kbps", "").parse().unwrap_or(0);
        let b_br: u64 = b.bitrate.replace(" kbps", "").parse().unwrap_or(0);
        b_br.cmp(&a_br)
    });

    (video_formats, audio_formats)
}

// ── Public command ───────────────────────────────────────────────────

#[tauri::command]
pub async fn analyze_url(url: String) -> Result<AnalyzedVideo, AnalyzeError> {
    // Validate URL
    if url.trim().is_empty() {
        return Err(AnalyzeError::invalid_url("URL cannot be empty."));
    }

    let url = url.trim();

    if !is_valid_youtube_url(url) {
        return Err(AnalyzeError::unsupported_url());
    }

    // Run yt-dlp
    let info = run_ytdlp(url).await?;

    // Normalize formats first (borrows info)
    let (video_formats, audio_formats) = normalize_formats(&info);

    // Then extract fields (consumes info)
    let title = info.title.unwrap_or_else(|| "Unknown Title".into());

    let channel = info
        .channel
        .or(info.uploader)
        .unwrap_or_else(|| "Unknown Channel".into());

    let duration = info
        .duration
        .map(format_duration)
        .unwrap_or_else(|| "0:00".into());

    let thumbnail = info.thumbnail.unwrap_or_default();

    Ok(AnalyzedVideo {
        title,
        channel,
        duration,
        thumbnail,
        video_formats,
        audio_formats,
    })
}
