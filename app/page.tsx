'use client';

import { useState, useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import Sidebar from '@/components/Sidebar';
import WelcomeScreen from '@/components/WelcomeScreen';
import ChatView from '@/components/ChatView';
import type { ActiveChat, SessionState, RecentChat } from '@/lib/types';

const LS_RECENT = 'wb_recent_chats';
const LS_THEME  = 'wb_theme';
const MAX_RECENT = 20;

function loadRecent(): RecentChat[] {
  try { return JSON.parse(localStorage.getItem(LS_RECENT) ?? '[]'); }
  catch { return []; }
}
function saveRecent(c: RecentChat[]) {
  try { localStorage.setItem(LS_RECENT, JSON.stringify(c)); } catch { /* ignore */ }
}

export default function Home() {
  const [session,     setSession]     = useState<SessionState | null>(null);
  const [activeChat,  setActiveChat]  = useState<ActiveChat | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [theme,       setTheme]       = useState<'dark' | 'light'>('dark');
  const [hydrated,    setHydrated]    = useState(false);

  /* ── Restore session + theme on mount ── */
  useEffect(() => {
    const restore = async () => {
      // Theme
      const saved = localStorage.getItem(LS_THEME) as 'dark' | 'light' | null;
      const t = saved ?? 'dark';
      setTheme(t);
      document.documentElement.setAttribute('data-theme', t);

      // Session
      try {
        const token    = sessionStorage.getItem('wb_token');
        const username = sessionStorage.getItem('wb_username');
        const userId   = sessionStorage.getItem('wb_userId');
        const pubkey   = sessionStorage.getItem('wb_pubkey');
        const jwkStr   = sessionStorage.getItem('wb_privkey_jwk');

        if (token && username && userId && pubkey && jwkStr) {
          const jwk = JSON.parse(jwkStr) as JsonWebKey;
          const privateKey = await crypto.subtle.importKey(
            'jwk', jwk,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true, ['decrypt']
          );
          setSession({ accessToken: token, username, userId, publicKeyStr: pubkey, privateKey });
        }
      } catch {
        // Corrupted — clear and show login
        sessionStorage.clear();
      }

      setRecentChats(loadRecent());
      setHydrated(true);
    };
    restore();
  }, []);

  /* ── Theme change: update <html> attr + persist ── */
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(LS_THEME, next);
      return next;
    });
  };

  const handleAuthenticated = (s: SessionState) => {
    setSession(s);
    setActiveChat(null);
    setRecentChats(loadRecent());
  };

  const handleStartChat = (chat: ActiveChat) => {
    setActiveChat(chat);
    setRecentChats(prev => {
      const updated: RecentChat[] = [
        { id: chat.id, username: chat.username, publicKey: chat.publicKey, lastMessageTime: new Date().toISOString() },
        ...prev.filter(c => c.id !== chat.id),
      ].slice(0, MAX_RECENT);
      saveRecent(updated);
      return updated;
    });
  };

  const handleMessageSent = (chatId: string, text: string) => {
    setRecentChats(prev => {
      const updated = prev.map(c =>
        c.id === chatId ? { ...c, lastMessage: text, lastMessageTime: new Date().toISOString() } : c
      );
      saveRecent(updated);
      return updated;
    });
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setSession(null);
    setActiveChat(null);
  };

  if (!hydrated) return null;
  if (!session)  return <AuthForm onAuthenticated={handleAuthenticated} />;

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ background: 'var(--wb-bg)' }}>

      {/* Left Sidebar — hidden on mobile when chat is open */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} flex-shrink-0`}>
        <Sidebar
          session={session}
          recentChats={recentChats}
          activeChat={activeChat}
          theme={theme}
          onStartChat={handleStartChat}
          onLogout={handleLogout}
          onToggleTheme={toggleTheme}
        />
      </div>

      {/* Right Main Panel */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <ChatView
            session={session}
            activeChat={activeChat}
            onBack={() => setActiveChat(null)}
            onMessageSent={text => handleMessageSent(activeChat.id, text)}
          />
        ) : (
          <WelcomeScreen />
        )}
      </main>
    </div>
  );
}