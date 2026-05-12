'use client';

import { useState, useEffect } from 'react';
import { searchUsers, getUserPublicKey } from '@/lib/api';
import type { ActiveChat, SessionState, RecentChat, UserSearchResult } from '@/lib/types';

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#7C3AED', '#6D28D9', '#2563EB', '#1D4ED8',
  '#0891B2', '#0E7490', '#059669', '#047857',
  '#D97706', '#B45309', '#DC2626', '#B91C1C',
  '#DB2777', '#BE185D', '#7C3AED', '#4F46E5',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(username: string): string {
  const parts = username.split(/[_\-\s.]/);
  if (parts.length >= 2 && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.substring(0, 2).toUpperCase();
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso).getDay()];
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({ username, size = 10, showOnline = false }: { username: string; size?: number; showOnline?: boolean }) {
  const sz = `w-${size} h-${size}`;
  const dotSz = size >= 10 ? 'w-3 h-3 border-2' : 'w-2.5 h-2.5 border-2';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 relative`}
      style={{ backgroundColor: getAvatarColor(username), fontSize: size <= 8 ? '0.65rem' : '0.75rem' }}
    >
      {getInitials(username)}
      {showOnline && (
        <span className={`absolute bottom-0 right-0 ${dotSz} bg-[#00C48C] border-[#161B22] rounded-full`} />
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  session: SessionState;
  recentChats: RecentChat[];
  activeChat: ActiveChat | null;
  theme: 'dark' | 'light';
  onStartChat: (chat: ActiveChat) => void;
  onLogout: () => void;
  onToggleTheme: () => void;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ session, recentChats, activeChat, theme, onStartChat, onLogout, onToggleTheme }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Debounced search as user types
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const cleanQuery = query.trim().startsWith('@') && query.trim().length > 1
          ? query.trim().substring(1)
          : query.trim();
        const data = await searchUsers(session.accessToken, cleanQuery);
        setResults(data.filter(u => u.id !== session.userId));
      } catch { setResults([]); }
      finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query, session.accessToken, session.userId]);

  const handleStartChat = async (user: UserSearchResult) => {
    setLoadingId(user.id);
    try {
      const keyData = await getUserPublicKey(session.accessToken, user.id);
      onStartChat({ id: user.id, username: user.username, publicKey: keyData.public_key });
      setQuery('');
      setResults([]);
    } catch { /* ignore */ }
    finally { setLoadingId(null); }
  };

  const showSearch = query.trim().length > 0;

  return (
    <aside className="w-[280px] flex flex-col border-r flex-shrink-0 h-full transition-colors duration-200"
      style={{ backgroundColor: 'var(--wb-surface)', borderColor: 'var(--wb-border)' }}
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#30363D] flex-shrink-0">
        <div className="w-7 h-7 bg-[#00C48C] rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#0D1117]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
        <span className="font-bold text-white text-[15px] tracking-tight flex-1">WhisperBox</span>
        <span className="flex items-center gap-1 text-[10px] text-[#00C48C] font-semibold bg-[#00C48C]/10 border border-[#00C48C]/25 px-2 py-0.5 rounded-full whitespace-nowrap">
          <span className="w-1.5 h-1.5 bg-[#00C48C] rounded-full animate-pulse" />
          Connected
        </span>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7D8590] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="sidebar-search"
            type="text"
            placeholder="@username..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-[#21262D] text-white placeholder-[#7D8590] rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C48C]/50 transition-all"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7D8590] hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto wb-scrollbar px-2 pb-2">

        {/* Search results */}
        {showSearch && (
          <div className="mb-1">
            <p className="text-[10px] font-semibold text-[#7D8590] uppercase tracking-widest px-2 py-1.5">
              {isSearching ? 'Searching…' : results.length > 0 ? 'People' : 'No results'}
            </p>
            {isSearching ? (
              <div className="flex justify-center py-5">
                <div className="w-4 h-4 border-2 border-[#00C48C]/30 border-t-[#00C48C] rounded-full animate-spin" />
              </div>
            ) : results.map((user, i) => (
              <div
                key={user.id}
                className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-[#21262D] transition-colors cursor-default animate-slide-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Avatar username={user.username} size={9} showOnline />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium leading-tight truncate">
                    {user.display_name && user.display_name !== user.username ? user.display_name : user.username}
                  </p>
                  <p className="text-[#7D8590] text-xs truncate">@{user.username}</p>
                </div>
                <button
                  id={`add-user-${user.id}`}
                  onClick={() => handleStartChat(user)}
                  disabled={loadingId === user.id}
                  className="text-[11px] font-bold px-3 py-1 rounded-lg border border-[#00C48C]/60 text-[#00C48C] hover:bg-[#00C48C] hover:text-[#0D1117] hover:border-[#00C48C] active:scale-95 transition-all disabled:opacity-50 flex-shrink-0"
                >
                  {loadingId === user.id ? '…' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recent chats */}
        {!showSearch && (
          <>
            {recentChats.length > 0 && (
              <p className="text-[10px] font-semibold text-[#7D8590] uppercase tracking-widest px-2 py-1.5">
                Recent Chats
              </p>
            )}

            {recentChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-[#7D8590] space-y-2">
                <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs text-center leading-relaxed">Search for someone<br />to start a private chat</p>
              </div>
            )}

            {recentChats.map((chat, i) => {
              const isActive = activeChat?.id === chat.id;
              return (
                <button
                  key={chat.id}
                  id={`recent-chat-${chat.id}`}
                  onClick={() => onStartChat({ id: chat.id, username: chat.username, publicKey: chat.publicKey })}
                  className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-all text-left mb-0.5 animate-slide-in ${
                    isActive
                      ? 'bg-[#00C48C]/10 border border-[#00C48C]/20'
                      : 'hover:bg-[#21262D] border border-transparent'
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <Avatar username={chat.username} size={10} showOnline />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm font-semibold truncate ${isActive ? 'text-[#00C48C]' : 'text-white'}`}>
                        {chat.username}
                      </p>
                      {chat.lastMessageTime && (
                        <span className="text-[10px] text-[#7D8590] flex-shrink-0 ml-1">
                          {formatTimeAgo(chat.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <p className="text-[#7D8590] text-xs truncate">
                      {chat.lastMessage ?? 'Tap to open chat'}
                    </p>
                  </div>
                  {(chat.unreadCount ?? 0) > 0 && (
                    <span className="bg-[#00C48C] text-[#0D1117] text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center flex-shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* ── Bottom: logged-in user strip ────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-t border-[#30363D] flex-shrink-0 bg-[#0D1117]/40">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 relative"
          style={{ backgroundColor: '#2563EB' }}
        >
          ME
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00C48C] border-2 border-[#161B22] rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">You</p>
          <p className="text-[#00C48C] text-[11px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#00C48C] rounded-full animate-pulse" />
            Online
          </p>
        </div>
        {/* Theme toggle button */}
        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="text-[#7D8590] hover:text-white p-1.5 rounded-lg hover:bg-[#21262D] transition-all flex-shrink-0"
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <button
          id="logout-button"
          onClick={onLogout}
          title="Sign out"
          className="text-[#7D8590] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
