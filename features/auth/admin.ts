import { supabase } from "../../lib/supabase";

export async function isCurrentUserAdmin() {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) throw error;
  return Boolean(data);
}
