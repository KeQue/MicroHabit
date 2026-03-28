import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "microhabit.auth.";

function secureKey(key: string) {
  return `${KEY_PREFIX}${key}`;
}

export const authStorage = {
  async getItem(key: string) {
    return AsyncStorage.getItem(secureKey(key));
  },

  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(secureKey(key), value);
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(secureKey(key)).catch(() => undefined);
  },
};
