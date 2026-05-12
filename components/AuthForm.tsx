'use client';

import { useState } from 'react';
import {
  generateRSAKeyPair,
  deriveWrappingKey,
  wrapPrivateKey,
  unwrapPrivateKey,
} from '@/lib/crypto';
import { register, login } from '@/lib/api';
import type { SessionState } from '@/lib/types';

interface Props {
  onAuthenticated: (session: SessionState) => void;
}

/** Eye-open SVG icon */
const EyeOpen = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** Eye-closed SVG icon */
const EyeOff = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function AuthForm({ onAuthenticated }: Props) {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false); // true when Koyeb cold-start delay is detected

  const switchMode = () => {
    setIsLogin(v => !v);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setSlowLoad(false);

    // Show a hint if the server is taking more than 5s (Koyeb cold start)
    const slowTimer = setTimeout(() => setSlowLoad(true), 5000);

    try {
      let session: SessionState;

      if (isLogin) {
        // --- LOGIN ---
        const data = await login({ username, password });
        const salt = Uint8Array.from(atob(data.user.pbkdf2_salt), c => c.charCodeAt(0));
        const wrappingKey = await deriveWrappingKey(password, salt);
        const privateKey = await unwrapPrivateKey(data.user.wrapped_private_key, wrappingKey);
        // Export key so page reload can restore session without re-login
        const jwk = await crypto.subtle.exportKey('jwk', privateKey);
        sessionStorage.setItem('wb_privkey_jwk', JSON.stringify(jwk));

        session = {
          accessToken: data.access_token,
          publicKeyStr: data.user.public_key,
          privateKey,
          userId: data.user.id,
          username: data.user.username,
        };
      } else {
        // --- REGISTER ---
        const keys = await generateRSAKeyPair();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = btoa(String.fromCharCode(...salt));
        const wrappingKey = await deriveWrappingKey(password, salt);
        const wrappedPrivateKey = await wrapPrivateKey(keys.privateKey, wrappingKey);
        const exportedPubKey = await crypto.subtle.exportKey('spki', keys.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPubKey)));

        const data = await register({
          username,
          display_name: username,
          password,
          public_key: publicKeyBase64,
          wrapped_private_key: wrappedPrivateKey,
          pbkdf2_salt: saltBase64,
        });

        // Export key for session restoration on reload
        const jwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
        sessionStorage.setItem('wb_privkey_jwk', JSON.stringify(jwk));

        session = {
          accessToken: data.access_token,
          publicKeyStr: data.user.public_key,
          privateKey: keys.privateKey,
          userId: data.user.id,
          username: data.user.username,
        };
      }

      // Persist token + username to sessionStorage so a refresh restores context
      // (private key cannot be serialised — re-login will be needed on hard refresh)
      sessionStorage.setItem('wb_token', session.accessToken);
      sessionStorage.setItem('wb_username', session.username);
      sessionStorage.setItem('wb_userId', session.userId);
      sessionStorage.setItem('wb_pubkey', session.publicKeyStr);

      onAuthenticated(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      clearTimeout(slowTimer);
      setSlowLoad(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#11161B] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-[#00C48C] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/50">
          <svg className="w-8 h-8 text-[#11161B]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">WhisperBox</h1>
        <p className="text-slate-400 text-sm mt-2 tracking-wide">End-to-End Encrypted Messaging</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#1A2228] rounded-2xl p-8 shadow-2xl border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-6 text-center">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <input
              id="auth-username"
              type="text"
              placeholder="Username (e.g., john_doe)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#242E35] text-white placeholder-slate-500 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#00C48C]/60 transition-all"
              required
              minLength={3}
              maxLength={32}
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#242E35] text-white placeholder-slate-500 rounded-xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#00C48C]/60 transition-all"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              id="toggle-password"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00C48C] hover:scale-110 active:scale-95 transition-all duration-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>

          {/* Confirm Password (register only) */}
          {!isLogin && (
            <div className="relative">
              <input
                id="auth-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-[#242E35] text-white placeholder-slate-500 rounded-xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#00C48C]/60 transition-all"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                id="toggle-confirm-password"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00C48C] hover:scale-110 active:scale-95 transition-all duration-200"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm p-3 rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-[#00C48C] hover:bg-[#00A877] hover:scale-[1.02] active:scale-[0.98] text-[#11161B] font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/30 disabled:opacity-50 tracking-wide mt-2"
          >
            {loading
              ? (isLogin ? 'Signing in...' : 'Creating account...')
              : (isLogin ? 'Sign In Securely' : 'Create Account')}
          </button>

          {/* Cold-start hint — shown after 5s of loading */}
          {slowLoad && (
            <p className="text-center text-xs text-amber-400/80 animate-pulse">
              ⏳ Waking up the server… this can take up to 30s on first use.
            </p>
          )}
        </form>

        {/* Switch mode */}
        <div className="mt-6 text-center text-sm text-slate-400">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            id="auth-switch-mode"
            onClick={switchMode}
            className="text-[#00C48C] hover:text-white font-bold transition-colors"
          >
            {isLogin ? 'Create account' : 'Sign in'}
          </button>
        </div>

        {/* Security badge */}
        <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured with end-to-end encryption
        </div>
      </div>
    </div>
  );
}
