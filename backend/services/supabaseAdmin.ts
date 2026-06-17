import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Verify a Supabase JWT and return the user's UUID. Throws on invalid token. */
export async function verifyJwt(token: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error(`JWT verification failed: ${error?.message ?? "no user returned"}`);
  return data.user.id;
}

export interface UserSecrets {
  notion_token: string;
  llm_api_key: string;
  llm_provider: string;
  llm_model: string;
  notion_database_id: string;
  notion_auto_sync: boolean;
  notion_database_title: string | null;
}

/** Fetch user's secrets row; returns null if not yet created. */
export async function getUserSecrets(userId: string): Promise<UserSecrets | null> {
  const { data, error } = await supabaseAdmin
    .from("user_secrets")
    .select(
      "notion_token, llm_api_key, llm_provider, llm_model, notion_database_id, notion_auto_sync, notion_database_title"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch user secrets: ${error.message}`);
  return data as UserSecrets | null;
}

/** Upsert (insert or update) secrets for a user. Only provided keys are changed. */
export async function upsertUserSecrets(
  userId: string,
  secrets: Partial<UserSecrets>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_secrets")
    .upsert({ user_id: userId, updated_at: new Date().toISOString(), ...secrets });
  if (error) throw new Error(`Failed to save secrets: ${error.message}`);
}
