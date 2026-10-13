# On-Device Engine — Roadmap & Forensic Findings

Status: **ACTIVE EXPERIMENT** (Option 2 — Ghost-Downloader-style on-device extraction)
Goal: Experience + learning. Success is NOT guaranteed.

## Current Architecture (backend-based, WORKING — FROZEN)

```
Android React app → Tauri HTTP plugin → backend (Node) → yt-dlp → metadata/download
```

The working download pipeline (backend routes, downloadService, file transfer, open file)
is FROZEN and must not be modified. The on-device engine is a SEPARATE parallel path.

## Target Architecture (what we're building)

```
Android React app → Tauri bridge → Kotlin YtDlpPlugin → Chaquopy (Python 3.13)
   → yt-dlp 2026.6.9 → QuickJS (JS runtime) → YouTube metadata directly on device
```

## Forensic Findings (2026-09-06, from yt-dlp-android 2.0.2 AAR)

### Bundled versions
- yt-dlp: **2026.6.9** (verified via `yt_dlp-2026.6.9.dist-info/METADATA` inside `requirements-common.imy`)
- Python: 3.13 (Chaquopy)
- Library: `dev.ffmpegkit-maintained:yt-dlp-android:2.0.2` (FREE version)

### yt-dlp JS runtime option (EXACT, from bundled source)
```python
opts = {
    'js_runtimes': {'quickjs': {'path': '/absolute/path/to/qjs'}},
    # or: {'deno': {...}}, {'node': {...}}, {'bun': {...}}
    # if None → default 'deno' enabled
    # priority (highest→lowest): deno, node, quickjs, bun
}
```
CLI equivalent: `--js-runtimes quickjs:/path/to/qjs`
Option key in opts dict: `js_runtimes` (dict of lowercase runtime key → config dict, `path` optional)

### CRITICAL: free runner silently DROPS unknown flags
`ytdlp_runner.pyc` (the Java→Python bridge module) has a hardcoded `_FLAG_MAP`
with ONLY these flags handled:

```
-f / --format          -o / --output          --cookies
--proxy                --add-header           --user-agent
--restrict-filenames   --newline              --no-playlist
-F                     -x / --extract-audio   --audio-format
--audio-quality        --write-sub
```

**Any other CLI flag passed via YtDlpRequest.addOption() is silently dropped.**

Implications (explains ALL Phase 6B failures):
- `--dump-json` was DROPPED → yt-dlp did a real download attempt, not a JSON dump
- `--js-runtimes` was DROPPED → QuickJS path never reached yt-dlp
- `--extractor-retries`, `--verbose`, `--no-check-certificates` were DROPPED

### Finding 6: YtDlp Java API returns EMPTY output (critical)
Decompiled `YtDlp.java` bytecode shows BOTH `execute()` and `executeDebug()`:
```java
PyObject result = ytdlp_runner.callAttr("execute", url, outputTemplate, options, callback);
int exitCode = result.toJava(Integer.class);
new YtDlpResponse(exitCode, "", "");   // output + errorOutput ALWAYS empty
```
- Python runner returns ONLY int exit code; stdout/stderr never captured back to Java
- `response.getOutput()` is ALWAYS empty string
- Real yt-dlp errors surface ONLY as YtDlpException message (Python exception text)

Implication: metadata extraction via stock `YtDlp.execute()` is IMPOSSIBLE in free 2.0.2.
The old Phase 6B parse path (`parseYtdlpJson(response.getOutput())`) could never work.

REVISED CONCLUSION: the old "403 even with QuickJS/EJS" test was INVALID — the
`--js-runtimes` and `--dump-json` flags were silently dropped by the runner AND
output never reached Java. The QuickJS/EJS approach was never actually tested.
Phase 1 therefore has real hope.

### Phase 1 architecture (correct)
Bypass ytdlp_runner entirely. From Kotlin use Chaquopy's Java-Python bridge:
1. Get Python + builtins module
2. exec() our own Python that builds YoutubeDL opts directly:
   opts = { 'dump_single_json': True, 'js_runtimes': {'quickjs': {'path': qjsPath}}, ... }
3. call yt_dlp.YoutubeDL(opts).extract_info(url, download=False)
4. return JSON string to Kotlin (no ytdlp_runner, no flag dropping)

### Free vs Pro
- Free AAR docstring: "no curl_cffi, no browser impersonation"
- Pro (yt-dlp-android-curl?) has TLS fingerprint impersonation for bot detection
- NOTE: we did NOT verify Pro exists/works — future research if Phase 3 reached

### Useful API discovery
- `YtDlp.execute(request, callback)` — normal run
- `YtDlp.executeDebug(request, logCallback, progressCallback)` — all logs (LogCallback had R8 issue — keep ProGuard rules)
- `YtDlp.updateYtDlp(context, callback)` — runtime yt-dlp self-update (Phase 4 candidate)

## Phase Roadmap

### Phase 1 — Bypass the broken free runner + wire JS runtime  [NEXT]
Goal: yt-dlp recognizes QuickJS; metadata extraction works on-device.
Problem: free `ytdlp_runner.pyc` drops flags and cannot dump JSON properly.
Options being evaluated:
- A. Drive yt_dlp DIRECTLY from our own Python (via Chaquopy), bypassing ytdlp_runner:
     our own opts dict incl. `js_runtimes={'quickjs': {'path': ...}}`, `dump_single_json`, etc.
- B. Monkey-patch `ytdlp_runner._cli_to_opts` at runtime to add js_runtimes + dump-json.
Exit criteria: logcat shows no "No supported JavaScript runtime"; qjs recognized; metadata JSON returned.

### Phase 2 — Player client + extraction tuning
Exit criteria: title/channel/duration/thumbnail/formats reach React UI on device.

### Phase 3 — TLS impersonation (hardest, uncertain)
curl_cffi/wreq on Android. Free AAR doesn't include it. Research Pro variant or NDK build.
Exit criteria: browser-like TLS fingerprint.

### Phase 4 — On-device download engine + yt-dlp update mechanism
Exit criteria: full download on device without backend.

## Do NOT reintroduce / touch
- Backend download pipeline (FROZEN)
- file.rs / download.rs / YtDlpPlugin.kt download code
- Open File / FileProvider (working)
- UI changes without separate request

## References
- AAR: `D:\Gradle\.gradle\caches\modules-2\files-2.1\dev.ffmpegkit-maintained\yt-dlp-android\2.0.2\...aar`
- Runner pyc: `app.imy` → `ytdlp_runner.pyc` (Python 3.13 bytecode, decode with xdis)
- Bundled yt-dlp pyc: `requirements-common.imy` → `yt_dlp/*.pyc`
