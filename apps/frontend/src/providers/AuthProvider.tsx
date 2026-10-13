'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { LoginDTO, RegisterDTO, AuthResponseDTO } from '@interviewprep/shared-types';

// ── Constants ───────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000';
// Must match the backend route exactly: POST /api/auth/refreshToken
const REFRESH_URL = `${BACKEND_URL}/api/auth/refreshToken`;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginDTO) => Promise<void>;
  register: (details: RegisterDTO) => Promise<void>;
  logout: () => void;
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// BACKEND_URL and REFRESH_URL are defined at module level above

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const { data: session, status: sessionStatus } = useSession();

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    if (sessionStatus === 'authenticated') {
      signOut();
    }
  }, [sessionStatus]);

  const refreshSession = useCallback(
    async (existingRefreshToken: string) => {
      try {
        // Use REFRESH_URL (module-level constant) — matches backend route exactly
        const response = await fetch(REFRESH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: existingRefreshToken }),
        });

        if (!response.ok) throw new Error('Token refresh failed');

        const payload = await response.json();
        if (payload.success && payload.data) {
          const { accessToken, refreshToken: newRefreshToken } = payload.data;
          setToken(accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Restore user from localStorage if present
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
          return accessToken;
        } else {
          throw new Error('Invalid refresh response structure');
        }
      } catch (err) {
        console.warn('[AuthProvider] Token refresh failed, logging out:', err);
        logout();
        return null;
      }
    },
    [logout],
  );

  // ── Server-side refresh failure detection ──────────────────────────────────
  // When NextAuth's server-side jwt() callback fails to refresh the token,
  // it sets session.error = 'RefreshAccessTokenError'. We detect that here
  // and force a full logout so the user gets a clean re-login prompt instead
  // of the broken "logged-in but 401" ghost state.
  const { data: sessionForError } = useSession();
  useEffect(() => {
    if (
      sessionForError?.error === 'RefreshAccessTokenError' ||
      sessionForError?.error === 'BackendAuthFailed'
    ) {
      console.warn(
        '[AuthProvider] Session error detected, forcing re-authentication:',
        sessionForError.error,
      );
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      signOut({ callbackUrl: '/login?reason=session_expired' });
    }
  }, [sessionForError?.error]);

  // Helper to check if a JWT access token is expired or expiring in <= 15 seconds
  const isJwtExpired = (jwtToken: string): boolean => {
    try {
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      return payload.exp * 1000 <= Date.now() + 15000;
    } catch {
      return true;
    }
  };

  // Synchronize Next-Auth session
  useEffect(() => {
    const syncSession = async () => {
      if (sessionStatus === 'authenticated' && session?.accessToken && session?.user) {
        if (session.refreshToken) {
          localStorage.setItem('refreshToken', session.refreshToken as string);
        }

        const storedRt = localStorage.getItem('refreshToken');
        if (isJwtExpired(session.accessToken as string) && storedRt) {
          await refreshSession(storedRt);
        } else {
          setToken(session.accessToken as string);
          setUser({
            id: session.user.id,
            name: session.user.name || 'GitHub User',
            email: session.user.email || '',
            role: session.user.role || 'STUDENT',
            image: session.user.image,
          });
        }
        setLoading(false);
      }
    };
    syncSession();
  }, [session, sessionStatus, refreshSession]);

  // Periodic silent refresh (runs every 14 minutes since JWT expiry is 15 minutes)
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(
      async () => {
        const rt = localStorage.getItem('refreshToken');
        if (rt) {
          await refreshSession(rt);
        }
      },
      14 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [token, refreshSession]);

  // Initial boot check — only for credential-based (non-OAuth) users
  useEffect(() => {
    const initializeAuth = async () => {
      if (sessionStatus === 'loading') return;
      // OAuth users are handled by the syncSession effect above
      if (sessionStatus === 'authenticated') return;

      const rt = localStorage.getItem('refreshToken');
      if (rt) {
        await refreshSession(rt);
      } else {
        // No session, no stored token — user is definitely logged out
        setLoading(false);
      }
    };

    initializeAuth();
  }, [refreshSession, sessionStatus]);

  const login = async (credentials: LoginDTO) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Login failed');
      }

      const { user: userData, accessToken, refreshToken } = payload.data as AuthResponseDTO;
      setUser(userData);
      setToken(accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (details: RegisterDTO) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Registration failed');
      }

      const { user: userData, accessToken, refreshToken } = payload.data as AuthResponseDTO;
      setUser(userData);
      setToken(accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const apiFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      let response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
      });

      // Handle token expiration / 401
      if (response.status === 401) {
        const rt = localStorage.getItem('refreshToken');
        if (rt) {
          const newAccessToken = await refreshSession(rt);
          if (newAccessToken) {
            headers.set('Authorization', `Bearer ${newAccessToken}`);
            response = await fetch(`${BACKEND_URL}${path}`, {
              ...options,
              headers,
            });
          }
        }
      }

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'API request failed');
      }

      return payload.data as T;
    },
    [token, refreshSession],
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
