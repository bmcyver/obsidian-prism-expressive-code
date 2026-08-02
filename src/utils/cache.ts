export class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 100) {
    this.max = Math.max(1, max);
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const val = this.cache.get(key);
    if (val !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, val);
    }
    return val;
  }

  set(key: K, val: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, val);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class CacheManager {
  private static instance: CacheManager;
  private caches: Set<LRUCache<unknown, unknown>> = new Set();

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public register<K, V>(cache: LRUCache<K, V>): LRUCache<K, V> {
    this.caches.add(cache);
    return cache;
  }

  public clearAllCaches(): void {
    for (const cache of this.caches) {
      cache.clear();
    }
  }
}

export const cacheManager = CacheManager.getInstance();
