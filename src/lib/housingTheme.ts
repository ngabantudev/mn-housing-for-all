import type { LayerKind } from "./types";

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

export const LAYER_LABEL: Record<LayerKind, string> = {
  vacant: "Empty",
  tif: "Subsidy",
  relief: "Relief",
};

// The one-line "what am I looking at" under the mode toggle. Kept here
// rather than inline in the map component so the same wording can be
// reused by the sources page without the two drifting apart.
export const LAYER_BLURB: Record<LayerKind, string> = {
  vacant: "Buildings registered as vacant with the city, and how long they've sat that way.",
  tif: "Saint Paul tax-increment districts — where property-tax growth is captured for redevelopment.",
  relief: "Free, indoor, publicly accessible places across Hennepin County during a heat emergency.",
};

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
