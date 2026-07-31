"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import type { BuildingUse, City, FeatureProperties, LayerKind, Tally } from "@/lib/types";
import { BUILDING_USES, buildingUse } from "@/lib/housingTheme";
import {
  CITIES,
  LAYERS,
  LAYER_IDS,
  RELIEF_CIRCLE,
  TIF_FILL,
  TIF_LABEL,
  TIF_OUTLINE,
  VACANT_CIRCLE,
  VACANT_SOURCE,
  addHousingLayers,
  boundsOf,
  computeTally,
  normalize,
  queryAt,
  reliefFilter,
  tifFilter,
  vacantFilter,
} from "@/lib/mapStyle";
import { useStateRef } from "@/lib/useStateRef";
import LayerControls from "./map/LayerControls";
import HeadlineStats from "./map/HeadlineStats";
import SiteModal from "./SiteModal";

// Same OpenFreeMap "Liberty" style the sibling MN civic-data map tools use,
// so a reader moving between them isn't relearning the basemap each time.
const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const TWIN_CITIES_CENTER: [number, number] = [-93.185, 44.955];
const DEFAULT_ZOOM = 10.4;

// Also the `md` Tailwind breakpoint, and deliberately the same number: below
// it the filter panel and the detail card cannot share a row, so the layout
// and the map's own touch behaviour have to change together.
const MOBILE_BREAKPOINT = 768;

function isMobileViewport(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

interface Selected {
  properties: FeatureProperties;
  pinned: boolean;
}

export default function HousingMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const boundsRef = useRef<Partial<Record<LayerKind, maplibregl.LngLatBounds>>>({});

  // Every layer starts on. The map's whole argument is the three datasets
  // read against each other, so the default view is all of them and the
  // checkboxes are there to subtract, not to assemble.
  //
  // Each of these is a useStateRef because the map's event handlers, which
  // are registered once and never re-created, have to read the current value
  // — see the note in lib/useStateRef.ts.
  const [active, setActive, activeRef] = useStateRef<Record<LayerKind, boolean>>({
    vacant: true,
    tif: true,
    relief: true,
  });
  const [visibleCities, setVisibleCities, visibleCitiesRef] = useStateRef<Record<City, boolean>>({
    Minneapolis: true,
    "St. Paul": true,
  });
  const [visibleUses, setVisibleUses, visibleUsesRef] = useStateRef<Record<BuildingUse, boolean>>({
    home: true,
    business: true,
    mixed: true,
    unrecorded: true,
  });
  const [housingOnly, setHousingOnly, housingOnlyRef] = useStateRef(false);
  const [freeOnly, setFreeOnly, freeOnlyRef] = useStateRef(true);
  const [selected, setSelected, selectedRef] = useStateRef<Selected | null>(null);

  const [tally, setTally] = useState<Tally | null>(null);
  // Phone-only: the layer checkboxes and filters are a tall column, and
  // pinning them open over a 375px-wide map leaves no map. Starts closed and
  // is CSS-forced open from `md` up, so the desktop layout never depends on
  // this and there's no first-paint flicker from measuring the viewport.
  const [panelOpen, setPanelOpen] = useState(false);
  const activeCount = LAYERS.filter((kind) => active[kind]).length;

  /**
   * Padding for every fitBounds, sized around the UI that sits on top of the
   * map rather than around the canvas. A flat 40px centered the data under
   * the filter panel on a desktop and under the header card on a phone,
   * which reads as "there's nothing over there" — the dots were there, just
   * beneath an opaque card.
   *
   * Read at call time, not captured once: a window can be resized across the
   * breakpoint between the initial fit and a later "Zoom to".
   */
  const fitPadding = (): maplibregl.PaddingOptions =>
    isMobileViewport()
      ? { top: 230, bottom: 32, left: 20, right: 20 }
      : { top: 32, bottom: 32, left: 352, right: 32 };

  const zoomToLayer = (target: LayerKind) => {
    const map = mapRef.current;
    const bounds = boundsRef.current[target];
    if (!map || !bounds || bounds.isEmpty()) return;
    map.fitBounds(bounds, { padding: fitPadding(), duration: 600 });
  };

  /**
   * The extent of everything currently switched on. With three layers
   * co-visible there's no single "the" layer to frame on, and framing on
   * one of them silently pushes the others off screen — which reads as
   * "that layer has no data here" rather than "you're zoomed past it."
   */
  const activeBounds = (): maplibregl.LngLatBounds | null => {
    const combined = new maplibregl.LngLatBounds();
    for (const kind of LAYERS) {
      const b = boundsRef.current[kind];
      if (!activeRef.current[kind] || !b || b.isEmpty()) continue;
      combined.extend(b);
    }
    return combined.isEmpty() ? null : combined;
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
      map.setFilter(
        VACANT_CIRCLE,
        vacantFilter(
          CITIES.filter((c) => visibleCitiesRef.current[c]),
          BUILDING_USES.filter((u) => visibleUsesRef.current[u]),
        ),
      );
    }
    for (const id of [TIF_FILL, TIF_OUTLINE, TIF_LABEL]) {
      if (map.getLayer(id)) map.setFilter(id, tifFilter(housingOnlyRef.current));
    }
    if (map.getLayer(RELIEF_CIRCLE)) map.setFilter(RELIEF_CIRCLE, reliefFilter(freeOnlyRef.current));
  };

  const applyVisibility = () => {
    const map = mapRef.current;
    if (!map) return;
    for (const [kind, ids] of Object.entries(LAYER_IDS) as [LayerKind, string[]][]) {
      const visibility = activeRef.current[kind] ? "visible" : "none";
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
      }
    }
  };

  /**
   * Drops the open detail card when the feature it describes is no longer on
   * screen. Every filter control funnels through here rather than repeating
   * the check, because the failure it prevents — a card describing a
   * building the reader just filtered away — is silent: nothing errors, the
   * card simply starts lying.
   */
  const dropSelectionIfHidden = () => {
    const site = selectedRef.current?.properties;
    if (!site) return;
    const hidden =
      !activeRef.current[site.kind] ||
      (site.kind === "vacant" &&
        (!visibleCitiesRef.current[site.city] || !visibleUsesRef.current[buildingUse(site.dwellingType)])) ||
      (site.kind === "tif" && housingOnlyRef.current && site.districtType !== "Housing") ||
      (site.kind === "relief" && freeOnlyRef.current && !site.free);
    if (hidden) setSelected(null);
  };

  const toggleLayer = (kind: LayerKind) => {
    setActive((prev) => ({ ...prev, [kind]: !prev[kind] }));
    applyVisibility();
    dropSelectionIfHidden();
  };

  const toggleCity = (city: City) => {
    setVisibleCities((prev) => ({ ...prev, [city]: !prev[city] }));
    applyFilters();
    dropSelectionIfHidden();
  };

  const toggleUse = (use: BuildingUse) => {
    setVisibleUses((prev) => ({ ...prev, [use]: !prev[use] }));
    applyFilters();
    dropSelectionIfHidden();
  };

  const toggleHousingOnly = () => {
    setHousingOnly((prev) => !prev);
    applyFilters();
    dropSelectionIfHidden();
  };

  const toggleFreeOnly = () => {
    setFreeOnly((prev) => !prev);
    applyFilters();
    dropSelectionIfHidden();
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

    map.on("load", async () => {
      // The WebGL drawing buffer is sized from the container at construction
      // time; if layout settles a beat later (webfonts, flex sizing) only
      // that smaller top-left region ever gets painted. One forced resize
      // once the container has its final size fixes it.
      setTimeout(() => map.resize(), 100);

      // no-store: these are static files regenerated by scripts/fetch-*.mjs,
      // and a browser-cached copy from before a property was added crashes
      // the modal on a field the current component expects to exist.
      const [vacant, tif, relief] = (await Promise.all(
        ["/vacant.geojson", "/tif.geojson", "/relief.geojson"].map((url) =>
          fetch(url, { cache: "no-store" }).then((res) => res.json()),
        ),
      )) as [FeatureCollection, FeatureCollection, FeatureCollection];

      setTally(computeTally(vacant, tif, relief));

      // Guards the whole add-sources-and-layers block: a second 'load' would
      // otherwise throw on the first duplicate addSource.
      if (map.getSource(VACANT_SOURCE)) return;
      addHousingLayers(map, { vacant, tif, relief });

      boundsRef.current = { vacant: boundsOf(vacant), tif: boundsOf(tif), relief: boundsOf(relief) };

      // A checkbox can have been clicked while these fetches were in flight
      // — setActive ran, but applyVisibility's getLayer guards no-opped
      // because the layers didn't exist yet. Re-apply what's current rather
      // than trusting each layer's just-added default visibility.
      applyVisibility();
      applyFilters();

      const initial = activeBounds();
      if (initial) map.fitBounds(initial, { padding: fitPadding(), duration: 0 });
    });

    // One unscoped hover handler rather than one per layer. With all three
    // layers co-visible a pointer over a vacant building that sits inside a
    // TIF district is inside two layers at once, and per-layer handlers
    // would both fire — leaving whichever registered last to win, which is
    // an arbitrary answer. queryAt resolves that deterministically.
    map.on("mousemove", (e: maplibregl.MapMouseEvent) => {
      if (!isDesktopHover || selectedRef.current?.pinned) return;
      const hit = queryAt(map, e.point)[0];
      map.getCanvas().style.cursor = hit ? "pointer" : "";
      setSelected(hit ? { properties: normalize(hit.properties as Record<string, unknown>), pinned: false } : null);
    });

    map.on("mouseout", () => {
      if (!isDesktopHover) return;
      map.getCanvas().style.cursor = "";
      if (!selectedRef.current?.pinned) setSelected(null);
    });

    // A click that hits nothing has to be told apart from one that hits a
    // feature — that's what makes "tap away to dismiss" work instead of
    // doing nothing.
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const hit = queryAt(map, e.point)[0];
      if (!hit) {
        if (selectedRef.current?.pinned) setSelected(null);
        return;
      }
      setSelected({ properties: normalize(hit.properties as Record<string, unknown>), pinned: true });
      // On a phone the filter panel and the detail sheet both want the
      // screen. Tapping a feature is a clear statement about which one the
      // reader wants, so the panel folds away rather than being covered.
      setPanelOpen(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Left column. `max-h` + scroll rather than a fixed height: with three
          layers expanded the controls are taller than a laptop viewport, and
          a panel that runs off the bottom of the screen hides the citation
          line at the end of the last layer. */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-h-[calc(100dvh-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto overscroll-contain font-sans *:pointer-events-auto *:shrink-0">
        <div className="rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-sm font-semibold text-neutral-900">MN Housing for All</h1>
            <Link href="/sources" className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900">
              Open sources
            </Link>
          </div>

          {tally && <HeadlineStats tally={tally} active={active} />}

          {/* Phone-only handle for the panel below. Hidden from `md` up,
              where that panel is always on screen and a control that can't
              change anything would just be a dead button. */}
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls="layer-panel"
            className="mt-2 flex w-full items-center justify-between rounded-md border border-neutral-200 px-2.5 py-2 text-sm font-medium text-neutral-700 active:bg-neutral-100 md:hidden"
          >
            <span>
              Layers &amp; filters
              <span className="ml-1.5 font-normal text-neutral-500">
                {activeCount} of {LAYERS.length} on
              </span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`shrink-0 transition-transform ${panelOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <LayerControls
          open={panelOpen}
          active={active}
          onToggleLayer={toggleLayer}
          onZoomToLayer={zoomToLayer}
          tally={tally}
          visibleCities={visibleCities}
          onToggleCity={toggleCity}
          visibleUses={visibleUses}
          onToggleUse={toggleUse}
          housingOnly={housingOnly}
          onToggleHousingOnly={toggleHousingOnly}
          freeOnly={freeOnly}
          onToggleFreeOnly={toggleFreeOnly}
        />
      </div>

      {selected && (
        // Top-right from `md` up, not bottom-left: the filter panel owns the
        // left column at every height, so a detail card anchored there —
        // which is where this used to sit — was drawn underneath it and the
        // reader lost both. The right side also keeps clear of MapLibre's
        // zoom buttons and attribution, which live bottom-right.
        //
        // Below `md` it's a bottom sheet, the one place a card can go on a
        // phone without covering the feature the reader just tapped.
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:justify-end md:pb-0">
          <SiteModal site={selected.properties} pinned={selected.pinned} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
