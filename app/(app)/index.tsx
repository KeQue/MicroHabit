import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../features/auth/useAuth";
import { createLeague, getMyLeagues, type League } from "../../features/leagues/api";

export default function LeaguesScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const canCreate = useMemo(() => {
    return !creating && newName.trim().length > 0;
  }, [creating, newName]);

  async function load() {
    if (!user?.id) return;

    try {
      setError(null);
      setLoading(true);
      const data = await getMyLeagues(user.id);
      setLeagues(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load leagues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Wait for auth to resolve
    if (initializing) return;
    if (!user?.id) return;

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing, user?.id]);

  async function onCreate() {
    if (!newName.trim()) {
      setError("League name is required");
      return;
    }

    try {
      setError(null);
      setCreating(true);

      const league = await createLeague(newName);

      setNewName("");
      setShowCreate(false);

      // Update UI immediately (no extra network call needed)
      setLeagues((prev) => [league, ...prev]);

      router.push(`/league/${league.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league");
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>Leagues</Text>

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
              editable={!creating}
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
              disabled={!canCreate}
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: canCreate ? "#1A2430" : "#0F172A",
                borderWidth: 1,
                borderColor: "#1F2937",
                opacity: canCreate ? 1 : 0.6,
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
              }}
              disabled={creating}
            >
              <Text style={{ color: "#A7B0BC", textAlign: "center" }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/league/join")}
          style={{ padding: 16, borderRadius: 14, backgroundColor: "#1A2430" }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            🔗 Join with invite link
          </Text>
        </Pressable>

        <Pressable onPress={load} disabled={loading || creating || !user?.id}>
          <Text style={{ color: "#A7B0BC" }}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ marginTop: 12, color: "tomato" }}>{error}</Text> : null}

      {/* Data */}
      <View style={{ marginTop: 18, flex: 1 }}>
        {initializing ? (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator />
          </View>
        ) : loading ? (
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
