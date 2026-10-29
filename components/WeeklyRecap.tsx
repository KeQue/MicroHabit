import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/features/auth/useAuth";
import { useWeeklyRecap } from "@/features/leagues/use-weekly-recap";
import { weeklyRecapRangeLabel } from "@/features/leagues/weekly-recap";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function WeeklyRecap({ visible, leagueId, onClose }: { visible: boolean; leagueId: string; onClose: () => void }) {
  const { user } = useAuth();
  const recap = useWeeklyRecap(visible, leagueId, user?.id ?? "");
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);
  const closeRef = useRef(onClose);
  const visibleRef = useRef(visible);
  closeRef.current = onClose;
  visibleRef.current = visible;

  useEffect(() => {
    dragY.stopAnimation();
    if (visible) { dragY.setValue(0); dismissing.current = false; }
    return () => dragY.stopAnimation();
  }, [visible, dragY]);

  const dragResponder = useMemo(() => {
    const reset = () => Animated.spring(dragY, {
      toValue: 0, damping: 24, stiffness: 260, mass: 1, useNativeDriver: Platform.OS !== "web",
    }).start();
    return PanResponder.create({
      // Header-only dismissal keeps member-list scrolling independent.
      onMoveShouldSetPanResponder: (_, gesture) => !dismissing.current &&
        gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx),
      onPanResponderGrant: () => dragY.stopAnimation(),
      onPanResponderMove: (_, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || (gesture.dy > 24 && gesture.vy > 0.8)) {
          dismissing.current = true;
          Animated.timing(dragY, { toValue: height, duration: 180, useNativeDriver: Platform.OS !== "web" })
            .start(({ finished }) => { if (finished && visibleRef.current) closeRef.current(); });
        } else reset();
      },
      onPanResponderTerminate: reset,
    });
  }, [dragY, height]);
  const data = recap.data;
  // Presentation order only. Keep the server's peer order and UUID identities.
  const members = data ? [
    ...data.members.filter((member) => member.user_id === user?.id),
    ...data.members.filter((member) => member.user_id !== user?.id),
  ] : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable testID="recap-backdrop" onPress={onClose} style={StyleSheet.absoluteFill}
          accessible={false} importantForAccessibility="no" />
        <Animated.View style={[styles.sheet, {
          height: Math.min(height * 0.88, height - insets.top - 12),
          paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: dragY }],
        }]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View testID="recap-drag-header" {...dragResponder.panHandlers}>
            <View style={styles.handleArea} pointerEvents="none"><View style={styles.handle} /></View>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>Weekly recap</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close weekly recap" onPress={onClose} style={styles.closeTarget}>
                <View style={styles.closeCircle}><Ionicons name="close" size={18} color="#D8C0FF" accessible={false} /></View>
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {recap.loading ? <View style={styles.message}>
              <ActivityIndicator accessibilityLabel="Loading weekly recap" color="#BCA3E3" />
              <Text style={styles.note}>Loading last week…</Text>
            </View> : null}
            {recap.error ? <View style={styles.message}>
              <Text accessibilityRole="alert" style={styles.note}>Could not load the weekly recap. Please try again.</Text>
              <Pressable accessibilityRole="button" onPress={recap.retry} style={styles.retry}><Text style={styles.link}>Try again</Text></Pressable>
            </View> : null}
            {data ? <>
              <View style={styles.periodGroup}>
                <Text style={styles.period}>{weeklyRecapRangeLabel(data.week_start, data.week_end)}</Text>
                <Text style={styles.note}>{data.provisional
                  ? "Sunday is still open for corrections until 00:00 UTC on Tuesday."
                  : "Last week’s activity"}</Text>
              </View>
              <View style={styles.summary}>
                <Text style={styles.total}>{data.total_member_days} {data.total_member_days === 1 ? "check-in" : "check-ins"} together</Text>
                <Text style={styles.note}>Group active on {data.group_active_days} of 7 days</Text>
              </View>
              <View>
                {members.map((member) => <View key={member.user_id} style={styles.member} accessible
                  accessibilityLabel={`${member.user_id === user?.id ? "You" : member.display_name || "Member"}. ${member.active_days} active days out of seven.`}>
                  <View style={styles.memberHeading}>
                    <Text style={[styles.name, member.user_id === user?.id && styles.you]}>{member.user_id === user?.id ? "You" : member.display_name || "Member"}</Text>
                    <Text style={styles.days}>{member.active_days}/7 days</Text>
                  </View>
                  <View style={styles.track} accessible={false}>
                    <View style={[styles.fill, { width: `${member.active_days / 7 * 100}%` }]} />
                  </View>
                </View>)}
              </View>
              <Text style={styles.encouragement}>{data.total_member_days
                ? "Every check-in counts. Keep showing up together."
                : "A fresh week is a chance to start together. Even one day counts."}</Text>
              <Text style={styles.footnote}>Based on saved check-ins and current members. Counts may change after corrections, membership changes or account deletion.</Text>
            </> : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(0,0,0,0.88)" },
  sheet: { width: "100%", maxWidth: 480, backgroundColor: "#120A22", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(237,231,255,0.12)", overflow: "hidden" },
  handleArea: { height: 20, alignItems: "center", justifyContent: "center" },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: "rgba(237,231,255,0.25)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 22, paddingRight: 12, paddingBottom: 8, gap: 8 },
  title: { color: "#EDE7FF", fontSize: 22, fontWeight: "700", flexShrink: 1 },
  closeTarget: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  closeCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(162,89,255,0.16)", alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 22, paddingTop: 8, gap: 18 },
  periodGroup: { gap: 6 },
  period: { color: "#EDE7FF", fontSize: 15, fontWeight: "600" },
  note: { color: "#BCAFCF", fontSize: 14, lineHeight: 20 },
  summary: { padding: 16, borderRadius: 14, gap: 6, backgroundColor: "rgba(162,89,255,0.10)" },
  total: { color: "#EDE7FF", fontSize: 22, fontWeight: "600" },
  member: { gap: 10, paddingVertical: 14 },
  memberHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  name: { flex: 1, color: "#EDE7FF", fontSize: 16 },
  you: { fontWeight: "600" },
  days: { color: "#BCAFCF", fontSize: 14 },
  track: { height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(237,231,255,0.08)" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: "#A259FF" },
  encouragement: { color: "#D8C0FF", fontSize: 14, lineHeight: 20 },
  footnote: { color: "#BCAFCF", fontSize: 12, lineHeight: 18 },
  message: { gap: 14, paddingVertical: 20 },
  retry: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", alignSelf: "flex-start", backgroundColor: "rgba(162,89,255,0.16)", borderRadius: 12 },
  link: { color: "#D8C0FF", fontSize: 16 },
});
