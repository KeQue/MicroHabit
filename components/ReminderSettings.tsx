import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getReminderState, refreshGentleDailyReminder, saveReminderPreferences, subscribeReminderState } from "../features/notifications/local";

export function ReminderSettings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useSyncExternalStore(subscribeReminderState, getReminderState, getReminderState);
  const [enabled, setEnabled] = useState(state.preferences.enabled);
  const [hour, setHour] = useState(String(state.preferences.hour).padStart(2, "0"));
  const [minute, setMinute] = useState(String(state.preferences.minute).padStart(2, "0"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const intent = useRef(0);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    intent.current++;
    const invalidateIntent = () => { intent.current++; };
    if (!visible) return;
    let active = true;
    setBusy(true);
    setMessage(null);
    void refreshGentleDailyReminder().then((fresh) => {
      if (!active) return;
      setEnabled(fresh.preferences.enabled);
      setHour(String(fresh.preferences.hour).padStart(2, "0"));
      setMinute(String(fresh.preferences.minute).padStart(2, "0"));
      setBusy(false);
    });
    return () => { active = false; invalidateIntent(); };
  }, [visible]);
  const save = async () => {
    if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || Number(hour) > 23 || Number(minute) > 59) {
      setMessage("Enter a time from 00:00 to 23:59."); return;
    }
    setBusy(true);
    const saving = intent.current;
    try {
      const result = await saveReminderPreferences({ enabled, hour: Number(hour), minute: Number(minute) });
      if (saving !== intent.current) return;
      if (result.preferences.enabled !== enabled || result.preferences.hour !== Number(hour) || result.preferences.minute !== Number(minute)) {
        setMessage(result.error || "The reminder was not saved. Please try again."); return;
      }
      setMessage(result.error || (enabled && result.permission !== "granted"
        ? "Time saved. Allow notifications in your phone settings to receive reminders."
        : enabled ? result.scheduled ? "Reminder saved." : "Reminder was not scheduled. Please try again."
          : result.preferences.enabled ? "Could not turn off reminders. Please try again." : "Reminders turned off."));
    } finally { if (saving === intent.current) setBusy(false); }
  };
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable accessibilityLabel="Close reminders" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>Reminders</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close reminders" onPress={onClose} style={styles.closeButton}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.description}>One daily reminder on this device, shared across your Commito accounts. Times follow your phone’s local time, while check-ins use UTC.</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Daily reminder</Text>
              <Switch accessibilityLabel="Daily reminder" value={enabled} onValueChange={setEnabled} disabled={busy || Platform.OS === "web"} trackColor={{ true: "#8B5CF6" }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Local time (24-hour)</Text>
              <View style={styles.time}>
                <TextInput accessibilityLabel="Reminder hour, 00 to 23" value={hour} onChangeText={setHour} maxLength={2} keyboardType="number-pad" editable={!busy} style={styles.input} selectTextOnFocus />
                <Text style={styles.label}>:</Text>
                <TextInput accessibilityLabel="Reminder minute, 00 to 59" value={minute} onChangeText={setMinute} maxLength={2} keyboardType="number-pad" editable={!busy} style={styles.input} selectTextOnFocus />
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Done editing reminder time" onPress={() => Keyboard.dismiss()} style={styles.keyboardDone}>
              <Text style={styles.label}>Done editing time</Text>
            </Pressable>
            {Platform.OS === "web" ? <Text style={styles.description}>Reminders are available in the iPhone or Android app.</Text> : null}
            {state.error || message ? <Text accessibilityLiveRegion="polite" style={styles.description}>{state.error || message}</Text> : null}
            {state.permission === "denied" && Platform.OS !== "web" ? (
              <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => setMessage("Open your phone settings and choose Commito → Notifications.")); }} style={styles.button}>
                <Text style={styles.label}>Open phone settings</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" disabled={busy || Platform.OS === "web"} onPress={() => { void save(); }} style={[styles.button, (busy || Platform.OS === "web") && styles.disabled]}>
              <Text style={styles.label}>{busy ? "Saving…" : "Save"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: "#10081F", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%", width: "100%", maxWidth: 480, alignSelf: "center" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#EDE7FF" }, close: { color: "#BCA3E3", fontSize: 23, padding: 8 },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  description: { color: "#B8AEC9", fontSize: 14, lineHeight: 21, marginBottom: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 14, borderBottomColor: "#2B1B42", borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: "#EDE7FF", fontSize: 16, flexShrink: 1 }, time: { flexDirection: "row", gap: 5, alignItems: "center" },
  input: { color: "#EDE7FF", backgroundColor: "#211333", borderRadius: 10, fontSize: 18, padding: 10, width: 48, textAlign: "center" },
  keyboardDone: { minHeight: 44, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: 8 },
  button: { marginTop: 12, backgroundColor: "#291743", borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center", padding: 12 }, disabled: { opacity: 0.5 },
});
