import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../services/supabaseAdmin.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return;
  }
  try {
    req.userId = await verifyJwt(authHeader.slice(7));
    next();
  } catch {
    res
      .status(401)
      .json({ success: false, error: "Invalid or expired session. Please sign in again." });
  }
}
