import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export type MyProfile = {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
};

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

export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData.user;
  if (!user) return null;

  await ensureProfileForUser(user);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, username")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data as MyProfile;
}

export async function updateMyProfile(updates: { name?: string; username?: string | null }) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData.user;
  if (!user) throw new Error("You must be signed in");

  const payload: Record<string, string | null> = {};

  if (typeof updates.name === "string") {
    const nextName = updates.name.trim();
    if (!nextName) throw new Error("Name cannot be empty");
    payload.name = nextName;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "username")) {
    payload.username = updates.username?.trim() || null;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("No profile changes provided");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select("id, email, name, username")
    .single();

  if (error) throw error;
  return data as MyProfile;
}
