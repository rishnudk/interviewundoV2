import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// ============================================================
// Redis Client — Used by CacheService & Health Checks
// Gracefully degrades to an in-memory store if REDIS_URL is omitted
// ============================================================

export const isRedisConfigured = Boolean(env.REDIS_URL && env.REDIS_URL.trim().length > 0);

class InMemoryRedisMock {
  private store = new Map<string, { value: string; expiry?: number }>();
  private handlers = new Map<string, Function[]>();

  on(event: string, callback: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(callback);
    return this;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
    let expiry: number | undefined;
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      expiry = Date.now() + args[1] * 1000;
    }
    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = (current ? parseInt(current, 10) || 0 : 0) + 1;
    const item = this.store.get(key);
    const expiry = item?.expiry;
    this.store.set(key, { value: String(num), expiry });
    return num;
  }

  async decr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = (current ? parseInt(current, 10) || 0 : 0) - 1;
    const item = this.store.get(key);
    const expiry = item?.expiry;
    this.store.set(key, { value: String(num), expiry });
    return num;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiry = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item || !item.expiry) return -1;
    const remaining = Math.round((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matching: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matching.push(key);
      }
    }
    return matching;
  }

  async publish(_channel: string, _message: string): Promise<number> {
    return 1;
  }

  async subscribe(..._channels: string[]): Promise<'OK'> {
    return 'OK';
  }

  disconnect() {}
  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

let redisClient: any;
let redisSub: any;

if (isRedisConfigured) {
  try {
    redisClient = new Redis(env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis retry count exceeded, falling back silently');
          return null; // Stop reconnecting
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected');
    });

    redisClient.on('error', (err: any) => {
      logger.warn({ err: err.message }, '⚠️ Redis connection error (will fallback gracefully)');
    });

    redisSub = new Redis(env.REDIS_URL!, {
      enableReadyCheck: false,
      retryStrategy: (times) => (times > 3 ? null : 1000),
    });

    redisSub.on('connect', () => {
      logger.info('✅ Redis subscriber connected');
    });

    redisSub.on('error', (err: any) => {
      logger.warn({ err: err.message }, '⚠️ Redis subscriber error (will fallback gracefully)');
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, '⚠️ Failed to instantiate Redis, using in-memory mock');
    redisClient = new InMemoryRedisMock();
    redisSub = new InMemoryRedisMock();
  }
} else {
  logger.info('ℹ️ REDIS_URL not configured. Using in-memory store for cache and session state.');
  redisClient = new InMemoryRedisMock();
  redisSub = new InMemoryRedisMock();
}

export const redis = redisClient;
export const redisSubscriber = redisSub;
