"use client";

import { useState } from "react";
import { generateRSAKeyPair, deriveWrappingKey, wrapPrivateKey, unwrapPrivateKey, createEncryptedPayload, decryptPayload } from "../lib/crypto";

export default function Home() {
  // Auth States
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatReady, setChatReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Security States
  const [accessToken, setAccessToken] = useState("");
  const [publicKeyStr, setPublicKeyStr] = useState("");
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);

  // Chat & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; username: string; publicKey: string } | null>(null);
  const [messages, setMessages] = useState<Array<{ id: number; text: string; ciphertextPreview: string }>>([]);
  const [messageInput, setMessageInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      let currentToken = "";
      let currentPubKey = "";
      let currentPrivKey: CryptoKey | null = null;

      if (isLogin) {
        const response = await fetch("/api/proxy/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error("Invalid username or password");
        const data = await response.json();
        
        const salt = Uint8Array.from(atob(data.user.pbkdf2_salt), c => c.charCodeAt(0));
        const wrappingKey = await deriveWrappingKey(password, salt);
        currentPrivKey = await unwrapPrivateKey(data.user.wrapped_private_key, wrappingKey);
        
        currentToken = data.access_token;
        currentPubKey = data.user.public_key;
      } else {
        const keys = await generateRSAKeyPair();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = btoa(String.fromCharCode(...salt));
        const wrappingKey = await deriveWrappingKey(password, salt);
        const wrappedPrivateKey = await wrapPrivateKey(keys.privateKey, wrappingKey);
        const exportedPubKey = await crypto.subtle.exportKey("spki", keys.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPubKey)));

        const response = await fetch("/api/proxy/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username, display_name: username, password,
            public_key: publicKeyBase64, wrapped_private_key: wrappedPrivateKey, pbkdf2_salt: saltBase64
          })
        });

        if (!response.ok) throw new Error("Registration failed.");
        const data = await response.json();
        
        currentPrivKey = keys.privateKey;
        currentToken = data.access_token;
        currentPubKey = data.user.public_key;
      }

      setPrivateKey(currentPrivKey);
      setAccessToken(currentToken);
      setPublicKeyStr(currentPubKey);
      setChatReady(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- API ROUTINES --- //

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/proxy/users/search?q=${searchQuery}`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const startChat = async (user: any) => {
    try {
      // 1. Get their public key
      const keyRes = await fetch(`/api/proxy/users/${user.id}/public-key`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      const keyData = await keyRes.json();
      setActiveChat({ id: user.id, username: user.username, publicKey: keyData.public_key });

      // 2. Fetch Received Messages from Database
      const msgRes = await fetch(`/api/proxy/conversations/${user.id}/messages`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      const msgData = await msgRes.json();

      // 3. Decrypt and display them!
      if (Array.isArray(msgData) && privateKey) {
         const decryptedMsgs = await Promise.all(msgData.map(async (msg: any) => {
            try {
               const text = await decryptPayload(msg.payload, privateKey);
               return { id: msg.id, text: text, ciphertextPreview: "Fetched from DB" };
            } catch { return null; }
         }));
         // Reverse so newest is at the bottom
         setMessages(decryptedMsgs.filter(Boolean).reverse() as any);
      } else {
         setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load chat", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChat) return;

    const textToSend = messageInput;
    setMessageInput(""); 

    try {
      const payload = await createEncryptedPayload(textToSend, activeChat.publicKey, publicKeyStr);
      console.log("🔒 SENDING SECURE PAYLOAD TO KOYEB:", payload);

      await fetch("/api/proxy/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}` 
        },
        body: JSON.stringify({
          to: activeChat.id,
          payload: payload
        })
      });

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: textToSend,
        ciphertextPreview: payload.ciphertext.substring(0, 15) + "..."
      }]);

    } catch (err) {
      console.error("Encryption failed", err);
    }
  };

  // --- UI RENDERERS --- //

  if (chatReady) {
    return (
      <div className="min-h-screen bg-[#11161B] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-[#1A2228] w-full max-w-2xl h-[650px] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
           
           {/* Header */}
           <div className="flex justify-between items-center bg-[#1A2228] px-6 py-5 border-b border-slate-700/50 z-10 shadow-sm">
              <div className="flex items-center gap-4">
                {activeChat && (
                  <button onClick={() => setActiveChat(null)} className="text-[#00C48C] hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-slate-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">{activeChat ? `@${activeChat.username}` : "WhisperBox"}</h2>
                  <p className="text-xs text-[#00C48C] font-mono mt-1 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 bg-[#00C48C] rounded-full animate-pulse"></span> {activeChat ? "End-to-End Encrypted" : "Network Connected"}
                  </p>
                </div>
              </div>
           </div>

           {/* Dynamic Body: Search OR Chat */}
           {!activeChat ? (
             <div className="flex-1 p-6 bg-[#151B21] flex flex-col">
               <form onSubmit={handleSearchUser} className="relative flex gap-3 mb-6">
                 <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                 </div>
                 <input
                   type="text"
                   placeholder="Search for a username..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="flex-1 bg-[#242E35] text-white placeholder-slate-500 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C]/50 transition-all shadow-inner"
                 />
                 <button type="submit" className="bg-[#00C48C] text-[#11161B] px-6 rounded-xl font-bold hover:bg-[#00A877] transition-colors shadow-lg">
                   {isSearching ? "Searching..." : "Find User"}
                 </button>
               </form>

               <div className="flex-1 overflow-y-auto space-y-3">
                 {searchResults.length === 0 && !isSearching && (
                    <div className="text-center text-slate-500 mt-10">Search for a friend to start chatting securely.</div>
                 )}
                 {searchResults.map((user) => (
                   <div key={user.id} onClick={() => startChat(user)} className="bg-[#1A2228] border border-slate-700/50 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:border-[#00C48C]/50 hover:bg-[#242E35] transition-all group">
                      <div>
                        <p className="font-bold text-white">@{user.username}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">ID: {user.id.split('-')[0]}...</p>
                      </div>
                      <button className="bg-transparent border border-[#00C48C] text-[#00C48C] group-hover:bg-[#00C48C] group-hover:text-[#11161B] px-4 py-2 rounded-lg font-bold text-sm transition-all">Message</button>
                   </div>
                 ))}
               </div>
             </div>
           ) : (
             <>
               <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#151B21]">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                      <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                      <p className="text-sm font-medium">Say hello! Messages are encrypted with their public key.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="flex flex-col items-end animate-fade-in-up">
                         <div className="bg-[#00C48C] text-[#11161B] px-5 py-3 rounded-2xl rounded-tr-sm shadow-lg max-w-[80%] transform transition-all hover:-translate-y-0.5">
                           <p className="font-medium text-[15px]">{msg.text}</p>
                         </div>
                         <div className="flex items-center gap-1 mt-1.5 opacity-60">
                           <svg className="w-3 h-3 text-[#00C48C]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                           <span className="text-[10px] text-slate-400 font-mono tracking-wider">AES-GCM • {msg.ciphertextPreview}</span>
                         </div>
                      </div>
                    ))
                  )}
               </div>
               <div className="p-4 bg-[#1A2228] border-t border-slate-700/50">
                 <form onSubmit={handleSendMessage} className="flex gap-3">
                   <input
                     type="text"
                     placeholder={`Message @${activeChat.username}...`}
                     value={messageInput}
                     onChange={(e) => setMessageInput(e.target.value)}
                     className="flex-1 bg-[#242E35] text-white placeholder-slate-500 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C]/50 transition-all shadow-inner"
                   />
                   <button
                     type="submit"
                     disabled={!messageInput.trim()}
                     className="bg-[#00C48C] text-[#11161B] px-6 rounded-xl font-bold hover:bg-[#00A877] hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 transition-all duration-200 flex items-center justify-center shadow-lg"
                   >
                     <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                   </button>
                 </form>
               </div>
             </>
           )}
        </div>
      </div>
    );
  }

  // --- NEW MODERN LOGIN/REGISTER UI ---
  return (
    <div className="min-h-screen bg-[#11161B] flex flex-col items-center justify-center p-6 font-sans">
      <div className="mb-6 flex flex-col items-center">
        <div className="w-16 h-16 bg-[#00C48C] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/50">
          <svg className="w-8 h-8 text-[#11161B]" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{isLogin ? "Welcome back" : "Create account"}</h1>
        <p className="text-slate-400 text-sm tracking-wide">WhisperBox • Secure End-to-End Encryption</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input type="text" placeholder="Username (e.g., john_doe)" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#E8F0FE] text-black placeholder-slate-500 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C] transition-all" required minLength={3} maxLength={32} />
          </div>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#242E35] text-white placeholder-slate-500 rounded-xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#00C48C] transition-all shadow-inner" required minLength={8} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00C48C] hover:scale-110 active:scale-95 transition-all duration-200">
              {showPassword ? (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>) : (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>)}
            </button>
          </div>
          {!isLogin && (
            <div className="relative animate-fade-in">
              <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-[#242E35] text-white placeholder-slate-500 rounded-xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#00C48C] transition-all shadow-inner" required={!isLogin} minLength={8} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00C48C] hover:scale-110 active:scale-95 transition-all duration-200">
                {showConfirmPassword ? (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>) : (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>)}
              </button>
            </div>
          )}
          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl text-center font-medium">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-[#00C48C] hover:bg-[#00A877] hover:scale-[1.02] active:scale-[0.98] text-[#11161B] font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/30 disabled:opacity-50 mt-2 tracking-wide">
            {loading ? "Processing..." : (isLogin ? "Sign In Securely" : "Create Account")}
          </button>
        </form>
        <div className="mt-8 text-center text-sm text-slate-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(""); setPassword(""); setConfirmPassword(""); }} className="text-[#00C48C] hover:text-white font-bold transition-colors">{isLogin ? "Create account" : "Sign in"}</button>
        </div>
        <div className="mt-8 text-center flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
          Secured with end-to-end encryption
        </div>
      </div>
    </div>
  );
}