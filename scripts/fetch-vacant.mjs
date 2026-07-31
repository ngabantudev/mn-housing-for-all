#!/usr/bin/env node
// scripts/fetch-vacant.mjs
//
// Writes public/vacant.geojson — every building the two cities currently
// carry on their vacant-building registers, as points.
//
// This is the layer the whole app is built around. Both cities require the
// owner of an empty building to register it and pay an annual fee, which
// means each city maintains a public, addressed, dated list of housing
// stock sitting unused. Put next to a count of people sleeping outside in
// the same city, that list is the argument.
//
// The two registers are NOT the same instrument and this script does not
// pretend they are — see the per-city notes below. They're combined into
// one layer because "empty buildings in the Twin Cities" is the useful
// frame, but every feature keeps its `city` so the modal and the sources
// page can say which rulebook produced it.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLayerFeatures, toIsoDate, toText, writeGeoJson } from "./arcgis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../public/vacant.geojson");

// --- Saint Paul -----------------------------------------------------------
//
// The layer behind information.stpaul.gov's "Vacant Buildings Map" (item
// 284c28f3acea45bd8a513f4d80bb0e67). Carries a registration category, the
// dwelling type, and the date the building went on the register. No owner
// field at all.
const ST_PAUL_URL = "https://services1.arcgis.com/9meaaHE3uiba0zr8/arcgis/rest/services/VacantBuildings/FeatureServer/0";

// --- Minneapolis ----------------------------------------------------------
//
// Minneapolis publishes several overlapping vacant-building layers; this is
// the current one. The older `VBR` and `VBR_and_Vacant_CPED_Properties`
// services are 2016-vintage snapshots and are deliberately not used — a
// ten-year-old vacancy list would put dots on houses that have been
// occupied for most of a decade.
const MINNEAPOLIS_URL = "https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/VBR_October2025/FeatureServer/0";

// Tokens that mark a registered owner as an organization rather than a
// person. Minneapolis' file names the owner of every registered vacant
// building, including private individuals at their home address.
//
// A corporate landlord or bank holding empty housing stock is a matter of
// legitimate public interest and gets named. A named individual on a
// campaigning map is a harassment vector, and nothing in the argument this
// app makes depends on knowing which particular person owns 3237 30th Ave
// S — so individuals are collapsed to a generic label instead. The
// underlying record stays public at the source either way; this script just
// declines to be the thing that republishes it at map scale.
const ENTITY_TOKENS = [
  "LLC", "L L C", "INC", "CORP", "CO ", " CO", "LP", "LLP", "LTD", "TRUST", "BANK",
  "PROPERTIES", "PROPERTY", "HOLDINGS", "HOMES", "GROUP", "PARTNERS", "PARTNERSHIP",
  "ASSOCIATION", "ASSOC", "CHURCH", "MINISTRIES", "FOUNDATION", "HABITAT",
  "CITY OF", "COUNTY", "HRA", "AUTHORITY", "REDEVELOPMENT", "DEVELOPMENT",
  "INVESTMENTS", "INVESTMENT", "CAPITAL", "REALTY", "REAL ESTATE", "MORTGAGE",
  "ENTERPRISES", "VENTURES", "MANAGEMENT", "SERVICES", "&",
];

function classifyOwner(rawName) {
  const name = toText(rawName);
  if (name === null) return null;
  const upper = name.toUpperCase();
  const isEntity = ENTITY_TOKENS.some((token) => upper.includes(token));
  return isEntity ? name : "Private individual (name withheld — see source)";
}

async function fetchStPaul() {
  console.log("[vacant] fetching Saint Paul register...");
  const raw = await fetchLayerFeatures(ST_PAUL_URL);
  const features = raw
    // A handful of rows carry a null geometry — an address the city
    // couldn't geocode. Nothing useful to draw, so they're dropped rather
    // than placed at 0,0 in the Gulf of Guinea.
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => {
      const p = f.properties ?? {};
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          kind: "vacant",
          city: "St. Paul",
          address: toText(p.ADDRESS) ?? "Address not recorded",
          category: toText(p.VB_CATEGORY),
          dwellingType: toText(p.DWELLING_TYPE),
          vacantSince: toIsoDate(p.VACANT_AS_OF),
          ward: toText(p.WARD),
          // St. Paul's DISTRICT is its numbered district-council (planning
          // district), not a neighborhood name — kept as "District N"
          // rather than dropped, since it's how residents there actually
          // refer to their area.
          neighborhood: p.DISTRICT ? `District ${p.DISTRICT}` : null,
          owner: null,
        },
      };
    });
  console.log(`[vacant] Saint Paul: ${features.length} building(s)`);
  return features;
}

async function fetchMinneapolis() {
  console.log("[vacant] fetching Minneapolis register...");
  const raw = await fetchLayerFeatures(MINNEAPOLIS_URL);
  const features = raw
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => {
      const p = f.properties ?? {};
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          kind: "vacant",
          city: "Minneapolis",
          address: toText(p.USER_Display) ?? toText(p.Match_addr) ?? "Address not recorded",
          // See the field comment in src/lib/types.ts: Minneapolis has no
          // equivalent of St. Paul's 1/2/3 severity categories, and
          // inventing one would misrepresent the city's own assessment.
          category: null,
          dwellingType: null,
          vacantSince: toIsoDate(p.USER_Day_of_VBR_Date),
          ward: toText(p.USER_Wards),
          neighborhood: toText(p.USER_Neighborhoods_Desc),
          owner: classifyOwner(p.USER_Full_Name),
        },
      };
    });
  console.log(`[vacant] Minneapolis: ${features.length} building(s)`);
  return features;
}

async function main() {
  const [stPaul, minneapolis] = await Promise.all([fetchStPaul(), fetchMinneapolis()]);
  const features = [...minneapolis, ...stPaul];

  const undated = features.filter((f) => f.properties.vacantSince === null).length;
  if (undated > 0) console.log(`[vacant] note: ${undated} building(s) have no usable registration date`);

  await writeGeoJson(OUTPUT_PATH, features, "vacant building");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
