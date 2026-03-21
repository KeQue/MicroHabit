import { Platform } from "react-native";
import { supabase } from "../lib/supabase";

export type AnalyticsEventName =
  | "app_open"
  | "sign_up_started"
  | "sign_up_completed"
  | "login_completed"
  | "league_created"
  | "league_joined"
  | "first_check_in"
  | "reminder_enabled"
  | "notification_permission_granted";

export async function trackEvent(
  eventName: AnalyticsEventName,
  eventData?: Record<string, unknown>
) {
  try {
    const { data } = await supabase.auth.getUser();

    await supabase.from("analytics_events").insert({
      user_id: data.user?.id ?? null,
      event_name: eventName,
      event_data: eventData ?? {},
      platform: Platform.OS,
    });
  } catch (error) {
    if (__DEV__) {
      console.log("[analytics] failed to track", eventName, error);
    }
  }
}
