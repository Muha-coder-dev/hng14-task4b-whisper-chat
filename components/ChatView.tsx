'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getConversationMessages, sendMessage } from '@/lib/api';
import { createEncryptedPayload, decryptPayload } from '@/lib/crypto';
import type { ActiveChat, ChatMessage, SessionState } from '@/lib/types';

interface Props {
  session: SessionState;
  activeChat: ActiveChat;
  onBack: () => void;
  onMessageSent?: (text: string) => void;
}

const POLL_MS = 4000;

// ── Avatar helpers (duplicated here to keep component self-contained) ─────────

const AVATAR_PALETTE = [
  '#7C3AED', '#6D28D9', '#2563EB', '#1D4ED8',
  '#0891B2', '#0E7490', '#059669', '#047857',
  '#D97706', '#B45309', '#DC2626', '#B91C1C',
  '#DB2777', '#BE185D', '#4F46E5', '#0284C7',
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

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatView({ session, activeChat, onBack, onMessageSent }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (smooth = true) =>
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });

  const loadMessages = useCallback(async () => {
    try {
      const raw = await getConversationMessages(session.accessToken, activeChat.id);
      if (!Array.isArray(raw) || raw.length === 0) return;
      const fresh: ChatMessage[] = [];
      for (const msg of raw) {
        if (knownIds.current.has(msg.id)) continue;
        const isSender = msg.sender_id === session.userId;
        try {
          const text = await decryptPayload(msg.payload, session.privateKey, isSender);
          fresh.push({ id: msg.id, text, isSender, ciphertextPreview: msg.payload.ciphertext.substring(0, 12) + '…', timestamp: msg.created_at });
          knownIds.current.add(msg.id);
        } catch {
          knownIds.current.add(msg.id);
        }
      }
      if (fresh.length > 0) {
        setMessages(prev =>
          [...prev, ...fresh].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        );
      }
    } catch { setLoadError('Could not load messages. Retrying…'); }
    finally { setIsInitialLoad(false); }
  }, [session.accessToken, session.userId, session.privateKey, activeChat.id]);

  useEffect(() => {
    knownIds.current = new Set();
    setMessages([]);
    setIsInitialLoad(true);
    setLoadError('');
    loadMessages().then(() => scrollToBottom(false));
    pollingRef.current = setInterval(loadMessages, POLL_MS);
    inputRef.current?.focus();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeChat.id, loadMessages]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setSendError('');
    setInput('');
    setIsSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const now = new Date().toISOString();
    try {
      const payload = await createEncryptedPayload(text, activeChat.publicKey, session.publicKeyStr);
      setMessages(prev => [...prev, { id: optimisticId, text, isSender: true, ciphertextPreview: payload.ciphertext.substring(0, 12) + '…', timestamp: now }]);
      const sent = await sendMessage(session.accessToken, activeChat.id, payload);
      knownIds.current.add(sent.id);
      setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, id: sent.id } : m));
      onMessageSent?.(text);
    } catch (err: unknown) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setSendError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally { setIsSending(false); }
  };

  // Group messages by date for separators
  const grouped: Array<{ date: string; msgs: ChatMessage[] }> = [];
  for (const msg of messages) {
    const d = new Date(msg.timestamp).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1117]">

      {/* ── Chat Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-[#161B22] border-b border-[#30363D] flex-shrink-0">
        {/* Mobile back button */}
        <button
          id="back-button"
          onClick={onBack}
          className="md:hidden text-[#7D8590] hover:text-white p-1.5 -ml-1 rounded-lg hover:bg-[#21262D] transition-all"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative"
          style={{ backgroundColor: getAvatarColor(activeChat.username) }}
        >
          {getInitials(activeChat.username)}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00C48C] border-2 border-[#161B22] rounded-full" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] leading-tight truncate">{activeChat.username}</p>
          <p className="text-[11px] text-[#00C48C] flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 bg-[#00C48C] rounded-full animate-pulse" />
            Active now
          </p>
        </div>

        {/* Lock badge */}
        <div className="flex items-center gap-1 text-[11px] text-[#7D8590] bg-[#21262D] border border-[#30363D] rounded-full px-3 py-1">
          <svg className="w-3 h-3 text-[#00C48C]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          E2EE
        </div>
      </div>

      {/* ── Messages Area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto wb-scrollbar px-4 py-4 space-y-1">
        {isInitialLoad ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3 text-[#7D8590]">
            <div className="w-5 h-5 border-2 border-[#00C48C]/30 border-t-[#00C48C] rounded-full animate-spin" />
            <p className="text-xs">Loading encrypted messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#7D8590] space-y-3">
            <div className="w-14 h-14 bg-[#161B22] border border-[#30363D] rounded-2xl flex items-center justify-center mb-2">
              <svg className="w-7 h-7 text-[#00C48C]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Start a secure conversation</p>
            <p className="text-xs text-center leading-relaxed max-w-[200px]">
              Messages with <span className="text-[#00C48C]">@{activeChat.username}</span> are end-to-end encrypted
            </p>
          </div>
        ) : (
          <>
            {grouped.map(({ date, msgs }) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#30363D]" />
                  <span className="text-[11px] text-[#7D8590] font-medium px-2 flex-shrink-0">
                    {formatDateSeparator(msgs[0].timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-[#30363D]" />
                </div>

                {msgs.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 mb-2 animate-fade-up ${msg.isSender ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    {msg.isSender ? (
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mb-1">
                        ME
                      </div>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mb-1"
                        style={{ backgroundColor: getAvatarColor(activeChat.username) }}
                      >
                        {getInitials(activeChat.username)}
                      </div>
                    )}

                    {/* Bubble + timestamp */}
                    <div className={`flex flex-col max-w-[70%] ${msg.isSender ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed break-words ${
                        msg.isSender
                          ? 'bg-[#00C48C] text-[#0D1117] rounded-br-sm font-medium'
                          : 'bg-[#21262D] text-[#E6EDF3] rounded-bl-sm border border-[#30363D]'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-[#7D8590] mt-1 px-1 font-mono">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* E2EE notice */}
            <div className="flex items-center justify-center gap-1.5 py-3 text-[#7D8590]">
              <svg className="w-3 h-3 text-[#00C48C]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-[11px]">Messages are end-to-end encrypted</span>
            </div>
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Error banners ────────────────────────────────────────────── */}
      {sendError && (
        <div className="px-5 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center">
          {sendError}
        </div>
      )}
      {loadError && !isInitialLoad && (
        <div className="px-5 py-1.5 bg-amber-500/10 border-t border-amber-500/20 text-amber-400 text-xs text-center">
          {loadError}
        </div>
      )}

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="px-4 py-3.5 bg-[#161B22] border-t border-[#30363D] flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            ref={inputRef}
            id="message-input"
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-[#21262D] text-white placeholder-[#7D8590] rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C48C]/50 border border-[#30363D] transition-all"
            autoComplete="off"
          />
          <button
            id="send-button"
            type="submit"
            disabled={!input.trim() || isSending}
            className="w-11 h-11 rounded-full bg-[#00C48C] flex items-center justify-center hover:bg-[#00B37D] active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-lg shadow-[#00C48C]/20 flex-shrink-0"
            aria-label="Send"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-[#0D1117]/30 border-t-[#0D1117] rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-[#0D1117]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
