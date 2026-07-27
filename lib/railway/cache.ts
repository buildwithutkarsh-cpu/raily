/* ══════════════════════════════════════════════════════════════
   RAILWAY — Cache Layer
   Simple in-memory cache with TTL support.
   Deduplicates in-flight requests to prevent thundering herd.
   ══════════════════════════════════════════════════════════════ */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: string;
}

export class RailwayCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private hitCount = 0;
  private missCount = 0;
  private readonly defaultTTL: number;

  constructor(defaultTTLMs = 60_000) {
    this.defaultTTL = defaultTTLMs;
  }

  /* ─── Get / Set ──────────────────────────────────────────── */

  get<T>(key: string): { data: T; cached: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return { data: entry.data as T, cached: true };
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
      cachedAt: new Date().toISOString(),
    });
  }

  /* ─── Deduplication ──────────────────────────────────────── */

  /**
   * Deduplicates concurrent requests for the same key.
   * If a request is already in-flight for this key, returns the existing promise.
   */
  async dedupe<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) return cached.data;

    const inflight = this.inflight.get(key) as Promise<T> | undefined;
    if (inflight) return inflight;

    const promise = fetcher()
      .then((data) => {
        this.set(key, data, ttlMs);
        this.inflight.delete(key);
        return data;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /* ─── Cache Invalidation ─────────────────────────────────── */

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.store.keys()) {
      if (pattern.test(key)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  /* ─── Statistics ─────────────────────────────────────────── */

  get stats() {
    return {
      size: this.store.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      inflightCount: this.inflight.size,
      hitRate: this.hitCount + this.missCount > 0
        ? Math.round((this.hitCount / (this.hitCount + this.missCount)) * 100)
        : 0,
    };
  }

  /* ─── Key Builders ───────────────────────────────────────── */

  static key = {
    stations: (query: string) => `stations:${query.toLowerCase().trim()}`,
    trains: (from: string, to: string, date: string) => `trains:${from}:${to}:${date}`,
    schedule: (train: string) => `schedule:${train}`,
    seatAvail: (train: string, from: string, to: string, date: string, cls?: string) =>
      `seats:${train}:${from}:${to}:${date}:${cls || "all"}`,
    pnr: (pnr: string) => `pnr:${pnr}`,
    liveStatus: (train: string) => `live:${train}`,
    fare: (train: string, from: string, to: string) => `fare:${train}:${from}:${to}`,
    coach: (train: string) => `coach:${train}`,
  };
}
