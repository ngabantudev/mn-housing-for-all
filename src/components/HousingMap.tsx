"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection } from "geojson";
import type { City, FeatureProperties, LayerKind, Tally } from "@/lib/types";
import {
  LAYER_BLURB,
  LAYER_COLOR,
  LAYER_LABEL,
  TIF_HOUSING_COLOR,
  TIF_OTHER_COLOR,
  VACANT_CATEGORY_COLOR,
  VACANT_UNCATEGORIZED_COLOR,
  formatDollars,
} from "@/lib/housingTheme";
import SiteModal from "./SiteModal";

// Same OpenFreeMap "Liberty" style the sibling MN civic-data map tools use,
// so a reader moving between them isn't relearning the basemap each time.
const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const TWIN_CITIES_CENTER: [number, number] = [-93.185, 44.955];
const DEFAULT_ZOOM = 10.4;

const MODES: LayerKind[] = ["vacant", "tif", "relief"];
const CITIES: City[] = ["Minneapolis", "St. Paul"];

const VACANT_SOURCE = "vacant-source";
const VACANT_CIRCLE = "vacant-circle";
const TIF_SOURCE = "tif-source";
const TIF_FILL = "tif-fill";
const TIF_OUTLINE = "tif-outline";
const TIF_LABEL = "tif-label";
const RELIEF_SOURCE = "relief-source";
const RELIEF_CIRCLE = "relief-circle";

// Which layers belong to which mode. Only one mode is on screen at a time:
// 695 building points under 64 translucent polygons is unreadable, and the
// three layers answer three different questions anyway.
const MODE_LAYERS: Record<LayerKind, string[]> = {
  vacant: [VACANT_CIRCLE],
  tif: [TIF_FILL, TIF_OUTLINE, TIF_LABEL],
  relief: [RELIEF_CIRCLE],
};

// Point layers are circle layers rather than DOM markers (which the sibling
// ward map uses for its ~40 pins): at 695 vacant buildings plus 211 relief
// locations, a div per feature costs a visible chunk of frame budget on
// every pan, and none of these features needs a photo the way a
// representative's pin does.
const VACANT_COLOR_EXPRESSION = [
  "match",
  ["coalesce", ["get", "category"], "none"],
  ...Object.entries(VACANT_CATEGORY_COLOR).flatMap(([category, color]) => [category, color]),
  VACANT_UNCATEGORIZED_COLOR,
] as unknown as maplibregl.ExpressionSpecification;

const TIF_COLOR_EXPRESSION = [
  "case",
  ["==", ["get", "districtType"], "Housing"],
  TIF_HOUSING_COLOR,
  TIF_OTHER_COLOR,
] as unknown as maplibregl.ExpressionSpecification;

/**
 * MapLibre tiles GeoJSON sources internally even when they're client-side,
 * and that vector-tile property encoding has no null type — a `null` in the
 * source comes back as `undefined` on features from queryRenderedFeatures.
 * Every nullable field is checked with `=== null` downstream (the modal's
 * category explainer, the dollar formatter), so undefined is re-normalized
 * back to null here, once, where features leave MapLibre's hands.
 */
function normalize(raw: Record<string, unknown> | null | undefined): FeatureProperties {
  const p = (raw ?? {}) as Record<string, unknown>;
  const nullable = (key: string) => (p[key] === undefined ? null : p[key]);
  return {
    ...p,
    category: nullable("category"),
    dwellingType: nullable("dwellingType"),
    vacantSince: nullable("vacantSince"),
    ward: nullable("ward"),
    neighborhood: nullable("neighborhood"),
    owner: nullable("owner"),
    districtType: nullable("districtType"),
    tifNumber: nullable("tifNumber"),
    creator: nullable("creator"),
    certifiedDate: nullable("certifiedDate"),
    decertificationDate: nullable("decertificationDate"),
    incrementReceived: nullable("incrementReceived"),
    incrementExpended: nullable("incrementExpended"),
    projectArea: nullable("projectArea"),
    hours: nullable("hours"),
    phone: nullable("phone"),
    website: nullable("website"),
  } as unknown as FeatureProperties;
}

function computeTally(vacant: FeatureCollection, tif: FeatureCollection, relief: FeatureCollection): Tally {
  const vacantByCity: Record<City, number> = { Minneapolis: 0, "St. Paul": 0 };
  for (const f of vacant.features) {
    const city = f.properties?.city as City | undefined;
    if (city && city in vacantByCity) vacantByCity[city] += 1;
  }
  const housing = tif.features.filter((f) => f.properties?.districtType === "Housing");
  return {
    vacantTotal: vacant.features.length,
    vacantByCity,
    housingTifDollars: housing.reduce((sum, f) => sum + (Number(f.properties?.incrementReceived) || 0), 0),
    housingTifCount: housing.length,
    reliefFreeCount: relief.features.filter((f) => f.properties?.free === true).length,
  };
}

function boundsOf(collection: FeatureCollection): maplibregl.LngLatBounds {
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

function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}

interface Selected {
  properties: FeatureProperties;
  pinned: boolean;
}

export default function HousingMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const boundsRef = useRef<Partial<Record<LayerKind, maplibregl.LngLatBounds>>>({});

  const [mode, setMode] = useState<LayerKind>("vacant");
  const modeRef = useRef(mode);
  const [visibleCities, setVisibleCities] = useState<Record<City, boolean>>({ Minneapolis: true, "St. Paul": true });
  const visibleCitiesRef = useRef(visibleCities);
  const [housingOnly, setHousingOnly] = useState(false);
  const housingOnlyRef = useRef(housingOnly);
  const [freeOnly, setFreeOnly] = useState(true);
  const freeOnlyRef = useRef(freeOnly);
  const [selected, setSelected] = useState<Selected | null>(null);
  const selectedRef = useRef<Selected | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    visibleCitiesRef.current = visibleCities;
  }, [visibleCities]);
  useEffect(() => {
    housingOnlyRef.current = housingOnly;
  }, [housingOnly]);
  useEffect(() => {
    freeOnlyRef.current = freeOnly;
  }, [freeOnly]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const zoomToDefault = (target: LayerKind = modeRef.current) => {
    const map = mapRef.current;
    const bounds = boundsRef.current[target];
    if (!map || !bounds || bounds.isEmpty()) return;
    map.fitBounds(bounds, { padding: 40, duration: 600 });
  };

  // Every filter the UI can set, re-derived from current state and applied
  // to whichever layers exist. Written as one function rather than one per
  // control so a layer can never end up with a stale filter from a control
  // that happened not to fire — the map's filter state is always the whole
  // truth of the UI's filter state.
  const applyFilters = () => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(VACANT_CIRCLE)) {
      const cities = CITIES.filter((c) => visibleCitiesRef.current[c]);
      map.setFilter(VACANT_CIRCLE, ["in", ["get", "city"], ["literal", cities]] as unknown as maplibregl.FilterSpecification);
    }
    // `null` clears a layer's filter outright. An always-true expression
    // would work too, but MapLibre validates filters against the style spec
    // and the forms that mean "no filter" differ by version — passing null
    // is the one that unambiguously means "show everything."
    const tifFilter = housingOnlyRef.current
      ? (["==", ["get", "districtType"], "Housing"] as unknown as maplibregl.FilterSpecification)
      : null;
    for (const id of [TIF_FILL, TIF_OUTLINE, TIF_LABEL]) {
      if (map.getLayer(id)) map.setFilter(id, tifFilter);
    }
    if (map.getLayer(RELIEF_CIRCLE)) {
      map.setFilter(
        RELIEF_CIRCLE,
        freeOnlyRef.current ? (["==", ["get", "free"], true] as unknown as maplibregl.FilterSpecification) : null,
      );
    }
  };

  // The two single-checkbox filters. Written as one helper rather than two
  // near-identical inline handlers: both have to update state, update the
  // ref applyFilters reads, re-apply, and drop a selection that may no
  // longer be on screen — and getting three of those four right is a bug
  // that only shows up as a stale modal.
  const setBooleanFilter = (
    setState: (value: boolean) => void,
    ref: { current: boolean },
    next: boolean,
  ) => {
    setState(next);
    ref.current = next;
    applyFilters();
    setSelected(null);
  };

  const applyMode = (next: LayerKind) => {
    const map = mapRef.current;
    if (!map) return;
    for (const [groupMode, ids] of Object.entries(MODE_LAYERS) as [LayerKind, string[]][]) {
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", groupMode === next ? "visible" : "none");
      }
    }
  };

  const switchMode = (next: LayerKind) => {
    if (next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    setSelected(null);
    applyMode(next);
    zoomToDefault(next);
  };

  const toggleCity = (city: City) => {
    setVisibleCities((prev) => {
      const next = { ...prev, [city]: !prev[city] };
      visibleCitiesRef.current = next;
      applyFilters();
      // A modal left open for a building in a city that just got hidden is
      // pointing at nothing — close it rather than strand it.
      if (!next[city] && selectedRef.current?.properties.city === city) setSelected(null);
      return next;
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: LIBERTY_STYLE_URL,
      center: TWIN_CITIES_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      cooperativeGestures: isMobileViewport(),
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    const isDesktopHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    map.on("error", (e) => {
      console.error("[MapLibre ERROR]", e.error?.message ?? e);
    });

    const handleHoverMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!isDesktopHover || selectedRef.current?.pinned) return;
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature) return;
      setSelected({ properties: normalize(feature.properties), pinned: false });
    };
    const handleHoverLeave = () => {
      if (!isDesktopHover) return;
      map.getCanvas().style.cursor = "";
      if (selectedRef.current?.pinned) return;
      setSelected(null);
    };

    map.on("load", async () => {
      // The WebGL drawing buffer is sized from the container at construction
      // time; if layout settles a beat later (webfonts, flex sizing) only
      // that smaller top-left region ever gets painted. One forced resize
      // once the container has its final size fixes it.
      setTimeout(() => map.resize(), 100);

      // no-store: these are static files regenerated by scripts/fetch-*.mjs,
      // and a browser-cached copy from before a property was added crashes
      // the modal on a field the current component expects to exist.
      const [vacantRes, tifRes, reliefRes] = await Promise.all([
        fetch("/vacant.geojson", { cache: "no-store" }),
        fetch("/tif.geojson", { cache: "no-store" }),
        fetch("/relief.geojson", { cache: "no-store" }),
      ]);
      const vacant: FeatureCollection = await vacantRes.json();
      const tif: FeatureCollection = await tifRes.json();
      const relief: FeatureCollection = await reliefRes.json();

      setTally(computeTally(vacant, tif, relief));

      // Guards the whole add-sources-and-layers block: a second 'load' would
      // otherwise throw on the first duplicate addSource.
      if (map.getSource(VACANT_SOURCE)) return;

      map.addSource(VACANT_SOURCE, { type: "geojson", data: vacant });
      map.addSource(TIF_SOURCE, { type: "geojson", data: tif });
      map.addSource(RELIEF_SOURCE, { type: "geojson", data: relief });

      map.addLayer({
        id: TIF_FILL,
        type: "fill",
        source: TIF_SOURCE,
        layout: { visibility: "none" },
        paint: { "fill-color": TIF_COLOR_EXPRESSION, "fill-opacity": 0.45 },
      });
      map.addLayer({
        id: TIF_OUTLINE,
        type: "line",
        source: TIF_SOURCE,
        layout: { visibility: "none" },
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
          // Districts are small and tightly packed downtown; without this
          // the labels collide into an unreadable mat at metro zoom.
          "text-max-width": 8,
          visibility: "none",
        },
        // minzoom rather than letting MapLibre's collision detection thin
        // them out: at zoom 10 it keeps a near-random handful, which reads
        // as "these districts are special" when they aren't.
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
        layout: { visibility: "none" },
        paint: {
          "circle-color": LAYER_COLOR.relief,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 13, 7, 16, 12],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9,
        },
      });

      // Registered after the layers exist, not at effect setup: a
      // layer-scoped map.on() is itself a layer query and throws the same
      // "layer does not exist" error if the pointer moves over the canvas
      // before the layer has been added.
      for (const id of [VACANT_CIRCLE, TIF_FILL, RELIEF_CIRCLE]) {
        map.on("mousemove", id, handleHoverMove);
        map.on("mouseleave", id, handleHoverLeave);
      }

      boundsRef.current = {
        vacant: boundsOf(vacant),
        tif: boundsOf(tif),
        relief: boundsOf(relief),
      };

      // Mode can have changed via a click while these fetches were in
      // flight — setMode ran, but applyMode's getLayer guards no-opped
      // because the layers didn't exist yet. Re-apply what's current rather
      // than trusting each layer's just-added default visibility.
      applyMode(modeRef.current);
      applyFilters();

      const initial = boundsRef.current[modeRef.current];
      if (initial && !initial.isEmpty()) map.fitBounds(initial, { padding: 40, duration: 0 });
    });

    // One unscoped click handler rather than one per layer, so a click that
    // hits nothing can be told apart from one that hits a feature — that's
    // what makes "tap away to dismiss" work instead of doing nothing.
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const queryable = [VACANT_CIRCLE, TIF_FILL, RELIEF_CIRCLE].filter((id) => map.getLayer(id));
      if (queryable.length === 0) return;
      // A hidden (visibility: "none") layer never appears in
      // queryRenderedFeatures results, so querying all three is safe even
      // though only one mode is ever on screen.
      const hit = map.queryRenderedFeatures(e.point, { layers: queryable })[0] as Feature | undefined;
      if (!hit) {
        if (selectedRef.current?.pinned) setSelected(null);
        return;
      }
      setSelected({ properties: normalize(hit.properties as Record<string, unknown>), pinned: true });
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapRef.current = null;
    };
    // Intentionally runs once: MapLibre owns a WebGL context and a worker
    // pool per instance, so re-running this on any state change would tear
    // down and rebuild the whole map. Everything the effect reads from
    // component state it reads through a ref for exactly that reason.
  }, []);

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute left-3 top-3 z-20 flex flex-col gap-2 font-sans max-w-[min(20rem,calc(100vw-1.5rem))]">
        <div className="rounded-lg bg-white/95 backdrop-blur-sm border border-neutral-200 shadow-lg px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-sm font-semibold text-neutral-900">MN Housing for All</h1>
            <Link href="/sources" className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
              Open sources
            </Link>
          </div>
          {tally && (
            <p className="mt-1 text-xs text-neutral-600 leading-snug">
              {mode === "vacant" && (
                <>
                  <strong className="text-amber-800">{tally.vacantTotal.toLocaleString("en-US")}</strong> buildings
                  registered vacant — {tally.vacantByCity.Minneapolis} in Minneapolis,{" "}
                  {tally.vacantByCity["St. Paul"]} in Saint Paul.
                </>
              )}
              {mode === "tif" && (
                <>
                  <strong className="text-violet-700">{formatDollars(tally.housingTifDollars)}</strong> in tax increment
                  received across {tally.housingTifCount} housing districts.
                </>
              )}
              {mode === "relief" && (
                <>
                  <strong className="text-teal-700">{tally.reliefFreeCount}</strong> free indoor locations across
                  Hennepin County.
                </>
              )}
            </p>
          )}
        </div>

        <div
          role="group"
          aria-label="Choose map layer"
          className="flex rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-lg p-1 text-sm"
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-colors ${
                mode === m ? "text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
              style={mode === m ? { backgroundColor: LAYER_COLOR[m] } : undefined}
            >
              {LAYER_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-lg px-3 py-2 text-xs text-neutral-600 leading-snug">
          {LAYER_BLURB[mode]}
        </div>

        {mode === "vacant" && (
          <div
            role="group"
            aria-label="Filter by city"
            className="rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-lg divide-y divide-neutral-100 text-sm text-neutral-700"
          >
            {CITIES.map((city) => (
              <label key={city} className="flex items-center gap-2 px-3 py-2.5 sm:py-2 cursor-pointer select-none">
                <input type="checkbox" checked={visibleCities[city]} onChange={() => toggleCity(city)} className="cursor-pointer" />
                {city}
              </label>
            ))}
            <div className="px-3 py-2 space-y-1">
              {Object.entries(VACANT_CATEGORY_COLOR).map(([category, color]) => (
                <div key={category} className="flex items-center gap-2 text-xs text-neutral-600">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  Saint Paul category {category}
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: VACANT_UNCATEGORIZED_COLOR }} />
                Minneapolis (uncategorized)
              </div>
            </div>
          </div>
        )}

        {mode === "tif" && (
          <div className="rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-lg text-sm text-neutral-700">
            <label className="flex items-center gap-2 px-3 py-2.5 sm:py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={housingOnly}
                onChange={() => setBooleanFilter(setHousingOnly, housingOnlyRef, !housingOnly)}
                className="cursor-pointer"
              />
              Housing districts only
            </label>
            <div className="border-t border-neutral-100 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: TIF_HOUSING_COLOR }} />
                Housing district
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: TIF_OTHER_COLOR }} />
                Other or unstated type
              </div>
            </div>
          </div>
        )}

        {mode === "relief" && (
          <div className="rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-lg text-sm text-neutral-700">
            <label className="flex items-center gap-2 px-3 py-2.5 sm:py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={() => setBooleanFilter(setFreeOnly, freeOnlyRef, !freeOnly)}
                className="cursor-pointer"
              />
              Free to enter only
            </label>
          </div>
        )}
      </div>

      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:justify-start sm:left-4 sm:bottom-4 sm:pb-0">
          <SiteModal site={selected.properties} pinned={selected.pinned} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
