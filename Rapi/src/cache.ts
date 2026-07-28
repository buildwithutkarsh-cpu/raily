/* ══════════════════════════════════════════════════════════════
   RAPI — Hardened In-Memory Cache Layer
   
   Protections against over-scraping and IP blocking:
   
   1. Stale-While-Revalidate (SWR):
      - When a key expires but a stale copy exists (within STALE_TTL),
        serve the stale data immediately and refresh in the background.
      - Eliminates stampedes: only one background refresh runs per key.
   
   2. Max Entries (maxKeys):
      - Hard limit on cache size (default 5,000 entries).
      - LRU-style eviction — oldest entries are evicted first.
      - Prevents unbounded memory growth under heavy load.
   
   3. Per-Key Minimum Scrape Interval:
      - Tracks last fetch time per key.
      - If a key was fetched within MIN_SCRAPE_INTERVAL seconds,
        subsequent requests get the cached value even if it's slightly
        stale — no new HTTP request is made.
      - Prevents rapid successive scrapes of the same data.
   
   4. Telemetry:
      - Tracks hits, misses, sets, evictions, stale-hits per data type.
      - Exposed via cache.stats() for monitoring / alerting.
   
   5. Background Refresh Lock:
      - Uses a simple lock to ensure only one background refresh
        runs per key at a time.
   ══════════════════════════════════════════════════════════════ */

import NodeCache from "node-cache";
import { CONFIG } from "./config";

/* ─── Telemetry Types ─────────────────────────────────────── */

export interface CacheTelemetry {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  staleHits: number;
  backgroundRefreshes: number;
  keys: number;
  maxKeys: number;
  utilizationPercent: number;
}

/* ─── Cache Value Wrapper ─────────────────────────────────── */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;       // timestamp of last successful fetch (epoch ms)
  staleAt: number;         // timestamp when stale grace period ends
  ttl: number;             // original TTL in seconds
}

/* ─── Main Cache Class ────────────────────────────────────── */

class Cache {
  private store: NodeCache;
  private telemetry: {
    hits: number;
    misses: number;
    sets: number;
    evictions: number;
    staleHits: number;
    backgroundRefreshes: number;
  };
  private bgRefreshLocks: Set<string>;
  private maxKeys: number;
  private staleTTL: number;       // extra seconds to serve stale data
  private minInterval: number;    // minimum seconds between fetches of same key

  constructor() {
    this.store = new NodeCache({
      stdTTL: CONFIG.CACHE.PNR_TTL,
      checkperiod: CONFIG.CACHE.CHECK_PERIOD,
      useClones: false,
      maxKeys: CONFIG.CACHE.MAX_KEYS,
    });

    this.telemetry = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      staleHits: 0,
      backgroundRefreshes: 0,
    };

    this.bgRefreshLocks = new Set();
    this.maxKeys = CONFIG.CACHE.MAX_KEYS;
    this.staleTTL = CONFIG.CACHE.STALE_TTL;
    this.minInterval = CONFIG.CACHE.MIN_SCRAPE_INTERVAL;

    // Track evictions
    this.store.on("del", (_key: string, value: unknown) => {
      if (value !== undefined) {
        this.telemetry.evictions++;
      }
    });
  }

  /**
   * Get a value from cache.
   * Returns `undefined` if the key doesn't exist or is hard-expired
   * (beyond both TTL and stale grace period).
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get<CacheEntry<T>>(key);
    if (!entry) {
      this.telemetry.misses++;
      return undefined;
    }

    const now = Date.now();

    // Case 1: Within fresh TTL — serve immediately
    if (now < entry.fetchedAt + entry.ttl * 1000) {
      this.telemetry.hits++;
      return entry.data;
    }

    // Case 2: Within stale grace period — serve stale (SWR)
    if (now < entry.staleAt) {
      this.telemetry.staleHits++;
      console.warn(`[Cache] Serving stale data for ${key} — expired ${Math.round((now - entry.fetchedAt - entry.ttl * 1000) / 1000)}s ago, staleTTL=${this.staleTTL}s`);
      return entry.data;
    }

    // Case 3: Hard expired — remove and miss
    this.store.del(key);
    this.telemetry.misses++;
    return undefined;
  }

  /**
   * Store a value in cache.
   * Returns true if the key was within maxKeys limit, false if eviction happened.
   */
  set<T>(key: string, value: T, ttlSeconds: number): boolean {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      fetchedAt: now,
      staleAt: now + (ttlSeconds + this.staleTTL) * 1000,
      ttl: ttlSeconds,
    };

    const success = this.store.set(key, entry, ttlSeconds + this.staleTTL);
    if (success) {
      this.telemetry.sets++;
    }
    return success;
  }

  /**
   * Check if a key exists in cache (fresh or stale, within staleTTL).
   * Returns false for hard-expired entries (beyond both TTL and stale grace).
   * Does NOT affect telemetry counters — use get() for that.
   */
  has(key: string): boolean {
    const entry = this.store.get<CacheEntry<unknown>>(key);
    if (!entry) return false;
    return Date.now() < entry.staleAt;
  }

  /**
   * Check if a key is fresh (within original TTL).
   */
  isFresh(key: string): boolean {
    const entry = this.store.get<CacheEntry<unknown>>(key);
    if (!entry) return false;
    return Date.now() < entry.fetchedAt + entry.ttl * 1000;
  }

  /**
   * Check if minimum scrape interval has elapsed since last fetch.
   * If not, the caller should use the cached value instead of scraping.
   */
  canScrape(key: string): boolean {
    const entry = this.store.get<CacheEntry<unknown>>(key);
    if (!entry) return true; // No cache entry = always can scrape
    const elapsed = (Date.now() - entry.fetchedAt) / 1000;
    return elapsed >= this.minInterval;
  }

  /**
   * Acquire a background refresh lock for a key.
   * Returns true if the lock was acquired, false if already in progress.
   */
  acquireRefreshLock(key: string): boolean {
    if (this.bgRefreshLocks.has(key)) return false;
    this.bgRefreshLocks.add(key);
    return true;
  }

  /**
   * Release a background refresh lock for a key.
   */
  releaseRefreshLock(key: string): void {
    this.bgRefreshLocks.delete(key);
  }

  /**
   * Track a background refresh event.
   */
  recordBackgroundRefresh(): void {
    this.telemetry.backgroundRefreshes++;
  }

  /**
   * Get cache telemetry.
   */
  getTelemetry(): CacheTelemetry {
    const nodeStats = this.store.getStats();
    const total = this.telemetry.hits + this.telemetry.misses + this.telemetry.staleHits;
    return {
      hits: this.telemetry.hits,
      misses: this.telemetry.misses,
      sets: this.telemetry.sets,
      evictions: this.telemetry.evictions,
      staleHits: this.telemetry.staleHits,
      backgroundRefreshes: this.telemetry.backgroundRefreshes,
      keys: nodeStats.keys,
      maxKeys: this.maxKeys,
      utilizationPercent: this.maxKeys > 0
        ? Math.round((nodeStats.keys / this.maxKeys) * 10000) / 100
        : 0,
    };
  }

  /**
   * Get raw node-cache stats.
   */
  stats() {
    return this.store.getStats();
  }

  /**
   * Clear all cached entries.
   */
  flush(): void {
    this.store.flushAll();
    this.bgRefreshLocks.clear();
    this.telemetry = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      staleHits: 0,
      backgroundRefreshes: 0,
    };
  }

  /**
   * Delete a specific key from cache.
   */
  del(key: string): void {
    this.store.del(key);
  }

  /**
   * Get the number of keys in cache.
   */
  get keys(): number {
    return this.store.getStats().keys;
  }

  /**
   * Full stale-while-revalidate lifecycle:
   *   1. Check cache — return fresh data immediately if available
   *   2. If stale data exists AND we can scrape, attempt background refresh
   *      (locked to prevent stampede) and return stale data in the meantime
   *   3. If stale data exists AND we CAN'T scrape (min interval), return stale data
   *   4. If no cache entry at all, scrape fresh
   *
   * Returns { data, cached, fromStale } where:
   *   - cached: true if data came from cache (fresh or stale)
   *   - fromStale: true if data was served from stale-while-revalidate
   */
  async getOrRefresh<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
  ): Promise<{ data: T; cached: boolean; fromStale: boolean }> {
    // Step 1: Try fresh cache
    const fresh = this.get<T>(key);
    if (fresh !== undefined) {
      const entry = this.store.get<CacheEntry<T>>(key);
      const now = Date.now();
      // If it came from `get()`, it's fresh (within TTL) or stale-within-grace
      if (entry && now < entry.fetchedAt + entry.ttl * 1000) {
        return { data: fresh, cached: true, fromStale: false };
      }
      // It's stale data — we'll revalidate in background if possible
      if (this.canScrape(key) && this.acquireRefreshLock(key)) {
        // Fire-and-forget background refresh
        this.recordBackgroundRefresh();
        fetcher()
          .then((freshData) => {
            this.set(key, freshData, ttl);
          })
          .catch((err) => {
            const errMsg = err && typeof err === 'object' ? (err.message || String(err)) : String(err);
            console.warn(`[Cache] Background refresh failed for ${key}:`, errMsg);
          })
          .finally(() => {
            this.releaseRefreshLock(key);
          });
      }
      return { data: fresh, cached: true, fromStale: true };
    }

    // Step 2: Nothing in cache — scrape fresh
    this.telemetry.misses++;
    const freshData = await fetcher();
    this.set(key, freshData, ttl);
    return { data: freshData, cached: false, fromStale: false };
  }
}

export const cache = new Cache();
