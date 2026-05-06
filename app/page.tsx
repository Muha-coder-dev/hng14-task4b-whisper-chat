"use client";
import { useState } from "react";
// Make sure you have created these files from our previous steps!
import { register, login, searchUser, getPublicKey, sendMessageFallback } from "../lib/api";
import { generateRSAKeyPair, deriveWrappingKey, wrapPrivateKey, createEncryptedPayload } from "../lib/crypto";

export default function WhisperChat() {
  const [view, setView] = useState<"auth" | "chat">("auth");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Chat State
  const [token, setToken] = useState("");
  const [myPublicKey, setMyPublicKey] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<{ sender: string; text: string }[]>([]);

  // --- 1. AUTHENTICATION (Register & Wrap Keys) ---
  const handleAuth = async () => {
    if (!username || !password) return alert("Enter username and password!");

    try {
      // 1. Generate new RSA keys for the user
      const rsaKeys = await generateRSAKeyPair();
      
      // Export public key to send to server
      const exportedPubKey = await crypto.subtle.exportKey("spki", rsaKeys.publicKey);
      const pubKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPubKey)));

      // 2. Generate a random salt & derive AES wrapping key from the password
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = btoa(String.fromCharCode(...salt));
      const wrappingKey = await deriveWrappingKey(password, salt);

      // 3. Wrap the private key so the server can't read it
      const wrappedPrivateKey = await wrapPrivateKey(rsaKeys.privateKey, wrappingKey);

      // 4. Register with Koyeb API
      const authData = {
        username: username,
        display_name: username,
        password: password, // Server hashes this
        public_key: pubKeyBase64,
        wrapped_private_key: wrappedPrivateKey,
        pbkdf2_salt: saltBase64,
      };

      const response = await register(authData);
      
      // Auto-login after registration to get the JWT token
      const loginRes = await login({ username, password });
      setToken(loginRes.access_token);
      setMyPublicKey(pubKeyBase64);
      setView("chat");

    } catch (error) {
      console.error(error);
      alert("Auth failed. Try a different username!");
    }
  };

  // --- 2. ENCRYPT & SEND MESSAGE ---
  const handleSend = async () => {
    if (!recipient || !message) return alert("Enter recipient username and message!");

    try {
      // 1. Find the user
      const users = await searchUser(token, recipient);
      if (!users.length) return alert("User not found!");
      const recipientId = users[0].id;

      // 2. Fetch their Public Key
      const { public_key: recipientPubKeyBase64 } = await getPublicKey(token, recipientId);

      // 3. Create the "Double Locked" payload (Hybrid Encryption)
      const payload = await createEncryptedPayload(message, recipientPubKeyBase64, myPublicKey);
      console.log("Secure Payload going to server:", payload);

      // 4. Send to server fallback
      await sendMessageFallback(token, {
        conversation_id: recipientId, // Simplified for this demo
        ...payload
      });

      setChatLog([...chatLog, { sender: "You", text: message }]);
      setMessage("");
    } catch (error) {
      console.error(error);
      alert("Failed to send message securely.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 text-yellow-400">WhisperBox</h1>
      
      <div className="w-full max-w-md bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700">
        
        {view === "auth" ? (
          // --- AUTH UI ---
          <div className="flex flex-col gap-4">
            <h2 className="text-xl mb-2">Create Secure Identity</h2>
            <input 
              type="text" placeholder="Username" 
              className="p-2 rounded bg-slate-900 border border-slate-600 outline-none focus:border-yellow-400"
              value={username} onChange={(e) => setUsername(e.target.value)}
            />
            <input 
              type="password" placeholder="Master Password" 
              className="p-2 rounded bg-slate-900 border border-slate-600 outline-none focus:border-yellow-400"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleAuth} className="bg-yellow-400 text-slate-900 px-4 py-2 rounded font-bold hover:bg-yellow-500 mt-2">
              Generate Keys & Enter
            </button>
          </div>
        ) : (
          // --- CHAT UI ---
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl">Encrypted Comms</h2>
              <span className="text-xs text-green-400">🟢 Connected</span>
            </div>
            
            <input 
              type="text" placeholder="Recipient's Exact Username..." 
              className="p-2 rounded bg-slate-900 border border-slate-600 outline-none text-yellow-400"
              value={recipient} onChange={(e) => setRecipient(e.target.value)}
            />
            
            <div className="h-64 overflow-y-auto p-4 bg-slate-900 rounded border border-slate-700">
              {chatLog.map((msg, i) => (
                <p key={i} className="mb-2"><span className="text-yellow-400 font-bold">{msg.sender}:</span> {msg.text}</p>
              ))}
            </div>

            <div className="flex gap-2">
              <input 
                type="text" placeholder="Type a secure message..." 
                className="flex-1 p-2 rounded bg-slate-900 border border-slate-600 outline-none"
                value={message} onChange={(e) => setMessage(e.target.value)}
              />
              <button onClick={handleSend} className="bg-yellow-400 text-slate-900 px-4 py-2 rounded font-bold hover:bg-yellow-500">
                Send
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}