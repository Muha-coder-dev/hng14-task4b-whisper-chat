// --- 1. KEY GENERATION & WRAPPING (Registration/Login) ---

export async function generateRSAKeyPair() {
  return await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"]
  );
}

// Derives a strong AES-GCM key from a password and salt using PBKDF2
export async function deriveWrappingKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  // Swapped AES-KW for AES-GCM to bypass the 8-byte length bug
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"] 
  );
}

// Wraps the RSA private key safely using AES-GCM 
export async function wrapPrivateKey(privateKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  // 1. Export the private key to raw bytes
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  
  // 2. Encrypt with AES-GCM, which has no strict length requirements
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, wrappingKey, exported);
  
  // 3. Combine IV + Ciphertext so the backend can store it in the single string field
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// --- 2. MESSAGE ENCRYPTION (Sending a message) ---

export async function createEncryptedPayload(text: string, recipientPubKeyBase64: string, senderPubKeyBase64: string) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Generate random AES-GCM key for this specific message
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  
  // Encrypt the actual message text
  const encryptedText = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, enc.encode(text));
  
  // Helper to import base64 public keys
  const importKey = async (base64: string) => {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return await crypto.subtle.importKey("spki", binary, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  };

  const recipientPubKey = await importKey(recipientPubKeyBase64);
  const senderPubKey = await importKey(senderPubKeyBase64);

  // Export AES key to raw bytes so we can wrap it with RSA
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

  // The "Double Lock"
  const encryptedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPubKey, rawAesKey);
  const encryptedKeyForSelf = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, senderPubKey, rawAesKey);

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedText))),
    iv: btoa(String.fromCharCode(...iv)),
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
    encryptedKeyForSelf: btoa(String.fromCharCode(...new Uint8Array(encryptedKeyForSelf)))
  };
}