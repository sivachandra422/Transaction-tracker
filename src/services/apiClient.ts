const API_TIMEOUT_MS = 30_000;

// On Android/Capacitor, relative URLs don't reach any server.
// VITE_API_URL must be set at build time to the deployed backend URL.
// Falls back to relative paths for local dev (web browser only).
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(fullUrl, { ...options, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      `Server returned an invalid response (${response.status}). Please try again.`
    );
  }

  if (!response.ok) {
    const err = data as { error?: string; message?: string };
    throw new ApiError(
      err?.error ?? err?.message ?? `Request failed (${response.status})`,
      response.status
    );
  }

  return data as T;
}
