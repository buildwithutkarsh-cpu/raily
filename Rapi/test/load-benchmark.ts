/* ══════════════════════════════════════════════════════════════
   RAPI — Load & Concurrency Benchmark
   
   Usage:
     Terminal 1: npm run dev
     Terminal 2: npx tsx test/load-benchmark.ts
     
   Or single command: npm run bench
     (requires server already running on port 3001)
   ══════════════════════════════════════════════════════════════ */

import autocannon from "autocannon";
import { CONFIG } from "../src/config";

const BASE_URL = `http://localhost:${CONFIG.PORT}`;

interface BenchmarkResult {
  title: string;
  url: string;
  latency: { p50: number; p95: number; p99: number };
  requests: { total: number; average: number };
  errors: number;
  timeouts: number;
  non2xx: number;
  passed: boolean;
  details: string[];
}

const results: BenchmarkResult[] = [];

async function benchmark(
  title: string,
  url: string,
  connections: number,
  duration: number
): Promise<BenchmarkResult> {
  const instance = autocannon({
    url,
    connections,
    duration,
    pipelining: 1,
  });

  autocannon.track(instance, { renderProgressBar: true, renderLatencyTable: true });

  return new Promise((resolve) => {
    instance.on("done", (result: autocannon.Result) => {
      const latency = result.latency;
      const p50 = latency.p50 ?? 0;
      const p95 = latency.p95 ?? 0;
      const p99 = latency.p99 ?? 0;
      const errors = (result.errors ?? 0) + (result.socketAmount ?? 0);
      const timeouts = result.timeouts ?? 0;
      const non2xx = result.non2xx ?? 0;

      const details: string[] = [];
      let passed = true;

      if (p50 > 50) { details.push(`✗ p50 ${p50.toFixed(1)}ms > 50ms`); passed = false; }
      else { details.push(`✓ p50 ${p50.toFixed(1)}ms ≤ 50ms`); }

      if (p95 > 250) { details.push(`✗ p95 ${p95.toFixed(1)}ms > 250ms`); passed = false; }
      else { details.push(`✓ p95 ${p95.toFixed(1)}ms ≤ 250ms`); }

      if (p99 > 500) { details.push(`✗ p99 ${p99.toFixed(1)}ms > 500ms`); passed = false; }
      else { details.push(`✓ p99 ${p99.toFixed(1)}ms ≤ 500ms`); }

      if (errors > 0) { details.push(`✗ ${errors} connection errors`); passed = false; }
      else { details.push(`✓ 0 connection errors`); }

      if (timeouts > 0) { details.push(`✗ ${timeouts} timeouts`); passed = false; }
      else { details.push(`✓ 0 timeouts`); }

      if (non2xx > 0) { details.push(`⚠ ${non2xx} non-2xx`); }

      resolve({ title, url, latency: { p50, p95, p99 }, requests: { total: result.requests?.total ?? 0, average: result.requests?.average ?? 0 }, errors, timeouts, non2xx, passed, details });
    });
  });
}

async function waitForServer(maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${BASE_URL}/`);
      if (resp.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable at ${BASE_URL}. Start it first: npm run dev`);
}

async function main() {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║  RAPI Load Benchmark                       ║`);
  console.log(`║  Target: ${BASE_URL}               ║`);
  console.log(`║  Ensure server is running first!            ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);

  await waitForServer();

  console.log("\n📊 Station Autocomplete (200 conn)\n");
  results.push(await benchmark("Station Autocomplete — q=DEL", `${BASE_URL}/api/v1/stations/autocomplete?q=DEL`, 200, 15));

  console.log("\n📊 Station Autocomplete Spike (1000 conn)\n");
  results.push(await benchmark("Station Autocomplete — Spike", `${BASE_URL}/api/v1/stations/autocomplete?q=MUMBAI`, 1000, 20));

  console.log("\n📊 Train Search — NDLS→BCT (500 conn)\n");
  results.push(await benchmark("Train Search — NDLS→BCT", `${BASE_URL}/api/v1/trains/search?from=NDLS&to=BCT`, 500, 15));

  console.log("\n📊 PNR Invalid (validation fast-path) (500 conn)\n");
  results.push(await benchmark("PNR — Invalid (validation gate)", `${BASE_URL}/api/v1/pnr/0000000000`, 500, 10));

  console.log("\n═══════════════════════════════════════════════");
  console.log("           BENCHMARK SUMMARY");
  console.log("═══════════════════════════════════════════════\n");

  for (const r of results) {
    console.log(` ${r.passed ? "✓" : "✗"} ${r.title}`);
    console.log(`    Latency: p50=${r.latency.p50.toFixed(1)}ms  p95=${r.latency.p95.toFixed(1)}ms  p99=${r.latency.p99.toFixed(1)}ms`);
    console.log(`    Req/s: ${r.requests.average.toFixed(0)}`);
    r.details.forEach((d) => console.log(`    ${d}`));
    console.log();
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`  Results: ${passed}/${results.length} benchmarks passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => { console.error("Benchmark failed:", err); process.exit(1); });
