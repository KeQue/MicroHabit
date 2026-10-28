import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { supplyPkceCrypto } from "./pkce-crypto";

if (Platform.OS !== "web") {
  if (typeof TextEncoder === "undefined") throw new Error("Secure sign-in requires TextEncoder support.");
  if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true });
  supplyPkceCrypto(globalThis.crypto,
    (array) => Crypto.getRandomValues(array),
    (data) => Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data));
}
