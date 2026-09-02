use std::path::{Path, PathBuf};
use std::process::Stdio;

/// Resolve the directory where the application binary lives.
/// In production (packaged): next to the .exe
fn exe_dir() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Walk up from the exe directory to find the project root
/// (the directory containing src-tauri/Cargo.toml).
fn project_root() -> PathBuf {
    let start = exe_dir();
    let mut current = start.as_path();
    loop {
        if current.join("src-tauri").join("Cargo.toml").exists() {
            return current.to_path_buf();
        }
        if current.join("Cargo.toml").exists() && current.join("src").exists() {
            return current.to_path_buf();
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent,
            _ => break,
        }
    }
    start
}

/// Check if a file exists and is likely executable (has .exe extension on Windows).
fn is_executable(path: &Path) -> bool {
    path.exists() && path.is_file()
}

/// Look for a binary by trying multiple locations in order:
/// 1. Next to the application executable (production packaged location)
/// 2. src-tauri/bin/ (development location)
/// 3. PATH fallback (development convenience)
///
/// Returns the path if found, or None.
fn resolve_binary(name: &str) -> Option<PathBuf> {
    let target_triple = std::env::var("TAURI_ENV_TARGET_TRIPLE")
        .unwrap_or_else(|_| "x86_64-pc-windows-msvc".into());

    let exe = exe_dir();
    let root = project_root();

    let candidates = [
        // 1. Production: next to the app executable (Tauri sidecar naming)
        exe.join(format!("{name}-{target_triple}.exe")),
        exe.join(format!("{name}.exe")),
        // 2. Development: project root / src-tauri / bin /
        root.join("src-tauri").join("bin").join(format!("{name}-{target_triple}.exe")),
        root.join("src-tauri").join("bin").join(format!("{name}.exe")),
    ];

    eprintln!("[RUNTIME] Resolving {name}:");
    eprintln!("  exe_dir: {}", exe.display());
    eprintln!("  project_root: {}", root.display());
    for candidate in &candidates {
        let exists = is_executable(candidate);
        eprintln!("  candidate: {} (exists: {})", candidate.display(), exists);
        if exists {
            eprintln!("  → resolved: {}", candidate.display());
            return Some(candidate.clone());
        }
    }

    // 3. PATH fallback (development convenience)
    eprintln!("  → falling back to PATH...");
    let result = resolve_on_path(name);
    if let Some(ref p) = result {
        eprintln!("  → PATH resolved: {}", p.display());
    } else {
        eprintln!("  → not found anywhere");
    }
    result
}

/// Try to find an executable on PATH using `where` (Windows).
fn resolve_on_path(name: &str) -> Option<PathBuf> {
    if let Ok(output) = std::process::Command::new("where")
        .arg(name)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                let path = PathBuf::from(path_str.lines().next().unwrap_or(&path_str));
                if is_executable(&path) {
                    return Some(path);
                }
            }
        }
    }
    None
}

/// Resolve the yt-dlp executable.
/// Order: bundled → PATH
pub fn resolve_ytdlp() -> Option<PathBuf> {
    resolve_binary("yt-dlp")
}

/// Resolve the FFmpeg executable.
/// Order: bundled → PATH
pub fn resolve_ffmpeg() -> Option<PathBuf> {
    resolve_binary("ffmpeg")
}

/// Get yt-dlp version by running `yt-dlp --version`.
pub fn ytdlp_version() -> Option<String> {
    let path = resolve_ytdlp()?;
    let output = std::process::Command::new(&path)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// Get FFmpeg version by running `ffmpeg -version`.
pub fn ffmpeg_version() -> Option<String> {
    let path = resolve_ffmpeg()?;
    let output = std::process::Command::new(&path)
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if output.status.success() {
        let first_line = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .to_string();
        Some(first_line)
    } else {
        None
    }
}

/// Check if running in development mode (not a packaged app).
pub fn is_development() -> bool {
    let dir = exe_dir();
    // If the exe is inside a `target/` directory, we're in dev mode
    dir.to_string_lossy().contains("target")
}
