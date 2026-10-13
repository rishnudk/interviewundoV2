'use client';

import { useEffect } from 'react';

// ============================================================
// KeepAliveProvider
// Pings the Render backend every 14 minutes to prevent the
// free-tier service from spinning down (spin-down happens
// after ~15 minutes of inactivity).
// ============================================================

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://interviewundo.onrender.com';

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

async function pingBackend(): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[KeepAlive] Health check returned non-OK status:', res.status);
    }
  } catch (err) {
    console.warn('[KeepAlive] Health check failed:', err);
  }
}

export function KeepAliveProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ping immediately on mount so the backend wakes up when
    // the first user lands on the page.
    pingBackend();

    const intervalId = setInterval(pingBackend, PING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return <>{children}</>;
}
