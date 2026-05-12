/**
 * api.ts — All API calls go through /api/proxy/* (Next.js Route Handler).
 * This ensures CORS is never a problem and the Koyeb base URL stays server-side.
 */

import type {
  AuthResponse,
  UserSearchResult,
  PublicKeyResponse,
  Message,
  EncryptedMessagePayload,
} from './types';

// Re-export types so callers can import from either location
export type {
  AuthResponse,
  UserSearchResult,
  PublicKeyResponse,
  Message,
  EncryptedMessagePayload,
};

const PROXY = '/api/proxy';

// --- AUTH ---

export async function register(userData: {
  username: string;
  display_name: string;
  password: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${PROXY}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string })?.detail ?? 'Registration failed');
  }
  return res.json();
}

export async function login(credentials: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${PROXY}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string })?.detail ?? 'Invalid username or password');
  }
  return res.json();
}

// --- USERS ---

export async function searchUsers(
  token: string,
  query: string
): Promise<UserSearchResult[]> {
  const res = await fetch(`${PROXY}/users/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getUserPublicKey(
  token: string,
  userId: string
): Promise<PublicKeyResponse> {
  const res = await fetch(`${PROXY}/users/${userId}/public-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch public key');
  return res.json();
}

// --- MESSAGES ---

export async function getConversationMessages(
  token: string,
  userId: string
): Promise<Message[]> {
  const res = await fetch(`${PROXY}/conversations/${userId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function sendMessage(
  token: string,
  recipientId: string,
  payload: EncryptedMessagePayload
): Promise<Message> {
  const res = await fetch(`${PROXY}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: recipientId, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string })?.detail ?? 'Failed to send message');
  }
  return res.json();
}