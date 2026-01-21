import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { createLeague, getMyLeagues, type League } from "../../features/leagues/api";
import { supabase } from "../../lib/supabase";

type PlanTier = "A" | "B" | "C";

const getMonthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function normalizeErr(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  return e?.message || e?.error_description || e?.hint || JSON.stringify(e);
}

export default function LeaguesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const planTierFromParams = useMemo(() => {
    const v = params.planTier;
    if (v === "A" || v === "B" || v === "C") return v as PlanTier;
    return null;
  }, [params.planTier]);

  const isFreeFromParams = useMemo(() => {
    const v = params.isFree;
    return v === "1";
  }, [params.isFree]);

  const lastConsumedSelection = useRef<string | null>(null);

  const [selectedPlanTier, setSelectedPlanTier] = useState<PlanTier | null>(null);
  const [isFreeSelected, setIsFreeSelected] = useState<boolean>(false);

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
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const u = data.user;
    if (!u) throw new Error("Not authenticated");
    setUserId(u.id);
    return u.id;
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

      if (!isFreeSelected) {
        router.push({
          pathname: "/(app)/paywall",
          params: { reason: "paid_not_available" },
        });
        return;
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
          isFree: true,
          planTier: null,
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
      router.push(`/league/${league.id}`);
    } catch (e: any) {
      const msg = normalizeErr(e);
      console.log("Create league error:", e);

      if (msg.toLowerCase().includes("free league already used")) {
        router.push({
          pathname: "/(app)/paywall",
          params: {
            reason: "free_used",
            monthKey: getMonthKey(),
          },
        });
        return;
      }

      if (msg.toLowerCase().includes("payment required")) {
        router.push({
          pathname: "/(app)/paywall",
          params: { reason: "paid_not_available" },
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
  router.replace("/(auth)/sign-in"); // ✅ correct
}


  function onStartCreate() {
    setError(null);
    router.push("/league/choose-plan");
  }

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>Leagues</Text>

        <Pressable onPress={onSignOut} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: "#A7B0BC" }}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>
        Create or join a league.
      </Text>


      {error ? (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#7F1D1D",
            backgroundColor: "#2A0E0E",
          }}
        >
          <Text style={{ color: "#FCA5A5" }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 24, gap: 12 }}>
        <Pressable
          onPress={onStartCreate}
          style={{ padding: 16, borderRadius: 14, backgroundColor: "#1A2430" }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            + Create league
          </Text>
        </Pressable>

        {showCreate ? (
          <View style={{ gap: 10, padding: 14, borderRadius: 14, backgroundColor: "#111827" }}>
            <Text style={{ color: "#A7B0BC" }}>
              Selected plan:{" "}
              <Text style={{ color: "white", fontWeight: "800" }}>
                {isFreeSelected ? "FREE" : (selectedPlanTier ?? "—")}
              </Text>
            </Text>

            <Text style={{ color: "#A7B0BC" }}>League name</Text>
            <TextInput
              value={newName}
              onChangeText={(t) => {
                setNewName(t);
                if (error) setError(null);
              }}
              placeholder="e.g. January Push"
              placeholderTextColor="#6B7280"
              autoCapitalize="sentences"
              style={{
                borderWidth: 1,
                borderColor: "#1F2937",
                padding: 12,
                borderRadius: 12,
                color: "white",
              }}
            />

            <Text style={{ color: "#A7B0BC", marginTop: 6 }}>
              Activity (max 40 chars) — {newActivity.length}/40
            </Text>
            <TextInput
              value={newActivity}
              onChangeText={(t) => {
                setNewActivity(t.slice(0, 40));
                if (error) setError(null);
              }}
              placeholder="e.g. Gym / Run / Reading"
              placeholderTextColor="#6B7280"
              autoCapitalize="sentences"
              style={{
                borderWidth: 1,
                borderColor: "#1F2937",
                padding: 12,
                borderRadius: 12,
                color: "white",
              }}
            />

            <Pressable
              onPress={onCreate}
              disabled={!canSubmit}
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: !canSubmit ? "#0F172A" : "#1A2430",
                borderWidth: 1,
                borderColor: "#1F2937",
                opacity: !canSubmit ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
                {creating ? "Creating..." : "Create"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCreate(false);
                setSelectedPlanTier(null);
                setIsFreeSelected(false);
                setNewName("");
                setNewActivity("");
                setError(null);
              }}
            >
              <Text style={{ color: "#A7B0BC", textAlign: "center" }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {/* FIXED: points to app/(app)/league/join.tsx */}
        <Link href="/league/join" asChild>
          <Pressable style={{ padding: 16, borderRadius: 14, backgroundColor: "#1A2430" }}>
            <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
              🔑 Join with code
            </Text>
          </Pressable>
        </Link>

        <Pressable onPress={load}>
          <Text style={{ color: "#A7B0BC" }}>Refresh</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 18, flex: 1 }}>
        {loading ? (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator />
          </View>
        ) : leagues.length === 0 ? (
          <Text style={{ color: "#A7B0BC" }}>No leagues yet. Create one or join.</Text>
        ) : (
          <FlatList
            data={leagues}
            keyExtractor={(l) => l.id}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/league/${item.id}`)}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: "#111827",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                }}
              >
                <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
                  {item.name ?? "Untitled league"}
                </Text>

                {item.activity ? (
                  <Text style={{ marginTop: 6, color: "#A7B0BC" }}>
                    {item.activity}
                  </Text>
                ) : null}

                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  {item.is_free ? (
                    <View
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: "#0B3B2E",
                        borderWidth: 1,
                        borderColor: "#14532D",
                      }}
                    >
                      <Text style={{ color: "#86EFAC", fontWeight: "700", fontSize: 12 }}>
                        FREE
                      </Text>
                    </View>
                  ) : null}

                  {item.status === "payment_required" ? (
                    <View
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: "#2A0E0E",
                        borderWidth: 1,
                        borderColor: "#7F1D1D",
                      }}
                    >
                      <Text style={{ color: "#FCA5A5", fontWeight: "700", fontSize: 12 }}>
                        Payment required
                      </Text>
                    </View>
                  ) : null}
                </View>

                {item.created_at ? (
                  <Text style={{ marginTop: 6, color: "#A7B0BC" }}>
                    Created: {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}
