import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getGentleNotificationCopy } from "./copy";

const CHANNEL_ID = "gentle-reminders";
const REMINDER_KIND = "gentle-daily-reminder";

let configured = false;

export function configureNotifications() {
  if (configured || Platform.OS === "web") return;

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
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Gentle reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0],
    lightColor: "#7C3AED",
  });
}

async function hasPermission() {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted" && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return status === "granted";
}

async function cancelMatchingReminders() {
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
  if (Platform.OS === "web") return false;

  configureNotifications();

  const permitted = await hasPermission();
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

  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    hour: 17,
    minute: 0,
    repeats: true,
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "MicroHabit",
      body: reminderBody,
      sound: false,
      data: { kind: REMINDER_KIND },
    },
    trigger,
  });

  return true;
}

export async function cancelGentleDailyReminder() {
  if (Platform.OS === "web") return;
  await cancelMatchingReminders();
}

export async function scheduleGentleTestNotification() {
  if (Platform.OS === "web") return false;

  configureNotifications();

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
