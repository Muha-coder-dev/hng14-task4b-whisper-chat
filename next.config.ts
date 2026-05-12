import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Expose the Koyeb base URL to server-side route handlers only (not the browser bundle)
  env: {
    KOYEB_API_URL: process.env.KOYEB_API_URL ?? 'https://whisperbox.koyeb.app',
  },
};

export default nextConfig;