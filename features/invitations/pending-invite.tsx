import { randomUUID } from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/useAuth";
import { authStorage, supabase } from "../../lib/supabase";
import { INVITE_TTL_MS, pendingInviteForUser, type PendingInvite } from "./invite";
import { createPendingInviteStore, type InviteSnapshot } from "./pending-store";

export const PENDING_INVITE_STORAGE_KEY = "commito.pending-league-invite.v1";
type PendingInviteContext = InviteSnapshot & {
  capture: (code: string) => Promise<PendingInvite>;
  clear: (nonce?: string) => Promise<void>;
};
const Context = createContext<PendingInviteContext | null>(null);

export function PendingInviteProvider({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const userId = user?.id ?? null;
  const [snapshot, setSnapshot] = useState<InviteSnapshot>({ ready: false, pending: null, error: null });
  const mounted = useRef(true);
  const store = useRef<ReturnType<typeof createPendingInviteStore> | null>(null);
  store.current ??= createPendingInviteStore(authStorage, PENDING_INVITE_STORAGE_KEY, {
    nonce: randomUUID, userId, initializing,
    onChange: (next) => { if (mounted.current) setSnapshot(next); },
  });
  const pendingStore = store.current;

  useLayoutEffect(() => {
    void pendingStore.setAuth(userId, initializing);
  }, [pendingStore, userId, initializing]);

  useEffect(() => {
    mounted.current = true;
    void pendingStore.start();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") void pendingStore.setAuth(null, false, true);
      else if (session?.user.id) void pendingStore.setAuth(session.user.id, false);
    });
    const foreground = AppState.addEventListener("change", (status) => {
      if (status === "active") void pendingStore.refresh();
    });
    return () => { mounted.current = false; subscription.unsubscribe(); foreground.remove(); };
  }, [pendingStore]);

  useEffect(() => {
    if (!snapshot.pending) return;
    const delay = Math.max(1, snapshot.pending.createdAt + INVITE_TTL_MS - Date.now());
    const timer = setTimeout(() => { void pendingStore.refresh(); }, delay);
    return () => clearTimeout(timer);
  }, [snapshot.pending, pendingStore]);

  const capture = useCallback((code: string) => pendingStore.capture(code), [pendingStore]);
  const clear = useCallback((nonce?: string) => pendingStore.clear(nonce), [pendingStore]);
  // Never expose another account's intent during the render before auth effects settle.
  const pending = pendingInviteForUser(snapshot.pending, userId);
  return <Context.Provider value={{ ready: snapshot.ready && !initializing, pending, error: snapshot.error, capture, clear }}>{children}</Context.Provider>;
}

export function usePendingInvite() {
  const context = useContext(Context);
  if (!context) throw new Error("usePendingInvite must be used inside PendingInviteProvider");
  return context;
}
