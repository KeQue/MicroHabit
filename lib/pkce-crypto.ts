type PkceCrypto = {
  getRandomValues?: (array: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;
  subtle?: { digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer> };
};

// Supply only the WebCrypto methods Supabase PKCE needs on native Hermes.
// Existing browser/runtime implementations are preserved. Hashing and random
// generation are delegated to Expo's native APIs, never implemented here.
export function supplyPkceCrypto(
  target: PkceCrypto,
  randomValues: (array: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>,
  sha256: (data: BufferSource) => Promise<ArrayBuffer>,
) {
  if (!target.getRandomValues) target.getRandomValues = randomValues;
  if (!target.subtle) target.subtle = {
    digest: async (algorithm, data) => {
      if (algorithm !== "SHA-256") throw new Error("Unsupported PKCE digest.");
      return sha256(data);
    },
  };
}
