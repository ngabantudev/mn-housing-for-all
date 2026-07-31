#!/usr/bin/env node
// scripts/fetch-relief.mjs
//
// Writes public/relief.geojson — indoor, publicly accessible places across
// Hennepin County that a person with nowhere to be can go during a heat
// emergency, from the county's own Cooling Option Map.
//
// This is not a shelter-bed layer, and the app is careful never to call it
// one. No Minnesota agency publishes an open, current, machine-readable
// list of homeless shelter locations and bed counts — the closest public
// ArcGIS layer named "Minneapolis_Shelters" is the city's civil-defense
// fallout/emergency shelter list (fire stations and the like), which would
// be actively misleading on a housing map. What the county *does* publish
// is this: where the libraries, rec centers, and public buildings are, and
// which of them cost nothing to enter.
//
// That's the honest version of the question this layer answers — "if you
// are outside in July and need to not be, where can you legally go for
// free?" — and it's the counterpart to the same population's winter
// problem that the encampment reporting in the sources page documents.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLayerFeatures, toText, writeGeoJson } from "./arcgis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../public/relief.geojson");

// The master point list behind Hennepin County's Cooling Option Map web app
// (item 9cde49f4f25d4cca885e58a967ec786f). The app draws it as a dozen
// separate layers filtered by `Type`; pulling the underlying list once and
// keeping `Type` as a property gets the same information in one request.
const COOLING_OPTIONS_URL =
  "https://services1.arcgis.com/ziLNoRgqnICUM0q1/arcgis/rest/services/CoolingOption2021_View/FeatureServer/0";

// Everything except beaches and wading pools, which are outdoors and so
// don't answer the "somewhere indoors" question this layer exists for.
// Matched case-insensitively against the source's `Type` field.
const OUTDOOR_TYPES = ["beach", "wading pool", "park facility", "splash pad"];

function isIndoor(type) {
  if (!type) return true; // unlabeled rows are kept; the modal shows the raw type
  const lower = type.toLowerCase();
  return !OUTDOOR_TYPES.some((t) => lower.includes(t));
}

async function main() {
  console.log("[relief] fetching Hennepin County cooling options...");
  const raw = await fetchLayerFeatures(COOLING_OPTIONS_URL);

  const features = raw
    .filter((f) => f.geometry?.type === "Point")
    // Status is the county's own "is this place still operating" flag.
    // Dropping the inactive rows matters more here than on the other
    // layers: sending someone to a closed building in a heat emergency is
    // a real-world failure, not a cosmetic one. Blank status is kept —
    // several rows never had one set, and they're mostly libraries.
    .filter((f) => {
      const status = toText(f.properties?.Status);
      return status === null || status.toLowerCase() === "active";
    })
    .filter((f) => isIndoor(toText(f.properties?.Type)))
    .map((f) => {
      const p = f.properties ?? {};
      const type = toText(p.Type) ?? "Public building";
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          kind: "relief",
          city: toText(p.City) ?? "Hennepin County",
          name: toText(p.Name) ?? "Unnamed location",
          address: toText(p.Address) ?? "Address not recorded",
          type,
          hours: toText(p.Hours),
          phone: toText(p.Phone),
          website: toText(p.Website),
          // The source stores this as the string "Yes"/"No" under `Fee`,
          // i.e. whether there IS a fee — inverted here so the property
          // name matches what it asserts and can't be misread downstream.
          free: toText(p.Fee)?.toLowerCase() !== "yes",
        },
      };
    });

  const free = features.filter((f) => f.properties.free).length;
  console.log(`[relief] ${features.length} indoor location(s); ${free} free to enter`);

  await writeGeoJson(OUTPUT_PATH, features, "relief location");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
