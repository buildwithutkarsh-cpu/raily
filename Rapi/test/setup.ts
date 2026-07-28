/* ══════════════════════════════════════════════════════════════
   RAPI — Shared Test Setup & Utilities
   ══════════════════════════════════════════════════════════════ */

import { execSync } from "child_process";
import path from "path";

/**
 * Path to the Rapi source directory.
 */
export const RAPI_ROOT = path.resolve(__dirname, "..");

/**
 * Ensure the server compiles before running tests.
 */
export function ensureBuilt(): void {
  try {
    execSync("npx tsc --noEmit", {
      cwd: RAPI_ROOT,
      stdio: "pipe",
      timeout: 30_000,
    });
  } catch (err: any) {
    console.warn("[Setup] TypeScript check failed — tests may fail:", err.stderr?.toString() || err.message);
  }
}

/**
 * Wait for a condition with timeout.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
  intervalMs = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Generate a random station code for fuzzing.
 */
export function randomStationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a random train number.
 */
export function randomTrainNumber(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}
