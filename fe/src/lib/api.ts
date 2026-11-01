import { getSupabaseClient } from "./supabase";

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  accessToken?: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  /** Request timeout in milliseconds. Defaults to 15 seconds. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
const defaultDevelopmentUrl = import.meta.env.DEV
  ? "http://127.0.0.1:3000/api/v1"
  : "";

/**
 * Returns the API base URL, including the /api/v1 prefix.
 * Production builds must configure VITE_API_BASE_URL explicitly.
 */
export function getApiBaseUrl(): string {
  const baseUrl = configuredBaseUrl || defaultDevelopmentUrl;
  if (!baseUrl) {
    throw new ApiError(
      0,
      "API_NOT_CONFIGURED",
      "API belum dikonfigurasi. Isi VITE_API_BASE_URL di fe/.env.local.",
    );
  }
  return baseUrl;
}

function parseJson(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorPayload(value: unknown): ApiErrorPayload | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  const error = value.error;
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    details: error.details,
  };
}

/** Centralized fetch wrapper for the SiCARE API response envelope. */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = false,
    accessToken,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const headers = new Headers({ Accept: "application/json" });
  if (options.headers) {
    for (const [headerName, headerVal] of Object.entries(options.headers)) {
      if (headerVal !== undefined && headerVal !== null) {
        headers.set(headerName, headerVal);
      }
    }
  }
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let token = accessToken;
  if (auth && !token) {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) {
        throw new ApiError(0, "SESSION_LOOKUP_FAILED", "Sesi autentikasi tidak dapat dibaca.");
      }
      token = data.session?.access_token;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "SESSION_LOOKUP_FAILED", "Sesi autentikasi tidak dapat dibaca.");
    }
  }

  if (auth && !token) {
    throw new ApiError(401, "AUTH_REQUIRED", "Silakan masuk kembali untuk melanjutkan.");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  let serializedBody: string | undefined;
  if (body !== undefined) {
    try {
      serializedBody = JSON.stringify(body);
    } catch {
      throw new ApiError(400, "INVALID_REQUEST_BODY", "Data permintaan tidak dapat diserialisasi.");
    }
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutHandle = timeoutMs > 0
    ? globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : undefined;

  let response: Response;
  let responseBody: unknown;
  let responseText: string;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: serializedBody,
      signal: controller.signal,
      credentials: options.credentials || "omit",
    });

    try {
      responseText = await response.text();
    } catch {
      throw new ApiError(0, "API_RESPONSE_READ_FAILED", "Respons dari backend tidak dapat dibaca.");
    }
    responseBody = parseJson(responseText);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError(0, "API_TIMEOUT", "Backend terlalu lama merespons. Periksa koneksi lalu coba lagi.");
    }
    if (signal?.aborted) {
      throw new ApiError(0, "REQUEST_ABORTED", "Permintaan dibatalkan.");
    }
    throw new ApiError(
      0,
      "API_UNREACHABLE",
      "Backend SiCARE tidak dapat dijangkau. Pastikan backend berjalan dan URL API benar.",
    );
  } finally {
    if (timeoutHandle !== undefined) globalThis.clearTimeout(timeoutHandle);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    const errorPayload = getErrorPayload(responseBody);
    const fallbackMessage = response.statusText
      ? `Permintaan gagal (${response.status} ${response.statusText}).`
      : `Permintaan gagal (${response.status}).`;
    throw new ApiError(
      response.status,
      errorPayload?.code ?? "API_REQUEST_FAILED",
      errorPayload?.message ?? fallbackMessage,
      errorPayload?.details,
    );
  }

  if (!responseText.trim()) return undefined as T;

  if (responseBody === null && responseText.trim() !== "null") {
    throw new ApiError(
      response.status,
      "INVALID_API_RESPONSE",
      "Backend mengembalikan format data yang tidak valid.",
    );
  }

  if (isRecord(responseBody) && Object.prototype.hasOwnProperty.call(responseBody, "data")) {
    return responseBody.data as T;
  }

  // Some endpoints (for example, health checks) return a plain JSON object.
  // A 204 response or an empty successful response has no payload to unwrap.
  return responseBody as T;
}
