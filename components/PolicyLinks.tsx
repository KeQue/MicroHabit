import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

export const POLICY_PAGES = [
  { label: "Privacy policy", url: "https://keque.github.io/MicroHabit/privacy/" },
  { label: "Support", url: "https://keque.github.io/MicroHabit/support/" },
] as const;

export async function openPolicyPage(label: string, url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`Could not open ${label.toLowerCase()}`, `Please try again, or open this address in your browser:\n${url}`);
  }
}

export function PolicyLinks() {
  return (
    <View style={styles.links}>
      {POLICY_PAGES.map(({ label, url }) => (
        <Pressable
          key={url}
          accessibilityRole="link"
          accessibilityLabel={label}
          accessibilityHint="Opens in your browser"
          onPress={() => void openPolicyPage(label, url)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.text}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 10 },
  text: { color: "#D8C0FF", fontSize: 14, textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
});
