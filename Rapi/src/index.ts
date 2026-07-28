/* ══════════════════════════════════════════════════════════════
   RAPI — Self-hosted Indian Railways API
   ══════════════════════════════════════════════════════════════
   A 100% free, scraping-based REST API service.
   
   Sources:
     - erail.in:     Train search, train info, route
     - confirmtkt:   PNR status
     - etrain.info:  Live running status
   ══════════════════════════════════════════════════════════════ */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { CONFIG } from "./config";

// Load .env
dotenv.config();

// Route imports
import pnrRoutes from "./routes/pnr";
import trainRoutes from "./routes/trains";
import stationRoutes from "./routes/stations";
import adminRoutes from "./routes/admin";

const app = express();

/* ─── Middleware ───────────────────────────────────────────── */

app.use(cors());
app.use(express.json());

// Global rate limiting — 100 req/min per IP, burst to 200
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    retryAfter: 60,
  },
});
app.use("/api/", limiter);

// Security headers
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

/* ─── Routes ──────────────────────────────────────────────── */

app.get("/", (_req, res) => {
  return res.json({
    name: "RAPI — Indian Railways API",
    version: "1.0.0",
    endpoints: {
      pnr: "GET /api/v1/pnr/:pnr",
      trainSearch: "GET /api/v1/trains/search?from=NDLS&to=BCT",
      trainLive: "GET /api/v1/trains/:trainNumber/live?date=DD-MM-YYYY",
      trainInfo: "GET /api/v1/trains/:trainNumber/info",
      trainAvailability: "GET /api/v1/trains/:trainNumber/availability?from=NDLS&to=BCT&date=DD-MM-YYYY",
      trainFare: "GET /api/v1/trains/:trainNumber/fare?from=NDLS&to=BCT&date=DD-MM-YYYY",
      adminCache: "GET /api/v1/admin/cache",
      adminHealth: "GET /api/v1/admin/health",
      stationAutocomplete: "GET /api/v1/stations/autocomplete?q=DEL",
    },
  });
});

app.use("/api/v1/pnr", pnrRoutes);
app.use("/api/v1/trains", trainRoutes);
app.use("/api/v1/stations", stationRoutes);
app.use("/api/v1/admin", adminRoutes);

/* ─── 404 Handler ──────────────────────────────────────────── */

app.use((_req, res) => {
  return res.status(404).json({
    success: false,
    error: "Endpoint not found. See GET / for available endpoints.",
  });
});

/* ─── Error Handler ────────────────────────────────────────── */

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[RAPI] Unhandled error:", err.message);
  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

/* ─── Start ────────────────────────────────────────────────── */

// Don't start listening when imported by tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  RAPI — Indian Railways API                  ║
║  Running on http://0.0.0.0:${CONFIG.PORT}              ║
║                                              ║
║  Endpoints:                                  ║
║    PNR:     /api/v1/pnr/:pnr                 ║
║    Search:  /api/v1/trains/search?from=&to=   ║
║    Live:    /api/v1/trains/:no/live          ║
║    Info:    /api/v1/trains/:no/info          ║
║    Avail:   /api/v1/trains/:no/availability  ║
║    Fare:    /api/v1/trains/:no/fare          ║
║    Cache:   /api/v1/admin/cache              ║
║    Health:  /api/v1/admin/health             ║
║    Station: /api/v1/stations/autocomplete?q= ║
╚═══════════════════════════════════════════════╝
  `);
  });
}

export default app;
