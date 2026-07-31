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

// Types that are outdoors by definition and so don't answer the "somewhere
// indoors" question this layer exists for. Matched case-insensitively as a
// substring of the source's `Type`.
//
// "park facilit" rather than "park facility": the county's actual value is
// the plural "Park Facilities", and the singular spelling silently let six
// outdoor sites — Elm Creek Park Reserve, Fort Snelling State Park, the
// Bloomington wildlife refuge visitor center — onto a layer this app
// describes as indoor. Checked against the live service on 2026-07-31.
const OUTDOOR_TYPES = ["beach", "wading pool", "park facilit", "splash pad"];

// `Swimming Pool` is the one type the county genuinely mixes: 25 active
// rows covering both indoor aquatic centers and outdoor water parks, with
// nothing in `Type` or any other structured field to tell them apart. The
// county does say which in its free-text `Notes` ("Outdoor aquatic park",
// "Indoor pools"), so that's what this reads.
//
// Only for pools, and only when the notes don't also mention indoor: three
// rec centers and one campground describe an indoor pool alongside an
// outdoor splash pad, and a blanket "notes mention outdoor" rule would
// throw those away.
function isOutdoorPool(type, notes) {
  if (!/swimming pool/i.test(type ?? "")) return false;
  const text = (notes ?? "").toLowerCase();
  return text.includes("outdoor") && !text.includes("indoor");
}

function isIndoor(type, notes) {
  if (!type) return true; // unlabeled rows are kept; the modal shows the raw type
  const lower = type.toLowerCase();
  if (OUTDOOR_TYPES.some((t) => lower.includes(t))) return false;
  return !isOutdoorPool(type, notes);
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
    .filter((f) => isIndoor(toText(f.properties?.Type), toText(f.properties?.Notes)))
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
          // The county's free-text note, kept verbatim. It's where the
          // things a person actually needs live — "Indoor pools", "Youth
          // under 18 free, adults $5", "CLOSED FOR CONSTRUCTION 6/15/26" on
          // a row whose Status still says Active. Dropping it was throwing
          // away the most useful field on the layer.
          notes: toText(p.Notes),
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
