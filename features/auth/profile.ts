import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export async function ensureProfileForUser(user: User | null | undefined) {
  if (!user) return;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}

export async function ensureProfileForCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  await ensureProfileForUser(data.user);
  return data.user ?? null;
}
