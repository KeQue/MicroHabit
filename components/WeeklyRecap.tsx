import { useAuth } from "@/features/auth/useAuth";
import { useWeeklyRecap } from "@/features/leagues/use-weekly-recap";
import { weeklyRecapDateLabel } from "@/features/leagues/weekly-recap";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function WeeklyRecap({ visible, leagueId, onClose }: { visible: boolean; leagueId: string; onClose: () => void }) {
  const { user } = useAuth();
  const recap = useWeeklyRecap(visible, leagueId, user?.id ?? "");
  const insets = useSafeAreaInsets();
  const data = recap.data;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.card} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Weekly recap</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close weekly recap" onPress={onClose} style={styles.button}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {recap.loading ? <ActivityIndicator accessibilityLabel="Loading weekly recap" color="#BCA3E3" /> : null}
            {recap.error ? <>
              <Text accessibilityRole="alert" style={styles.note}>Could not load the weekly recap. Please try again.</Text>
              <Pressable accessibilityRole="button" onPress={recap.retry} style={styles.button}><Text style={styles.link}>Try again</Text></Pressable>
            </> : null}
            {data ? <>
              <Text style={styles.period}>{weeklyRecapDateLabel(data.week_start)} – {weeklyRecapDateLabel(data.week_end)} · UTC</Text>
              <Text style={styles.note}>{data.provisional
                ? "Sunday can still be corrected today. These counts settle on Tuesday at 00:00 UTC."
                : "Last week’s saved activity"}</Text>
              <View style={styles.summary}>
                <Text style={styles.total}>{data.total_member_days} member {data.total_member_days === 1 ? "check-in" : "check-ins"}</Text>
                <Text style={styles.note}>Your group was active on {data.group_active_days} of 7 days.</Text>
              </View>
              {data.members.map((member) => <View key={member.user_id} style={styles.member} accessible
                accessibilityLabel={`${member.user_id === user?.id ? "You" : member.display_name}. ${member.active_days} active days out of seven.`}>
                <Text style={styles.name}>{member.user_id === user?.id ? "You" : member.display_name || "Member"}</Text>
                <Text style={styles.days}>{member.active_days}/7 days</Text>
              </View>)}
              <Text style={styles.encouragement}>{data.total_member_days
                ? "Every check-in is a step forward. Keep showing up together."
                : "A fresh week is a chance to start together. Even one day counts."}</Text>
              <Text style={styles.footnote}>Based on currently saved activity and members. Corrections, member changes and account deletion can change these counts. This is not a separate competition or a permanent result.</Text>
            </> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 18, backgroundColor: "rgba(0,0,0,0.55)" },
  card: { width: "100%", maxWidth: 440, maxHeight: "100%", flexShrink: 1, borderRadius: 20, backgroundColor: "#120A22", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(237,231,255,0.15)", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 8, paddingTop: 8, gap: 8 },
  title: { color: "#EDE7FF", fontSize: 20, fontWeight: "700", flexShrink: 1 },
  button: { minHeight: 44, minWidth: 44, padding: 12, justifyContent: "center", alignSelf: "flex-start" },
  link: { color: "#D8C0FF", fontSize: 16 },
  content: { padding: 20, paddingTop: 8, gap: 12 },
  period: { color: "#EDE7FF", fontSize: 15, fontWeight: "600" },
  note: { color: "#BCAFCF", fontSize: 14, lineHeight: 20 },
  summary: { padding: 14, borderRadius: 12, gap: 6, backgroundColor: "rgba(162,89,255,0.10)" },
  total: { color: "#EDE7FF", fontSize: 18, fontWeight: "600" },
  member: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(237,231,255,0.12)" },
  name: { flex: 1, color: "#EDE7FF", fontSize: 16 },
  days: { color: "#D8C0FF", fontSize: 15 },
  encouragement: { color: "#D8C0FF", fontSize: 15, lineHeight: 21 },
  footnote: { color: "#BCAFCF", fontSize: 12, lineHeight: 18 },
});
