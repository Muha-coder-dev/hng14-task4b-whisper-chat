// --- HELPER TO GET BROWSER CRYPTO safely ---
const getSubtle = () => {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }
  return window.crypto.subtle;
};

// --- 1. KEY GENERATION & WRAPPING (Registration/Login) ---

export async function generateRSAKeyPair() {
  const subtle = getSubtle();
  return await subtle.generateKey(
    { 
      name: "RSA-OAEP", 
      modulusLength: 2048, 
      publicExponent: new Uint8Array([1, 0, 1]), 
      hash: "SHA-256" 
    },
    true, 
    ["encrypt", "decrypt"]
  );
}

export async function deriveWrappingKey(password: string, salt: Uint8Array) {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw", 
    enc.encode(password), 
    { name: "PBKDF2" }, 
    false, 
    ["deriveBits", "deriveKey"]
  );

  return await subtle.deriveKey(
    { 
      name: "PBKDF2", 
      salt: salt as BufferSource, 
      iterations: 100000, 
      hash: "SHA-256" 
    },
    keyMaterial, 
    { name: "AES-GCM", length: 256 }, 
    true, 
    ["encrypt", "decrypt"] 
  );
}

export async function wrapPrivateKey(privateKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const subtle = getSubtle();
  const exported = await subtle.exportKey("pkcs8", privateKey);
  
  // Need to safely access getRandomValues from window.crypto
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
  
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv: iv }, wrappingKey, exported);
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function unwrapPrivateKey(wrappedKeyBase64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const subtle = getSubtle();
  const combined = Uint8Array.from(atob(wrappedKeyBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await subtle.decrypt({ name: "AES-GCM", iv: iv }, wrappingKey, ciphertext);
  
  return await subtle.importKey(
    "pkcs8", 
    decrypted, 
    { name: "RSA-OAEP", hash: "SHA-256" }, 
    true, 
    ["decrypt"]
  );
}

// --- 2. MESSAGE ENCRYPTION & DECRYPTION ---

export async function createEncryptedPayload(text: string, recipientPubKeyBase64: string, senderPubKeyBase64: string) {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
  
  const aesKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const encryptedText = await subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, enc.encode(text));
  
  const importKey = async (base64: string) => {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return await subtle.importKey("spki", binary, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  };

  const recipientPubKey = await importKey(recipientPubKeyBase64);
  const senderPubKey = await importKey(senderPubKeyBase64);

  const rawAesKey = await subtle.exportKey("raw", aesKey);

  const encryptedKey = await subtle.encrypt({ name: "RSA-OAEP" }, recipientPubKey, rawAesKey);
  const encryptedKeyForSelf = await subtle.encrypt({ name: "RSA-OAEP" }, senderPubKey, rawAesKey);

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedText))),
    iv: btoa(String.fromCharCode(...iv)),
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
    encryptedKeyForSelf: btoa(String.fromCharCode(...new Uint8Array(encryptedKeyForSelf)))
  };
}

export async function decryptPayload(payload: any, privateKey: CryptoKey): Promise<string> {
  const subtle = getSubtle();
  const { ciphertext, iv, encryptedKey, encryptedKeyForSelf } = payload;
  
  const keyToUse = encryptedKey || encryptedKeyForSelf;
  const encryptedKeyBinary = Uint8Array.from(atob(keyToUse), c => c.charCodeAt(0));
  
  const rawAesKey = await subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedKeyBinary);
  const aesKey = await subtle.importKey("raw", rawAesKey, { name: "AES-GCM" }, false, ["decrypt"]);
  
  const ivBinary = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const ciphertextBinary = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  const decrypted = await subtle.decrypt({ name: "AES-GCM", iv: ivBinary }, aesKey, ciphertextBinary);
  
  return new TextDecoder().decode(decrypted);
}