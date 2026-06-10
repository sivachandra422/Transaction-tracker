import { create } from "zustand";

export interface SyncLogEntry {
  status: "pending" | "success" | "error";
  msg?: string;
}

interface SyncState {
  syncLogs: Record<string, SyncLogEntry>;
  setSyncPending: (id: string) => void;
  setSyncSuccess: (id: string) => void;
  setSyncError: (id: string, msg: string) => void;
  clearSyncLog: (id: string) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  syncLogs: {},
  setSyncPending: (id) =>
    set((s) => ({ syncLogs: { ...s.syncLogs, [id]: { status: "pending" } } })),
  setSyncSuccess: (id) =>
    set((s) => ({
      syncLogs: { ...s.syncLogs, [id]: { status: "success", msg: "Synced!" } },
    })),
  setSyncError: (id, msg) =>
    set((s) => ({
      syncLogs: { ...s.syncLogs, [id]: { status: "error", msg } },
    })),
  clearSyncLog: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.syncLogs;
      return { syncLogs: rest };
    }),
}));
