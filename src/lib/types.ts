// The three things this map puts side by side. They're deliberately not
// merged into one "site" type with optional fields everywhere: a vacant
// house, a TIF district, and a library that stays open in a heat
// emergency have almost nothing in common except a location, and pretending
// otherwise produces a modal full of null checks.
export type LayerKind = "vacant" | "tif" | "relief";

/** Which city's open-data portal a feature came from. */
export type City = "Minneapolis" | "St. Paul";

export interface VacantProperties {
  kind: "vacant";
  city: City;
  address: string;
  // St. Paul's registration category (1/2/3), which controls what an owner
  // has to do before the building can be sold or reoccupied — category 3 is
  // the most serious (condemned, structurally unsound). Minneapolis'
  // registration file doesn't carry an equivalent, so it's null there
  // rather than guessed at from a different city's rulebook.
  category: string | null;
  // e.g. "Single Family Residential", "Duplex" — how many households this
  // building could hold if it weren't empty. St. Paul only.
  dwellingType: string | null;
  // ISO date the building entered the vacant-building register. This is the
  // single most useful field on the layer: a 2019 date on a 2026 map means
  // seven years of an empty house.
  vacantSince: string | null;
  ward: string | null;
  neighborhood: string | null;
  // Minneapolis publishes the registered owner; St. Paul's layer doesn't
  // carry one at all. Individual owners' names are collapsed to a generic
  // label upstream in scripts/fetch-vacant.mjs — see the comment there for
  // why. Non-null here means it's an entity (LLC, bank, land trust, the
  // city itself), which is the case with an actual public-interest angle.
  owner: string | null;
}

export interface TifProperties {
  kind: "tif";
  city: City;
  name: string;
  // Saint Paul's own district numbering, as filed with the State Auditor —
  // the key to look a district up in the annual disclosure reports linked
  // from the sources page.
  tifNumber: number | null;
  // "Housing" | "Redevelopment" | null. Housing districts are the ones
  // statute ties to a low-income housing requirement, so they get their own
  // color and their own filter here. Null on the 11 older districts whose
  // type never made it into the published attribute table.
  districtType: string | null;
  // "HRA" (city Housing and Redevelopment Authority) or "SPPA" (Port
  // Authority) — different bodies, different accountability.
  creator: string | null;
  certifiedDate: string | null;
  // Free-text in the source ("12/31/2042"), kept verbatim rather than
  // parsed: a handful of rows carry things a date parser would mangle.
  decertificationDate: string | null;
  // Dollars. Nullable because the published table leaves these blank for
  // districts that haven't filed yet or predate the current reporting
  // format — a blank is genuinely "not reported," not zero.
  incrementReceived: number | null;
  incrementExpended: number | null;
  projectArea: string | null;
}

export interface ReliefProperties {
  kind: "relief";
  city: string;
  name: string;
  address: string;
  // "Library", "Park Facility", "Government Building", ... — Hennepin's own
  // categorization of what kind of place this is.
  type: string;
  hours: string | null;
  phone: string | null;
  website: string | null;
  // Whether getting in the door costs money. The whole point of this layer
  // for an unhoused resident is somewhere to be that doesn't, so the map
  // defaults to showing only the free ones.
  free: boolean;
}

export type FeatureProperties = VacantProperties | TifProperties | ReliefProperties;

/**
 * A headline figure computed from the loaded data at runtime rather than
 * hardcoded, so it can never drift out of sync with what the map is
 * actually showing after a `npm run data:all`.
 */
export interface Tally {
  vacantTotal: number;
  vacantByCity: Record<City, number>;
  // Sum of `incrementReceived` across Housing-type districts only.
  housingTifDollars: number;
  housingTifCount: number;
  reliefFreeCount: number;
}
