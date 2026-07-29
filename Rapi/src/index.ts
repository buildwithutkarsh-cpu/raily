/* ══════════════════════════════════════════════════════════════
   RAPI — Self-hosted Indian Railways API
   ══════════════════════════════════════════════════════════════ */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { CONFIG } from "./config";
import { requestIdMiddleware, log } from "./utils/response";

dotenv.config();

import pnrRoutes from "./routes/pnr";
import trainRoutes from "./routes/trains";
import stationRoutes from "./routes/stations";
import adminRoutes from "./routes/admin";

const app = express();

/* ─── Middleware Stack ─────────────────────────────────────── */

// 1. Request ID — must be first for logging
app.use(requestIdMiddleware);

// 2. Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// 3. Strict CORS — only allow configured origins
app.use(cors({
  origin: CONFIG.IS_PRODUCTION ? CONFIG.ALLOWED_ORIGINS : "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "x-admin-key"],
  credentials: true,
  maxAge: 86400,
}));

// 4. Body parsing
app.use(express.json({ limit: "10kb" }));

// 5. General rate limiting — 100 req/min per IP, burst to 200
const generalLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
  max: CONFIG.RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      retryable: true,
    },
    timestamp: new Date().toISOString(),
  },
});
app.use("/api/", generalLimiter);

// 6. Admin rate limiting — stricter for admin endpoints
const adminLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
  max: CONFIG.RATE_LIMIT.ADMIN_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Admin rate limit exceeded. 10 requests per minute max.",
      retryable: true,
    },
    timestamp: new Date().toISOString(),
  },
});
app.use("/api/v1/admin/", adminLimiter);

// 7. Optional API key authentication middleware
app.use("/api/v1/", (req, res, next) => {
  // Skip auth for admin endpoints (they have their own auth)
  if (req.path.startsWith("/admin/")) {
    return next();
  }
  // Skip auth if no API key is configured
  if (!CONFIG.API_KEY) {
    return next();
  }
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey || apiKey !== CONFIG.API_KEY) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing API key. Set x-api-key header.",
        retryable: false,
      },
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

// 8. Request logging (structured JSON)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log("info", "request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration,
    });
  });
  next();
});

/* ─── Routes ───────────────────────────────────────────────── */

app.get("/", (_req, res) => {
  return res.json({
    name: "RAPI — Indian Railways API",
    version: "1.0.0",
    documentation: "See https://github.com/raily/rapi for full API docs",
    endpoints: {
      pnr: "GET /api/v1/pnr/:pnr",
      trainSearch: "GET /api/v1/trains/search?from=NDLS&to=BCT&date=DD-MM-YYYY",
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
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found. See GET / for available endpoints.",
      retryable: false,
    },
    timestamp: new Date().toISOString(),
  });
});

/* ─── Error Handler ────────────────────────────────────────── */

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log("error", "Unhandled error", {
    requestId: req.requestId,
    error: err.message,
    stack: CONFIG.IS_PRODUCTION ? undefined : err.stack,
  });
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      retryable: true,
    },
    timestamp: new Date().toISOString(),
  });
});

/* ─── Start ────────────────────────────────────────────────── */

if (process.env.NODE_ENV !== "test") {
  app.listen(CONFIG.PORT, "0.0.0.0", () => {
    log("info", "RAPI started", {
      port: CONFIG.PORT,
      environment: CONFIG.NODE_ENV,
      authEnabled: !!CONFIG.API_KEY,
      adminEnabled: !!CONFIG.ADMIN_KEY,
      allowedOrigins: CONFIG.IS_PRODUCTION ? CONFIG.ALLOWED_ORIGINS : "*",
    });
  });
}

export default app;