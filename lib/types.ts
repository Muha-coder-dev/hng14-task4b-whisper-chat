// ─── UI / App State ─────────────────────────────────────────────────

export interface ActiveChat {
  id: string;
  username: string;
  publicKey: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  isSender: boolean;
  ciphertextPreview: string;
  timestamp: string;
}

export interface SessionState {
  accessToken: string;
  publicKeyStr: string;
  privateKey: CryptoKey;
  userId: string;
  username: string;
}

export interface RecentChat {
  id: string;
  username: string;
  publicKey: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

// ─── API Shapes ──────────────────────────────────────────────────────

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    public_key: string;
    wrapped_private_key: string;
    pbkdf2_salt: string;
  };
}

export interface PublicKeyResponse {
  public_key: string;
}

export interface EncryptedMessagePayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  payload: EncryptedMessagePayload;
  created_at: string;
}
