import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { isCurrentUserAdmin } from "../../features/auth/admin";
import { trackEvent } from "../../features/analytics";
import { ensureProfileForCurrentUser } from "../../features/auth/profile";
import { createLeague, getMyLeagues, type League } from "../../features/leagues/api";
import { getCommitmentPlan, getPlanName, type PlanTier } from "../../features/leagues/plans";
import { supabase } from "../../lib/supabase";

const getMonthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function normalizeErr(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  return e?.message || e?.error_description || e?.hint || JSON.stringify(e);
}

function planLabel(isFreeSelected: boolean, selectedPlanTier: PlanTier | null) {
  if (isFreeSelected) return "Free trial";
  return getPlanName(selectedPlanTier);
}

export default function LeaguesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const planTierFromParams = useMemo(() => {
    const v = params.planTier;
    if (v === "A" || v === "B" || v === "C") return v as PlanTier;
    return null;
  }, [params.planTier]);

  const isFreeFromParams = useMemo(() => params.isFree === "1", [params.isFree]);
  const lastConsumedSelection = useRef<string | null>(null);

  const [selectedPlanTier, setSelectedPlanTier] = useState<PlanTier | null>(null);
  const [isFreeSelected, setIsFreeSelected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  async function resolveUser() {
    const u = await ensureProfileForCurrentUser();
    if (!u) throw new Error("Not authenticated");
    setUserId(u.id);
    return u.id;
  }

  async function load() {
    try {
      setError(null);
      setLoading(true);

      const uid = userId ?? (await resolveUser());
      const [data, admin] = await Promise.all([getMyLeagues(uid), isCurrentUserAdmin().catch(() => false)]);
      setLeagues(data);
      setIsAdmin(admin);
    } catch (e: any) {
      setError(normalizeErr(e) ?? "Failed to load leagues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (params.isFree == null && params.planTier == null) return;

    const key = `${params.isFree ?? ""}|${params.planTier ?? ""}`;
    if (lastConsumedSelection.current === key) return;
    lastConsumedSelection.current = key;

    setIsFreeSelected(isFreeFromParams);
    setSelectedPlanTier(planTierFromParams);
    setShowCreate(true);
    setError(null);
  }, [params.isFree, params.planTier, isFreeFromParams, planTierFromParams]);

  const canSubmit =
    (isFreeSelected || !!selectedPlanTier) &&
    newName.trim().length > 0 &&
    newActivity.trim().length > 0 &&
    !creating;

  async function onCreate() {
    if (creatingRef.current) return;

    try {
      setError(null);
      setCreating(true);
      creatingRef.current = true;

      if (!isFreeSelected && !selectedPlanTier) {
        throw new Error("Please choose a commitment level first");
      }

      await (userId ?? resolveUser());

      if (!newName.trim()) throw new Error("League name is required");
      if (!newActivity.trim()) throw new Error("Activity is required");

      const timeoutMs = 15000;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Try again.")), timeoutMs)
      );

      const league = await Promise.race([
        createLeague({
          name: newName,
          activity: newActivity,
          isFree: isFreeSelected,
          planTier: isFreeSelected ? null : selectedPlanTier,
          monthKey: getMonthKey(),
        }),
        timeout,
      ]);

      setNewName("");
      setNewActivity("");
      setShowCreate(false);
      setSelectedPlanTier(null);
      setIsFreeSelected(false);

      await load();
      await trackEvent("league_created", {
        league_id: league.id,
        is_free: isFreeSelected,
        plan_tier: league.plan_tier ?? null,
      });

      if (!isFreeSelected && league.status === "payment_required") {
        router.push({
          pathname: "/(app)/league/purchase",
          params: {
            leagueId: league.id,
            next: `/(app)/league/${league.id}`,
          },
        });
        return;
      }

      router.push(`/(app)/league/${league.id}`);
    } catch (e: any) {
      setError(normalizeErr(e));
    } finally {
      setCreating(false);
      creatingRef.current = false;
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  function onStartCreate() {
    setError(null);
    router.push("/league/choose-plan");
  }

  function resetCreate() {
    setShowCreate(false);
    setSelectedPlanTier(null);
    setIsFreeSelected(false);
    setNewName("");
    setNewActivity("");
    setError(null);
  }

  const selectedPlan = !isFreeSelected && selectedPlanTier ? getCommitmentPlan(selectedPlanTier) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Leagues</Text>
            <Text style={styles.subtitle}>
              {showCreate ? "Set up your league details." : "Create or join a commitment league."}
            </Text>
          </View>

          <Pressable onPress={onSignOut} style={styles.headerGhostBtn}>
            <Text style={styles.headerGhostText}>Sign out</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actionStack}>
          {showCreate ? (
            <Pressable
              onPress={onStartCreate}
              style={({ pressed }) => [styles.backBtn, pressed && styles.actionPressed]}
            >
              <Text style={styles.backBtnText}>Back to plans</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onStartCreate}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            >
              <Text style={styles.actionTitle}>+ Create a league</Text>
              <Text style={styles.actionSubtitle}>Start a new accountability group.</Text>
            </Pressable>
          )}

          {!showCreate ? (
            <>
              <Pressable
                onPress={() => router.push("/(app)/league/join")}
                style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
              >
                <Text style={styles.actionTitle}>Join with code</Text>
                <Text style={styles.actionSubtitle}>Jump into an existing league in seconds.</Text>
              </Pressable>

              {isAdmin ? (
                <Pressable
                  onPress={() => router.push("/(app)/reports")}
                  style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
                >
                  <Text style={styles.actionTitle}>League reports</Text>
                  <Text style={styles.actionSubtitle}>Review pending rewards, charity totals, and leagues awaiting settlement.</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>

        {showCreate ? (
          <>
            {selectedPlan ? (
              <View style={styles.selectedPlanWrap}>
                <Text style={styles.selectedPlanLabel}>SELECTED PLAN</Text>
                <Text style={styles.selectedPlanTitle}>
                  {selectedPlan.fullName} - ${selectedPlan.priceEuros} per person
                </Text>
                <Text style={styles.selectedPlanMessage}>{selectedPlan.message}</Text>
                <Text style={styles.selectedPlanMeta}>{selectedPlan.quickDifference}</Text>
                <Text style={styles.selectedPlanMeta}>{selectedPlan.summary}</Text>
                {selectedPlan.secondarySummary ? (
                  <Text style={styles.selectedPlanMeta}>{selectedPlan.secondarySummary}</Text>
                ) : null}
                {selectedPlan.unlockLabel ? (
                  <Text style={styles.selectedPlanMetaHighlight}>{selectedPlan.unlockLabel}</Text>
                ) : null}
                {selectedPlan.purchaseNote ? (
                  <Text style={styles.selectedPlanMeta}>{selectedPlan.purchaseNote}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.createCard}>
              <View style={styles.createHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createEyebrow}>CREATE A LEAGUE</Text>
                  <Text style={styles.createTitle}>Fill in your league</Text>
                  <Text style={styles.createHelper}>Only the fields below are editable.</Text>
                </View>

                <View style={styles.planChip}>
                  <Text style={styles.planChipText}>{planLabel(isFreeSelected, selectedPlanTier)}</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>League name</Text>
                <TextInput
                  value={newName}
                  onChangeText={(t) => {
                    setNewName(t);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. April consistency club"
                  placeholderTextColor="#64748B"
                  autoCapitalize="sentences"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>What activity are you committing to?</Text>
                  <Text style={styles.fieldCount}>{newActivity.length}/40</Text>
                </View>
                <TextInput
                  value={newActivity}
                  onChangeText={(t) => {
                    setNewActivity(t.slice(0, 40));
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Gym, running, reading"
                  placeholderTextColor="#64748B"
                  autoCapitalize="sentences"
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={onCreate}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.createBtn,
                  !canSubmit && styles.createBtnDisabled,
                  pressed && canSubmit && styles.createBtnPressed,
                ]}
              >
                <Text style={styles.createBtnText}>{creating ? "Creating..." : "Create league"}</Text>
              </Pressable>

              <Pressable onPress={resetCreate} style={styles.cancelInlineBtn}>
                <Text style={styles.cancelInlineText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <View style={styles.listWrap}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator />
            </View>
          ) : leagues.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No leagues yet</Text>
              <Text style={styles.emptyText}>Your leagues will show up here once you create or join one.</Text>
              <Pressable onPress={load} style={styles.emptyRefreshBtn}>
                <Text style={styles.emptyRefreshText}>Refresh</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>Your leagues</Text>
                <Pressable onPress={load} style={styles.inlineRefreshBtn}>
                  <Text style={styles.inlineRefreshText}>Refresh</Text>
                </Pressable>
              </View>

              <View style={styles.listContent}>
                {leagues.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (item.my_payment_status === "unpaid" && item.plan_tier) {
                        router.push({
                          pathname: "/(app)/league/purchase",
                          params: {
                            leagueId: item.id,
                            next: `/(app)/league/${item.id}`,
                          },
                        });
                        return;
                      }

                      router.push(`/(app)/league/${item.id}`);
                    }}
                    style={({ pressed }) => [styles.leagueCard, pressed && styles.actionPressed]}
                  >
                    <Text style={styles.leagueName}>{item.name ?? "Untitled league"}</Text>
                    {item.activity ? <Text style={styles.leagueActivity}>{item.activity}</Text> : null}
                    {item.my_payment_status === "unpaid" && item.plan_tier ? (
                      <Text style={styles.leagueMeta}>Payment required before you can participate.</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 20,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: "white",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 23,
    color: "#A7B0BC",
  },
  headerGhostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginTop: 6,
  },
  headerGhostText: {
    color: "#C8D0DB",
    fontSize: 15,
    fontWeight: "500",
  },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    backgroundColor: "#2A0E0E",
  },
  errorText: {
    color: "#FCA5A5",
    lineHeight: 20,
  },
  actionStack: {
    marginTop: 24,
    gap: 12,
  },
  actionCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#162131",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  backBtnText: {
    color: "#C8D0DB",
    fontSize: 15,
    fontWeight: "700",
  },
  actionPressed: {
    opacity: 0.92,
  },
  actionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  actionSubtitle: {
    color: "#A7B0BC",
    fontSize: 14,
    lineHeight: 20,
  },
  selectedPlanWrap: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  selectedPlanLabel: {
    color: "rgba(237,231,255,0.48)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  selectedPlanTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  selectedPlanMessage: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedPlanMeta: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 18,
  },
  selectedPlanMetaHighlight: {
    color: "#FCD34D",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  createCard: {
    marginTop: 12,
    borderRadius: 22,
    padding: 16,
    gap: 14,
    backgroundColor: "#101826",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  createEyebrow: {
    color: "rgba(237,231,255,0.48)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  createTitle: {
    marginTop: 4,
    color: "white",
    fontSize: 22,
    fontWeight: "800",
  },
  createHelper: {
    marginTop: 6,
    color: "#8FA1B7",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  planChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.34)",
    backgroundColor: "rgba(162,89,255,0.12)",
  },
  planChipText: {
    color: "#EDE7FF",
    fontSize: 13,
    fontWeight: "700",
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldLabel: {
    color: "#A7B0BC",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  fieldCount: {
    color: "rgba(237,231,255,0.48)",
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    color: "white",
    fontSize: 16,
  },
  createBtn: {
    marginTop: 2,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "rgba(162,89,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.4)",
    alignItems: "center",
  },
  createBtnPressed: {
    backgroundColor: "rgba(162,89,255,0.24)",
  },
  createBtnDisabled: {
    opacity: 0.55,
  },
  createBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  cancelInlineBtn: {
    paddingVertical: 4,
  },
  cancelInlineText: {
    color: "#A7B0BC",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
  },
  listWrap: {
    marginTop: 18,
  },
  loadingState: {
    marginTop: 24,
    alignItems: "center",
  },
  emptyCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    backgroundColor: "rgba(16,24,38,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  emptyTitle: {
    color: "rgba(237,231,255,0.88)",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: "rgba(167,176,188,0.88)",
    fontSize: 14,
    lineHeight: 21,
  },
  emptyRefreshBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  emptyRefreshText: {
    color: "rgba(237,231,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listHeaderText: {
    color: "rgba(237,231,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  inlineRefreshBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  inlineRefreshText: {
    color: "#A7B0BC",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    gap: 12,
    paddingBottom: 16,
  },
  leagueCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  leagueName: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  leagueActivity: {
    marginTop: 6,
    color: "#A7B0BC",
    fontSize: 14,
  },
  leagueMeta: {
    marginTop: 6,
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "600",
  },
});
