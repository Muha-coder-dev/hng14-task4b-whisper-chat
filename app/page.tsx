"use client";
import { useState } from "react";
import { deriveKey, encryptMessage, decryptMessage } from "../lib/crypto";

export default function WhisperChat() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<{sender: string, text: string}[]>([]);

  const handleSend = async () => {
    if (!password || !message) return alert("Enter a password and message!");

    // 1. Generate a salt (In a real app, this is shared with the recipient)
    const salt = new TextEncoder().encode("constant-hng-salt"); 
    const key = await deriveKey(password, salt);

    // 2. Encrypt the message locally
    const { ciphertext, iv } = await encryptMessage(message, key);
    
    // 3. Simulate sending to server (we'll log the "scrambled" version to prove it works)
    console.log("Sending to server:", ciphertext);

    // 4. Decrypt it back (to show it in the UI)
    const decrypted = await decryptMessage(ciphertext, iv, key);
    setChatLog([...chatLog, { sender: "You", text: decrypted }]);
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 text-yellow-400">Whisper Chat (E2EE)</h1>
      
      <div className="w-full max-w-md bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700">
        <input 
          type="password" 
          placeholder="Enter Secret Room Key..." 
          className="w-full p-2 mb-4 rounded bg-slate-900 border border-slate-600 focus:border-yellow-400 outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        <div className="h-64 overflow-y-auto mb-4 p-4 bg-slate-900 rounded border border-slate-700">
          {chatLog.map((msg, i) => (
            <p key={i} className="mb-2"><span className="text-yellow-400 font-bold">{msg.sender}:</span> {msg.text}</p>
          ))}
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Type a whisper..." 
            className="flex-1 p-2 rounded bg-slate-900 border border-slate-600 outline-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button 
            onClick={handleSend}
            className="bg-yellow-400 text-slate-900 px-4 py-2 rounded font-bold hover:bg-yellow-500 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}