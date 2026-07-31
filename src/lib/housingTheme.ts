import type { BuildingUse, City, LayerKind } from "./types";

// One hue per layer, chosen so the three can never be confused for each
// other on screen or in the legend. Deliberately avoids red/blue: this app
// shows city administrative data, not election results, and borrowing the
// party palette would imply a partisan reading the data doesn't carry.
// (mn-civic-watch, which this shares a stack with, reserves red/blue for
// exactly that purpose — keeping the two apps' color languages disjoint
// means a reader moving between them never mis-reads one as the other.)
export const LAYER_COLOR: Record<LayerKind, string> = {
  vacant: "#B45309", // amber-700 — a boarded-up building
  tif: "#7C3AED", // violet-600 — public money
  relief: "#0D9488", // teal-600 — somewhere to go
};

export const LAYER_COLOR_SOFT: Record<LayerKind, string> = {
  vacant: "#FEF3C7",
  tif: "#EDE9FE",
  relief: "#CCFBF1",
};

// One-word labels ("Empty", "Subsidy", "Relief") read as clever rather than
// informative: they tell you a mood, not what the dots are. A reader landing
// on this map cold should be able to name the dataset from the checkbox
// alone, so each label is what the publishing agency itself calls the thing.
export const LAYER_LABEL: Record<LayerKind, string> = {
  vacant: "Vacant buildings",
  tif: "Tax subsidy districts",
  // Hennepin County's own name for this data is the "Cooling Option Map"
  // (ArcGIS item 9cde49f4f25d4cca885e58a967ec786f, tagged Public Health).
  // "Relief" was this project's invention; the county's word is better.
  relief: "Cooling sites",
};

// The one-line "what am I looking at" under each layer's checkbox. Kept here
// rather than inline in the map component so the same wording can be
// reused by the sources page without the two drifting apart.
export const LAYER_BLURB: Record<LayerKind, string> = {
  vacant:
    "Homes, businesses, and mixed-use buildings their owners had to register with the city as empty — because they were condemned, unsecured, or carrying code violations nobody fixed.",
  tif: "Saint Paul tax-increment districts — where property-tax growth is captured for redevelopment.",
  relief:
    "Libraries, rec centers, public buildings and malls from Hennepin County's Cooling Option Map — indoor places to get out of the heat, and which of them cost nothing to enter.",
};

/**
 * Why a building is on the register, in the cities' own terms.
 *
 * Neither register records a *reason for vacancy* — nobody files "the owner
 * died", "the sale fell through", "it burned". What both record is which
 * enforcement condition the building met, which is the closest thing to a
 * "why" the public record actually contains. Reproduced here so the app can
 * say it plainly instead of leaving a reader to assume the dots are just
 * houses somebody forgot about.
 */
export const REGISTRATION_TRIGGER: Record<City, string> = {
  "St. Paul":
    "Saint Paul requires registration once a building is unoccupied and is unsecured, secured by other than normal means, dangerous, condemned, carrying multiple housing or building code violations, or has sat unoccupied over a year under an order to correct nuisance conditions.",
  Minneapolis:
    "Minneapolis requires registration for any residential or commercial building that is condemned and needs a code compliance inspection, unoccupied and unsecured five days or more, secured by abnormal means for 30 days, carrying numerous housing, fire or building code violations for 30 days, unoccupied over 365 days under a nuisance order, or unable to get a certificate of occupancy after a work stoppage or expired permit.",
};

// The register says a building met one of the conditions above. It does not
// say which one — so the app says that too, rather than implying the dot
// means "condemned" when it may mean "the permit expired."
export const REGISTRATION_CAVEAT =
  "The published register records that a building met one of those conditions, not which one.";

/**
 * Hennepin's `Type` values are internal abbreviations — "Rec Com Cntr",
 * "Govt Bldg", "Misc Site" — which are fine in a county spreadsheet and
 * useless to someone deciding where to walk to. Expanded for display only;
 * the raw value stays in the data so it still matches the county's file.
 */
export const RELIEF_TYPE_LABEL: Record<string, string> = {
  "Rec Com Cntr": "Recreation or community center",
  "Govt Bldg": "Government building",
  "Misc Site": "Other public site",
  "Salvation Army": "Salvation Army location",
  "Swimming Pool": "Pool or aquatic center",
  "Movie Theater": "Movie theater",
  "Shopping Mall": "Shopping mall",
  Library: "Library",
};

export function reliefTypeLabel(type: string): string {
  return RELIEF_TYPE_LABEL[type] ?? type;
}

/**
 * Coarse building use, for the "is this an empty house or an empty
 * storefront?" question. Saint Paul publishes DWELLING_TYPE; Minneapolis'
 * file carries no equivalent field at all, so its 311 buildings are
 * "not recorded" rather than silently counted as homes — the Minneapolis
 * program covers "any residential or commercial building" and the published
 * layer doesn't say which one any given address is.
 */
export const BUILDING_USES: BuildingUse[] = ["home", "business", "mixed", "unrecorded"];

// Saint Paul's DWELLING_TYPE values, verbatim, grouped. Anything the city
// adds later that isn't listed here falls through to "unrecorded" rather
// than being guessed into a bucket.
export const DWELLING_TYPE_USE: Record<string, BuildingUse> = {
  "Single Family Residential": "home",
  Duplex: "home",
  "Multi-family Residential": "home",
  Commercial: "business",
  "Mixed Use": "mixed",
};

export const BUILDING_USE_LABEL: Record<BuildingUse, string> = {
  home: "Homes",
  business: "Businesses",
  mixed: "Mixed use",
  unrecorded: "Use not recorded",
};

export function buildingUse(dwellingType: string | null): BuildingUse {
  if (dwellingType === null) return "unrecorded";
  return DWELLING_TYPE_USE[dwellingType] ?? "unrecorded";
}

/**
 * The plain-English noun for a single building, for the modal headline —
 * "Empty duplex", not "Empty Duplex Residential". Saint Paul's own type
 * string is the input, so a reader can still match what they see here
 * against the city's record.
 */
export function buildingNoun(dwellingType: string | null): string {
  switch (dwellingType) {
    case "Single Family Residential":
      return "single-family home";
    case "Duplex":
      return "duplex";
    case "Multi-family Residential":
      return "multi-family building";
    case "Commercial":
      return "commercial building";
    case "Mixed Use":
      return "mixed-use building";
    default:
      return "building";
  }
}

// St. Paul's vacant-building categories escalate: 1 is a registration and
// fee, 2 blocks sale until code orders are met, 3 is condemned and
// structurally unsound. Shading by severity rather than one flat color
// makes "how bad is this block" legible at a glance.
export const VACANT_CATEGORY_COLOR: Record<string, string> = {
  "1": "#FCD34D", // amber-300
  "2": "#D97706", // amber-600
  "3": "#92400E", // amber-800
};

// Minneapolis' registration file has no category equivalent (see the field
// comment in types.ts), so its points get a distinct neutral rather than
// being assigned a St. Paul severity they were never rated for.
export const VACANT_UNCATEGORIZED_COLOR = "#A16207"; // yellow-700

// Housing TIF districts are the ones statute ties to a low-income housing
// requirement — the whole reason this layer is on a housing map — so they
// read as the "figure" and everything else as the "ground."
export const TIF_HOUSING_COLOR = "#7C3AED"; // violet-600
export const TIF_OTHER_COLOR = "#A5B4FC"; // indigo-300

export function vacantColor(category: string | null): string {
  if (category === null) return VACANT_UNCATEGORIZED_COLOR;
  return VACANT_CATEGORY_COLOR[category] ?? VACANT_UNCATEGORIZED_COLOR;
}

const DOLLARS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatDollars(value: number | null): string {
  if (value === null) return "Not reported";
  return DOLLARS.format(value);
}

/**
 * "7 years" / "8 months" — how long a building has been on the register.
 * Deliberately coarse: the exact day count is noise, and the number that
 * changes minds is the order of magnitude.
 */
export function formatDuration(isoDate: string | null, now: Date = new Date()): string | null {
  if (!isoDate) return null;
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return null;
  const months = Math.max(0, Math.round((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (months < 1) return "under a month";
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  return `${Math.floor(months / 12)} years`;
}

export function formatDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  // UTC, not local: these are date-only values with no meaningful time
  // zone, and rendering them locally shifts them a day west of Greenwich.
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
