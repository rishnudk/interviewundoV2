import { z } from 'zod';

// ============================================================
// Environment Configuration — Validated with Zod
// Fails fast on startup if any required variable is missing
// ============================================================

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis (Optional for free single-instance hosting)
  REDIS_URL: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Grok API (xAI)
  GROK_API_KEY: z.string().optional(),
  GROK_MODEL: z.string().default('grok-2'),

  // Shared secret for server-to-server NextAuth webhook/API endpoints security
  AUTH_SHARED_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
