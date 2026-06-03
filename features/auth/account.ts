import { supabase } from "../../lib/supabase";

export async function deleteCurrentAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;

  await supabase.auth.signOut().catch(() => undefined);
}
