import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Decode the `exp` claim from a JWT without verifying the signature.
 * Returns expiry as a Unix timestamp in milliseconds, or 0 on failure.
 */
function getJwtExpiry(jwt: string): number {
  try {
    const base64Payload = jwt.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
    return decoded.exp ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// ── NextAuth Config ─────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    // ── jwt() is called on every session read ─────────────────────────────
    // • On first sign-in: `account` and `profile` are populated → call backend
    // • On subsequent reads: only `token` is available → check expiry + refresh
    async jwt({ token, account, profile, user }) {
      const backendUrl =
        process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

      // ── FIRST SIGN-IN ────────────────────────────────────────────────────
      if (account && profile) {
        try {
          const provider = account.provider;

          // Build provider-specific payload
          const body =
            provider === 'github'
              ? {
                  githubId: profile.id?.toString() || user?.id,
                  email: profile.email || user?.email,
                  name: profile.name || (profile as any).login || user?.name || 'GitHub User',
                  image: (profile as any).avatar_url || user?.image || null,
                }
              : {
                  googleId: (profile as any).sub || user?.id,
                  email: profile.email || user?.email,
                  name: profile.name || user?.name || 'Google User',
                  image: (profile as any).picture || user?.image || null,
                };

          const res = await fetch(`${backendUrl}/api/auth/${provider}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-shared-secret': process.env.AUTH_SHARED_SECRET || '',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Backend authentication failed');
          }

          const payload = await res.json();
          if (payload.success && payload.data) {
            token.accessToken = payload.data.accessToken;
            token.refreshToken = payload.data.refreshToken;
            token.backendUser = payload.data.user;
            // Read actual expiry from the JWT claim itself — no expiresIn dependency
            token.accessTokenExpiry = getJwtExpiry(payload.data.accessToken);
            delete token.error;
          } else {
            throw new Error('Unexpected backend response structure');
          }
        } catch (error) {
          console.error('[auth] First sign-in backend call failed:', error);
          // Propagate failure so session.error is set and the UI can react
          token.error = 'BackendAuthFailed';
        }

        // Always return after first sign-in — don't fall through to refresh logic
        return token;
      }

      // ── SUBSEQUENT CALLS: PROACTIVE TOKEN REFRESH ────────────────────────
      // If the access token is missing, expired, or within 60 seconds of expiry,
      // exchange the refresh token for a new pair via the backend.
      const expiry = token.accessTokenExpiry as number | undefined;
      const needsRefresh = !token.accessToken || !expiry || Date.now() >= expiry - 60_000;

      if (needsRefresh && token.refreshToken) {
        try {
          const res = await fetch(`${backendUrl}/api/auth/refreshToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Token refresh failed');
          }

          const payload = await res.json();
          if (payload.success && payload.data) {
            token.accessToken = payload.data.accessToken;
            token.refreshToken = payload.data.refreshToken;
            token.accessTokenExpiry = getJwtExpiry(payload.data.accessToken);
            delete token.error;
          } else {
            throw new Error('Invalid refresh response structure');
          }
        } catch (error) {
          console.error('[auth] Token refresh failed:', error);
          // This is the key signal: frontend will detect this and force re-login
          token.error = 'RefreshAccessTokenError';
        }
      }

      return token;
    },

    // ── session() shapes what useSession() returns to the client ───────────
    async session({ session, token }) {
      // Always propagate error state so the UI can detect and react to failures
      session.error = token.error as string | undefined;

      if (token.accessToken && token.backendUser && !token.error) {
        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string | undefined;
        session.user = {
          ...session.user,
          ...(token.backendUser as any),
        };
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
});
