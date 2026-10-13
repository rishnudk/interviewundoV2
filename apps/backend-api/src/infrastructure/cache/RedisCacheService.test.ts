import { describe, it, expect, beforeEach } from 'vitest';
import { RedisCacheService } from './RedisCacheService';

describe('RedisCacheService with In-Memory / Redis Fallback', () => {
  const cache = new RedisCacheService();

  beforeEach(async () => {
    await cache.delete('test-key');
    await cache.delete('test-obj');
  });

  it('should store and retrieve string data', async () => {
    await cache.set('test-key', 'hello-world');
    const val = await cache.get<string>('test-key');
    expect(val).toBe('hello-world');
  });

  it('should store and retrieve complex objects', async () => {
    const payload = { userId: '123', name: 'Alice', active: true };
    await cache.set('test-obj', payload);
    const val = await cache.get<typeof payload>('test-obj');
    expect(val).toEqual(payload);
  });

  it('should delete keys properly', async () => {
    await cache.set('test-key', 'to-be-deleted');
    await cache.delete('test-key');
    const val = await cache.get<string>('test-key');
    expect(val).toBeNull();
  });

  it('should return null for non-existent keys', async () => {
    const val = await cache.get<string>('does-not-exist');
    expect(val).toBeNull();
  });
});
