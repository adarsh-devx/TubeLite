# TubeLite Backend

This backend is a separate, modular service for the Android app's future metadata pipeline. It is intentionally isolated from the stable Windows/Desktop Tauri application and does not modify the desktop implementation.

## Purpose

The backend provides a minimal HTTP API for:

- `GET /health`
- `POST /api/analyze`

It uses `yt-dlp` with the normal supported installation/runtime path and returns metadata in the same shape expected by the Android frontend contract:

- `title`
- `channel`
- `duration`
- `thumbnail`
- `video_formats`
- `audio_formats`

## Requirements

- Node.js 18+
- `yt-dlp` installed on the server
- `ffmpeg` installed on the server for future conversion tasks
- Node.js available to yt-dlp for JavaScript challenge solving

## Install yt-dlp

### macOS

```bash
brew install yt-dlp ffmpeg
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y ffmpeg
python3 -m pip install --upgrade yt-dlp
```

### Windows

```powershell
py -m pip install --upgrade yt-dlp
winget install Gyan.Dev.FFmpeg
```

### Alternative direct binary install

```bash
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
```

## Environment

Copy `.env.example` to `.env` and adjust values as needed:

```bash
cp .env.example .env
```

Example:

```env
BACKEND_HOST=127.0.0.1
PORT=3001
YT_DLP_BINARY=yt-dlp
FFMPEG_BINARY=ffmpeg
NODE_BINARY=node
YT_DLP_FORCE_IPV4=false
```

The backend binds to `127.0.0.1` by default and is therefore not reachable from another device. For Android LAN development, set `BACKEND_HOST=0.0.0.0`, allow port `3001` through the PC's private-network firewall, and keep the server off public network profiles. `CORS_ORIGIN` defaults to the Tauri WebView origin `http://tauri.localhost`; set it to a comma-separated list of explicit origins when needed. Do not use `*` if credentials are ever introduced.

Set `YT_DLP_FORCE_IPV4=true` only when the server's default IPv6/network path causes yt-dlp's YouTube request to stall. When false, the backend does not pass `--force-ipv4`.

## Run locally

```bash
npm install
npm run build
npm start
```

Or in development mode:

```bash
npm run dev
```

## Android LAN development

In PowerShell, run the backend on the PC's LAN interface:

```powershell
$env:BACKEND_HOST = "0.0.0.0"
$env:CORS_ORIGIN = "http://tauri.localhost"
npm start
```

Find the PC's private LAN IPv4 address:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object IPAddress, InterfaceAlias
```

Set the frontend backend origin before building the Android APK, replacing `192.168.1.23` with that LAN address:

```powershell
$env:VITE_TUBELITE_BACKEND_URL = "http://192.168.1.23:3001"
npm run tauri android build -- --debug
```

Use an HTTPS URL for a production device/backend deployment. The Vite variable is embedded during `npm run build`, which Tauri runs through `beforeBuildCommand` before packaging the APK.

## API

### Health

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "tubelite-backend"
}
```

### Analyze

```http
POST /api/analyze
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

Response:

```json
{
  "title": "Rick Astley - Never Gonna Give You Up",
  "channel": "RickAstleyVEVO",
  "duration": "00:33",
  "thumbnail": "https://i.ytimg.com/...",
  "video_formats": [
    {
      "quality": "720p",
      "label": "HD · 12 MB",
      "format": "MP4",
      "size": "12 MB"
    }
  ],
  "audio_formats": [
    {
      "quality": "mp3 128",
      "label": "Standard · 2 MB",
      "bitrate": "128 kbps",
      "size": "2 MB"
    }
  ]
}
```

## Notes

- No cookies or browser-based extraction is implemented.
- No playlists are supported.
- No video byte download/proxying is implemented yet.
- The backend intentionally uses the standard supported `yt-dlp` runtime path on the server.
- Analysis enables yt-dlp's Node.js JavaScript runtime and the supported `ejs:github` remote component when needed.
- FFmpeg is prepared for future conversion work but not yet used for byte proxying or media download tasks.
