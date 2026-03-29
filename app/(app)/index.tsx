import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ensureProfileForCurrentUser } from "../../features/auth/profile";
import { createLeague, getMyLeagues, type League } from "../../features/leagues/api";
import { supabase } from "../../lib/supabase";

type PlanTier = "A" | "B" | "C";
type UserTier = "free" | "A" | "B" | "C";

const getMonthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function normalizeErr(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  return e?.message || e?.error_description || e?.hint || JSON.stringify(e);
}

function planLabel(isFreeSelected: boolean, selectedPlanTier: PlanTier | null) {
  if (isFreeSelected) return "Free";
  if (selectedPlanTier === "A") return "Plus";
  if (selectedPlanTier === "B") return "Circle";
  if (selectedPlanTier === "C") return "Team";
  return "Choose a plan";
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

  async function resolveUser() {
    const u = await ensureProfileForCurrentUser();
    if (!u) throw new Error("Not authenticated");
    setUserId(u.id);
    return u.id;
  }

  async function getMyTier(uid: string): Promise<UserTier> {
    const { data, error, status } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", uid)
      .single();

    if (error && status !== 406) throw error;
    const t = (data?.plan_tier ?? "free") as UserTier;
    return t || "free";
  }

  async function load() {
    try {
      setError(null);
      setLoading(true);

      const uid = userId ?? (await resolveUser());
      const data = await getMyLeagues(uid);
      setLeagues(data);
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
        throw new Error("Please choose a plan first");
      }

      const uid = userId ?? (await resolveUser());

      if (!isFreeSelected) {
        const myTier = await getMyTier(uid);
        if (myTier === "free") {
          router.push({
            pathname: "/(app)/paywall",
            params: { reason: "upgrade_required", next: "/(app)" },
          });
          return;
        }
      }

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
      router.push(`/(app)/league/${league.id}`);
    } catch (e: any) {
      const msg = normalizeErr(e);
      if (msg.toLowerCase().includes("payment required")) {
        router.push({
          pathname: "/(app)/paywall",
          params: { reason: "upgrade_required", next: "/(app)" },
        });
        return;
      }
      setError(msg);
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
    router.push({ pathname: "/league/choose-plan", params: { source: "create" } });
  }

  function resetCreate() {
    setShowCreate(false);
    setSelectedPlanTier(null);
    setIsFreeSelected(false);
    setNewName("");
    setNewActivity("");
    setError(null);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.screen}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Leagues</Text>
          <Text style={styles.subtitle}>Create or join a league.</Text>
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
        <Pressable onPress={onStartCreate} style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}>
          <Text style={styles.actionTitle}>{showCreate ? "Change plan" : "+ Create a league"}</Text>
          <Text style={styles.actionSubtitle}>
            {showCreate ? "Pick a different plan before creating." : "Start a new accountability group."}
          </Text>
        </Pressable>

        {!showCreate ? (
          <Pressable
            onPress={() => router.push("/(app)/league/join")}
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionTitle}>Join with code</Text>
            <Text style={styles.actionSubtitle}>Jump into an existing league in seconds.</Text>
          </Pressable>
        ) : null}
      </View>

      {showCreate ? (
        <View style={styles.createCard}>
          <View style={styles.createHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.createEyebrow}>CREATE A LEAGUE</Text>
              <Text style={styles.createTitle}>Name your league</Text>
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
              <Text style={styles.fieldLabel}>Activity</Text>
              <Text style={styles.fieldCount}>{newActivity.length}/40</Text>
            </View>
            <TextInput
              value={newActivity}
              onChangeText={(t) => {
                setNewActivity(t.slice(0, 40));
                if (error) setError(null);
              }}
              placeholder="e.g. Gym, walking, reading"
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

            <FlatList
              data={leagues}
              keyExtractor={(l) => l.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/(app)/league/${item.id}`)}
                  style={({ pressed }) => [
                    styles.leagueCard,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <Text style={styles.leagueName}>{item.name ?? "Untitled league"}</Text>
                  {item.activity ? <Text style={styles.leagueActivity}>{item.activity}</Text> : null}
                </Pressable>
              )}
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 20,
    backgroundColor: "#0B0F14",
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
  createCard: {
    marginTop: 14,
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
  },
  fieldLabel: {
    color: "#A7B0BC",
    fontSize: 14,
    fontWeight: "600",
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
    flex: 1,
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
});
