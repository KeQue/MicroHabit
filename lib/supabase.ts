import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { authStorage } from "./authStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");

let supabaseClient: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase() as object, prop, receiver);
  },
}) as SupabaseClient;

export default supabase;
