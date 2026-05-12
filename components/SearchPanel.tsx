'use client';

import { useState } from 'react';
import { searchUsers, getUserPublicKey } from '@/lib/api';
import type { ActiveChat, UserSearchResult } from '@/lib/types';

interface Props {
  token: string;
  currentUserId: string;
  onStartChat: (chat: ActiveChat) => void;
}

export default function SearchPanel({ token, currentUserId, onStartChat }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setError('');
    try {
      const data = await searchUsers(token, query.trim());
      // Filter out yourself from results
      setResults(data.filter(u => u.id !== currentUserId));
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (user: UserSearchResult) => {
    setLoadingId(user.id);
    try {
      const keyData = await getUserPublicKey(token, user.id);
      onStartChat({ id: user.id, username: user.username, publicKey: keyData.public_key });
    } catch {
      setError(`Could not load public key for @${user.username}.`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5 bg-[#151B21] overflow-hidden">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="relative flex gap-3 mb-5 flex-shrink-0">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          id="search-input"
          type="text"
          placeholder="Search for a username..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-[#242E35] text-white placeholder-slate-500 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C]/50 transition-all"
        />
        <button
          id="search-submit"
          type="submit"
          disabled={isSearching || !query.trim()}
          className="bg-[#00C48C] text-[#11161B] px-6 rounded-xl font-bold hover:bg-[#00A877] active:scale-95 transition-all disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Find'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-400 text-sm p-3 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {results.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 mt-8">
            <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-center">Search for a friend to start chatting securely.</p>
          </div>
        )}

        {results.map(user => (
          <div
            key={user.id}
            className="bg-[#1A2228] border border-slate-700/50 p-4 rounded-xl flex justify-between items-center hover:border-[#00C48C]/50 hover:bg-[#242E35] transition-all group"
          >
            <div>
              <p className="font-bold text-white">@{user.username}</p>
              {user.display_name && user.display_name !== user.username && (
                <p className="text-sm text-slate-400 mt-0.5">{user.display_name}</p>
              )}
              <p className="text-xs text-slate-600 font-mono mt-1">
                ID: {user.id.split('-')[0]}…
              </p>
            </div>
            <button
              id={`start-chat-${user.id}`}
              onClick={() => handleStartChat(user)}
              disabled={loadingId === user.id}
              className="bg-transparent border border-[#00C48C] text-[#00C48C] group-hover:bg-[#00C48C] group-hover:text-[#11161B] px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
            >
              {loadingId === user.id ? '...' : 'Message'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
