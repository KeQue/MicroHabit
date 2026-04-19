import type { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildAuthRedirectUrl, consumeAuthCallbackUrl } from "./links";
import { ensureProfileForUser } from "./profile";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export type SocialAuthProvider = "google";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  initializing: boolean;

  // actions
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: SocialAuthProvider) => Promise<"signed-in" | "cancelled">;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendSignUpConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (lower.includes("email not confirmed")) {
    return "Check your inbox and confirm your email before signing in.";
  }

  if (lower.includes("email address") && lower.includes("invalid")) {
    return "Supabase rejected that signup email. Use a real inbox address, and if this is a production signup, make sure custom SMTP is configured in Supabase Auth.";
  }

  if (lower.includes("not authorized")) {
    return "Supabase is not allowed to send signup emails to that address yet. Add custom SMTP or authorize the address in your Supabase project.";
  }

  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncRealtimeAuth = (nextSession: Session | null) => {
      const token = nextSession?.access_token;
      if (!token) return;
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
    if (error) throw new Error(normalizeAuthErrorMessage(error.message));
    if (data.session?.user) {
      await ensureProfileForUser(data.session.user);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(normalizeAuthErrorMessage(error.message));
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

    if (error) throw new Error(normalizeAuthErrorMessage(error.message));

    const authUrl = data?.url;
    if (!authUrl) {
      throw new Error("Could not start Google sign-in.");
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type !== "success" || !result.url) {
      return "cancelled";
    }

    const callbackResult = await consumeAuthCallbackUrl(result.url);
    if (callbackResult.kind === "error") {
      throw new Error(normalizeAuthErrorMessage(callbackResult.message));
    }
    if (callbackResult.kind === "none") {
      throw new Error("Could not complete Google sign-in.");
    }

    const {
      data: { user: nextUser },
    } = await supabase.auth.getUser();
    if (nextUser) {
      await ensureProfileForUser(nextUser);
    }

    return "signed-in";
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthRedirectUrl("/update-password"),
    });
    if (error) throw new Error(normalizeAuthErrorMessage(error.message));
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(normalizeAuthErrorMessage(error.message));
  }

  async function resendSignUpConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: buildAuthRedirectUrl("/sign-in"),
      },
    });
    if (error) throw new Error(normalizeAuthErrorMessage(error.message));
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo(
    () => ({
      user,
      session,
      initializing,
      signUp,
      signIn,
      signInWithProvider,
      resetPassword,
      updatePassword,
      resendSignUpConfirmation,
      signOut,
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
