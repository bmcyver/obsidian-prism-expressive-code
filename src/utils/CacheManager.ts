import { LRUCache } from './LRUCache';
import { clearStyleCache } from '../prism/scopeMapping';

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
    clearStyleCache();
  }
}

export const cacheManager = CacheManager.getInstance();
