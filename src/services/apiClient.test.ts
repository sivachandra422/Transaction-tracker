import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./apiClient";

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      ...response,
    })
  );
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on a 200 response", async () => {
    mockFetch({ ok: true, status: 200, json: () => Promise.resolve({ value: 42 }) });
    const result = await apiFetch<{ value: number }>("/api/test");
    expect(result.value).toBe(42);
  });

  it("throws ApiError with status when response is not ok", async () => {
    mockFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Bad input" }),
    });
    await expect(apiFetch("/api/test")).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && (e as ApiError).status === 400
    );
  });

  it("uses error message from response body", async () => {
    mockFetch({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: "Validation failed" }),
    });
    await expect(apiFetch("/api/test")).rejects.toThrow("Validation failed");
  });

  it("falls back to message field if error field is absent", async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Internal error" }),
    });
    await expect(apiFetch("/api/test")).rejects.toThrow("Internal error");
  });

  it("throws ApiError with 'timed out' on AbortError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
    );
    await expect(apiFetch("/api/test")).rejects.toThrow(/timed out/i);
  });

  it("throws ApiError when response body is not valid JSON", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    await expect(apiFetch("/api/test")).rejects.toBeInstanceOf(ApiError);
  });
});
