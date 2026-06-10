/**
 * Local-first sync engine.
 *
 * Dexie (IndexedDB) is the source of truth; Supabase is the cloud replica.
 *  - Every local write marks the row `dirty: 1` (outbox pattern).
 *  - push: upserts all dirty rows (including soft-delete tombstones), clears dirty.
 *  - pull: fetches rows with `updated_at > lastPulledAt`, merges last-write-wins.
 *  - Triggers: app start, auth change, browser online event, debounced writes,
 *    and a periodic interval.
 */
import { db, getMeta, setMeta, META_KEYS } from "./db";
import {
  sbUpsertTransactions,
  sbFetchTransactionsSince,
  sbGetUserId,
} from "./supabase";

type SyncListener = (status: SyncStatus) => void;

export interface SyncStatus {
  state: "idle" | "syncing" | "error" | "offline";
  lastSyncedAt: string | null;
  error?: string;
}

let status: SyncStatus = { state: "idle", lastSyncedAt: null };
const listeners = new Set<SyncListener>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

function notify(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l(status));
}

export function onSyncStatus(cb: SyncListener): () => void {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

/** Push all dirty rows to Supabase. No-op when signed out. */
export async function push(): Promise<void> {
  const userId = await sbGetUserId();
  if (!userId) return;

  const dirtyRows = await db.transactions.where("dirty").equals(1).toArray();
  if (dirtyRows.length === 0) return;

  await sbUpsertTransactions(dirtyRows, userId);
  await db.transactions.bulkPut(dirtyRows.map((t) => ({ ...t, dirty: 0 as const })));
}

/** Pull remote changes since the last cursor; merge last-write-wins. */
export async function pull(): Promise<boolean> {
  const userId = await sbGetUserId();
  if (!userId) return false;

  const since = await getMeta(META_KEYS.LAST_PULLED_AT);
  const remote = await sbFetchTransactionsSince(since);
  if (remote.length === 0) return false;

  let changed = false;
  await db.transaction("rw", db.transactions, async () => {
    for (const r of remote) {
      const local = await db.transactions.get(r.id);
      // Local unpushed edit is newer → keep local, it will push next cycle.
      if (local?.dirty === 1 && local.updatedAt >= r.updatedAt) continue;
      await db.transactions.put(r);
      changed = true;
    }
  });

  const maxUpdated = remote[remote.length - 1].updatedAt;
  await setMeta(META_KEYS.LAST_PULLED_AT, maxUpdated);
  return changed;
}

/**
 * Full sync cycle. Returns true when local data changed (callers should
 * re-hydrate the in-memory store).
 */
export async function syncNow(): Promise<boolean> {
  if (running) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    notify({ state: "offline" });
    return false;
  }
  running = true;
  notify({ state: "syncing" });
  try {
    await push();
    const changed = await pull();
    notify({ state: "idle", lastSyncedAt: new Date().toISOString(), error: undefined });
    return changed;
  } catch (err) {
    notify({ state: "error", error: err instanceof Error ? err.message : String(err) });
    return false;
  } finally {
    running = false;
  }
}

/** Debounced push after local writes (batches rapid edits). */
export function requestPush(onChanged?: () => void): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const changed = await syncNow();
    if (changed) onChanged?.();
  }, 1500);
}

/** Start background sync: online listener + 60s interval. Idempotent. */
export function startBackgroundSync(onChanged: () => void): () => void {
  const onOnline = () => void syncNow().then((c) => c && onChanged());
  window.addEventListener("online", onOnline);
  if (!intervalTimer) {
    intervalTimer = setInterval(() => {
      void syncNow().then((c) => c && onChanged());
    }, 60_000);
  }
  void syncNow().then((c) => c && onChanged());
  return () => {
    window.removeEventListener("online", onOnline);
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
  };
}
