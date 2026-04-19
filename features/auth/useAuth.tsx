import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildAuthRedirectUrl } from "./links";
import { ensureProfileForUser } from "./profile";
import { supabase } from "../../lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  initializing: boolean;

  // actions
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
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
