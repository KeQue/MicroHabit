import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../../lib/supabase";
import { getFreeLeagueHistory } from "./api";
import type { MonthlyCycle } from "./monthly-results";

const PAGE_SIZE = 12;
type HistoryState = {
  key: string;
  cycles: MonthlyCycle[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
};

function emptyState(key: string): HistoryState {
  return { key, cycles: [], loading: false, error: null, hasMore: false, loadingMore: false, moreError: null };
}

/** Lazy, account-scoped history. An old request can never publish into a new scope. */
export function useMonthlyHistory(leagueId: string, userId: string, utcDay: string) {
  const identity = `${leagueId}:${userId}`;
  const key = `${identity}:${utcDay}`;
  const [state, setState] = useState(() => emptyState(key));
  const stateRef = useRef(state);
  stateRef.current = state;
  const currentKey = useRef(key);
  const currentIdentity = useRef(identity);
  const generation = useRef(0);
  const mounted = useRef(true);
  const opened = useRef(false);
  const authAllowed = useRef(true);
  const pending = useRef<"first" | "more" | null>(null);

  // Invalidate synchronously: effects run after render, but a response can arrive before them.
  if (currentKey.current !== key) {
    generation.current += 1;
    pending.current = null;
    currentKey.current = key;
    if (currentIdentity.current !== identity) {
      opened.current = false;
      authAllowed.current = true;
      currentIdentity.current = identity;
    }
  }

  const publish = useCallback((next: HistoryState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const loadFirst = useCallback(async () => {
    if (!mounted.current || !opened.current || !authAllowed.current || !leagueId || !userId || currentKey.current !== key) return;
    const request = ++generation.current;
    pending.current = "first";
    publish({ ...emptyState(key), loading: true });
    const isCurrent = () => mounted.current && authAllowed.current && currentKey.current === key && generation.current === request;
    try {
      const page = await getFreeLeagueHistory(leagueId, null, PAGE_SIZE);
      if (!isCurrent()) return;
      pending.current = null;
      publish({ ...emptyState(key), cycles: page, hasMore: page.length === PAGE_SIZE });
    } catch {
      if (!isCurrent()) return;
      pending.current = null;
      publish({ ...emptyState(key), error: "Could not load past results. Please try again." });
    }
  }, [key, leagueId, userId, publish]);

  const open = useCallback(() => {
    if (opened.current || !authAllowed.current || !leagueId || !userId || currentKey.current !== key) return;
    opened.current = true;
    void loadFirst();
  }, [loadFirst, key, leagueId, userId]);

  const retry = useCallback(() => {
    if (!authAllowed.current || !leagueId || !userId || currentKey.current !== key) return;
    opened.current = true;
    void loadFirst();
  }, [loadFirst, key, leagueId, userId]);

  const refresh = useCallback(() => {
    if (opened.current) void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    const previous = stateRef.current;
    if (!mounted.current || !opened.current || !authAllowed.current || currentKey.current !== key ||
      previous.key !== key || pending.current || !previous.hasMore || !previous.cycles.length || !leagueId || !userId) return;
    const request = ++generation.current;
    pending.current = "more";
    publish({ ...previous, loadingMore: true, moreError: null });
    const isCurrent = () => mounted.current && authAllowed.current && currentKey.current === key && generation.current === request;
    try {
      const oldest = previous.cycles[previous.cycles.length - 1].month_start;
      const page = await getFreeLeagueHistory(leagueId, oldest, PAGE_SIZE);
      if (!isCurrent()) return;
      const seen = new Set(previous.cycles.map((cycle) => cycle.month_start));
      const additions = page.filter((cycle) => {
        if (seen.has(cycle.month_start)) return false;
        seen.add(cycle.month_start);
        return true;
      });
      pending.current = null;
      publish({ ...previous, cycles: [...previous.cycles, ...additions], loadingMore: false, moreError: null, hasMore: page.length === PAGE_SIZE });
    } catch {
      if (!isCurrent()) return;
      pending.current = null;
      publish({ ...previous, loadingMore: false, moreError: "Could not load older months. Please try again." });
    }
  }, [key, leagueId, userId, publish]);

  useEffect(() => {
    mounted.current = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return;
      if (event === "SIGNED_OUT" || (session?.user.id && session.user.id !== userId)) {
        authAllowed.current = false;
        opened.current = false;
        generation.current += 1;
        pending.current = null;
        publish(emptyState(currentKey.current));
      } else if (session?.user.id === userId) {
        authAllowed.current = true;
      }
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      pending.current = null;
      subscription.unsubscribe();
    };
  }, [identity, userId, publish]);

  useEffect(() => {
    if (stateRef.current.key !== key) publish(emptyState(key));
    if (opened.current) void loadFirst();
  }, [key, loadFirst, publish]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // Hide another league/account/day's state even on the render preceding effect cleanup.
  const visible = state.key === key && authAllowed.current ? state : emptyState(key);
  return { ...visible, open, retry, refresh, loadMore };
}
