"use client";

import { useState } from "react";
// Ensure this path matches exactly where your crypto.ts is located!
import { generateRSAKeyPair, deriveWrappingKey, wrapPrivateKey, unwrapPrivateKey } from "../lib/crypto";

export default function Home() {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatReady, setChatReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        // --- LOG IN FLOW ---
        const response = await fetch("https://whisperbox.koyeb.app/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || "Invalid username or password");
        }
        
        const data = await response.json();
        const salt = Uint8Array.from(atob(data.user.pbkdf2_salt), c => c.charCodeAt(0));
        const wrappingKey = await deriveWrappingKey(password, salt);
        await unwrapPrivateKey(data.user.wrapped_private_key, wrappingKey);
        
        setChatReady(true);

      } else {
        // --- REGISTER FLOW ---
        const keys = await generateRSAKeyPair();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = btoa(String.fromCharCode(...salt));

        const wrappingKey = await deriveWrappingKey(password, salt);
        const wrappedPrivateKey = await wrapPrivateKey(keys.privateKey, wrappingKey);
        
        const exportedPubKey = await crypto.subtle.exportKey("spki", keys.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPubKey)));

        const response = await fetch("https://whisperbox.koyeb.app/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username,
            display_name: username, // <--- THE CRITICAL FIX IS HERE
            password: password,
            public_key: publicKeyBase64,
            wrapped_private_key: wrappedPrivateKey,
            pbkdf2_salt: saltBase64
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          let errorMessage = "Registration failed. Check inputs (No special characters in username).";
          if (typeof errData.detail === 'string') errorMessage = errData.detail;
          else if (Array.isArray(errData.detail)) errorMessage = errData.detail[0]?.msg || errorMessage;
          throw new Error(errorMessage);
        }
        
        setChatReady(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- SUCCESS CHAT UI ---
  if (chatReady) {
    return (
      <div className="min-h-screen bg-[#11161B] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-[#1A2228] p-6 rounded-2xl w-full max-w-md shadow-2xl">
           <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
              <h2 className="text-xl font-semibold text-white">WhisperBox Chats</h2>
              <span className="text-[#00C48C] text-sm flex items-center gap-2 font-medium">
                <span className="w-2.5 h-2.5 bg-[#00C48C] rounded-full animate-pulse"></span> Connected
              </span>
           </div>
           <p className="text-gray-400 text-center py-10">Encrypted messaging ready.</p>
        </div>
      </div>
    );
  }

  // --- NEW MODERN LOGIN/REGISTER UI ---
  return (
    <div className="min-h-screen bg-[#11161B] flex flex-col items-center justify-center p-6 font-sans">
      
      {/* Logo Area */}
      <div className="mb-6 flex flex-col items-center">
        <div className="w-16 h-16 bg-[#00C48C] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/50">
          {/* Simple SVG Chat Bubble matching the Yapp logo vibe */}
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {isLogin ? "Welcome back" : "Create account"}
        </h1>
        <p className="text-gray-400 text-sm">
          WhisperBox • Secure End-to-End Encryption
        </p>
      </div>

      {/* Form Container */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Username Input - Styled light like the screenshot */}
          <div>
            <input
              type="text"
              placeholder="Username (e.g., john_doe)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#E8F0FE] text-black placeholder-gray-500 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C] transition-all"
              required
              minLength={3}
              maxLength={32}
            />
          </div>

          {/* Password Input - Styled dark like the screenshot */}
          <div>
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#242E35] text-white placeholder-gray-500 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C] transition-all"
              required
              minLength={8}
            />
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}
          
          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00C48C] hover:bg-[#00A877] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 mt-2"
          >
            {loading ? "Processing..." : (isLogin ? "Sign In Securely" : "Create Account")}
          </button>
        </form>

        {/* The Toggle Link at the bottom exactly like the mockup */}
        <div className="mt-8 text-center text-sm text-gray-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-[#00C48C] hover:text-white font-medium transition-colors"
          >
            {isLogin ? "Create account" : "Sign in"}
          </button>
        </div>
        
        <div className="mt-8 text-center flex items-center justify-center gap-2 text-xs text-gray-600">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
          Secured with end-to-end encryption
        </div>
      </div>
    </div>
  );
}