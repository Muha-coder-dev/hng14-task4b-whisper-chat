'use client';

import { useState, useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import Sidebar from '@/components/Sidebar';
import WelcomeScreen from '@/components/WelcomeScreen';
import ChatView from '@/components/ChatView';
import type { ActiveChat, SessionState, RecentChat } from '@/lib/types';

const LS_KEY = 'wb_recent_chats';
const MAX_RECENT = 20;

function loadRecent(): RecentChat[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); }
  catch { return []; }
}
function saveRecent(chats: RecentChat[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(chats)); } catch { /* ignore */ }
}

export default function Home() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setRecentChats(loadRecent());
  }, []);

  const handleAuthenticated = (s: SessionState) => {
    setSession(s);
    setActiveChat(null);
    setRecentChats(loadRecent());
  };

  const handleStartChat = (chat: ActiveChat) => {
    setActiveChat(chat);
    // Upsert into recent chats list
    setRecentChats(prev => {
      const filtered = prev.filter(c => c.id !== chat.id);
      const updated: RecentChat[] = [
        { id: chat.id, username: chat.username, publicKey: chat.publicKey, lastMessageTime: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_RECENT);
      saveRecent(updated);
      return updated;
    });
  };

  const handleMessageSent = (chatId: string, text: string) => {
    setRecentChats(prev => {
      const updated = prev.map(c =>
        c.id === chatId
          ? { ...c, lastMessage: text, lastMessageTime: new Date().toISOString() }
          : c
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
  if (!session) return <AuthForm onAuthenticated={handleAuthenticated} />;

  return (
    <div className="h-screen w-full flex bg-[#0D1117] overflow-hidden">

      {/* ── Left Sidebar ── */}
      {/* On mobile: hide sidebar when a chat is active */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} flex-shrink-0`}>
        <Sidebar
          session={session}
          recentChats={recentChats}
          activeChat={activeChat}
          onStartChat={handleStartChat}
          onLogout={handleLogout}
        />
      </div>

      {/* ── Right Main Panel ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <ChatView
            session={session}
            activeChat={activeChat}
            onBack={() => setActiveChat(null)}
            onMessageSent={(text) => handleMessageSent(activeChat.id, text)}
          />
        ) : (
          <WelcomeScreen />
        )}
      </main>
    </div>
  );
}