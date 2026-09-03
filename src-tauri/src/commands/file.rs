use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

fn downloads_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        // Android public Downloads directory.
        //
        // The previous implementation relied on:
        // app.path().download_dir()
        //
        // On the target device this was not resolving to the public
        // /sdcard/Download directory, which is why TubeLite was never
        // appearing there.
        let downloads = PathBuf::from("/sdcard/Download");
        let tubelite_dir = downloads.join("TubeLite");

        fs::create_dir_all(&tubelite_dir).map_err(|error| {
            format!(
                "Could not create public Downloads/TubeLite directory: {error}"
            )
        })?;

        return Ok(tubelite_dir);
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;

        dirs::download_dir()
            .ok_or_else(|| "The device Downloads directory is unavailable.".to_string())
    }
}

fn safe_filename(filename: &str) -> String {
    let name = Path::new(filename)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("download");

    let sanitized: String = name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || ".-_".contains(character) {
                character
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.is_empty() {
        "download".to_string()
    } else {
        sanitized
    }
}

fn unique_path(directory: &Path, filename: &str) -> PathBuf {
    let safe_name = safe_filename(filename);
    let path = directory.join(&safe_name);

    if !path.exists() {
        return path;
    }

    let stem = Path::new(&safe_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");

    let extension = Path::new(&safe_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");

    for index in 1..10000 {
        let candidate = if extension.is_empty() {
            directory.join(format!("{stem} ({index})"))
        } else {
            directory.join(format!("{stem} ({index}).{extension}"))
        };

        if !candidate.exists() {
            return candidate;
        }
    }

    directory.join(format!(
        "{stem}-{}{}",
        UNIX_EPOCH
            .elapsed()
            .unwrap_or_default()
            .as_nanos(),
        if extension.is_empty() {
            String::new()
        } else {
            format!(".{extension}")
        }
    ))
}

#[tauri::command]
pub fn download_backend_file(
    app: tauri::AppHandle,
    backend_url: String,
    job_id: String,
    filename: String,
) -> Result<String, String> {
    if !job_id
        .chars()
        .all(|character| character.is_ascii_hexdigit() || character == '-')
    {
        return Err("Invalid download job ID.".to_string());
    }

    let address = backend_url
        .strip_prefix("http://")
        .ok_or_else(|| {
            "Only HTTP backend URLs are supported for native streaming.".to_string()
        })?;

    let (host_port, _) = address.split_once('/').unwrap_or((address, ""));

    let mut stream = TcpStream::connect(host_port)
        .map_err(|error| format!("Could not connect to download service: {error}"))?;

    let request = format!(
        "GET /api/download/{job_id}/file HTTP/1.1\r\n\
         Host: {host_port}\r\n\
         Connection: close\r\n\
         \r\n"
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;

    // IMPORTANT:
    // Resolve the destination BEFORE creating the file.
    let directory = downloads_dir(&app)?;

    fs::create_dir_all(&directory).map_err(|error| {
        format!("Could not create download directory: {error}")
    })?;

    let target = unique_path(&directory, &filename);

    println!(
        "[AndroidDownload] saving backend file to: {}",
        target.display()
    );

    let mut reader = BufReader::new(stream);

    let mut status_line = String::new();

    reader
        .read_line(&mut status_line)
        .map_err(|error| error.to_string())?;

    if !status_line.starts_with("HTTP/1.1 200")
        && !status_line.starts_with("HTTP/1.0 200")
    {
        return Err(format!(
            "Download file request failed: {}",
            status_line.trim()
        ));
    }

    let mut content_length: Option<u64> = None;

    loop {
        let mut line = String::new();

        reader
            .read_line(&mut line)
            .map_err(|error| error.to_string())?;

        if line == "\r\n" || line.is_empty() {
            break;
        }

        if let Some(value) = line.strip_prefix("Content-Length:") {
            content_length = Some(
                value
                    .trim()
                    .parse::<u64>()
                    .map_err(|_| "Invalid file response length.".to_string())?,
            );
        }
    }

    let length = content_length
        .ok_or_else(|| "File response has no content length.".to_string())?;

    let mut file = File::create(&target).map_err(|error| {
        format!(
            "Could not create destination file '{}': {error}",
            target.display()
        )
    })?;

    let copied = std::io::copy(&mut reader.take(length), &mut file)
        .map_err(|error| format!("Could not save downloaded file: {error}"))?;

    if copied != length {
        let _ = fs::remove_file(&target);

        return Err(format!(
            "Downloaded file is incomplete: expected {length} bytes, received {copied} bytes."
        ));
    }

    file.flush()
        .map_err(|error| format!("Could not flush downloaded file: {error}"))?;

    println!(
        "[AndroidDownload] file saved successfully: {} ({} bytes)",
        target.display(),
        copied
    );

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_local_file(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    // Android: FileProvider content:// URI through the mobile plugin.
    #[cfg(target_os = "android")]
    {
        let state = app.state::<tauri_plugin_ytdlp::YtDlp<tauri::Wry>>();

        return state.open_file(&path);
    }

    // Desktop: open_path with canonical validation.
    #[cfg(not(target_os = "android"))]
    {
        let directory = downloads_dir(&app)?
            .canonicalize()
            .map_err(|error| error.to_string())?;

        let target = PathBuf::from(path)
            .canonicalize()
            .map_err(|error| error.to_string())?;

        if target.parent() != Some(directory.as_path()) {
            return Err(
                "The selected file is outside the device Downloads directory."
                    .to_string(),
            );
        }

        app.opener()
            .open_path(target.to_string_lossy(), None::<&str>)
            .map_err(|error| error.to_string())
    }
}