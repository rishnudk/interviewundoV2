import { redis } from '../../config/redis';
import type { ICacheService } from '../../domain/ports/services/ICacheService';

// ============================================================
// RedisCacheService
// Implements ICacheService using Redis with automatic in-memory fallback
// If Redis is unreachable or omitted, caching continues in-memory
// ============================================================

export class RedisCacheService implements ICacheService {
  private memoryCache = new Map<string, { value: string; expiry?: number }>();

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch {
      // Fallback to local memory cache
    }

    const mem = this.memoryCache.get(key);
    if (!mem) return null;
    if (mem.expiry && mem.expiry < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    try {
      return JSON.parse(mem.value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value);
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryCache.set(key, { value: data, expiry });

    try {
      if (ttlSeconds) {
        await redis.set(key, data, 'EX', ttlSeconds);
      } else {
        await redis.set(key, data);
      }
    } catch {
      // Fail silently for Redis write; in-memory cache already stored it
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await redis.del(key);
    } catch {}
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of this.memoryCache.keys()) {
      if (regex.test(k)) {
        this.memoryCache.delete(k);
      }
    }

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {}
  }
}
