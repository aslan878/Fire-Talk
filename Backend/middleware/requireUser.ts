import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const id = req.header("x-user-id")?.trim();
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(401).json({ error: "X-User-Id header with a valid ObjectId is required" });
    return;
  }
  req.userId = id;
  next();
}
