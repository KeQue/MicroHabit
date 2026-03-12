import { supabase } from "../lib/supabase";
import type { LeaguePaymentStatus } from "./leagues/api";

export type StorePlatform = "ios" | "android";
export type VerificationStatus = "pending" | "verified" | "failed";

export type LeaguePayment = {
  id: string;
  league_id: string;
  user_id: string;
  store_platform: StorePlatform;
  store_product_id: string;
  transaction_id: string;
  purchase_token: string | null;
  amount_cents: number;
  verification_status: VerificationStatus;
  verified_at: string | null;
  created_at: string;
};

export async function getPaywallEnabled() {
  try {
    const { data, error } = await supabase.rpc("get_paywall_enabled");
    if (error) throw error;
    return Boolean(data);
  } catch {
    return true;
  }
}

export async function getMyLeaguePaymentStatus(leagueId: string) {
  const { data, error, status } = await supabase
    .from("league_members")
    .select("payment_status")
    .eq("league_id", leagueId)
    .single();

  if (error && status !== 406) throw error;
  return (data?.payment_status as LeaguePaymentStatus | undefined) ?? null;
}

export async function verifyLeaguePurchase(params: {
  leagueId: string;
  storePlatform: StorePlatform;
  storeProductId: string;
  transactionId: string;
  purchaseToken?: string | null;
  amountCents?: number | null;
  verificationStatus?: VerificationStatus;
  rawPayload?: Record<string, unknown> | null;
}) {
  const { data, error } = await supabase.rpc("verify_league_purchase", {
    p_league_id: params.leagueId,
    p_store_platform: params.storePlatform,
    p_store_product_id: params.storeProductId,
    p_transaction_id: params.transactionId,
    p_purchase_token: params.purchaseToken ?? null,
    p_amount_cents: params.amountCents ?? null,
    p_verification_status: params.verificationStatus ?? "verified",
    p_raw_payload: params.rawPayload ?? null,
  });

  if (error) throw error;
  return data as string;
}
