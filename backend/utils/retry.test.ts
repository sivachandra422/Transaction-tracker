import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

function retryableError(statusCode: number): Error {
  const err = new Error(`Notion HTTP ${statusCode}`);
  (err as NodeJS.ErrnoException).code = String(statusCode);
  return err;
}

describe("withRetry", () => {
  it("resolves immediately when fn succeeds on first call", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and returns on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError(429))
      .mockResolvedValueOnce("retry-ok");

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 });
    expect(result).toBe("retry-ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 (5xx) and returns on third attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError(503))
      .mockRejectedValueOnce(retryableError(503))
      .mockResolvedValueOnce("third-ok");

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 });
    expect(result).toBe("third-ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 400 (client error)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError(400))
      .mockResolvedValueOnce("should-not-reach");

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 })
    ).rejects.toMatchObject({ message: "Notion HTTP 400" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401 (auth error)", async () => {
    const fn = vi.fn().mockRejectedValue(retryableError(401));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 })
    ).rejects.toMatchObject({ message: "Notion HTTP 401" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(retryableError(500));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 })
    ).rejects.toMatchObject({ message: "Notion HTTP 500" });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors without a code property", async () => {
    const err = new Error("network failure");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitterFactor: 0 })).rejects.toThrow(
      "network failure"
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
