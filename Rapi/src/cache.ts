/* ══════════════════════════════════════════════════════════════
   RAPI — Hardened In-Memory Cache Layer
   ══════════════════════════════════════════════════════════════ */

import NodeCache from "node-cache";
import { CONFIG } from "./config";

/* ─── Cache Value Wrapper ─────────────────────────────────── */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  staleAt: number;
  ttl: number;
}

/* ─── Main Cache Class ────────────────────────────────────── */

class Cache {
  private store: NodeCache;
  private telemetry = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    staleHits: 0,
    backgroundRefreshes: 0,
  };
  private bgRefreshLocks = new Set<string>();
  private readonly maxKeys: number;
  private readonly staleTTL: number;
  private readonly minInterval: number;

  constructor() {
    this.store = new NodeCache({
      stdTTL: CONFIG.CACHE.PNR_TTL,
      checkperiod: CONFIG.CACHE.CHECK_PERIOD,
      useClones: false,
      maxKeys: CONFIG.CACHE.MAX_KEYS,
    });

    this.maxKeys = CONFIG.CACHE.MAX_KEYS;
    this.staleTTL = CONFIG.CACHE.STALE_TTL;
    this.minInterval = CONFIG.CACHE.MIN_SCRAPE_INTERVAL;

    this.store.on("del", (_key: string, value: unknown) => {
      if (value !== undefined) {
        this.telemetry.evictions++;
      }
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get<CacheEntry<T>>(key);
    if (!entry) {
      this.telemetry.misses++;
      return undefined;
    }

    const now = Date.now();

    if (now < entry.fetchedAt + entry.ttl * 1000) {
      this.telemetry.hits++;
      return entry.data;
    }

    if (now < entry.staleAt) {
      this.telemetry.staleHits++;
      return entry.data;
    }

    this.store.del(key);
    this.telemetry.misses++;
    return undefined;
  }

  set<T>(key: string, value: T, ttlSeconds: number): boolean {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      fetchedAt: now,
      staleAt: now + (ttlSeconds + this.staleTTL) * 1000,
      ttl: ttlSeconds,
    };
    const success = this.store.set(key, entry, ttlSeconds + this.staleTTL);
    if (success) this.telemetry.sets++;
    return success;
  }

  has(key: string): boolean {
    const entry = this.store.get<CacheEntry<unknown>>(key);
    if (!entry) return false;
    return Date.now() < entry.staleAt;
  }

  isFresh(key: string): boolean {
    const entry = this.store.get<CacheEntry<unknown>>(key);
    if (!entry) return false;
    return Date.now() < entry.fetchedAt + entry.ttl * 1000;
  }

  canScrape(key: string): boolean {
    const entry = this.store.get<CacheEntry<unknown>>(key);
    if (!entry) return true;
    return (Date.now() - entry.fetchedAt) / 1000 >= this.minInterval;
  }

  acquireRefreshLock(key: string): boolean {
    if (this.bgRefreshLocks.has(key)) return false;
    this.bgRefreshLocks.add(key);
    return true;
  }

  releaseRefreshLock(key: string): void {
    this.bgRefreshLocks.delete(key);
  }

  recordBackgroundRefresh(): void {
    this.telemetry.backgroundRefreshes++;
  }

  getTelemetry() {
    const nodeStats = this.store.getStats();
    return {
      ...this.telemetry,
      keys: nodeStats.keys,
      maxKeys: this.maxKeys,
    };
  }

  stats() {
    return this.store.getStats();
  }

  flush(): void {
    this.store.flushAll();
    this.bgRefreshLocks.clear();
    this.telemetry = { hits: 0, misses: 0, sets: 0, evictions: 0, staleHits: 0, backgroundRefreshes: 0 };
  }

  del(key: string): void {
    this.store.del(key);
  }

  get keys(): number {
    return this.store.getStats().keys;
  }

  async getOrRefresh<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
  ): Promise<{ data: T; cached: boolean; fromStale: boolean }> {
    const fresh = this.get<T>(key);
    if (fresh !== undefined) {
      const entry = this.store.get<CacheEntry<T>>(key);
      const now = Date.now();
      if (entry && now < entry.fetchedAt + entry.ttl * 1000) {
        return { data: fresh, cached: true, fromStale: false };
      }
      if (this.canScrape(key) && this.acquireRefreshLock(key)) {
        this.recordBackgroundRefresh();
        fetcher()
          .then((freshData) => this.set(key, freshData, ttl))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Cache] Background refresh failed for ${key}: ${msg}`);
          })
          .finally(() => this.releaseRefreshLock(key));
      }
      return { data: fresh, cached: true, fromStale: true };
    }

    // NOTE: this.get() above already incremented `misses` for the cache
    // miss, so we must NOT count it again here (double-count bug).
    const freshData = await fetcher();
    this.set(key, freshData, ttl);
    return { data: freshData, cached: false, fromStale: false };
  }
}

export const cache = new Cache();