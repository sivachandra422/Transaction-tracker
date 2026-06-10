const API_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
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
