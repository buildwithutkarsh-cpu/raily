/* ══════════════════════════════════════════════════════════════
   RAPI — Response Parsers
   Clean HTML/raw-text into structured JSON
   ══════════════════════════════════════════════════════════════ */

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

/**
 * Parse erail.in pipe-delimited train search response.
 * Format: ~~~header~~~^field1~field2~field3...~~~~~~~~
 */
export function parseErailTrains(raw: string): any[] {
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (!blocks.length) return [];

  const trains: any[] = [];

  for (const block of blocks) {
    // Each block has format: header~^~field1~field2~field3...
    const lines = block.split("~^");
    if (lines.length < 2) continue;

    const fields = lines[1].split("~").filter(Boolean);
    if (fields.length < 14) continue;

    trains.push({
      train_no: fields[0] || "",
      train_name: fields[1] || "",
      source_stn_name: fields[2] || "",
      source_stn_code: fields[3] || "",
      dstn_stn_name: fields[4] || "",
      dstn_stn_code: fields[5] || "",
      from_stn_name: fields[6] || "",
      from_stn_code: fields[7] || "",
      to_stn_name: fields[8] || "",
      to_stn_code: fields[9] || "",
      from_time: fields[10] || "",
      to_time: fields[11] || "",
      travel_time: fields[12] || "",
      running_days: fields[13] || "",
    });
  }

  return trains;
}

/**
 * Parse erail.in train info response (single train).
 */
export function parseErailTrainInfo(raw: string): any {
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (blocks.length < 2) return null;

  // Block 0: header info
  const headerFields = blocks[0].split("~").filter(Boolean);
  // Block 1: detailed info
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
export function parseErailRoute(raw: string): any[] {
  const entries = raw.split("~^").filter(Boolean);
  const stations: any[] = [];

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


