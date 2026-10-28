/**
 * App configuration. No secrets live in the app — it only knows the backend URL.
 * Android emulator reaches host machine via 10.0.2.2.
 */

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "http://10.0.2.2:8787";

export const APP_VERSION = "1.0.0";

/** AI request timeout to the backend. */
export const REQUEST_TIMEOUT_MS = 45_000;
