# PROJECT MASTER CONTEXT — TubeLite Downloader

> **Purpose:** This document fully describes the TubeLite Downloader project so that any AI coding agent can understand the architecture, data flows, current status, historical context, frozen components, known bugs, and rules for modification without reading the codebase.

---

## TABLE OF CONTENTS

1. [Product Definition](#1-product-definition)
2. [Current Architecture](#2-current-architecture)
3. [Repository Inventory](#3-repository-inventory)
4. [Frontend State Machine](#4-frontend-state-machine)
5. [Complete User Flows](#5-complete-user-flows)
6. [Backend Architecture](#6-backend-architecture)
7. [yt-dlp Pipeline](#7-yt-dlp-pipeline)
8. [Android Architecture](#8-android-architecture)
9. [Network / Request Flow](#9-network--request-flow)
10. [Current Working Status](#10-current-working-status)
11. [Current Known Bugs](#11-current-known-bugs)
12. [Historical Debugging / Failed Approaches](#12-historical-debugging--failed-approaches)
13. [Frozen Components](#13-frozen-components)
14. [Security / Limitations](#14-security--limitations)
15. [Configuration](#15-configuration)
16. [Build / Run / Test Procedures](#16-build--run--test-procedures)
17. [Non-Goals](#17-non-goals)
18. [Future Work](#18-future-work)
19. [New AI Agent Context — Read This First](#19-new-agent-context--read-this-first)
20. [Final Project Snapshot](#20-final-project-snapshot)

---

## 1. PRODUCT DEFINITION

**Product Name:** TubeLite Downloader

**Platforms:** Android (primary target), Windows desktop (development/testing)

**Intended Users:** Anyone wanting to download YouTube videos or extract audio on Android or Windows.

**Primary Use Case:** Paste a YouTube URL → Analyze → Select quality → Download → Open file.

**Supported Download Types:**
- MP4 video (quality selectable: 144p to 4K)
- MP3 audio (extracted via FFmpeg conversion)

**Intentionally NOT Supported:**
- Playlist downloads (`--no-playlist` is hardcoded)
- Browser cookie authentication
- Private/authenticated content
- Arbitrary non-YouTube URLs

**Where Files Are Stored:**
- Desktop: `~/Downloads/TubeLite/` (via `dirs::download_dir()`)
- Android: Backend serves files, app downloads them via HTTP to device storage

---

## 2. CURRENT ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ANDROID DEVICE                               │
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐ │
│  │  React UI    │────▶│  Tauri 2     │────▶│  Rust Commands       │ │
│  │  (WebView)   │     │  IPC Bridge  │     │  (lib.rs)            │ │
│  └──────────────┘     └──────────────┘     └──────────┬───────────┘ │
│                                                        │              │
│                     ┌──────────────────────────────────┘              │
│                     │                                                  │
│              ┌──────▼──────────┐      ┌──────────────────────┐       │
│              │  @tauri-apps/   │      │  Kotlin Plugin       │       │
│              │  plugin-http    │      │  (YtDlpPlugin.kt)    │       │
│              │  (native fetch) │      │  [FROZEN/UNUSED      │       │
│              └──────┬──────────┘      │   for analyze]       │       │
│                     │                  └──────────────────────┘       │
└─────────────────────┼────────────────────────────────────────────────┘
                      │
                      │  HTTP POST/GET (LAN)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PC (LAN)                                     │
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐ │
│  │  Node.js     │────▶│  yt-dlp      │────▶│  FFmpeg (MP3 only)  │ │
│  │  Backend     │     │  (bundled)   │     │  (bundled)           │ │
│  │  :3001       │     └──────────────┘     └──────────────────────┘ │
│  └──────────────┘                                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Desktop Architecture (simpler — no LAN)

```
User
  ↓
React UI (WebView)
  ↓ invoke("analyze_url") / invoke("start_download")
Rust Command (lib.rs → commands/*.rs)
  ↓ spawn
yt-dlp.exe (bundled in src-tauri/bin/)
  ↓ (MP3 only)
ffmpeg.exe (bundled in src-tauri/bin/)
  ↓
Output file in ~/Downloads/TubeLite/
```

**Key difference:** Desktop uses Rust subprocess execution directly. Android uses a Node.js backend on the PC over LAN.

---

## 3. REPOSITORY INVENTORY

### Root Directory

| Path | Purpose | Status |
|------|---------|--------|
| `src/` | React/TypeScript frontend | Active |
| `src-tauri/` | Tauri 2 Rust + Android project | Active |
| `backend/` | Node.js backend server | Active |
| `dist/` | Vite build output | Generated |
| `node_modules/` | npm dependencies | Generated |
| `.env` | Build-time env vars (`VITE_TUBELITE_BACKEND_URL`) | Active |
| `.env.example` | Template for `.env` | Documentation |
| `.gitignore` | Git ignore rules | Active |
| `package.json` | npm manifest | Active |
| `vite.config.ts` | Vite bundler config | Active |
| `tsconfig.json` | TypeScript project references | Active |

### Frontend (`src/`)

| Path | Purpose | Status |
|------|---------|--------|
| `src/App.tsx` | Root component, screen routing, bottom nav | Active |
| `src/main.tsx` | React DOM entry point | Active |
| `src/index.css` | Tailwind v4 theme (dark palette) | Active |
| `src/pages/Home.tsx` | URL input + Analyze button | Active |
| `src/pages/Analyzing.tsx` | Loading spinner during analysis | Active |
| `src/pages/DownloadSetup.tsx` | Quality/format selection | Active |
| `src/pages/Downloading.tsx` | Progress display | Active |
| `src/pages/DownloadComplete.tsx` | Success + Open File | Active |
| `src/pages/DownloadError.tsx` | Error display + retry/change link | Active |
| `src/pages/Settings.tsx` | Settings page (placeholder) | Active |
| `src/hooks/useDownloadFlow.ts` | Central state machine + all actions | Active |
| `src/services/tauri.ts` | Tauri invoke wrappers + platform branching | Active |
| `src/services/backend.ts` | HTTP client for backend API + nativeFetch bridge | Active |
| `src/types/download.ts` | Type definitions + mapper functions | Active |
| `src/types/navigation.ts` | **DELETED** (was duplicate of NavTab) | Removed |
| `src/data/mockData.ts` | Mock data for browser-only mode | Active |
| `src/components/*.tsx` | 12 UI components (all used) | Active |

### Tauri/Rust (`src-tauri/`)

| Path | Purpose | Status |
|------|---------|--------|
| `src-tauri/src/lib.rs` | Plugin registration, command handler, bridge commands | Active |
| `src-tauri/src/main.rs` | Desktop entry point | Active |
| `src-tauri/src/runtime.rs` | Binary resolution (yt-dlp, FFmpeg) | Active (desktop only) |
| `src-tauri/src/commands/mod.rs` | Command exports | Active |
| `src-tauri/src/commands/analyze.rs` | Desktop yt-dlp analysis (subprocess) | Active (desktop only) |
| `src-tauri/src/commands/download.rs` | Desktop download + FFmpeg + progress events | **FROZEN** |
| `src-tauri/src/commands/file.rs` | File transfer (HTTP download from backend) + Open File | **FROZEN** |
| `src-tauri/plugins/yt-dlp/` | Custom Tauri plugin for Kotlin bridge | Active (Android) |
| `src-tauri/capabilities/default.json` | Tauri permissions (HTTP scope) | Active |
| `src-tauri/tauri.conf.json` | Tauri app configuration | Active |
| `src-tauri/Cargo.toml` | Rust dependencies | Active |

### Android Generated (`src-tauri/gen/android/`)

| Path | Purpose | Status |
|------|---------|--------|
| `app/build.gradle.kts` | Android build config (signing, packaging, cleartext) | Active |
| `app/src/main/AndroidManifest.xml` | Android permissions + FileProvider | Active |
| `app/src/main/java/.../YtDlpPlugin.kt` | Kotlin plugin (Chaquopy bridge) | **FROZEN** |
| `app/src/main/java/.../MainActivity.kt` | Tauri Android activity | Generated |
| `app/src/main/res/xml/file_paths.xml` | FileProvider path config | Active |
| `app/proguard-rules.pro` | R8 keep rules | Active |
| `app/src/main/assets/tauri.conf.json` | Tauri config for Android | Generated |

### Backend (`backend/`)

| Path | Purpose | Status |
|------|---------|--------|
| `backend/src/index.ts` | HTTP server, CORS, routing | Active |
| `backend/src/routes/analyze.ts` | POST /api/analyze handler | Active |
| `backend/src/routes/download.ts` | POST /api/download handler | Active |
| `backend/src/routes/health.ts` | GET /health handler | Active |
| `backend/src/services/ytDlpService.ts` | yt-dlp subprocess execution | Active |
| `backend/src/services/downloadService.ts` | Download job registry + lifecycle | **FROZEN** |
| `backend/src/utils/config.ts` | Environment variable config | Active |
| `backend/src/utils/validation.ts` | URL validation + format helpers | Active |

---

## 4. FRONTEND STATE MACHINE

Defined in `src/hooks/useDownloadFlow.ts`:

```
Screen type:
  "home" | "analyzing" | "setup" | "downloading" | "complete" | "error" | "settings"

NavTab type:
  "home" | "history" | "settings"
```

### State Transitions

```
HOME (navTab="home")
  │
  │ User enters URL, taps Analyze
  │ → setState({ screen: "analyzing" })
  │
  ▼
ANALYZING
  │
  ├─ success → setState({ screen: "setup", videoInfo, videoFormats, audioFormats })
  │
  └─ error → setState({ screen: "error", error: { title, message } })

SETUP
  │
  │ User selects format, taps Download
  │ → setState({ screen: "downloading" })
  │ → startDownload() → backend POST /api/download
  │
  ├─ Android: polls GET /api/download/:jobId every 1s
  │   ├─ completed → downloadBackendFile() → setState({ screen: "complete" })
  │   └─ failed → setState({ screen: "error" })
  │
  └─ Desktop: listens to Tauri events (download-progress, download-complete, download-error)
      ├─ progress → setState({ progress, speed, eta })
      ├─ complete → setState({ screen: "complete" })
      └─ error → setState({ screen: "error" })

DOWNLOADING
  │
  ├─ Cancel → setState({ screen: "setup" })
  ├─ Progress events update state
  └─ Complete → setState({ screen: "complete" })

COMPLETE
  │
  ├─ Open File → openLocalFile(filepath)
  └─ Download Another → setState({ screen: "home" })

ERROR
  │
  ├─ Try Again → re-runs performAnalyze(url) → setState({ screen: "analyzing" })
  └─ Change Link → setState({ screen: "home" })
```

**Bottom nav visibility:** Hidden during `downloading`, `complete`, `error`, `analyzing`.

**Tab navigation:**
- `navTab="home"` → Shows download flow screens
- `navTab="history"` → Shows "No history yet" placeholder
- `navTab="settings"` → Shows SettingsPage

**State ownership:** All state lives in `useDownloadFlow` hook. `App.tsx` destructures and passes to children. No external state management library.

---

## 5. COMPLETE USER FLOWS

### FLOW A — Android Analyze

1. **User:** Pastes YouTube URL in `Home.tsx` UrlInput, taps AnalyzeButton
2. **Component:** `Home.tsx` → `onAnalyze(url)`
3. **Handler:** `handleAnalyze(url)` in `useDownloadFlow.ts`
4. **State:** `{ screen: "analyzing", url }`
5. **Function:** `performAnalyze(url)`
6. **Service:** `analyzeUrl(url, signal)` in `tauri.ts`
7. **Branch:** `isAndroidRuntime()` → true → `analyzeWithBackend(url, signal)` in `backend.ts`
8. **HTTP:** `nativeFetch(backendUrl + "/api/analyze", { method: "POST", body: { url } })`
   - On Android: uses `@tauri-apps/plugin-http` (native HTTP, bypasses WebView)
   - On Desktop: uses `window.fetch`
9. **Backend:** `POST /api/analyze` → `analyzeRoute()` → `analyzeUrl(url)` in `ytDlpService.ts`
10. **yt-dlp:** `spawn("yt-dlp", [url, "--dump-json", "--no-playlist", "--js-runtimes", "node:node", "--remote-components", "ejs:github", ...])`
11. **Response:** JSON with title, channel, duration, thumbnail, video_formats, audio_formats
12. **Frontend:** `parseAnalyzedResult()` → `mapAnalyzedToVideoInfo()` etc.
13. **State:** `{ screen: "setup", videoInfo, videoFormats, audioFormats }`
14. **UI:** `DownloadSetup.tsx` renders quality options

### FLOW B — Android Video Download

1. **User:** Selects quality in DownloadSetup, taps Download
2. **Handler:** `handleStartDownload()`
3. **State:** `{ screen: "downloading", stage: "downloading" }`
4. **Service:** `startDownload(url, quality, "video")` in `tauri.ts`
5. **Branch:** `isAndroidRuntime()` → `downloadWithBackend(url, quality, "video")`
6. **HTTP:** `nativeFetch(backendUrl + "/api/download", { method: "POST", body: { url, quality, kind: "video" } })`
7. **Backend:** Creates job, spawns yt-dlp with format selector, returns `{ jobId }`
8. **Polling:** `getDownloadStatus(jobId)` every 1s via `GET /api/download/:jobId`
9. **Completed:** `downloadBackendFile(jobId, filename)` → Rust `download_backend_file` → TCP stream from backend → saves to device Downloads
10. **State:** `{ screen: "complete", completedDownloadInfo: { filepath, ... } }`
11. **UI:** `DownloadComplete.tsx` with Open File button

### FLOW C — Android Audio (MP3) Download

Same as Flow B but:
- `kind: "mp3"` → backend spawns yt-dlp with `bestaudio/best` → then FFmpeg converts to MP3
- Progress includes "converting" stage
- Final file is `.mp3`

### FLOW D — Desktop Download

1. **User:** Selects quality, taps Download
2. **Service:** `startDownload(url, quality, "video")` → `invokeNative("start_download", { request })`
3. **Rust:** `start_download()` in `download.rs` → spawns yt-dlp subprocess directly
4. **Events:** Tauri events (`download-progress`, `download-complete`, `download-error`)
5. **File:** Saved to `~/Downloads/TubeLite/` directly
6. **Open File:** `openLocalFile()` → `app.opener().open_path()` (desktop)

---

## 6. BACKEND ARCHITECTURE

**Stack:** Node.js, TypeScript, native `http` module (no Express)

**Host/Port:** `0.0.0.0:3001` (bound to all interfaces for LAN access)

**CORS Origins:** `http://tauri.localhost,https://tauri.localhost` (configurable via `CORS_ORIGIN` env var)

### Endpoints

| Method | Path | Input | Output | Purpose | Status |
|--------|------|-------|--------|---------|--------|
| GET | `/health` | — | `{ status: "ok" }` | Health check | ✅ Working |
| POST | `/api/analyze` | `{ url: string }` | `{ title, channel, duration, thumbnail, video_formats, audio_formats }` | YouTube metadata extraction | ❌ YouTube 502 |
| POST | `/api/download` | `{ url, quality, kind }` | `{ jobId: string }` | Start download job | 🔒 Frozen |
| GET | `/api/download/:jobId` | — | `{ status, progress, speed, eta, result? }` | Poll download status | 🔒 Frozen |
| GET | `/api/download/:jobId/file` | — | Binary file stream | Download completed file | 🔒 Frozen |

### Backend Config (`backend/src/utils/config.ts`)

```typescript
{
  host: process.env.BACKEND_HOST || '127.0.0.1',    // Overridden to 0.0.0.0 in practice
  port: Number(process.env.PORT || 3001),
  ytdlpBinary: process.env.YT_DLP_BINARY || 'yt-dlp',
  ffmpegBinary: process.env.FFMPEG_BINARY || 'ffmpeg',
  nodeBinary: process.env.NODE_BINARY || 'node',
  ytdlpForceIpv4: process.env.YT_DLP_FORCE_IPV4 === 'true',
  ytdlpTimeoutMs: Number(process.env.YT_DLP_TIMEOUT_MS || 30000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://tauri.localhost,https://tauri.localhost')
    .split(',').map(s => s.trim()).filter(Boolean),
}
```

### Job Lifecycle (Download)

1. `POST /api/download` → creates job in memory map → spawns yt-dlp → returns `jobId`
2. `GET /api/download/:jobId` → returns current status/progress
3. `GET /api/download/:jobId/file` → streams the completed file
4. Job stored in `Map<string, DownloadJob>` in `downloadService.ts`
5. No automatic cleanup of completed jobs (held in memory)

---

## 7. yt-dlp PIPELINE

### Analyze Command (Backend)

**Executable:** System `yt-dlp` (from PATH or configured binary)

**Command:**
```bash
yt-dlp <url> \
  --dump-json \
  --no-playlist \
  --js-runtimes node:<nodeBinary> \
  --remote-components ejs:github \
  --extractor-retries 3 \
  --no-warnings
```

**Flags explained:**
- `--dump-json`: Output metadata as JSON
- `--no-playlist`: Single video only
- `--js-runtimes node:<node>`: Use Node.js as JavaScript runtime for YouTube's `n`-challenge
- `--remote-components ejs:github`: Download EJS scripts from GitHub (not bundled locally)
- `--extractor-retries 3`: Retry on extractor errors
- `--no-warnings`: Suppress warnings in stdout

**Output:** JSON with title, formats, duration, thumbnail, etc.

**Timeout:** 30 seconds (configurable)

### Download Command (Desktop Rust)

**Executable:** Bundled `yt-dlp.exe` (resolved via `runtime.rs`)

**Video command:**
```bash
yt-dlp <url> \
  -f "bestvideo[height<=<H>][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=<H>]+bestaudio/best[height<=<H>]/best" \
  -o "<downloadDir>/%(title)s.%(ext)s" \
  --no-playlist --no-warnings --no-check-certificates \
  --newline --progress --progress-delta 1 --no-colors \
  --merge-output-format mp4
```

**MP3 command:**
```bash
yt-dlp <url> \
  -f "bestaudio/best" \
  -o "<downloadDir>/.tmp_%(title)s.%(ext)s" \
  --no-playlist --no-warnings --no-check-certificates \
  --newline --progress --progress-delta 1 --no-colors
```

Then FFmpeg converts:
```bash
ffmpeg -y -i <tempfile> -codec:a libmp3lame -b:a 320k -q:a 0 <output.mp3>
```

### Format Selection

| Quality String | yt-dlp Selector |
|---------------|-----------------|
| `2160p` | `bestvideo[height<=2160][ext=mp4]+bestaudio...` |
| `1080p` | `bestvideo[height<=1080][ext=mp4]+bestaudio...` |
| `720p` | `bestvideo[height<=720][ext=mp4]+bestaudio...` |
| MP3 | `bestaudio/best` → FFmpeg to MP3 |

---

## 8. ANDROID ARCHITECTURE

### Technology Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS v4
- **Shell:** Tauri 2.11
- **Native:** Rust (compiled to `libtubelite_lib.so` for aarch64)
- **Android Project:** Generated by `npx tauri android init`
- **Package ID:** `com.tubelite.downloader`
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 36
- **ABI:** arm64-v8a (physical device), universal (build)
- **Signing:** Debug keystore at `~/.android-keystore/tubelite-dev.jks`

### How Android Differs from Desktop

| Aspect | Desktop | Android |
|--------|---------|---------|
| Analyze | Rust subprocess `yt-dlp.exe` | HTTP to Node.js backend on PC |
| Download | Rust subprocess `yt-dlp.exe` + events | HTTP to backend + polling + file transfer |
| File location | `~/Downloads/TubeLite/` | Device storage via `download_backend_file` |
| Open File | `app.opener().open_path()` | FileProvider content:// URI via Kotlin plugin |
| JS Runtime | N/A (subprocess) | N/A (backend runs yt-dlp) |

### Android HTTP Plugin Configuration

**Capability (`src-tauri/capabilities/default.json`):**
```json
{
  "permissions": [
    "core:default",
    {
      "identifier": "http:default",
      "allow": [{ "url": "http://10.250.42.215:3001" }]
    }
  ]
}
```

This allows the Tauri HTTP plugin to make requests to the backend only. The `nativeFetch()` function in `backend.ts` uses `@tauri-apps/plugin-http` on Android to bypass WebView mixed-content/CORS restrictions.

### Android Cleartext HTTP

`build.gradle.kts` sets `usesCleartextTraffic = "true"` for both debug and release builds, allowing HTTP requests to the LAN backend.

### FileProvider Configuration

`file_paths.xml`:
```xml
<external-files-path name="app_downloads" path="." />
<external-path name="shared_downloads" path="Download" />
<cache-path name="app_cache" path="." />
```

`open_local_file` on Android routes through `tauri_plugin_ytdlp::YtDlp::open_file()` which uses `FileProvider.getUriForFile()` + `ACTION_VIEW` intent.

### Why Android Does NOT Run Local yt-dlp

**HISTORICAL:** Phase 6B attempted to run yt-dlp directly on Android using:
1. `yt-dlp-android` Maven library (Chaquopy/CPython 3.13)
2. QuickJS-NG binary (cross-compiled for ARM64)
3. `yt-dlp-ejs` Python package (for YouTube's n-challenge)
4. Monkey-patch to inject `--js-runtimes` into compiled `ytdlp_runner.pyc`

**What failed:**
- YouTube returned HTTP 403 (bot detection) even with QuickJS + EJS
- `ytdlp_runner.pyc` silently dropped unmapped CLI flags
- `executeDebug()` + `LogCallback` crashed with Chaquopy runtime
- `usesCleartextTraffic` blocked HTTP in release builds
- Tauri HTTP plugin scope blocked all URLs initially

**Result:** Android analysis was switched to use the Node.js backend on the PC over LAN. The Kotlin plugin infrastructure remains but is NOT used for analysis.

**DO NOT REINTRODUCE** local yt-dlp/QuickJS/EJS on Android without a complete redesign.

---

## 9. NETWORK / REQUEST FLOW

### Current LAN Architecture

```
Android App (10.250.x.x)
    │
    │ @tauri-apps/plugin-http (native HTTP client)
    │ Origin: https://tauri.localhost (Tauri 2 custom protocol)
    │
    ▼
PC Backend (10.250.42.215:3001)
    │
    │ HTTP POST /api/analyze
    │ HTTP POST /api/download
    │ HTTP GET /api/download/:jobId
    │ HTTP GET /api/download/:jobId/file
    │
    ▼
yt-dlp (subprocess)
    │
    ▼
FFmpeg (MP3 conversion only)
```

### Request Paths

**Analyze (Android):**
```
React → analyzeUrl() → analyzeWithBackend() → nativeFetch()
  → @tauri-apps/plugin-http → http://10.250.42.215:3001/api/analyze
  → Node.js analyzeRoute() → ytDlpService.analyzeUrl() → spawn yt-dlp
  → JSON response → parseAnalyzedResult() → React state
```

**Analyze (Desktop):**
```
React → analyzeUrl() → invoke("analyze_url")
  → Rust analyze_url() → spawn yt-dlp.exe
  → JSON response → AnalyzedVideo → React state
```

**Download (Android):**
```
React → startDownload() → downloadWithBackend() → nativeFetch()
  → http://10.250.42.215:3001/api/download → { jobId }
  → Poll GET /api/download/:jobId every 1s
  → On completed: downloadBackendFile(jobId, filename)
    → Rust download_backend_file() → TCP GET /api/download/:jobId/file
    → Streams to device Downloads/TubeLite/
  → Open File: openLocalFile() → FileProvider content:// URI → ACTION_VIEW
```

### Backend CORS

Default origins: `http://tauri.localhost,https://tauri.localhost`

Android WebView origin: `https://tauri.localhost` (Tauri 2 production custom protocol)

The HTTP plugin bypasses WebView CORS entirely (native HTTP client), but CORS still applies to any `window.fetch()` fallback.

---

## 10. CURRENT WORKING STATUS

| Component | Status | Evidence | Notes |
|-----------|--------|----------|-------|
| React UI | ✅ Working | TypeScript compiles, Vite builds | 7 screens, all functional |
| Navigation | ✅ Working | Bottom nav with 3 tabs | History is placeholder |
| State machine | ✅ Working | useDownloadFlow hook | All transitions defined |
| Tauri startup | ✅ Working | Desktop + Android launch | Verified |
| Tauri commands | ✅ Working | cargo check passes | 8 commands registered |
| Android build | ✅ Working | APK builds successfully | Release build |
| Android install | ✅ Working | APK installs on physical device | Verified |
| Backend startup | ✅ Working | Health endpoint responds | `0.0.0.0:3001` |
| LAN connectivity | ✅ Working | Phone Chrome hits /health | Verified |
| /health | ✅ Working | Returns 200 + JSON | Verified |
| /api/analyze (PC) | ✅ Working | curl returns full metadata | Verified |
| Android analyze | ❌ Broken | HTTP 502 from backend | YouTube bot detection |
| Video download (Desktop) | ✅ Working | yt-dlp subprocess + events | **FROZEN** |
| MP3 download (Desktop) | ✅ Working | yt-dlp + FFmpeg | **FROZEN** |
| Progress polling (Android) | ✅ Working | Backend job registry | **FROZEN** |
| File transfer (Android) | ✅ Working | TCP stream from backend | **FROZEN** |
| Open File (Android) | ✅ Working | FileProvider content:// URI | **FROZEN** |
| Open File (Desktop) | ✅ Working | app.opener() | **FROZEN** |
| Quality selection | ✅ Working | Video + Audio formats | Desktop only (Android depends on analyze) |
| Error handling | ✅ Working | ErrorScreen component | Catches and displays errors |
| Settings | ⚠️ Placeholder | SettingsPage exists | No actual settings |
| History | ❌ Not implemented | "No history yet" text | Not started |

---

## 11. CURRENT KNOWN BUGS

### BUG 1: Android Analyze Returns HTTP 502

**Symptom:** Pressing Analyze on Android shows "The video could not be analyzed. Please try again."

**Layer:** Backend → yt-dlp → YouTube

**Current Verified Evidence:**
- Tauri HTTP plugin successfully sends POST to `http://10.250.42.215:3001/api/analyze`
- Backend receives the request
- Backend's yt-dlp subprocess executes and returns non-zero exit code
- Backend returns HTTP 502 with body: `{"error":"ERROR: [youtube] ... Sign in to confirm you're not a bot ...","code":"YTDLP_EXECUTION_FAILED"}`
- The same request from PC `curl` succeeds (HTTP 200)

**Root Cause (VERIFIED):** YouTube's anti-bot detection blocks yt-dlp. The yt-dlp version on the backend requires a JavaScript runtime + EJS to solve YouTube's `n`-challenge. The backend is configured with `--js-runtimes node:node` and `--remote-components ejs:github`, which should work but YouTube's detection is evasive.

**Current State:** The HTTP transport layer (Android → backend) is fully functional. The failure is in YouTube's anti-bot measures blocking yt-dlp extraction.

**Next Diagnostic:** The yt-dlp error message in the 502 response body contains the exact YouTube error. This needs to be read from the response and analyzed.

### BUG 2: Rust Warnings in Non-Frozen Code (Minor)

**Warnings (6 total):**
- `plugins/yt-dlp/src/lib.rs`: `PluginHandle`, `api`, `PLUGIN_IDENTIFIER` — cfg-gated (used on Android only)
- `src/commands/analyze.rs`: `format_id`, `resolution`, `width`, `tbr` fields — deserialized but not read
- `src/commands/download.rs`: `conversion_failed`, `sanitize_filename` — defined but unused

**Impact:** None (warnings only). Not dead code — cfg-gated or frozen pipeline.

---

## 12. HISTORICAL DEBUGGING / FAILED APPROACHES

### Approach 1: Android Local yt-dlp via Chaquopy

**What was tried:** Running yt-dlp directly on Android using `yt-dlp-android:2.0.2` Maven library with Chaquopy/CPython 3.13 embedded runtime.

**Why:** To avoid LAN dependency — make the app self-contained.

**What happened:** Plugin initialized, CPython loaded, but YouTube extraction returned HTTP 403 (bot detection).

**Why abandoned:** YouTube blocks yt-dlp without proper JavaScript runtime + n-challenge solving. The Chaquopy environment couldn't properly execute the required JS.

**DO NOT REINTRODUCE:** YES — unless completely redesigned with proper JS runtime support.

### Approach 2: QuickJS-NG + EJS Bundle

**What was tried:** Cross-compiling QuickJS-NG v0.16.2 for Android ARM64, bundling `yt-dlp-ejs` v0.8.0, and configuring `--js-runtimes quickjs:/path/to/qjs`.

**Why:** To provide yt-dlp with a JavaScript runtime on Android for YouTube's n-challenge.

**What happened:** Binary compiled successfully, EJS bundled, but `_cli_to_opts()` in compiled `ytdlp_runner.pyc` silently dropped the `--js-runtimes` flag. Monkey-patch was created but YouTube still returned 403.

**Why abandoned:** Multiple compounding issues — flag mapping, Chaquopy callback API incompatibility, YouTube anti-bot still blocking.

**DO NOT REINTRODUCE:** YES.

### Approach 3: Tauri HTTP Plugin for Android Analyze

**What was tried:** Using `@tauri-apps/plugin-http` to make native HTTP requests from Android to the PC backend.

**Why:** `window.fetch()` fails on Android due to HTTPS-origin → HTTP mixed content + cleartext blocking.

**What happened:** Required adding `http:default` permission + URL scope `http://10.250.42.215:3001`. Initially failed with "url not allowed on the configured scope" — fixed by adding the scope to capabilities.

**Status:** WORKING — this is the current implementation.

**DO NOT REINTRODUCE:** N/A — this is the current approach.

### Approach 4: WebView console.log for Release Debugging

**What was tried:** Adding `console.log()` diagnostic messages in `backend.ts` to trace Android Analyze requests.

**Why:** To capture runtime errors from the Android app.

**What happened:** Logs never appeared in logcat because `Logger.shouldLog()` returns `BuildConfig.DEBUG` which is `false` in release builds.

**Solution used:** Added `android_log` Rust command using `eprintln!` (goes to Android logcat via `RustStdoutStderr` tag). Temporary diagnostic bridge — now cleaned up.

**DO NOT REINTRODUCE:** The WebView console suppression in release is a known Tauri behavior. Use Rust `eprintln!` for Android debugging.

### Approach 5: FileProvider content:// URI for Android Open File

**What was tried:** Using `file://` URI with `app.opener()` to open downloaded files on Android.

**Why:** To let users open downloaded files directly.

**What happened:** `file://` URIs are blocked by Android's `FileUriExposedException` on API 24+.

**Solution:** Implemented FileProvider with `content://` URI via Kotlin plugin's `openFile` command. Routes through `FileProvider.getUriForFile()` + `ACTION_VIEW` intent.

**Status:** WORKING.

---

## 13. FROZEN COMPONENTS

The following components are **PROVEN WORKING** and **MUST NOT BE MODIFIED** without explicit justification:

### Download Pipeline (Desktop + Backend)

| File | What it does | Why frozen |
|------|-------------|------------|
| `src-tauri/src/commands/download.rs` | Desktop yt-dlp download + FFmpeg + progress events | Working end-to-end |
| `backend/src/services/downloadService.ts` | Download job registry + lifecycle | Working end-to-end |
| `backend/src/routes/download.ts` | POST /api/download endpoint | Working end-to-end |
| `src-tauri/src/commands/file.rs` | File transfer (TCP) + Open File | Working end-to-end |
| `src/services/backend.ts` `downloadWithBackend()` | Android download HTTP client | Working end-to-end |
| `src/services/backend.ts` `getDownloadStatus()` | Android status polling | Working end-to-end |
| `src/hooks/useDownloadFlow.ts` `handleStartDownload()` | Download state management | Working end-to-end |

### Android Native

| File | What it does | Why frozen |
|------|-------------|------------|
| `YtDlpPlugin.kt` | Kotlin plugin (Chaquopy bridge, FileProvider) | Working for Open File, complex to modify |
| `proguard-rules.pro` | R8 keep rules for Chaquopy | Required for plugin |
| `file_paths.xml` | FileProvider path configuration | Required for Open File |
| `build.gradle.kts` | Android build config | Working, complex interactions |

### Rules for Frozen Components

1. Do NOT refactor "for cleanliness"
2. Do NOT change error messages
3. Do NOT change API contracts
4. Do NOT change progress event structure
5. Do NOT change job lifecycle
6. Do NOT change file transfer protocol
7. Do NOT change FileProvider configuration
8. If you believe a frozen component has a bug, REPORT it — do not fix it yourself

---

## 14. SECURITY / LIMITATIONS

- **LAN-only backend:** Backend binds to `0.0.0.0:3001` — accessible from any device on the same network
- **HTTP only:** No TLS — all traffic is cleartext
- **No authentication:** Anyone on the LAN can use the backend
- **CORS restricted:** Only `tauri.localhost` origins are allowed (but HTTP plugin bypasses this)
- **HTTP scope restricted:** Tauri HTTP plugin only allows `http://10.250.42.215:3001`
- **No cookie handling:** yt-dlp runs without authentication cookies
- **YouTube anti-bot:** yt-dlp is subject to YouTube's bot detection (the current blocker)

---

## 15. CONFIGURATION

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_TUBELITE_BACKEND_URL` | (none) | Build-time backend URL for frontend |
| `BACKEND_HOST` | `127.0.0.1` | Backend bind address (overridden to `0.0.0.0`) |
| `PORT` | `3001` | Backend port |
| `YT_DLP_BINARY` | `yt-dlp` | yt-dlp executable path |
| `FFMPEG_BINARY` | `ffmpeg` | FFmpeg executable path |
| `NODE_BINARY` | `node` | Node.js executable path (for yt-dlp JS runtime) |
| `YT_DLP_FORCE_IPV4` | `false` | Force IPv4 for yt-dlp |
| `YT_DLP_TIMEOUT_MS` | `30000` | Analysis timeout in ms |
| `CORS_ORIGIN` | `http://tauri.localhost,https://tauri.localhost` | Allowed CORS origins |

### Development Config

```bash
# Frontend dev server
npm run dev          # Vite on port 1420

# Backend
cd backend && npm run dev   # Node.js on port 3001

# Desktop Tauri
npm run tauri dev    # Tauri with hot reload

# Android
npm run tauri android dev   # Android with device connection
```

### Release Config

```bash
# Android release build
ANDROID_HOME=D:\Android\Sdk \
ANDROID_SDK_ROOT=D:\Android\Sdk \
RUSTUP_HOME=D:\Rust\.rustup \
CARGO_HOME=D:\Rust\.cargo \
VITE_TUBELITE_BACKEND_URL=http://10.250.42.215:3001 \
npx tauri android build
```

### Tauri Config (`tauri.conf.json`)

- Product name: "TubeLite Downloader"
- Identifier: `com.tubelite.downloader`
- Window: 400×800, resizable, not fullscreen
- CSP: null (no content security policy)
- `withGlobalTauri: true`

---

## 16. BUILD / RUN / TEST PROCEDURES

### Frontend Development
```bash
cd "D:/Downloads/Yt for phone"
npm run dev                    # Vite dev server on :1420
```

### Backend Development
```bash
cd "D:/Downloads/Yt for phone/backend"
npm run dev                    # Node.js server on :3001
```

### Desktop Development
```bash
npm run tauri dev              # Tauri dev with hot reload
```

### Android Release Build
```bash
cd "D:/Downloads/Yt for phone"
export ANDROID_HOME="D:/Android/Sdk"
export ANDROID_SDK_ROOT="D:/Android/Sdk"
export RUSTUP_HOME="D:/Rust/.rustup"
export CARGO_HOME="D:/Rust/.cargo"
export PATH="/d/Rust/.cargo/bin:/d/Android/Sdk/platform-tools:$PATH"
export VITE_TUBELITE_BACKEND_URL="http://10.250.42.215:3001"
npx tauri android build
```

APK output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`

### APK Installation
```bash
adb install -r "<apk-path>"
```

### Backend Health Test
```bash
curl http://10.250.42.215:3001/health
```

### Analyze API Test
```bash
curl -X POST http://10.250.42.215:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Android Logcat Diagnostics
```bash
adb logcat -c                         # Clear
adb logcat -d -v time | findstr "Tauri RustStdoutStderr"
```

### Static Validation
```bash
npx tsc -b --noEmit                   # TypeScript check
npm run build                         # Vite production build
cargo check --manifest-path src-tauri/Cargo.toml   # Rust check
cd src-tauri/gen/android && ./gradlew.bat :app:compileUniversalReleaseKotlin  # Kotlin check
```

---

## 17. NON-GOALS

The following are **INTENTIONALLY NOT** part of this project:

- ❌ **Playlist downloading** — `--no-playlist` is hardcoded
- ❌ **Browser cookie fallback** — no cookie authentication support
- ❌ **Android-local yt-dlp** — abandoned after extensive attempts (see §12)
- ❌ **Android-local QuickJS/EJS** — abandoned (see §12)
- ❌ **Arbitrary URL downloading** — YouTube only
- ❌ **HTTPS for backend** — LAN HTTP only for development
- ❌ **Background downloading** — no Android service
- ❌ **Share Intent** — not implemented
- ❌ **MediaStore integration** — not implemented
- ❌ **User accounts / authentication** — not planned
- ❌ **History persistence** — "No history yet" placeholder only
- ❌ **Settings persistence** — Settings page is placeholder
- ❌ **Push notifications** — not planned
- ❌ **Proxy support** — not implemented

---

## 18. FUTURE WORK

### CURRENT BLOCKER
YouTube anti-bot detection returns HTTP 502 when yt-dlp attempts metadata extraction. This blocks the entire Android Analyze flow.

### NEXT REQUIRED INVESTIGATION
1. Determine why `--js-runtimes node:node --remote-components ejs:github` doesn't bypass YouTube's bot detection on the backend
2. Test whether the backend's yt-dlp version is current enough for YouTube's current protections
3. Investigate whether cookies or PO tokens are needed

### NEXT IMPLEMENTATION (after blocker resolved)
1. End-to-end Android download flow test (once Analyze works)
2. History page implementation
3. Settings persistence

### LATER IMPROVEMENTS
1. HTTPS for backend (production)
2. Background download service on Android
3. Share Intent for downloaded files
4. Notification on download complete

---

## 19. NEW AGENT CONTEXT — READ THIS FIRST

### What We Are Building
TubeLite Downloader — a YouTube video/audio downloader for Android (and Windows) with a modern dark UI. Users paste a YouTube URL, select quality, and download.

### Current Architecture
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Shell:** Tauri 2.11 (Rust + WebView)
- **Backend:** Node.js on PC (LAN server at `:3001`)
- **Download engine:** yt-dlp + FFmpeg (on the PC)

### Android Architecture
Android cannot run yt-dlp locally. Instead:
1. Android app sends HTTP requests to the PC backend over LAN
2. Backend runs yt-dlp, returns metadata/results
3. Android polls for download status
4. Android downloads completed file via TCP from backend
5. Android opens file via FileProvider content:// URI

### Desktop Architecture
Desktop runs yt-dlp directly as a Rust subprocess. No backend needed.

### Current Working Features
- Full 7-screen React UI (Home → Analyzing → Setup → Downloading → Complete → Error + Settings)
- Desktop video + MP3 download with real progress
- Android backend communication (HTTP plugin)
- File transfer + Open File on Android
- Backend health + analyze + download endpoints

### Current Broken Feature
**Android Analyze** returns HTTP 502. The backend receives the request but yt-dlp fails with YouTube bot detection. The same request from PC curl succeeds (intermittently). The error is: `"Sign in to confirm you're not a bot"`.

### Important Historical Failures
1. **Android local yt-dlp** — Abandoned. Chaquopy/CPython couldn't bypass YouTube bot detection.
2. **QuickJS + EJS bundle** — Abandoned. Flag mapping issues + YouTube still blocking.
3. **WebView console.log** — Doesn't work in release builds. Use Rust `eprintln!` instead.
4. **window.fetch on Android** — Blocked by mixed-content (HTTPS origin → HTTP). Use `@tauri-apps/plugin-http`.

### Frozen Components
**DO NOT TOUCH** the download pipeline: `download.rs`, `downloadService.ts`, `download.ts` route, `file.rs`, `YtDlpPlugin.kt`, `useDownloadFlow.ts` download logic, `downloadWithBackend()`, `getDownloadStatus()`.

### Current Blocker
YouTube anti-bot detection in yt-dlp. Need to investigate: yt-dlp version currency, EJS effectiveness, cookie/PO token requirements.

### Rules for Modifying the Project
1. **NEVER** modify frozen download components
2. **NEVER** claim success without actual device testing
3. **NEVER** add features not in the spec
4. **ALWAYS** run TypeScript + Cargo checks after changes
5. **ALWAYS** verify APK builds before device testing
6. **PREFER** minimal changes over refactoring
7. **REPORT** issues instead of silently fixing frozen code

### What NOT to Do
- Do NOT reintroduce Android local yt-dlp/QuickJS/EJS
- Do NOT modify the download pipeline
- Do NOT change the UI design
- Do NOT add cookies/PO tokens without evidence they help
- Do NOT upgrade dependencies unless required
- Do NOT build APKs repeatedly (slow — 5-10 min each)

### Where to Start Debugging
1. Check yt-dlp version on the PC: `yt-dlp --version`
2. Test analyze from PC: `curl -X POST http://10.250.42.215:3001/api/analyze -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`
3. If PC fails too → yt-dlp version/YouTube detection issue
4. If PC succeeds but Android fails → network or request difference
5. Check backend logs for exact yt-dlp error

---

## 20. FINAL PROJECT SNAPSHOT

```
PROJECT:          TubeLite Downloader
PLATFORM:         Android (primary) + Windows (development)
FRONTEND:         React 19, TypeScript 6, Tailwind CSS 4, Vite 8
TAURI:            Tauri 2.11 (Rust + WebView)
BACKEND:          Node.js, TypeScript, native http module on port 3001
DOWNLOAD ENGINE:  yt-dlp (system binary) + FFmpeg (system binary)

CURRENT VERIFIED FEATURES:
  ✅ Full 7-screen React UI with dark theme
  ✅ Desktop video download with progress
  ✅ Desktop MP3 download with FFmpeg conversion
  ✅ Android build + install on physical device
  ✅ Backend health endpoint
  ✅ Backend analyze endpoint (from PC)
  ✅ Android HTTP plugin communication
  ✅ Android file transfer from backend
  ✅ Android FileProvider open file
  ✅ Tauri HTTP scope configuration

CURRENT VERIFIED BUGS:
  ❌ Android analyze returns HTTP 502 (YouTube bot detection)
  ⚠️ Rust warnings in non-frozen code (cfg-gated, harmless)

FROZEN COMPONENTS:
  🔒 download.rs (desktop download pipeline)
  🔒 downloadService.ts (backend job registry)
  🔒 download route (POST /api/download)
  🔒 file.rs (file transfer + open file)
  🔒 YtDlpPlugin.kt (Kotlin plugin)
  🔒 useDownloadFlow.ts download logic

ABANDONED APPROACHES:
  🗃️ Android local yt-dlp via Chaquopy
  🗃️ QuickJS-NG + EJS bundle
  🗃️ Android monkey-patch for ytdlp_runner
  🗃️ WebView console.log for release debugging

CURRENT BLOCKER:
  YouTube anti-bot detection blocks yt-dlp metadata extraction.
  Backend returns 502: "Sign in to confirm you're not a bot"

NEXT DIAGNOSTIC:
  1. Verify yt-dlp version is current
  2. Test analyze from PC (may also fail intermittently)
  3. Investigate cookies / PO tokens / player_client options
  4. Check if --js-runtimes + --remote-components are working

IMPORTANT NON-GOALS:
  ❌ No playlist support
  ❌ No browser cookies
  ❌ No Android-local yt-dlp
  ❌ No background download service
  ❌ No Share Intent
  ❌ No HTTPS for backend
  ❌ No authentication
```
