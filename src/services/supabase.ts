import { createClient } from "@supabase/supabase-js";
import type { Transaction } from "../types";

// Public values — safe to commit (anon key is protected by row-level security)
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://fexbynoduaderbrjmqtz.supabase.co";
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleGJ5bm9kdWFkZXJicmptcXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNjI5NzIsImV4cCI6MjA5NjYzODk3Mn0.sQHOXtqYC_CTqGAqdLMxL2-102BKB0DYw_pSxWJGdD0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function sbSignUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function sbSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function sbSignOut() {
  await supabase.auth.signOut();
}

export async function sbGetSession() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/** Current authenticated user id (uuid) or null when signed out. */
export async function sbGetUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export function sbOnAuthChange(cb: (user: { email: string; name: string } | null) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      cb({
        email: session.user.email ?? "",
        name: session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "User",
      });
    } else {
      cb(null);
    }
  });
  return () => subscription.unsubscribe();
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

interface TransactionRow {
  id: string;
  user_id?: string;
  amount: number;
  description: string;
  merchant: string;
  category: Transaction["category"];
  type: Transaction["type"];
  date: string;
  labels: string[] | null;
  synced: boolean;
  notion_page_id: string | null;
  notion_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Map app Transaction → Supabase row (snake_case). Strips local-only `dirty`. */
function toRow(tx: Transaction, userId: string): TransactionRow {
  return {
    id: tx.id,
    user_id: userId,
    amount: tx.amount,
    description: tx.description,
    merchant: tx.merchant,
    category: tx.category,
    type: tx.type,
    date: tx.date,
    labels: tx.labels,
    synced: tx.synced,
    notion_page_id: tx.notionPageId ?? null,
    notion_url: tx.notionUrl ?? null,
    created_at: tx.createdAt,
    updated_at: tx.updatedAt,
    deleted_at: tx.deletedAt ?? null,
  };
}

/** Map Supabase row → app Transaction (clean, not dirty). */
function fromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    merchant: row.merchant,
    category: row.category,
    type: row.type,
    date: row.date,
    labels: row.labels ?? [],
    synced: row.synced,
    notionPageId: row.notion_page_id ?? undefined,
    notionUrl: row.notion_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    deletedAt: row.deleted_at,
    dirty: 0,
  };
}

// ─── CRUD operations (throw on failure so callers can retry) ─────────────────

export async function sbUpsertTransactions(txs: Transaction[], userId: string): Promise<void> {
  if (txs.length === 0) return;
  const { error } = await supabase
    .from("transactions")
    .upsert(txs.map((t) => toRow(t, userId)));
  if (error) throw new Error(`[supabase] upsert: ${error.message}`);
}

export async function sbFetchTransactionsSince(sinceISO: string | null): Promise<Transaction[]> {
  let query = supabase.from("transactions").select("*").order("updated_at", { ascending: true });
  if (sinceISO) query = query.gt("updated_at", sinceISO);
  const { data, error } = await query;
  if (error) throw new Error(`[supabase] fetch: ${error.message}`);
  return ((data ?? []) as TransactionRow[]).map(fromRow);
}

export async function sbClearTransactions(): Promise<void> {
  const { error } = await supabase.from("transactions").delete().neq("id", "");
  if (error) throw new Error(`[supabase] clear: ${error.message}`);
}
