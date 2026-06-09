/**
 * secureStorage — thin abstraction over storage backends:
 *   - Capacitor Preferences (encrypted key-value) when running on Android/iOS
 *   - sessionStorage (ephemeral, never written to disk) in the browser
 *
 * Synchronous reads/writes use sessionStorage as the in-memory cache;
 * Capacitor Preferences calls happen asynchronously via initSecureStorage().
 * This keeps the Zustand store instantiation synchronous.
 */

import { Capacitor } from "@capacitor/core";

export const SECURE_KEYS = {
  NOTION_TOKEN: "secure_notion_token",
  LLM_API_KEY: "secure_llm_api_key",
} as const;

type SecureKey = (typeof SECURE_KEYS)[keyof typeof SECURE_KEYS];

// ─── Synchronous surface (uses sessionStorage as cache) ─────────────────────

export function secureGet(key: SecureKey): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function secureSet(key: SecureKey, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore QuotaExceededError or security errors */
  }

  // Fire-and-forget write to Capacitor Preferences on native
  if (Capacitor.isNativePlatform()) {
    writeToPreferences(key, value).catch(() => {});
  }
}

export function secureClear(): void {
  try {
    Object.values(SECURE_KEYS).forEach((k) => sessionStorage.removeItem(k));
  } catch {}

  if (Capacitor.isNativePlatform()) {
    clearPreferences().catch(() => {});
  }
}

// ─── Async init — call once on app startup on native ────────────────────────

export async function initSecureStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { Preferences } = await import("@capacitor/preferences");

    for (const key of Object.values(SECURE_KEYS)) {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        try {
          sessionStorage.setItem(key, value);
        } catch {}
      }
    }
  } catch {
    /* Preferences plugin not available — fall back to sessionStorage only */
  }
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function writeToPreferences(key: string, value: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

async function clearPreferences(): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  for (const key of Object.values(SECURE_KEYS)) {
    await Preferences.remove({ key });
  }
}
