import * as Linking from "expo-linking";
import { normalizeInviteCode, parseInviteAddress } from "./invite";

function inviteBase() {
  return Linking.createURL("/league/join");
}

export function buildInviteUrl(code: string): string {
  const url = new URL(inviteBase());
  url.searchParams.set("code", normalizeInviteCode(code));
  return url.toString();
}

export function parseInviteUrl(url: string): string | null {
  return parseInviteAddress(url, inviteBase());
}

export function buildInviteMessage(code: string): string {
  const normalized = normalizeInviteCode(code);
  return `Join my Commito league!\nInvite code: ${normalized}\n\nAlready have Commito? Open this invitation:\n${buildInviteUrl(normalized)}\n\nNew to Commito? Install the app when available, create an account, then choose Join and enter ${normalized}. Keep this code if you need to install first.`;
}
