import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_PREFIX = "microhabit.auth.";

async function canUseSecureStore() {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

function secureKey(key: string) {
  return `${KEY_PREFIX}${key}`;
}

export const authStorage = {
  async getItem(key: string) {
    const namespacedKey = secureKey(key);
    if (await canUseSecureStore()) {
      try {
        const value = await SecureStore.getItemAsync(namespacedKey);
        if (value != null) return value;
      } catch {
        // Fall back to AsyncStorage instead of failing app startup if the secure store
        // is unavailable or the keychain entry cannot be read on a specific device.
      }
    }
    return AsyncStorage.getItem(namespacedKey);
  },

  async setItem(key: string, value: string) {
    const namespacedKey = secureKey(key);
    if (await canUseSecureStore()) {
      try {
        await SecureStore.setItemAsync(namespacedKey, value);
        await AsyncStorage.removeItem(namespacedKey).catch(() => undefined);
        return;
      } catch {
        // Fall through to AsyncStorage if writing to the secure store fails.
      }
    }
    await AsyncStorage.setItem(namespacedKey, value);
  },

  async removeItem(key: string) {
    const namespacedKey = secureKey(key);
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(namespacedKey).catch(() => undefined);
    }
    await AsyncStorage.removeItem(namespacedKey).catch(() => undefined);
  },
};
