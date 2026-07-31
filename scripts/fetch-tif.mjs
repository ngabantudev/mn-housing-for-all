#!/usr/bin/env node
// scripts/fetch-tif.mjs
//
// Writes public/tif.geojson — Saint Paul's tax-increment financing
// districts as polygons.
//
// Why a housing map cares about TIF: a TIF district freezes the property
// tax base inside its boundary and routes the growth above that line back
// into development there, for decades. Minnesota recognizes five district
// types, and "Housing" districts are the one type statute conditions on
// producing low-income housing. So this layer answers a specific question —
// *of the property-tax growth the city has already committed, how much of
// it is legally tied to housing?* — with the city's own filed numbers.
//
// Only Saint Paul. Minneapolis' TIF geography isn't published as a
// comparable open feature service, and stitching one city's mapped
// districts to another's PDF tables would produce a map that looks like a
// regional comparison while being nothing of the sort.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLayerFeatures, toIsoDate, toNumber, toText, writeGeoJson } from "./arcgis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../public/tif.geojson");

// Layer 1 of the service behind the city's public TIF Experience app
// (item 84f4974467bf405ca727f8606ec2e8b3). Layer 2 on the same service is
// Project Areas — the larger envelopes districts sit inside. Only the
// districts are pulled: the project areas overlap them almost entirely, and
// two stacked translucent polygon layers make both unreadable.
const TIF_DISTRICTS_URL =
  "https://services1.arcgis.com/9meaaHE3uiba0zr8/arcgis/rest/services/TIF_For_Open_Info_DM/FeatureServer/1";

async function main() {
  console.log("[tif] fetching Saint Paul TIF districts...");
  const raw = await fetchLayerFeatures(TIF_DISTRICTS_URL, { where: "RecordType = 'TIF District'" });

  const features = raw
    .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
    .map((f) => {
      const p = f.properties ?? {};
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          kind: "tif",
          city: "St. Paul",
          name: toText(p.Name) ?? "Unnamed district",
          tifNumber: Number.isFinite(p.TIFNumber) ? p.TIFNumber : null,
          districtType: toText(p.TypeOfDistrict),
          creator: toText(p.Creator),
          certifiedDate: toIsoDate(p.DateCertified),
          // Kept as the source's own string rather than an ISO date — see
          // the field comment in src/lib/types.ts.
          decertificationDate: toText(p.DateAndYearOfRequiredDecertification_1),
          // Note the source's spelling of "Recieved" — it's the actual
          // field name in the published service, not a typo here.
          incrementReceived: toNumber(p.TaxIncrementRecieved),
          incrementExpended: toNumber(p.TaxIncrementExpended),
          projectArea: toText(p.AssignedProjectArea),
        },
      };
    });

  const housing = features.filter((f) => f.properties.districtType === "Housing");
  const untyped = features.filter((f) => f.properties.districtType === null);
  const housingDollars = housing.reduce((sum, f) => sum + (f.properties.incrementReceived ?? 0), 0);

  console.log(`[tif] ${features.length} district(s); ${housing.length} typed "Housing"`);
  console.log(`[tif] housing districts report $${housingDollars.toLocaleString("en-US")} in increment received`);
  if (untyped.length > 0) {
    // Worth surfacing rather than silently folding into "other": these are
    // mostly older districts whose type predates the current attribute
    // table, so the Housing count above is a floor, not an exact figure.
    console.log(`[tif] note: ${untyped.length} district(s) carry no district type in the published table`);
  }

  await writeGeoJson(OUTPUT_PATH, features, "TIF district");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
