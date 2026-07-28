/* ══════════════════════════════════════════════════════════════
   RAPI — Configuration
   ══════════════════════════════════════════════════════════════ */

import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

  CACHE: {
    PNR_TTL: parseInt(process.env.CACHE_TTL_PNR || "180", 10),               // 3 min
    LIVE_TTL: parseInt(process.env.CACHE_TTL_LIVE || "120", 10),             // 2 min
    TRAIN_SEARCH_TTL: parseInt(process.env.CACHE_TTL_SEARCH || "600", 10),    // 10 min
    ROUTE_TTL: parseInt(process.env.CACHE_TTL_ROUTES || "86400", 10),        // 24 hr
    AVAIL_TTL: parseInt(process.env.CACHE_TTL_AVAIL || "120", 10),            // 2 min
    MAX_KEYS: parseInt(process.env.CACHE_MAX_KEYS || "5000", 10),             // prevent memory blowup
    CHECK_PERIOD: parseInt(process.env.CACHE_CHECK_PERIOD || "60", 10),      // expiry sweep every 60s
    STALE_TTL: parseInt(process.env.CACHE_STALE_TTL || "600", 10),           // 10 min stale grace (swr)
    MIN_SCRAPE_INTERVAL: parseInt(process.env.CACHE_MIN_INTERVAL || "30", 10), // 30s min between scrapes of same key
  },

  TIMEOUT: 15_000,   // 15s request timeout
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,  // 1s initial backoff
} as const;

/* ─── Source URLs ──────────────────────────────────────────── */

export const SOURCES = {
  ERAIL_BASE: "https://erail.in",
  CONFIRMTKT_BASE: "https://www.confirmtkt.com",
  ETRAIN_BASE: "https://etrain.info",
  NTES_BASE: "https://enquiry.indianrail.gov.in",

  /* erail.in endpoints */
  TRAIN_SEARCH: (from: string, to: string) =>
    `https://erail.in/rail/getTrains.aspx?Station_From=${from}&Station_To=${to}&DataSource=0&Language=0&Cache=true`,

  TRAIN_INFO: (trainNo: string) =>
    `https://erail.in/rail/getTrains.aspx?TrainNo=${trainNo}&DataSource=0&Language=0&Cache=true`,

  TRAIN_ROUTE: (trainId: string) =>
    `https://erail.in/data.aspx?Action=TRAINROUTE&Password=2012&Data1=${trainId}&Data2=0&Cache=true`,

  /* confirmtkt endpoint */
  PNR_STATUS: (pnr: string) =>
    `https://www.confirmtkt.com/pnr-status/${pnr}`,

  /* etrain.info endpoint */
  LIVE_STATUS: (trainNo: string, date: string) =>
    `https://etrain.info/train/${trainNo}/live?date=${date}`,

  /* erail.in availability endpoint */
  AVAILABILITY: (trainNo: string, from: string, to: string, date: string, quota: string) =>
    `https://erail.in/rail/getAvailability.aspx?TrainNo=${trainNo}&From=${from}&To=${to}&Date=${date}&Quota=${quota}&DataSource=0&Language=0&Cache=true`,
} as const;
