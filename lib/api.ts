const BASE_URL = "https://whisperbox.koyeb.app";

export async function register(userData: any) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData), // { username, display_name, password, public_key, wrapped_private_key, pbkdf2_salt }
  });
  if (!response.ok) throw new Error("Registration failed");
  return response.json();
}

export async function login(credentials: any) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials), // { username, password }
  });
  if (!response.ok) throw new Error("Login failed");
  return response.json(); // Returns AuthResponse with tokens and user profile
}

export async function searchUser(token: string, username: string) {
  const response = await fetch(`${BASE_URL}/users/search?q=${username}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getPublicKey(token: string, userId: string) {
  const response = await fetch(`${BASE_URL}/users/${userId}/public-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function sendMessageFallback(token: string, payload: any) {
  const response = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(payload), // The EncryptedPayload schema
  });
  if (!response.ok) throw new Error("Failed to send message");
  return response.json();
}