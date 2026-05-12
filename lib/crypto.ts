// --- HELPERS ---

const getSubtle = () => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  return window.crypto.subtle;
};

/** Safe wrapper around getRandomValues that also guards for SSR */
const getRandomBytes = (length: number): Uint8Array => {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  return window.crypto.getRandomValues(new Uint8Array(length));
};

// --- TYPES ---

export interface EncryptedPayload {
  ciphertext: string;       // Base64 AES-GCM ciphertext
  iv: string;               // Base64 12-byte IV
  encryptedKey: string;     // Base64 AES key encrypted with recipient's RSA public key
  encryptedKeyForSelf: string; // Base64 AES key encrypted with sender's own RSA public key
}

// --- 1. KEY GENERATION & WRAPPING (Registration / Login) ---

export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  const subtle = getSubtle();
  return subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives an AES-GCM key from the user's password + salt via PBKDF2.
 * This key is used to wrap (encrypt) the RSA private key before storage.
 */
export async function deriveWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtle();
  const enc = new TextEncoder();

  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts (wraps) the RSA private key using the AES-GCM wrapping key.
 * The 12-byte IV is prepended to the ciphertext and the whole thing is Base64-encoded.
 */
export async function wrapPrivateKey(privateKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const subtle = getSubtle();
  const exported = await subtle.exportKey('pkcs8', privateKey);
  const iv = getRandomBytes(12) as Uint8Array<ArrayBuffer>;
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, exported);

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts (unwraps) the Base64-encoded wrapped private key back into a CryptoKey
 * that can be used for RSA-OAEP decryption.
 */
export async function unwrapPrivateKey(wrappedKeyBase64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const subtle = getSubtle();
  const combined = Uint8Array.from(atob(wrappedKeyBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext);

  return subtle.importKey(
    'pkcs8',
    decrypted,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

// --- 2. MESSAGE ENCRYPTION & DECRYPTION ---

/**
 * Creates a fully encrypted E2EE payload.
 * - AES-GCM encrypts the plaintext.
 * - The AES key is RSA-OAEP encrypted twice:
 *     - once for the recipient (encryptedKey)
 *     - once for the sender themselves (encryptedKeyForSelf)
 */
export async function createEncryptedPayload(
  text: string,
  recipientPubKeyBase64: string,
  senderPubKeyBase64: string
): Promise<EncryptedPayload> {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const iv = getRandomBytes(12) as Uint8Array<ArrayBuffer>;

  // 1. Generate a fresh, single-use AES-GCM key
  const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

  // 2. Encrypt the plaintext
  const encryptedText = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(text));

  // 3. Import both RSA public keys
  const importRsaKey = async (base64: string): Promise<CryptoKey> => {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return subtle.importKey('spki', binary, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  };

  const [recipientPubKey, senderPubKey] = await Promise.all([
    importRsaKey(recipientPubKeyBase64),
    importRsaKey(senderPubKeyBase64),
  ]);

  // 4. Export raw AES key and encrypt it for both parties ("double lock")
  const rawAesKey = await subtle.exportKey('raw', aesKey);
  const [encryptedKey, encryptedKeyForSelf] = await Promise.all([
    subtle.encrypt({ name: 'RSA-OAEP' }, recipientPubKey, rawAesKey),
    subtle.encrypt({ name: 'RSA-OAEP' }, senderPubKey, rawAesKey),
  ]);

  const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  return {
    ciphertext: toBase64(encryptedText),
    iv: btoa(String.fromCharCode(...iv)),
    encryptedKey: toBase64(encryptedKey),
    encryptedKeyForSelf: toBase64(encryptedKeyForSelf),
  };
}

/**
 * Decrypts an E2EE payload using the local private key.
 *
 * @param payload    - The EncryptedPayload object from the server
 * @param privateKey - The in-memory RSA private key (never persisted in plaintext)
 * @param isSender   - true if the current user sent this message (uses encryptedKeyForSelf)
 *                     false if the current user received this message (uses encryptedKey)
 */
export async function decryptPayload(
  payload: EncryptedPayload,
  privateKey: CryptoKey,
  isSender: boolean
): Promise<string> {
  const subtle = getSubtle();
  const { ciphertext, iv, encryptedKey, encryptedKeyForSelf } = payload;

  // Critical fix: pick the correct encrypted AES key based on who is reading
  const keyToDecrypt = isSender ? encryptedKeyForSelf : encryptedKey;
  if (!keyToDecrypt) {
    throw new Error(`Missing encrypted key field for ${isSender ? 'sender' : 'recipient'}`);
  }

  const encryptedKeyBinary = Uint8Array.from(atob(keyToDecrypt), c => c.charCodeAt(0));
  const rawAesKey = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedKeyBinary);

  const aesKey = await subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']);

  const ivBinary = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const ciphertextBinary = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv: ivBinary }, aesKey, ciphertextBinary);

  return new TextDecoder().decode(decrypted);
}