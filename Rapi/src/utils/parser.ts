/* ══════════════════════════════════════════════════════════════
   RAPI — Response Parsers
   Clean HTML/raw-text into structured JSON
   ══════════════════════════════════════════════════════════════ */

import type { RouteStation, TrainSearchEntry } from "../types";

/**
 * Clean a string: trim, collapse whitespace, remove \n \t
 */
export function clean(str: string): string {
  return str.replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Sanitize HTML entities (nbsp, &amp;, &lt;, etc.) and whitespace.
 */
export function sanitizeHTML(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ErailTrainInfo {
  train_no: string;
  train_name: string;
  from_stn_name: string;
  from_stn_code: string;
  to_stn_name: string;
  to_stn_code: string;
  from_time: string;
  to_time: string;
  travel_time: string;
  running_days: string;
  train_type: string;
  train_id: string;
  distance: string;
  avg_speed: string;
}

export interface ErailRouteStation {
  stnCode: string;
  stnName: string;
  arrival: string;
  departure: string;
  distance: number;
  day: number;
  zone: string;
}

/**
 * Parse erail.in pipe-delimited train search response.
 * Returns camelCase entries matching TrainSearchEntry.
 */
export function parseErailTrains(raw: string): TrainSearchEntry[] {
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (!blocks.length) return [];

  const trains: TrainSearchEntry[] = [];

  for (const block of blocks) {
    const lines = block.split("~^");
    if (lines.length < 2) continue;

    const fields = lines[1].split("~").filter(Boolean);
    if (fields.length < 14) continue;

    trains.push({
      trainNumber: fields[0] || "",
      trainName: fields[1] || "",
      sourceStationName: fields[2] || "",
      sourceStationCode: fields[3] || "",
      destinationStationName: fields[4] || "",
      destinationStationCode: fields[5] || "",
      fromStationName: fields[6] || "",
      fromStationCode: fields[7] || "",
      toStationName: fields[8] || "",
      toStationCode: fields[9] || "",
      fromTime: fields[10] || "",
      toTime: fields[11] || "",
      travelTime: fields[12] || "",
      runningDays: fields[13] || "",
    });
  }

  return trains;
}

/**
 * Parse erail.in train info response (single train).
 */
export function parseErailTrainInfo(raw: string): ErailTrainInfo | null {
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (blocks.length < 2) return null;

  const headerFields = blocks[0].split("~").filter(Boolean);
  const detailFields = blocks[1].split("~").filter(Boolean);

  return {
    train_no: headerFields[1]?.replace("^", "") || "",
    train_name: headerFields[2] || "",
    from_stn_name: headerFields[3] || "",
    from_stn_code: headerFields[4] || "",
    to_stn_name: headerFields[5] || "",
    to_stn_code: headerFields[6] || "",
    from_time: headerFields[11] || "",
    to_time: headerFields[12] || "",
    travel_time: headerFields[13] || "",
    running_days: headerFields[14] || "",
    train_type: detailFields[11] || "",
    train_id: detailFields[12] || "",
    distance: detailFields[18] || "",
    avg_speed: detailFields[19] || "",
  };
}

/**
 * Parse erail.in route response.
 * Format: ~^code~name~arrival~departure~~distance~day~~~~zone
 */
export function parseErailRoute(raw: string): ErailRouteStation[] {
  const entries = raw.split("~^").filter(Boolean);
  const stations: ErailRouteStation[] = [];

  for (const entry of entries) {
    const fields = entry.split("~").filter(Boolean);
    if (fields.length < 8) continue;

    stations.push({
      stnCode: fields[1] || "",
      stnName: fields[2] || "",
      arrival: fields[3] || "--",
      departure: fields[4] || "--",
      distance: parseInt(fields[6] || "0"),
      day: parseInt(fields[7] || "1"),
      zone: fields[9] || "",
    });
  }

  return stations;
}