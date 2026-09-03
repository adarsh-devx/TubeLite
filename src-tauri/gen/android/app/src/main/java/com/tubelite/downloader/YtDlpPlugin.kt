package com.tubelite.downloader

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import android.util.Log
import android.media.MediaScannerConnection
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import dev.ffmpegkit_maintained.ytdlp.YtDlp
import dev.ffmpegkit_maintained.ytdlp.YtDlpException
import dev.ffmpegkit_maintained.ytdlp.YtDlpRequest
import dev.ffmpegkit_maintained.ytdlp.YtDlpResponse
import java.io.File

private const val TAG = "YtDlpPlugin"

@InvokeArg
internal class AnalyzeArgs {
    lateinit var url: String
}

@InvokeArg
internal class OpenFileArgs {
    lateinit var path: String
}

@TauriPlugin
class YtDlpPlugin(private val activity: Activity) : Plugin(activity) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var initialized = false

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
        try {
            YtDlp.init(activity)
            initialized = true
            Log.d(TAG, "[ANDROID YTDLP] yt-dlp-android initialized successfully")
        } catch (e: YtDlpException) {
            Log.e(TAG, "[ANDROID YTDLP] Failed to initialize yt-dlp-android", e)
        } catch (e: Exception) {
            Log.e(TAG, "[ANDROID YTDLP] Failed to initialize yt-dlp-android", e)
        }
    }

    @Command
    fun extractInfo(invoke: Invoke) {
        val args = invoke.parseArgs(AnalyzeArgs::class.java)

        if (!initialized) {
            invoke.reject("yt-dlp runtime not initialized. Please restart the app.")
            return
        }

        scope.launch {
            try {
                Log.d(TAG, "[ANDROID YTDLP] Extracting info for: ${args.url}")

                val request = YtDlpRequest(args.url)
                    .addOption("--dump-json")
                    .addOption("--no-playlist")
                    .addOption("--no-check-certificates")
                    .addOption("--extractor-retries")
                    .addOption("5")
                    .addOption("--verbose")

                Log.d(TAG, "[ANDROID YTDLP] Calling YtDlp.execute...")

                val response: YtDlpResponse
                try {
                    response = YtDlp.execute(request, null)
                } catch (e: Exception) {
                    Log.e(TAG, "[ANDROID YTDLP] execute error: ${e.message}")
                    invoke.reject("Error: ${e.message}")
                    return@launch
                }

                val jsonOutput = response.getOutput()
                val stderrOutput = response.getErrorOutput()

                Log.d(
                    TAG,
                    "[ANDROID YTDLP] exitCode=${response.exitCode} success=${response.isSuccess}"
                )
                Log.d(TAG, "[ANDROID YTDLP] stdout length: ${jsonOutput.length}")
                Log.d(TAG, "[ANDROID YTDLP] stderr length: ${stderrOutput.length}")
                Log.d(
                    TAG,
                    "[ANDROID YTDLP] stderr preview: ${stderrOutput.take(2000)}"
                )

                if (!response.isSuccess) {
                    invoke.reject(
                        "yt-dlp failed (exit ${response.exitCode}): ${stderrOutput.take(500)}"
                    )
                    return@launch
                }

                val result = parseYtdlpJson(jsonOutput)

                if (result != null) {
                    Log.d(
                        TAG,
                        "[ANDROID YTDLP] Parsed title: ${
                            result.optString("title", "unknown")
                        }"
                    )
                    Log.d(
                        TAG,
                        "[ANDROID YTDLP] video_formats count: ${
                            result.optJSONArray("video_formats")?.length() ?: 0
                        }"
                    )
                    Log.d(
                        TAG,
                        "[ANDROID YTDLP] audio_formats count: ${
                            result.optJSONArray("audio_formats")?.length() ?: 0
                        }"
                    )

                    invoke.resolve(result)
                } else {
                    Log.e(TAG, "[ANDROID YTDLP] Failed to parse JSON output")
                    invoke.reject("Failed to parse video info")
                }

            } catch (e: YtDlpException) {
                Log.e(TAG, "[ANDROID YTDLP] yt-dlp error", e)
                Log.e(TAG, "[ANDROID YTDLP] Full error message: ${e.message}")
                invoke.reject("yt-dlp error: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "[ANDROID YTDLP] Unexpected error", e)
                Log.e(TAG, "[ANDROID YTDLP] Full error message: ${e.message}")
                invoke.reject("Error: ${e.message}")
            }
        }
    }

    @Command
    fun openFile(invoke: Invoke) {
        val args = invoke.parseArgs(OpenFileArgs::class.java)
        val filePath = args.path

        Log.d(TAG, "[OPEN_FILE] Requested: $filePath")

        try {
            val file = File(filePath)

            if (!file.exists()) {
                Log.e(TAG, "[OPEN_FILE] File not found: $filePath")
                invoke.reject("File not found: $filePath")
                return
            }

            if (filePath.contains("/../")) {
                Log.e(TAG, "[OPEN_FILE] Path traversal rejected: $filePath")
                invoke.reject("Invalid file path")
                return
            }

            /*
             * IMPORTANT:
             * The file is already physically present in /Download/TubeLite.
             *
             * MediaScannerConnection tells Android's media database about
             * the existing MP4/MP3 file so Gallery/Photos/media apps can
             * discover it and show it in Recent/Videos/Music.
             */
            val extension = MimeTypeMap.getFileExtensionFromUrl(filePath)
                .lowercase()

            val mimeType = MimeTypeMap
                .getSingleton()
                .getMimeTypeFromExtension(extension)
                ?: when (extension) {
                    "mp4" -> "video/mp4"
                    "m4a" -> "audio/mp4"
                    "mp3" -> "audio/mpeg"
                    else -> "*/*"
                }

            Log.d(TAG, "[MEDIA_SCAN] Scanning file: $filePath")
            Log.d(TAG, "[MEDIA_SCAN] MIME type: $mimeType")

            MediaScannerConnection.scanFile(
                activity.applicationContext,
                arrayOf(file.absolutePath),
                arrayOf(mimeType)
            ) { path, uri ->
                Log.d(
                    TAG,
                    "[MEDIA_SCAN] Completed path=$path uri=$uri"
                )
            }

            val authority = "${activity.applicationInfo.packageName}.fileprovider"

            val contentUri: Uri = FileProvider.getUriForFile(
                activity,
                authority,
                file
            )

            Log.d(
                TAG,
                "[OPEN_FILE] contentUri=$contentUri mimeType=$mimeType"
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, mimeType)
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            activity.startActivity(intent)

            Log.d(TAG, "[OPEN_FILE] Opened successfully")
            invoke.resolve(JSObject())

        } catch (e: Exception) {
            Log.e(TAG, "[OPEN_FILE] Error: ${e.message}", e)
            invoke.reject("Failed to open file: ${e.message}")
        }
    }

    private fun parseYtdlpJson(json: String): JSObject? {
        return try {
            val obj = JSObject(json)

            val result = JSObject()

            result.put(
                "title",
                obj.optString("title", "Unknown Title")
            )

            result.put(
                "channel",
                obj.optString(
                    "channel",
                    obj.optString("uploader", "Unknown Channel")
                )
            )

            result.put(
                "thumbnail",
                obj.optString("thumbnail", "")
            )

            val durationSec = obj.optDouble("duration", 0.0)
            result.put(
                "duration",
                formatDuration(durationSec)
            )

            val videoFormats = mutableListOf<JSObject>()
            val audioFormats = mutableListOf<JSObject>()
            val formatsArray = obj.optJSONArray("formats")

            if (formatsArray != null) {
                val seenQualities = mutableSetOf<String>()

                for (i in 0 until formatsArray.length()) {
                    val fmt = formatsArray.getJSONObject(i)

                    val vcodec = fmt.optString("vcodec", "none")
                    val acodec = fmt.optString("acodec", "none")
                    val height = fmt.optInt("height", 0)
                    val ext = fmt.optString("ext", "mp4")
                    val abr = fmt.optDouble("abr", 0.0)

                    val filesize = fmt.optLong("filesize", 0)
                    val filesizeApprox = fmt.optLong("filesize_approx", 0)

                    val actualSize =
                        if (filesize > 0) filesize else filesizeApprox

                    val hasVideo =
                        vcodec != "none" && vcodec.isNotEmpty()

                    val hasAudio =
                        acodec != "none" && acodec.isNotEmpty()

                    if (hasVideo && height > 0 && ext == "mp4") {
                        val quality = "${height}p"

                        if (!seenQualities.contains(quality)) {
                            seenQualities.add(quality)

                            val vf = JSObject()

                            vf.put("quality", quality)
                            vf.put(
                                "label",
                                "${qualityLabel(height)} · ${
                                    formatFilesize(actualSize)
                                }"
                            )
                            vf.put("format", "MP4")
                            vf.put(
                                "size",
                                formatFilesize(actualSize)
                            )

                            videoFormats.add(vf)
                        }

                    } else if (hasAudio && !hasVideo && abr > 0) {
                        val af = JSObject()

                        af.put(
                            "quality",
                            "${ext.uppercase()} ${abr.toInt()}"
                        )

                        af.put(
                            "label",
                            "${if (abr >= 256) "High Quality" else "Standard"} · ${
                                formatFilesize(actualSize)
                            }"
                        )

                        af.put(
                            "bitrate",
                            "${abr.toInt()} kbps"
                        )

                        af.put(
                            "size",
                            formatFilesize(actualSize)
                        )

                        audioFormats.add(af)
                    }
                }

                videoFormats.sortByDescending {
                    it.optString("quality", "0p")
                        .replace("p", "")
                        .toIntOrNull() ?: 0
                }

                audioFormats.sortByDescending {
                    it.optString("bitrate", "0 kbps")
                        .replace(" kbps", "")
                        .toIntOrNull() ?: 0
                }
            }

            result.put(
                "video_formats",
                videoFormats.toTypedArray()
            )

            result.put(
                "audio_formats",
                audioFormats.toTypedArray()
            )

            result

        } catch (e: Exception) {
            Log.e(TAG, "JSON parse error", e)
            null
        }
    }

    private fun formatDuration(seconds: Double): String {
        val total = seconds.toInt()

        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60

        return if (h > 0) {
            String.format("%d:%02d:%02d", h, m, s)
        } else {
            String.format("%d:%02d", m, s)
        }
    }

    private fun formatFilesize(bytes: Long): String {
        if (bytes <= 0) return ""

        if (bytes < 1024 * 1024) {
            return String.format(
                "%.1f KB",
                bytes / 1024.0
            )
        }

        if (bytes < 1024L * 1024 * 1024) {
            return String.format(
                "%.0f MB",
                bytes / (1024.0 * 1024.0)
            )
        }

        return String.format(
            "%.1f GB",
            bytes / (1024.0 * 1024.0 * 1024.0)
        )
    }

    private fun qualityLabel(height: Int): String {
        return when {
            height >= 2160 -> "4K Ultra HD"
            height >= 1440 -> "2K Quad HD"
            height >= 1080 -> "Full HD"
            height >= 720 -> "HD"
            height >= 480 -> "SD"
            height >= 360 -> "Low"
            else -> "Data Saver"
        }
    }
}