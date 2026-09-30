type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Simple in-memory cache (Phase 1.0).
 * Designed so a Redis adapter can replace this later without changing callers.
 */
export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(prefixOrKey: string): void {
    for (const key of this.store.keys()) {
      if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const publicCache = new MemoryCache();

export const PUBLIC_CACHE_TTL_MS = 45_000;
