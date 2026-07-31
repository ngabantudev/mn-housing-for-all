import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import type { BuildingUse, City, FeatureProperties, LayerKind, Tally } from "./types";
import {
  DWELLING_TYPE_USE,
  LAYER_COLOR,
  TIF_HOUSING_COLOR,
  TIF_OTHER_COLOR,
  VACANT_CATEGORY_COLOR,
  VACANT_UNCATEGORIZED_COLOR,
  buildingUse,
} from "./housingTheme";

// Everything that turns the three GeoJSON files into MapLibre sources,
// layers, filters and hit tests. Kept out of the component so what's left
// there is the part a reader actually has to hold in their head: which
// checkbox does what.

export const VACANT_SOURCE = "vacant-source";
export const VACANT_CIRCLE = "vacant-circle";
export const TIF_SOURCE = "tif-source";
export const TIF_FILL = "tif-fill";
export const TIF_OUTLINE = "tif-outline";
export const TIF_LABEL = "tif-label";
export const RELIEF_SOURCE = "relief-source";
export const RELIEF_CIRCLE = "relief-circle";

export const LAYERS: LayerKind[] = ["vacant", "tif", "relief"];
export const CITIES: City[] = ["Minneapolis", "St. Paul"];

// The MapLibre layer ids each toggle owns. Any combination of the three can
// be on screen at once, which is the point: "vacant houses inside a housing
// TIF district" is a question you can only ask by looking at both at the
// same time. Draw order keeps that readable — the TIF polygons are added
// first and stay underneath, so points are never buried by a fill.
export const LAYER_IDS: Record<LayerKind, string[]> = {
  vacant: [VACANT_CIRCLE],
  tif: [TIF_FILL, TIF_OUTLINE, TIF_LABEL],
  relief: [RELIEF_CIRCLE],
};

// MapLibre's expression and filter types are structural and don't narrow
// from a plain array literal, so every expression below would otherwise
// carry its own `as unknown as` incantation. One helper each, named for
// what it produces, keeps the casts in a single place.
const expression = (value: unknown) => value as unknown as maplibregl.ExpressionSpecification;
const filter = (value: unknown) => value as unknown as maplibregl.FilterSpecification;

const VACANT_COLOR_EXPRESSION = expression([
  "match",
  ["coalesce", ["get", "category"], "none"],
  ...Object.entries(VACANT_CATEGORY_COLOR).flatMap(([category, color]) => [category, color]),
  VACANT_UNCATEGORIZED_COLOR,
]);

const TIF_COLOR_EXPRESSION = expression([
  "case",
  ["==", ["get", "districtType"], "Housing"],
  TIF_HOUSING_COLOR,
  TIF_OTHER_COLOR,
]);

/**
 * Saint Paul's raw dwelling type, resolved to the coarse use the checkboxes
 * filter on. Written as a style expression rather than as a property baked
 * into the GeoJSON so the grouping can be changed without re-running
 * scripts/fetch-vacant.mjs — and, more importantly, so the file on disk
 * keeps the city's own words instead of this app's summary of them.
 *
 * The `match` default is "unrecorded", which covers both Minneapolis (no
 * dwelling-type field at all, so `get` returns nothing) and any new type
 * Saint Paul adds later — an unknown type shows up as unclassified rather
 * than being quietly filed under whichever bucket looked closest.
 */
const USE_EXPRESSION = [
  "match",
  ["coalesce", ["get", "dwellingType"], ""],
  ...Object.entries(DWELLING_TYPE_USE).flatMap(([dwellingType, use]) => [dwellingType, use]),
  "unrecorded",
];

export const vacantFilter = (cities: City[], uses: BuildingUse[]) =>
  filter(["all", ["in", ["get", "city"], ["literal", cities]], ["in", USE_EXPRESSION, ["literal", uses]]]);

// `null` clears a layer's filter outright. An always-true expression would
// work too, but MapLibre validates filters against the style spec and the
// forms that mean "no filter" differ by version — passing null is the one
// that unambiguously means "show everything."
export const tifFilter = (housingOnly: boolean) =>
  housingOnly ? filter(["==", ["get", "districtType"], "Housing"]) : null;

export const reliefFilter = (freeOnly: boolean) => (freeOnly ? filter(["==", ["get", "free"], true]) : null);

/**
 * MapLibre tiles GeoJSON sources internally even when they're client-side,
 * and that vector-tile property encoding has no null type — a `null` in the
 * source comes back as `undefined` on features from queryRenderedFeatures.
 * Every nullable field is checked with `=== null` downstream (the modal's
 * category explainer, the dollar formatter), so undefined is re-normalized
 * back to null here, once, where features leave MapLibre's hands.
 */
const NULLABLE_FIELDS = [
  "category",
  "dwellingType",
  "vacantSince",
  "ward",
  "neighborhood",
  "owner",
  "districtType",
  "tifNumber",
  "creator",
  "certifiedDate",
  "decertificationDate",
  "incrementReceived",
  "incrementExpended",
  "projectArea",
  "hours",
  "notes",
  "phone",
  "website",
] as const;

export function normalize(raw: Record<string, unknown> | null | undefined): FeatureProperties {
  const p = { ...((raw ?? {}) as Record<string, unknown>) };
  for (const field of NULLABLE_FIELDS) {
    if (p[field] === undefined) p[field] = null;
  }
  return p as unknown as FeatureProperties;
}

export function boundsOf(collection: FeatureCollection): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  const extend = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      bounds.extend(coords as [number, number]);
      return;
    }
    for (const c of coords) extend(c);
  };
  for (const f of collection.features) extend((f.geometry as { coordinates?: unknown })?.coordinates);
  return bounds;
}

export function computeTally(vacant: FeatureCollection, tif: FeatureCollection, relief: FeatureCollection): Tally {
  const vacantByCity: Record<City, number> = { Minneapolis: 0, "St. Paul": 0 };
  const vacantByUse: Record<BuildingUse, number> = { home: 0, business: 0, mixed: 0, unrecorded: 0 };
  for (const f of vacant.features) {
    const city = f.properties?.city as City | undefined;
    if (city && city in vacantByCity) vacantByCity[city] += 1;
    vacantByUse[buildingUse((f.properties?.dwellingType as string | null) ?? null)] += 1;
  }
  const housing = tif.features.filter((f) => f.properties?.districtType === "Housing");
  return {
    vacantTotal: vacant.features.length,
    vacantByCity,
    vacantByUse,
    housingTifDollars: housing.reduce((sum, f) => sum + (Number(f.properties?.incrementReceived) || 0), 0),
    housingTifCount: housing.length,
    reliefFreeCount: relief.features.filter((f) => f.properties?.free === true).length,
  };
}

/**
 * Adds all three datasets. Point layers are circle layers rather than DOM
 * markers (which the sibling ward map uses for its ~40 pins): at 695 vacant
 * buildings plus 192 cooling sites, a div per feature costs a visible chunk
 * of frame budget on every pan, and none of these features needs a photo the
 * way a representative's pin does.
 *
 * Order matters and is the whole reason this is one function rather than
 * three: polygons first, points on top.
 */
export function addHousingLayers(
  map: maplibregl.Map,
  data: { vacant: FeatureCollection; tif: FeatureCollection; relief: FeatureCollection },
): void {
  map.addSource(VACANT_SOURCE, { type: "geojson", data: data.vacant });
  map.addSource(TIF_SOURCE, { type: "geojson", data: data.tif });
  map.addSource(RELIEF_SOURCE, { type: "geojson", data: data.relief });

  map.addLayer({
    id: TIF_FILL,
    type: "fill",
    source: TIF_SOURCE,
    // Lighter than a solo layer would want: these polygons sit under up to
    // 900 points, and at 0.45 the fill drags every dot on top of it toward
    // violet. The outline carries the district's shape instead.
    paint: { "fill-color": TIF_COLOR_EXPRESSION, "fill-opacity": 0.25 },
  });
  map.addLayer({
    id: TIF_OUTLINE,
    type: "line",
    source: TIF_SOURCE,
    paint: { "line-color": TIF_COLOR_EXPRESSION, "line-width": 1.5 },
  });
  map.addLayer({
    id: TIF_LABEL,
    type: "symbol",
    source: TIF_SOURCE,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      // Districts are small and tightly packed downtown; without this the
      // labels collide into an unreadable mat at metro zoom.
      "text-max-width": 8,
    },
    // minzoom rather than letting MapLibre's collision detection thin them
    // out: at zoom 10 it keeps a near-random handful, which reads as "these
    // districts are special" when they aren't.
    minzoom: 12,
    paint: { "text-color": "#4C1D95", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
  });

  map.addLayer({
    id: VACANT_CIRCLE,
    type: "circle",
    source: VACANT_SOURCE,
    paint: {
      "circle-color": VACANT_COLOR_EXPRESSION,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 13, 6, 16, 11],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
      "circle-opacity": 0.9,
    },
  });

  map.addLayer({
    id: RELIEF_CIRCLE,
    type: "circle",
    source: RELIEF_SOURCE,
    paint: {
      "circle-color": LAYER_COLOR.relief,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 13, 7, 16, 12],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  });
}

/**
 * What's under a pointer position, most specific first. The two point layers
 * are queried ahead of the TIF fill deliberately rather than leaning on
 * MapLibre's result ordering: a district polygon covers many city blocks, so
 * whenever a dot and a district are both under the cursor the dot is the
 * thing being aimed at, and that has to be true no matter what order the
 * renderer happens to hand results back in.
 *
 * A layer switched off is `visibility: "none"` and never appears in
 * queryRenderedFeatures results at all, so no filtering by active state is
 * needed here. Every id is guarded with getLayer, so a pointer crossing the
 * canvas before the data loads is a no-op rather than a throw.
 */
export function queryAt(map: maplibregl.Map, point: maplibregl.Point): Feature[] {
  const query = (ids: string[]) => {
    const present = ids.filter((id) => map.getLayer(id));
    return present.length === 0 ? [] : (map.queryRenderedFeatures(point, { layers: present }) as unknown as Feature[]);
  };
  const points = query([VACANT_CIRCLE, RELIEF_CIRCLE]);
  return points.length > 0 ? points : query([TIF_FILL]);
}
