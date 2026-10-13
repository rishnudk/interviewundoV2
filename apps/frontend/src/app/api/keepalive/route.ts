import { NextResponse } from 'next/server';

// GET /api/keepalive — pings Next.js frontend AND triggers Express backend keepalive
export async function GET() {
  const backendUrl =
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  let backendStatus = 'unreachable';
  let backendDetails = null;

  try {
    const res = await fetch(`${backendUrl}/api/keepalive`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    backendDetails = await res.json();
    backendStatus = res.ok ? 'alive' : 'degraded';
  } catch {
    backendStatus = 'error';
  }

  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    frontend: 'up',
    backend: backendStatus,
    details: backendDetails,
  });
}
