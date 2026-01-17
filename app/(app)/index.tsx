import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

export default function LeaguesScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
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
      setError(e?.message ?? "Failed to load leagues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    try {
      setError(null);
      setCreating(true);

      const league = await createLeague(newName, newActivity);

      setNewName("");
      setNewActivity("");
      setShowCreate(false);

      await load();
      router.push(`/league/${league.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league");
    } finally {
      setCreating(false);
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    // if your auth routing is correct, this should redirect automatically
    router.replace("/sign-in");
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

      {/* Actions */}
      <View style={{ marginTop: 24, gap: 12 }}>
        <Pressable
          onPress={() => setShowCreate((v) => !v)}
          style={{ padding: 16, borderRadius: 14, backgroundColor: "#1A2430" }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            + Create league
          </Text>
        </Pressable>

        {showCreate ? (
          <View style={{ gap: 10, padding: 14, borderRadius: 14, backgroundColor: "#111827" }}>
            <Text style={{ color: "#A7B0BC" }}>League name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
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
              onChangeText={(t) => setNewActivity(t.slice(0, 40))}
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
              disabled={creating}
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: creating ? "#0F172A" : "#1A2430",
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
                {creating ? "Creating..." : "Create"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCreate(false);
                setNewName("");
                setNewActivity("");
              }}
            >
              <Text style={{ color: "#A7B0BC", textAlign: "center" }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/join")}
          style={{ padding: 16, borderRadius: 14, backgroundColor: "#1A2430" }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            🔗 Join with invite link
          </Text>
        </Pressable>

        <Pressable onPress={load}>
          <Text style={{ color: "#A7B0BC" }}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ marginTop: 12, color: "tomato" }}>{error}</Text> : null}

      {/* Data */}
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
