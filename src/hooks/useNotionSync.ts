import { useCallback } from "react";
import type { Transaction } from "../types";
import { useSettingsStore } from "../store/settingsStore";
import { useTransactionStore } from "../store/transactionStore";
import { useSyncStore } from "../store/syncStore";
import { syncToNotion } from "../services/notionApi";

export function useNotionSync(onNeedConfig?: () => void) {
  const notionConfig = useSettingsStore((s) => s.notionConfig);
  const markSynced = useTransactionStore((s) => s.markSynced);
  const transactions = useTransactionStore((s) => s.transactions);
  const { setSyncPending, setSyncSuccess, setSyncError } = useSyncStore();

  const configured = Boolean(notionConfig.hasServerToken && notionConfig.notionDatabaseId);

  const syncSingle = useCallback(
    async (tx: Transaction) => {
      if (!configured) {
        onNeedConfig?.();
        return;
      }
      if (tx.synced && tx.notionPageId) {
        setSyncSuccess(tx.id);
        return;
      }
      setSyncPending(tx.id);
      try {
        const data = await syncToNotion(notionConfig.notionDatabaseId, tx);
        markSynced(tx.id, data.id, data.url);
        setSyncSuccess(tx.id);
      } catch (err) {
        setSyncError(tx.id, err instanceof Error ? err.message : "Failed");
      }
    },
    [configured, notionConfig, markSynced, setSyncPending, setSyncSuccess, setSyncError, onNeedConfig]
  );

  const bulkSync = useCallback(async (): Promise<number> => {
    const unsynced = transactions.filter((t) => !t.synced);
    for (const tx of unsynced) {
      await syncSingle(tx);
    }
    return unsynced.length;
  }, [transactions, syncSingle]);

  return { syncSingle, bulkSync, configured, autoSync: notionConfig.autoSync };
}
