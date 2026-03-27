import Constants from "expo-constants";
import { Platform } from "react-native";

import { trackEvent } from "../analytics";
import { getGentleNotificationCopy } from "./copy";

const CHANNEL_ID = "gentle-reminders";
const REMINDER_KIND = "gentle-daily-reminder";

let configured = false;
let notificationsModulePromise: Promise<typeof import("expo-notifications")> | null = null;

function notificationsUnsupportedInCurrentRuntime() {
  return Platform.OS === "android" && Constants.executionEnvironment === "storeClient";
}

async function getNotificationsModule() {
  if (Platform.OS === "web" || notificationsUnsupportedInCurrentRuntime()) return null;

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }

  return notificationsModulePromise;
}

export function configureNotifications() {
  if (configured || Platform.OS === "web" || notificationsUnsupportedInCurrentRuntime()) return;

  void (async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    configured = true;
  })();
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Gentle reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0],
    lightColor: "#7C3AED",
  });
}

async function hasPermission(requestIfNeeded = true) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  const wasGranted = status === "granted";

  if (requestIfNeeded && status !== "granted" && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (!wasGranted && status === "granted") {
    void trackEvent("notification_permission_granted");
  }

  return status === "granted";
}

async function cancelMatchingReminders() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const matches = scheduled.filter(
    (item) =>
      item.content.data &&
      typeof item.content.data === "object" &&
      "kind" in item.content.data &&
      item.content.data.kind === REMINDER_KIND
  );

  await Promise.all(
    matches.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

export async function ensureGentleDailyReminder() {
  return ensureGentleDailyReminderWithOptions({ requestPermission: true });
}

export async function ensureGentleDailyReminderWithOptions(options?: {
  requestPermission?: boolean;
}) {
  if (Platform.OS === "web" || notificationsUnsupportedInCurrentRuntime()) return false;

  configureNotifications();

  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  const permitted = await hasPermission(options?.requestPermission ?? true);
  if (!permitted) return false;

  await ensureChannel();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const alreadyScheduled = scheduled.some(
    (item) =>
      item.content.data &&
      typeof item.content.data === "object" &&
      "kind" in item.content.data &&
      item.content.data.kind === REMINDER_KIND
  );

  if (alreadyScheduled) return true;

  const weekdayIndex = new Date().getDay();
  const reminderBody = getGentleNotificationCopy("light_encouragement", weekdayIndex);

  const trigger = {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    hour: 17,
    minute: 0,
    repeats: true,
  } as const;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "MicroHabit",
      body: reminderBody,
      sound: false,
      data: { kind: REMINDER_KIND },
    },
    trigger,
  });

  void trackEvent("reminder_enabled");
  return true;
}

export async function cancelGentleDailyReminder() {
  if (Platform.OS === "web" || notificationsUnsupportedInCurrentRuntime()) return;
  await cancelMatchingReminders();
}

export async function scheduleGentleTestNotification() {
  if (Platform.OS === "web" || notificationsUnsupportedInCurrentRuntime()) return false;

  configureNotifications();

  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  const permitted = await hasPermission();
  if (!permitted) return false;

  await ensureChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "MicroHabit",
      body: getGentleNotificationCopy("light_encouragement"),
      sound: false,
      data: { kind: "gentle-test-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
    },
  });

  return true;
}
