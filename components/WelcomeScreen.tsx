'use client';

export default function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#0D1117] relative overflow-hidden select-none">

      {/* Subtle dot grid */}
      <div className="absolute inset-0 dot-grid pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-md">

        {/* ── Illustration ── */}
        <div className="mb-8 animate-float">
          <svg
            viewBox="0 0 220 180"
            className="w-56 h-44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Glow under illustration */}
            <ellipse cx="110" cy="168" rx="70" ry="8" fill="#00C48C" opacity="0.08" />

            {/* ── Left chat bubble (received) ── */}
            <rect x="12" y="60" width="110" height="52" rx="14" fill="#161B22" stroke="#30363D" strokeWidth="1.5" />
            {/* Bubble tail */}
            <path d="M20 112 L12 124 L30 112Z" fill="#161B22" stroke="#30363D" strokeWidth="1" strokeLinejoin="round" />
            {/* Text lines */}
            <rect x="24" y="74" width="60" height="7" rx="3.5" fill="#30363D" />
            <rect x="24" y="88" width="86" height="7" rx="3.5" fill="#30363D" />

            {/* ── Right chat bubble (sent / green) ── */}
            <rect x="98" y="18" width="110" height="52" rx="14" fill="#00C48C" opacity="0.85" />
            {/* Bubble tail */}
            <path d="M200 70 L208 82 L190 70Z" fill="#00C48C" opacity="0.85" />
            {/* Text lines */}
            <rect x="112" y="32" width="80" height="7" rx="3.5" fill="#0D7A5A" opacity="0.6" />
            <rect x="112" y="46" width="56" height="7" rx="3.5" fill="#0D7A5A" opacity="0.6" />

            {/* ── Shield / Lock ── */}
            <circle cx="110" cy="128" r="22" fill="#161B22" stroke="#30363D" strokeWidth="1.5" />
            <path
              d="M110 110l-12 5v8c0 7.18 5.12 13.9 12 15.5 6.88-1.6 12-8.32 12-15.5v-8l-12-5z"
              fill="#00C48C"
              opacity="0.9"
            />
            {/* Lock keyhole */}
            <circle cx="110" cy="123" r="3" fill="#0D1117" />
            <rect x="108.5" y="124" width="3" height="5" rx="1" fill="#0D1117" />

            {/* ── Sparkle dots ── */}
            <circle cx="26"  cy="38"  r="3.5" fill="#00C48C" opacity="0.5" />
            <circle cx="186" cy="120" r="2.5" fill="#00C48C" opacity="0.35" />
            <circle cx="70"  cy="152" r="2"   fill="#00C48C" opacity="0.3" />
            <circle cx="155" cy="10"  r="3"   fill="#00C48C" opacity="0.4" />

            {/* ── Dashes (motion lines) ── */}
            <line x1="6"   y1="50"  x2="18"  y2="50"  stroke="#30363D" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="202" y1="100" x2="214" y2="100" stroke="#30363D" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* ── Headline ── */}
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight leading-snug">
          Welcome to WhisperBox
        </h2>

        {/* ── Body copy ── */}
        <p className="text-[#7D8590] text-sm leading-relaxed mb-8 max-w-xs">
          Search for a contact on the left and start a private conversation. Every message is locked — only you and the recipient can read it.
        </p>

        {/* ── E2EE badge ── */}
        <div className="flex items-center gap-2 text-xs text-[#7D8590] bg-[#161B22] border border-[#30363D] rounded-full px-4 py-2">
          <svg className="w-3.5 h-3.5 text-[#00C48C]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd" />
          </svg>
          End-to-End Encrypted
        </div>
      </div>
    </div>
  );
}
