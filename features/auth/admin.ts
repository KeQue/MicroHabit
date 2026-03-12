import { supabase } from "../../lib/supabase";

const ADMIN_USER_ID = process.env.EXPO_PUBLIC_ADMIN_USER_ID?.trim() || "";

export function getConfiguredAdminUserId() {
  return ADMIN_USER_ID || null;
}

export async function isCurrentUserAdmin() {
  const adminUserId = getConfiguredAdminUserId();
  if (!adminUserId) return false;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  return data.user?.id === adminUserId;
}
