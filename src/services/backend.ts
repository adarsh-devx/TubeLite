import type {
  AnalyzedAudioFormat,
  AnalyzedResult,
  AnalyzedVideoFormat,
} from "../types/download";

const backendUrl = import.meta.env.VITE_TUBELITE_BACKEND_URL?.trim().replace(/\/$/, "");

console.log(
  "[AndroidDownload] build-time backend URL:",
  backendUrl ?? "<unset>",
);

export function getBackendUrl(): string {
  return backendUrl ?? "";
}

/**
 * Use Tauri HTTP plugin on Android to bypass WebView mixed-content / CORS.
 * Desktop continues to use window.fetch.
 */
async function nativeFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const isAndroid =
    typeof navigator !== "undefined" &&
    /Android/i.test(navigator.userAgent);

  const isTauri =
    typeof window !== "undefined" &&
    (
      "__TAURI_INTERNALS__" in window ||
      "__TAURI__" in window
    );

  console.log("[AndroidDownload] nativeFetch:", {
    url,
    isAndroid,
    isTauri,
    userAgent:
      typeof navigator !== "undefined"
        ? navigator.userAgent
        : "<unknown>",
  });

  if (isAndroid && isTauri) {
    console.log("[AndroidDownload] Using Tauri native HTTP");

    const { fetch: tauriFetch } =
      await import("@tauri-apps/plugin-http");

    return tauriFetch(url, init);
  }

  console.log("[AndroidDownload] Using browser fetch");

  return window.fetch(url, init);
}

type BackendErrorCode =
  | "BACKEND_UNAVAILABLE"
  | "INVALID_URL"
  | "ANALYSIS_TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "ANALYSIS_FAILED"
  | "DOWNLOAD_TIMEOUT"
  | "DOWNLOAD_FAILED"
  | "OUTPUT_ERROR";

export class BackendApiError extends Error {
  readonly code: BackendErrorCode;

  constructor(
    message: string,
    code: BackendErrorCode,
  ) {
    super(message);
    this.name = "BackendApiError";
    this.code = code;
  }
}

export async function analyzeWithBackend(
  url: string,
  signal?: AbortSignal,
): Promise<AnalyzedResult> {
  if (!backendUrl) {
    throw new BackendApiError(
      "The analysis service is not configured on this device.",
      "BACKEND_UNAVAILABLE",
    );
  }

  let response: Response;

  try {
    response = await nativeFetch(`${backendUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;

    throw new BackendApiError(
      "The analysis service is unavailable. Check your connection and try again.",
      "BACKEND_UNAVAILABLE",
    );
  }

  if (response.status === 400) {
    throw new BackendApiError(
      "Please enter a valid YouTube link.",
      "INVALID_URL",
    );
  }

  if (response.status === 504) {
    throw new BackendApiError(
      "Analysis took too long. Please try again.",
      "ANALYSIS_TIMEOUT",
    );
  }

  if (!response.ok) {
    let backendMessage = `HTTP ${response.status}`;
    try {
      const errorPayload = await response.json();
      if (errorPayload?.error) {
        backendMessage = errorPayload.error;
      }
    } catch {
      // ignore parse error
    }
    throw new BackendApiError(
      `The video could not be analyzed: ${backendMessage}`,
      "ANALYSIS_FAILED",
    );
  }

  try {
    const payload: unknown = await response.json();
    return parseAnalyzedResult(payload);
  } catch (error) {
    if (error instanceof BackendApiError) throw error;

    throw new BackendApiError(
      "The analysis service returned an invalid response.",
      "MALFORMED_RESPONSE",
    );
  }
}

export async function downloadWithBackend(
  url: string,
  quality: string,
  kind: "video" | "mp3" = "video",
): Promise<{ jobId: string }> {
  if (!backendUrl) {
    const err = new BackendApiError(
      "The download service is not configured on this device.",
      "BACKEND_UNAVAILABLE",
    );

    console.error("[AndroidDownload] missing backend URL", err.message);
    throw err;
  }

  const requestBody = { url, quality, kind };
  const requestUrl = `${backendUrl}/api/download`;

  console.log("[AndroidDownload] request URL:", requestUrl);
  console.log("[AndroidDownload] request body:", {
    url: requestBody.url,
    quality: requestBody.quality,
    kind: requestBody.kind,
  });

  const controller = new AbortController();
  const timeoutMs = 20000;

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    // IMPORTANT:
    // Android/Tauri uses the native HTTP plugin here.
    // Desktop continues to use normal fetch through nativeFetch().
    const response = await nativeFetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const responseText = await response.text();

    console.log(
      "[AndroidDownload] HTTP status:",
      response.status,
      response.statusText,
    );

    console.log(
      "[AndroidDownload] raw response body:",
      responseText || "<empty>",
    );

    console.log(
      "[AndroidDownload] POST response body before validation:",
      responseText || "<empty>",
    );

    if (response.status === 400) {
      const err = new BackendApiError(
        "Please enter a valid YouTube link.",
        "INVALID_URL",
      );

      console.error("[AndroidDownload] 400 response", err.message);
      throw err;
    }

    if (response.status === 504) {
      const err = new BackendApiError(
        "The download timed out. Please try again.",
        "DOWNLOAD_TIMEOUT",
      );

      console.error("[AndroidDownload] 504 response", err.message);
      throw err;
    }

    if (!response.ok) {
      let backendMessage = `HTTP ${response.status}`;

      try {
        const parsed = JSON.parse(responseText) as {
          error?: string;
        };

        if (parsed?.error) {
          backendMessage = parsed.error;
        }
      } catch {
        if (responseText) {
          backendMessage = responseText;
        }
      }

      const err = new BackendApiError(
        `The download request failed: ${backendMessage}`,
        "DOWNLOAD_FAILED",
      );

      console.error(
        "[AndroidDownload] non-OK response",
        err.message,
      );

      throw err;
    }

    const payload: unknown = responseText
      ? JSON.parse(responseText)
      : null;

    if (!isRecord(payload) || typeof payload.jobId !== "string") {
      const err = new BackendApiError(
        "The download service returned an invalid response.",
        "MALFORMED_RESPONSE",
      );

      console.error("[AndroidDownload] malformed response", payload);
      throw err;
    }

    console.log("[AndroidDownload] job ID:", payload.jobId);

    return {
      jobId: payload.jobId,
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      const err = new BackendApiError(
        "The download request timed out while contacting the backend.",
        "DOWNLOAD_TIMEOUT",
      );

      console.error(
        "[AndroidDownload] fetch aborted",
        err.message,
      );

      throw err;
    }

    // IMPORTANT:
    // Don't wrap our own BackendApiError again.
    if (error instanceof BackendApiError) {
      throw error;
    }

    if (error instanceof Error) {
      console.error(
        "[AndroidDownload] fetch/network exception:",
        error.message,
      );

      const err = new BackendApiError(
        `The download request failed: ${error.message}`,
        "DOWNLOAD_FAILED",
      );

      throw err;
    }

    const err = new BackendApiError(
      "The download request failed while contacting the backend.",
      "DOWNLOAD_FAILED",
    );

    console.error(
      "[AndroidDownload] unexpected exception",
      err.message,
    );

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface BackendDownloadStatus {
  jobId: string;

  status:
    | "queued"
    | "downloading"
    | "completed"
    | "failed";

  progress: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;

  result?: {
    title: string;
    filename: string;
    filepath: string;
    format: string;
    size: string;
    duration: string;
    thumbnail: string;
  };

  error?: string;
}

export async function getDownloadStatus(
  jobId: string,
): Promise<BackendDownloadStatus> {
  const requestUrl =
    `${backendUrl}/api/download/${encodeURIComponent(jobId)}`;

  console.log(
    "[AndroidDownload] polling URL:",
    requestUrl,
  );

  const response = await nativeFetch(requestUrl);
  const responseText = await response.text();

  console.log(
    "[AndroidDownload] polling response:",
    requestUrl,
    response.status,
    responseText,
  );

  if (!response.ok) {
    throw new BackendApiError(
      `Download status failed: HTTP ${response.status}`,
      "DOWNLOAD_FAILED",
    );
  }

  return JSON.parse(
    responseText,
  ) as BackendDownloadStatus;
}

function parseAnalyzedResult(
  payload: unknown,
): AnalyzedResult {
  if (!isRecord(payload)) {
    throw malformedResponse();
  }

  if (
    typeof payload.title !== "string" ||
    typeof payload.channel !== "string" ||
    typeof payload.duration !== "string" ||
    typeof payload.thumbnail !== "string" ||
    !Array.isArray(payload.video_formats) ||
    !Array.isArray(payload.audio_formats)
  ) {
    throw malformedResponse();
  }

  return {
    title: payload.title,
    channel: payload.channel,
    duration: payload.duration,
    thumbnail: payload.thumbnail,
    video_formats: payload.video_formats.map(
      parseVideoFormat,
    ),
    audio_formats: payload.audio_formats.map(
      parseAudioFormat,
    ),
  };
}

function parseVideoFormat(
  value: unknown,
): AnalyzedVideoFormat {
  if (
    !isRecord(value) ||
    !hasStringFields(value, [
      "quality",
      "label",
      "format",
      "size",
    ])
  ) {
    throw malformedResponse();
  }

  return {
    quality: value.quality,
    label: value.label,
    format: value.format,
    size: value.size,
  };
}

function parseAudioFormat(
  value: unknown,
): AnalyzedAudioFormat {
  if (
    !isRecord(value) ||
    !hasStringFields(value, [
      "quality",
      "label",
      "bitrate",
      "size",
    ])
  ) {
    throw malformedResponse();
  }

  return {
    quality: value.quality,
    label: value.label,
    bitrate: value.bitrate,
    size: value.size,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasStringFields(
  value: Record<string, any>,
  fields: string[],
): boolean {
  return fields.every(
    (field) => typeof value[field] === "string",
  );
}

function malformedResponse(): BackendApiError {
  return new BackendApiError(
    "The analysis service returned an invalid response.",
    "MALFORMED_RESPONSE",
  );
}