import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../../lib/supabase";
import { millisecondsUntilNextUtcDay } from "./utc-calendar";
import { createRecapRequest, parseWeeklyRecap, type WeeklyRecap } from "./weekly-recap";

const empty = { data: null as WeeklyRecap | null, loading: false, error: false };

/** No cached recap survives closing, sign-out, account change or league change. */
export function useWeeklyRecap(visible: boolean, leagueId: string, userId: string) {
  const key = visible && leagueId && userId ? `${leagueId}:${userId}` : "";
  const currentKey = useRef(key);
  currentKey.current = key;
  const [state, setState] = useState({ key: "", ...empty });
  const retryRef = useRef(() => {});
  useEffect(() => {
    let active = true;
    let allowed = !!key;
    let timer: ReturnType<typeof setTimeout>;
    const request = createRecapRequest<WeeklyRecap>((next) => {
      if (active && allowed && currentKey.current === key) setState({ key, ...next });
    });
    const load = () => {
      if (!active || !allowed || currentKey.current !== key) return;
      void request.load(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session || data.session.user.id !== userId || !active || !allowed || currentKey.current !== key) {
          throw new Error("Session changed");
        }
        const response = await supabase.rpc("get_free_league_weekly_recap", { p_league_id: leagueId })
          .setHeader("Authorization", `Bearer ${data.session.access_token}`);
        if (response.error) throw response.error;
        return parseWeeklyRecap(response.data);
      });
    };
    retryRef.current = load;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session?.user.id && session.user.id !== userId)) {
        allowed = false;
        request.cancel();
        if (active) setState({ key: "", ...empty });
      }
    });
    const scheduleDay = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { load(); scheduleDay(); }, millisecondsUntilNextUtcDay() + 50);
    };
    if (key) { load(); scheduleDay(); }
    const foreground = AppState.addEventListener("change", (status) => {
      if (status === "active" && key) { load(); scheduleDay(); }
    });
    return () => {
      active = false;
      request.cancel();
      clearTimeout(timer);
      subscription.unsubscribe();
      foreground.remove();
    };
  }, [key, leagueId, userId]);
  return { ...(key && state.key === key ? state : empty), retry: () => retryRef.current() };
}
