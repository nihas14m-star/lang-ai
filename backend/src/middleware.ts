/**
 * Middleware: rate limiting, optional bearer auth, error normalization.
 */

import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { timingSafeEqual } from "node:crypto";

// ---------- Errors ----------

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "not_found", message: "Unknown endpoint" } });
}

/** eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Duck-typed ZodError check: shared/ and backend/ must not require the same
  // zod instance for this to work (workspace-hoisted, but stay robust).
  const isZodError =
    err instanceof ZodError ||
    (typeof err === "object" && err !== null && (err as { name?: string }).name === "ZodError" &&
      Array.isArray((err as { issues?: unknown }).issues));
  if (isZodError) {
    const issues = (err as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Request body is invalid",
        details: issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Log server-side; never leak internals to the client.
  console.error(JSON.stringify({ evt: "unhandled_error", message: err instanceof Error ? err.message : String(err) }));
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong. Please try again." } });
}

// ---------- Rate limiting (sliding window, in-memory) ----------

interface Bucket {
  hits: number[];
}

export function createRateLimiter(windowMs: number, max: number) {
  const buckets = new Map<string, Bucket>();
  // Periodic sweep to avoid unbounded growth.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, bucket] of buckets) {
      bucket.hits = bucket.hits.filter((t) => t > cutoff);
      if (bucket.hits.length === 0) buckets.delete(key);
    }
  }, Math.max(windowMs, 30_000));
  sweep.unref?.();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((t) => t > now - windowMs);
    if (bucket.hits.length >= max) {
      const retryAfterSec = Math.ceil((bucket.hits[0]! + windowMs - now) / 1000);
      res.set("Retry-After", String(Math.max(1, retryAfterSec)));
      res.status(429).json({
        error: { code: "rate_limited", message: "Too many requests. Please slow down.", details: { retryAfterSec } },
      });
      return;
    }
    bucket.hits.push(now);
    buckets.set(key, bucket);
    next();
  };
}

// ---------- Optional bearer auth ----------

export function createAuth(apiToken?: string) {
  return function auth(req: Request, res: Response, next: NextFunction): void {
    if (!apiToken) return next(); // local development: open
    const header = req.headers.authorization ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    const a = Buffer.from(provided);
    const b = Buffer.from(apiToken);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();
    res.status(401).json({ error: { code: "unauthorized", message: "Missing or invalid API token" } });
  };
}
