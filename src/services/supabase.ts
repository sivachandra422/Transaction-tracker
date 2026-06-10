import { createClient } from "@supabase/supabase-js";
import type { Transaction } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Supabase client — only created when env vars are present
export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function sbSignUp(email: string, password: string, name: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function sbSignIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function sbSignOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function sbGetSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function sbOnAuthChange(cb: (user: { email: string; name: string } | null) => void) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map app Transaction → Supabase row (snake_case) */
function toRow(tx: Transaction) {
  return {
    id: tx.id,
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
  };
}

/** Map Supabase row → app Transaction */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): Transaction {
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
  };
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

export async function sbUpsertTransaction(tx: Transaction): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("transactions").upsert(toRow(tx));
  if (error) console.error("[supabase] upsert error:", error.message);
}

export async function sbDeleteTransaction(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) console.error("[supabase] delete error:", error.message);
}

export async function sbFetchAllTransactions(): Promise<Transaction[]> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[supabase] fetch error:", error.message);
    return [];
  }
  return (data ?? []).map(fromRow);
}

export async function sbClearTransactions(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("transactions").delete().neq("id", "");
  if (error) console.error("[supabase] clear error:", error.message);
}
