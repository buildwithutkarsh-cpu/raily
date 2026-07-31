/* ══════════════════════════════════════════════════════════════
   RAILY — Tool Schema Sanitization Tests
   ══════════════════════════════════════════════════════════════
   Guards against Groq strict-mode rejections. Groq validates EVERY
   tool schema on EVERY request — one malformed tool (e.g. `required`
   present but `properties` missing) rejects the entire request:

     invalid JSON schema for tool getHealth
     tools[7].function.parameters: 'required' present but 'properties' is missing

   These tests prove sanitizeToolDefinitions always produces a
   provider-acceptable schema for every tool, including the RAILWAY_TOOLS
   registry shipped to production.
   ══════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import { RAILWAY_TOOLS, sanitizeToolDefinitions } from "./tools";

function sanitizeOne(params: unknown): Record<string, unknown> {
  const tools = sanitizeToolDefinitions([
    {
      type: "function",
      function: { name: "testTool", description: "desc", strict: true, parameters: params },
    },
  ])!;
  const fn = tools[0].function as Record<string, unknown>;
  return fn.parameters as Record<string, unknown>;
}

describe("sanitizeToolDefinitions — Groq strict-mode compliance", () => {
  it("returns undefined for empty or missing tool lists", () => {
    expect(sanitizeToolDefinitions(undefined)).toBeUndefined();
    expect(sanitizeToolDefinitions([])).toBeUndefined();
  });

  it("fixes the exact getHealth failure: required present but properties missing", () => {
    // This is the schema Groq rejected as tools[7] (getHealth):
    //   { type: "object", required: [] }  ← no `properties`
    const schema = sanitizeOne({ type: "object", required: [] });
    expect(schema.type).toBe("object");
    expect(schema.properties).toEqual({});
    expect(schema.required).toEqual([]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("fixes required present without properties AND keeps declared properties", () => {
    const schema = sanitizeOne({
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    });
    expect(schema.properties).toEqual({ query: { type: "string" } });
    expect(schema.required).toEqual(["query"]);
  });

  it("drops required entries that reference non-existent properties", () => {
    const schema = sanitizeOne({
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query", "ghost"],
    });
    expect(schema.required).toEqual(["query"]);
  });

  it("fills defaults when parameters is entirely missing", () => {
    const tools = sanitizeToolDefinitions([
      { type: "function", function: { name: "noParams", description: "d", strict: true } },
    ])!;
    const fn = tools[0].function as Record<string, unknown>;
    expect(fn.parameters).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
  });

  it("fills defaults when parameters is malformed (array / non-object)", () => {
    const tools = sanitizeToolDefinitions([
      { type: "function", function: { name: "badParams", description: "d", strict: true, parameters: [] } },
    ])!;
    const fn = tools[0].function as Record<string, unknown>;
    expect(fn.parameters).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
  });

  it("coerces missing additionalProperties to false", () => {
    const schema = sanitizeOne({ type: "object", properties: {}, required: [] });
    expect(schema.additionalProperties).toBe(false);
  });

  it("every RAILWAY_TOOLS schema survives sanitization as Groq-valid", () => {
    const sanitized = sanitizeToolDefinitions(RAILWAY_TOOLS as unknown as Array<Record<string, unknown>>);
    expect(sanitized).toBeDefined();
    expect(sanitized!.length).toBe(RAILWAY_TOOLS.length);

    for (let i = 0; i < sanitized!.length; i++) {
      const tool = sanitized![i];
      const name = (tool.function as Record<string, unknown>).name as string;
      const params = (tool.function as Record<string, unknown>).parameters as Record<string, unknown>;

      expect(params.type, `${name} type`).toBe("object");
      expect(params.properties, `${name} properties present`).toBeTypeOf("object");
      expect(Array.isArray(params.properties), `${name} properties is object`).toBe(false);
      expect(Array.isArray(params.required), `${name} required is array`).toBe(true);
      expect(params.additionalProperties, `${name} additionalProperties`).toBe(false);

      // Every required entry must reference a declared property.
      const declared = new Set(Object.keys(params.properties as Record<string, unknown>));
      for (const key of params.required as string[]) {
        expect(declared.has(key), `${name} required[${key}] declared`).toBe(true);
      }
    }
  });

  it("does not mutate the source RAILWAY_TOOLS registry", () => {
    // The registry must remain intact for client-side tool execution.
    expect(RAILWAY_TOOLS[7].function.name).toBe("getHealth");
    expect(RAILWAY_TOOLS[7].function.parameters.properties).toEqual({});
    expect(RAILWAY_TOOLS[7].function.parameters.required).toEqual([]);
  });
});
