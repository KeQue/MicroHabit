import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildAuthRedirectUrl, consumeAuthCallbackUrl } from "./links";
import { ensureProfileForUser } from "./profile";
import { supabase } from "../../lib/supabase";

export type SocialAuthProvider = "google" | "apple";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  initializing: boolean;

  // actions
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: SocialAuthProvider) => Promise<"signed-in" | "cancelled">;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendSignUpConfirmation: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncRealtimeAuth = (nextSession: Session | null) => {
      const token = nextSession?.access_token;
      if (!token) {
        void supabase.removeAllChannels();
        return;
      }
      void supabase.realtime.setAuth(token);
    };

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        const s = data.session ?? null;
        syncRealtimeAuth(s);
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          void ensureProfileForUser(s.user).catch((err) => {
            console.log("ensureProfileForUser(init) failed", err);
          });
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      syncRealtimeAuth(newSession ?? null);
      setSession(newSession ?? null);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void ensureProfileForUser(newSession.user).catch((err) => {
          console.log("ensureProfileForUser(auth change) failed", err);
        });
      }
      setInitializing(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // --- actions ---
  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthRedirectUrl("/sign-in"),
      },
    });
    if (error) throw error;
    if (data.user) {
      await ensureProfileForUser(data.user);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      await ensureProfileForUser(data.user);
    }
  }

  async function signInWithProvider(provider: SocialAuthProvider) {
    const redirectTo = buildAuthRedirectUrl("/sign-in");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const authUrl = data?.url;
    if (!authUrl) {
      throw new Error("Could not start social sign-in");
    }

    const WebBrowser = await import("expo-web-browser");
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type !== "success" || !result.url) {
      return "cancelled";
    }

    const callbackResult = await consumeAuthCallbackUrl(result.url);
    if (callbackResult.kind === "error") {
      throw new Error(callbackResult.message);
    }
    if (callbackResult.kind === "none") {
      throw new Error("Could not complete social sign-in");
    }

    const {
      data: { user: nextUser },
    } = await supabase.auth.getUser();
    if (nextUser) {
      await ensureProfileForUser(nextUser);
    }

    return "signed-in";
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthRedirectUrl("/update-password"),
    });
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async function resendSignUpConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: buildAuthRedirectUrl("/sign-in"),
      },
    });
    if (error) throw error;
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw error;
    await supabase.auth.signOut().catch(() => undefined);
  }

  const value = useMemo(
    () => ({
      user,
      session,
      initializing,
      signUp,
      signIn,
      signInWithProvider,
      signOut,
      resetPassword,
      updatePassword,
      resendSignUpConfirmation,
      deleteAccount,
    }),
    [user, session, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
