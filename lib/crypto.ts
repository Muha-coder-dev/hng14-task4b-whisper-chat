// lib/crypto.ts

/**
 * Derives a strong AES-GCM key from a user-provided password and salt.
 * Uses PBKDF2 with 100,000 iterations for high security.
 */
export async function deriveKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  
  // 1. Import the raw password as a "key material"
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // 2. Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    } as any, // Bypass TS overload mismatch for salt/BufferSource
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string using AES-GCM.
 * Returns the ciphertext and the IV (Initialization Vector) as Base64 strings.
 */
export async function encryptMessage(text: string, key: CryptoKey) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM standard IV length
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(text)
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypts a Base64 ciphertext using AES-GCM and a derived key.
 */
export async function decryptMessage(ciphertext: string, iv: string, key: CryptoKey) {
  const enc = new TextDecoder();
  
  // Convert Base64 strings back to Uint8Arrays
  const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const ivArr = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivArr },
    key,
    data
  );

  return enc.decode(decrypted);
}