import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function LeaguesScreen() {
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        paddingTop: 70,
        backgroundColor: "#0B0F14",
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>
        Leagues
      </Text>

      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>
        Create or join a league. (UI only for now)
      </Text>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Pressable
          onPress={() => router.push("/league/alpha")}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: "#1A2430",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            + Create league
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/join")}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: "#1A2430",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            🔗 Join with invite link
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
