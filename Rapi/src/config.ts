/* ══════════════════════════════════════════════════════════════
   RAPI — Configuration
   ══════════════════════════════════════════════════════════════ */

import dotenv from "dotenv";
dotenv.config();

export interface CacheConfig {
  PNR_TTL: number;
  LIVE_TTL: number;
  TRAIN_SEARCH_TTL: number;
  ROUTE_TTL: number;
  AVAIL_TTL: number;
  MAX_KEYS: number;
  CHECK_PERIOD: number;
  STALE_TTL: number;
  MIN_SCRAPE_INTERVAL: number;
}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_TEST: process.env.NODE_ENV === "test",

  /* ─── CORS ──────────────────────────────────────────────── */
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",").map(s => s.trim()),

  /* ─── Authentication ────────────────────────────────────── */
  API_KEY: process.env.API_KEY || "",
  ADMIN_KEY: process.env.ADMIN_KEY || "",

  CACHE: {
    PNR_TTL: parseInt(process.env.CACHE_TTL_PNR || "180", 10),
    LIVE_TTL: parseInt(process.env.CACHE_TTL_LIVE || "120", 10),
    TRAIN_SEARCH_TTL: parseInt(process.env.CACHE_TTL_SEARCH || "600", 10),
    ROUTE_TTL: parseInt(process.env.CACHE_TTL_ROUTES || "86400", 10),
    AVAIL_TTL: parseInt(process.env.CACHE_TTL_AVAIL || "120", 10),
    MAX_KEYS: parseInt(process.env.CACHE_MAX_KEYS || "5000", 10),
    CHECK_PERIOD: parseInt(process.env.CACHE_CHECK_PERIOD || "60", 10),
    STALE_TTL: parseInt(process.env.CACHE_STALE_TTL || "600", 10),
    MIN_SCRAPE_INTERVAL: parseInt(process.env.CACHE_MIN_INTERVAL || "30", 10),
  } as CacheConfig,

  /* ─── Rate Limiting ─────────────────────────────────────── */
  RATE_LIMIT: {
    WINDOW_MS: 60_000,
    MAX_REQUESTS: 100,
    ADMIN_MAX_REQUESTS: 10,
  },

  TIMEOUT: 15_000,
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,
} as const;

/* ─── Source URLs ──────────────────────────────────────────── */

export const SOURCES = {
  ERAIL_BASE: "https://erail.in",
  CONFIRMTKT_BASE: "https://www.confirmtkt.com",
  ETRAIN_BASE: "https://etrain.info",
  NTES_BASE: "https://enquiry.indianrail.gov.in",

  TRAIN_SEARCH: (from: string, to: string): string =>
    `https://erail.in/rail/getTrains.aspx?Station_From=${from}&Station_To=${to}&DataSource=0&Language=0&Cache=true`,

  TRAIN_INFO: (trainNo: string): string =>
    `https://erail.in/rail/getTrains.aspx?TrainNo=${trainNo}&DataSource=0&Language=0&Cache=true`,

  TRAIN_ROUTE: (trainId: string): string =>
    `https://erail.in/data.aspx?Action=TRAINROUTE&Password=2012&Data1=${trainId}&Data2=0&Cache=true`,

  PNR_STATUS: (pnr: string): string =>
    `https://www.indianrail.gov.in/enquiry/CommonCaptcha?inputPnrNo=${pnr}&inputPage=PNR&language=en`,

  LIVE_STATUS: (trainNo: string, date: string): string =>
    `https://etrain.info/train/${trainNo}/live?date=${date}`,

  AVAILABILITY: (trainNo: string, from: string, to: string, date: string, quota: string): string =>
    `https://erail.in/rail/getAvailability.aspx?TrainNo=${trainNo}&From=${from}&To=${to}&Date=${date}&Quota=${quota}&DataSource=0&Language=0&Cache=true`,
} as const;