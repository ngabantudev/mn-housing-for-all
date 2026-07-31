// Shared ArcGIS Feature Service helpers for the fetch-*.mjs scripts.
//
// Every layer this app pulls from is a public, unauthenticated ArcGIS
// FeatureServer, but the four portals involved (Saint Paul, Minneapolis,
// Hennepin County, Ramsey County) each have their own quirks — different
// spatial references, different record caps, one that returns HTML on
// error instead of JSON. This centralizes the handling so a new layer is a
// URL and a mapping function rather than another copy of the same 40 lines.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const USER_AGENT = "mn-housing-for-all-etl/0.1";

/**
 * Pages through a FeatureServer layer and returns every feature as GeoJSON
 * in WGS84.
 *
 * `resultOffset` paging rather than a single big request: several of these
 * layers cap `maxRecordCount` at 2000 and *silently truncate* past it —
 * there's no error and no flag in the response, you just quietly get fewer
 * vacant buildings than the city has. Looping until a short page comes back
 * is the only reliable way to know the set is complete.
 */
export async function fetchLayerFeatures(layerUrl, { where = "1=1", outFields = "*", pageSize = 1000 } = {}) {
  const features = [];
  let offset = 0;

  for (;;) {
    const url = new URL(`${layerUrl}/query`);
    url.searchParams.set("where", where);
    url.searchParams.set("outFields", outFields);
    url.searchParams.set("f", "geojson");
    // Ask the server to reproject. Saint Paul's vacant-buildings layer is
    // natively in a Ramsey-County-specific Lambert projection measured in
    // US survey feet; MapLibre wants lng/lat. Letting ArcGIS do it is both
    // more accurate and less code than reprojecting here.
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(pageSize));

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${layerUrl}`);
    const body = await res.json();
    // ArcGIS reports query errors with HTTP 200 and an `error` object, so a
    // res.ok check alone will happily hand back an empty feature list.
    if (body.error) throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message} for ${layerUrl}`);

    const page = body.features ?? [];
    features.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }

  return features;
}

/**
 * ArcGIS date fields arrive as epoch milliseconds, but several of these
 * layers store dates as free-text strings instead ("12/8/2023",
 * "02/15/2022"). Normalizes both to an ISO date, or null when the value is
 * blank or unparseable — null rather than a fallback date, since a made-up
 * "vacant since" would be the one field on this map most likely to be
 * quoted at a council meeting.
 */
export function toIsoDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  // Already ISO (YYYY-MM-DD), which is what the TIF layer's DateOnly
  // fields come back as.
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  // M/D/YYYY or MM/DD/YYYY. Built by hand rather than handed to `new Date`
  // so it can't be reinterpreted as D/M/YYYY on a differently-localized
  // machine, and so a nonsense value fails loudly to null.
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Strips a currency string ("707700", "$707,700") to a number, or null. */
export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Collapses blank/whitespace-only strings to null; trims the rest. */
export function toText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export async function writeGeoJson(outputPath, features, label) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ type: "FeatureCollection", features }));
  console.log(`[done] wrote ${features.length} ${label} feature(s) to ${outputPath}`);
}
