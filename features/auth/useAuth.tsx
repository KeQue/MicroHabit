import type { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildAuthRedirectUrl, cancelPendingAuthFlow, consumeAuthCallbackUrl, getPendingAuthFlow, parseAuthCallbackUrl } from "./links";
import type { AuthCallbackResult } from "./callback";
import { ensureProfileForUser } from "./profile";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export type SocialAuthProvider = "google" | "apple";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  initializing: boolean;
  passwordRecovery: boolean;
  processingAuthLink: boolean;
  handleAuthCallback: (url: string) => Promise<AuthCallbackResult>;
  finishPasswordRecovery: () => void;

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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [pendingAuthLinks, setPendingAuthLinks] = useState(0);

  const handleAuthCallback = useCallback(async (url: string) => {
    const callback = parseAuthCallbackUrl(url);
    if (!callback.isCallback) return { kind: "none" } as const;
    // Mark recovery before setSession/exchange emits SIGNED_IN. Otherwise the
    // normal signed-in route guard can win the race and open leagues.
    setPendingAuthLinks((count) => count + 1);
    setPasswordRecovery(callback.recovery && !callback.error);
    try {
      const result = await consumeAuthCallbackUrl(url);
      setPasswordRecovery(result.kind === "recovery");
      return result;
    } finally {
      setPendingAuthLinks((count) => count - 1);
    }
  }, []);

  const finishPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

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
          void ensureProfileForUser(s.user).catch(() => undefined);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
      syncRealtimeAuth(newSession ?? null);
      setSession(newSession ?? null);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void ensureProfileForUser(newSession.user).catch(() => undefined);
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
    await cancelPendingAuthFlow();
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

  const signInWithProvider = useCallback(async (provider: SocialAuthProvider) => {
    await cancelPendingAuthFlow();
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
      throw new Error(`Could not start ${provider === "apple" ? "Apple" : "Google"} sign-in.`);
    }

    let result: WebBrowser.WebBrowserAuthSessionResult;
    try {
      result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    } catch (error) {
      await cancelPendingAuthFlow();
      throw error;
    }
    if (result.type !== "success" || !result.url) {
      await cancelPendingAuthFlow();
      return "cancelled";
    }

    const callbackResult = await handleAuthCallback(result.url);
    if (callbackResult.kind === "error") {
      throw new Error(normalizeAuthErrorMessage(callbackResult.message));
    }
    if (callbackResult.kind === "none") {
      throw new Error(`Could not complete ${provider === "apple" ? "Apple" : "Google"} sign-in.`);
    }

    const {
      data: { user: nextUser },
    } = await supabase.auth.getUser();
    if (nextUser) {
      await ensureProfileForUser(nextUser);
    }

    return "signed-in" as const;
  }, [handleAuthCallback]);

  async function resetPassword(email: string) {
    await cancelPendingAuthFlow();
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
    if (await getPendingAuthFlow() !== "sign-in") {
      throw new Error("Start signup again on this device to request a new confirmation link. Then open the newest email here.");
    }
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
    await cancelPendingAuthFlow();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo(
    () => ({
      user,
      session,
      initializing,
      passwordRecovery,
      processingAuthLink: pendingAuthLinks > 0,
      handleAuthCallback,
      finishPasswordRecovery,
      signUp,
      signIn,
      signInWithProvider,
      resetPassword,
      updatePassword,
      resendSignUpConfirmation,
      signOut,
    }),
    [user, session, initializing, passwordRecovery, pendingAuthLinks, handleAuthCallback, finishPasswordRecovery, signInWithProvider]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
