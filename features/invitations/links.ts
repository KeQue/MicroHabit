import * as Linking from "expo-linking";
import { normalizeInviteCode, parseInviteAddress } from "./invite";
import { INVITE_WEB_PAGE_AVAILABLE } from "../../constants/launch";

export function buildInviteWebUrl(code: string): string {
  const url = new URL("https://keque.github.io/MicroHabit/join/");
  url.searchParams.set("code", normalizeInviteCode(code));
  return url.toString();
}

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
  return `Join my Commito league!\nInvite code: ${normalized}\n\n${INVITE_WEB_PAGE_AVAILABLE ? `${buildInviteWebUrl(normalized)}\n\n` : ""}Or open Commito, choose Join and enter the code.\nNeed the app? Ask me for access and keep this code for after signup.`;
}

export function buildInviteShareContent(code: string): { message: string; url?: string } {
  return { message: buildInviteMessage(code), ...(INVITE_WEB_PAGE_AVAILABLE ? { url: buildInviteWebUrl(code) } : {}) };
}
