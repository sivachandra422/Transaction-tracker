import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function createError(message: string, statusCode: number, code?: string): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/** Catches unhandled async errors forwarded via next(err). Always returns JSON. */
export function globalErrorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode ?? 500;
  const message = err.message || "An unexpected error occurred.";

  console.error(`[Error] ${status} — ${message}`, err.stack ?? "");

  res.status(status).json({
    success: false,
    error: message,
    ...(err.code ? { code: err.code } : {}),
  });
}

/** Wrap async route handlers so unhandled rejections reach globalErrorHandler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
