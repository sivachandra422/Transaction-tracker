export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  jitterFactor?: number;
}

const DEFAULT_OPTS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1_500,
  jitterFactor: 0.3,
};

function isRetryable(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  if (!code) return false;
  const status = parseInt(code, 10);
  return status === 429 || (status >= 500 && status <= 599);
}

function backoffMs(attempt: number, base: number, jitter: number): number {
  const exp = base * Math.pow(2, attempt);
  const spread = exp * jitter;
  return exp + Math.random() * spread - spread / 2;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxAttempts, baseDelayMs, jitterFactor } = { ...DEFAULT_OPTS, ...opts };

  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, backoffMs(attempt, baseDelayMs, jitterFactor))
      );
    }
  }

  throw lastErr;
}
