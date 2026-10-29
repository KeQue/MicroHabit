import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appVersionLabel } from "../features/app/version-label";
import { openPolicyPage, POLICY_PAGES } from "./PolicyLinks";
import { ReminderSettings } from "./ReminderSettings";

type Action = () => void | Promise<void>;
type Props = {
  visible: boolean;
  onClose: () => void;
  onSignOut: Action;
  onDeleteAccount: Action;
  deletingAccount: boolean;
  onBack?: Action;
  onCheckInRules?: Action;
  onTestNotification?: Action;
  onWeeklyRecap?: Action;
};

type Row = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: Action;
  danger?: boolean;
  disabled?: boolean;
  link?: boolean;
  navigation?: boolean;
};

function MenuGroup({ rows, onAction }: { rows: Row[]; onAction: (action: Action) => void }) {
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <Pressable
            accessibilityRole={row.link ? "link" : "button"}
            accessibilityHint={row.link ? "Opens in your browser" : undefined}
            accessibilityState={{ disabled: !!row.disabled }}
            disabled={row.disabled}
            onPress={() => onAction(row.onPress)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed, row.disabled && styles.disabled]}
          >
            <Ionicons
              name={row.icon}
              size={19}
              color={row.danger ? "#FCA5A5" : "#BCA3E3"}
              accessible={false}
            />
            <Text style={[styles.rowText, row.danger && styles.danger]}>{row.label}</Text>
            {row.navigation || row.link ? (
              <Ionicons name={row.link ? "open-outline" : "chevron-forward"} size={14} color="rgba(237,231,255,0.45)" accessible={false} />
            ) : null}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function AccountMenuSheet({
  visible, onClose, onSignOut, onDeleteAccount, deletingAccount,
  onBack, onCheckInRules, onTestNotification, onWeeklyRecap,
}: Props) {
  const [remindersOpen, setRemindersOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const pendingAction = useRef<Action | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) {
      dragY.stopAnimation();
      dragY.setValue(0);
      dismissing.current = false;
    }
  }, [visible, dragY]);

  const dragResponder = useMemo(() => {
    const returnToPosition = () => Animated.spring(dragY, {
      toValue: 0, damping: 24, stiffness: 260, mass: 1,
      useNativeDriver: Platform.OS !== "web",
    }).start();

    return PanResponder.create({
      // Only the header owns this gesture; the rows retain normal scrolling.
      onMoveShouldSetPanResponder: (_, gesture) =>
        !dismissing.current && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx),
      onPanResponderGrant: () => dragY.stopAnimation(),
      onPanResponderMove: (_, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || (gesture.dy > 24 && gesture.vy > 0.8)) {
          dismissing.current = true;
          Animated.timing(dragY, {
            toValue: height, duration: 180, useNativeDriver: Platform.OS !== "web",
          }).start(({ finished }) => {
            if (finished) closeRef.current();
          });
        } else {
          returnToPosition();
        }
      },
      onPanResponderTerminate: returnToPosition,
    });
  }, [dragY, height]);

  const finishDismissal = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    void action?.();
  };
  const closeAndRun = (action: Action) => {
    if (pendingAction.current) return;
    pendingAction.current = action;
    onClose();
    // iOS must finish dismissing this modal before presenting an alert/browser.
    if (Platform.OS !== "ios") finishDismissal();
  };
  const version = appVersionLabel({
    environment: Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? "expo"
      : Platform.OS === "web" ? "web" : "native",
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuild: Application.nativeBuildVersion,
    configuredVersion: Constants.expoConfig?.version,
  });
  const leagueRows: Row[] = [];
  if (onCheckInRules) leagueRows.push({ label: "Check-in rules", icon: "calendar-outline", onPress: onCheckInRules, navigation: true });
  if (onWeeklyRecap) leagueRows.push({ label: "Weekly recap", icon: "stats-chart-outline", onPress: onWeeklyRecap, navigation: true });
  if (onBack) leagueRows.push({ label: "Back to leagues", icon: "arrow-back-outline", onPress: onBack });

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={finishDismissal} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[styles.sheet, { maxHeight: height - insets.top - 16, paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: dragY }] }]}
        >
          <View {...dragResponder.panHandlers}>
            <View pointerEvents="none" style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>Settings</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                onPress={onClose}
                style={({ pressed }) => [styles.closeTarget, pressed && styles.disabled]}
              >
                <View style={styles.closeCircle}>
                  <Ionicons name="close" size={18} color="#D8C0FF" accessible={false} />
                </View>
              </Pressable>
            </View>
          </View>
          <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {leagueRows.length ? <MenuGroup rows={leagueRows} onAction={closeAndRun} /> : null}
            <MenuGroup onAction={closeAndRun} rows={[
              { label: "Daily reminder", icon: "notifications-outline", onPress: () => setRemindersOpen(true), navigation: true },
            ]} />
            <MenuGroup onAction={closeAndRun} rows={POLICY_PAGES.map(({ label, url }, index) => ({
              label, icon: index === 0 ? "hand-left-outline" : "help-circle-outline",
              link: true, onPress: () => openPolicyPage(label, url),
            }))} />
            <MenuGroup onAction={closeAndRun} rows={[
              { label: "Sign out", icon: "log-out-outline", onPress: onSignOut, disabled: deletingAccount },
              { label: deletingAccount ? "Deleting…" : "Delete account", icon: "trash-outline", onPress: onDeleteAccount, danger: true, disabled: deletingAccount },
            ]} />
            {onTestNotification ? <MenuGroup onAction={closeAndRun} rows={[
              { label: "Test notification", icon: "notifications-outline", onPress: onTestNotification },
            ]} /> : null}
            <View style={styles.version}>
              <Text selectable style={styles.versionText}>{version.title}</Text>
              {version.detail ? <Text style={styles.environmentText}>{version.detail}</Text> : null}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
    <ReminderSettings visible={remindersOpen} onClose={() => setRemindersOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { width: "100%", maxWidth: 480, flexShrink: 1, backgroundColor: "rgba(18,10,34,0.98)", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(237,231,255,0.12)", overflow: "hidden" },
  handleArea: { height: 16, alignItems: "center", justifyContent: "flex-end" },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: "rgba(237,231,255,0.25)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 22, paddingRight: 12, paddingTop: 0, paddingBottom: 8 },
  title: { color: "#EDE7FF", fontSize: 20, fontWeight: "700", letterSpacing: 0.1, flexShrink: 1 },
  closeTarget: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  closeCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(162,89,255,0.16)", alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 18, gap: 12 },
  group: { backgroundColor: "rgba(162,89,255,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(162,89,255,0.12)", borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 46, paddingHorizontal: 14, paddingVertical: 11, gap: 12 },
  rowPressed: { backgroundColor: "rgba(162,89,255,0.18)" },
  rowText: { flex: 1, color: "#EDE7FF", fontSize: 16, fontWeight: "400", lineHeight: 21 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(237,231,255,0.10)", marginLeft: 45 },
  danger: { color: "#FCA5A5" },
  disabled: { opacity: 0.45 },
  version: { alignItems: "center", paddingTop: 2, paddingBottom: 2, gap: 3 },
  versionText: { color: "rgba(237,231,255,0.65)", fontSize: 12, lineHeight: 16 },
  environmentText: { color: "rgba(237,231,255,0.45)", fontSize: 11, lineHeight: 15, textAlign: "center" },
});
