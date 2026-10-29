import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getGentleNotificationCopy } from "./copy";
import { createReminderController, REMINDER_KIND, REMINDER_STORAGE_KEY, TEST_KIND } from "./reminder-controller";
export type { ReminderPreferences, ReminderState } from "./reminder-controller";

const CHANNEL_ID = "gentle-reminders";
let configured = false;
export function configureNotifications() {
  if (configured || Platform.OS === "web") return;
  Notifications.setNotificationHandler({ handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }) });
  configured = true;
}
async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Gentle reminders", importance: Notifications.AndroidImportance.DEFAULT,
    sound: null, vibrationPattern: [0], lightColor: "#7C3AED",
  });
}
const controller = createReminderController({
  read: () => AsyncStorage.getItem(REMINDER_STORAGE_KEY),
  write: (value) => AsyncStorage.setItem(REMINDER_STORAGE_KEY, value),
  timezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
  permission: async (request) => {
    if (Platform.OS === "web") return false;
    configureNotifications();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!request || !current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  },
  list: () => Platform.OS === "web" ? Promise.resolve([]) : Notifications.getAllScheduledNotificationsAsync(),
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  schedule: async (preferences, timezone) => {
    await ensureChannel();
    return Notifications.scheduleNotificationAsync({
      content: {
        title: "Commito", body: getGentleNotificationCopy("light_encouragement", new Date().getDay()),
        sound: false,
        data: { kind: REMINDER_KIND, signature: `${preferences.hour}:${preferences.minute}:${timezone}` },
      },
      trigger: Platform.OS === "ios" ? {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: preferences.hour, minute: preferences.minute, repeats: true,
      } : {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: preferences.hour, minute: preferences.minute, channelId: CHANNEL_ID,
      },
    });
  },
  test: async () => {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title: "Commito", body: getGentleNotificationCopy("light_encouragement"), sound: false,
        data: { kind: TEST_KIND } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CHANNEL_ID },
    });
  },
});

export const setReminderAccount = controller.setAccount;
export const refreshGentleDailyReminder = controller.refresh;
export const saveReminderPreferences = controller.save;
export const getReminderState = controller.getState;
export const subscribeReminderState = controller.subscribe;
export async function ensureGentleDailyReminder() { return (await controller.refresh()).scheduled; }
export async function cancelGentleDailyReminder() { await controller.setAccount(null); }
export async function scheduleGentleTestNotification() {
  return controller.test();
}
