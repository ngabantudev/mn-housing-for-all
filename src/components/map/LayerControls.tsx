import type { BuildingUse, City, LayerKind, Tally } from "@/lib/types";
import {
  BUILDING_USES,
  BUILDING_USE_LABEL,
  LAYER_BLURB,
  LAYER_COLOR,
  LAYER_LABEL,
  TIF_HOUSING_COLOR,
  TIF_OTHER_COLOR,
  VACANT_CATEGORY_COLOR,
  VACANT_UNCATEGORIZED_COLOR,
} from "@/lib/housingTheme";
import { CITIES, LAYERS } from "@/lib/mapStyle";
import LayerCitation from "./LayerCitation";

// Shared by every checkbox in the panel. The vertical padding is there for
// touch: on a phone these rows are the whole interface, and a 12px label with
// no padding is a target most thumbs miss.
const CHECKBOX_ROW = "flex cursor-pointer select-none items-center gap-2 py-1 text-xs md:py-0";

function Swatch({ color, square = false }: { color: string; square?: boolean }) {
  return (
    <span
      className={`h-2.5 w-2.5 shrink-0 ${square ? "rounded-sm" : "rounded-full"}`}
      style={{ backgroundColor: color }}
    />
  );
}

function LegendRow({ color, square, children }: { color: string; square?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-600">
      <Swatch color={color} square={square} />
      {children}
    </div>
  );
}

export interface LayerControlsProps {
  active: Record<LayerKind, boolean>;
  onToggleLayer: (kind: LayerKind) => void;
  onZoomToLayer: (kind: LayerKind) => void;
  tally: Tally | null;
  visibleCities: Record<City, boolean>;
  onToggleCity: (city: City) => void;
  visibleUses: Record<BuildingUse, boolean>;
  onToggleUse: (use: BuildingUse) => void;
  housingOnly: boolean;
  onToggleHousingOnly: () => void;
  freeOnly: boolean;
  onToggleFreeOnly: () => void;
  /** Phone only — the panel is CSS-forced open from `md` up. */
  open: boolean;
}

/**
 * One row per layer: a checkbox, a colour swatch, and a "Zoom to". Each
 * layer's blurb, filters, legend and citation live under its own row and
 * collapse with it — a "Housing districts only" control on screen for a
 * layer that isn't drawn is a control that visibly does nothing.
 */
export default function LayerControls(props: LayerControlsProps) {
  const { active, tally, visibleCities, visibleUses, housingOnly, freeOnly, open } = props;
  return (
    <div
      id="layer-panel"
      role="group"
      aria-label="Map layers"
      className={`${open ? "block" : "hidden"} divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white/90 text-sm text-neutral-700 shadow-lg backdrop-blur-sm md:block`}
    >
      {LAYERS.map((kind) => (
        <div key={kind}>
          <div className="flex items-center gap-2 px-3 py-2.5 sm:py-2">
            <label className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={active[kind]}
                onChange={() => props.onToggleLayer(kind)}
                className="cursor-pointer"
              />
              <Swatch color={LAYER_COLOR[kind]} />
              <span className="font-medium text-neutral-900">{LAYER_LABEL[kind]}</span>
            </label>
            <button
              type="button"
              onClick={() => props.onZoomToLayer(kind)}
              disabled={!active[kind]}
              className="shrink-0 rounded-md px-2.5 py-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500 md:py-1"
            >
              Zoom to
            </button>
          </div>

          {active[kind] && (
            <div className="space-y-2 border-t border-neutral-100 px-3 py-2">
              <p className="text-xs leading-snug text-neutral-600">{LAYER_BLURB[kind]}</p>

              {kind === "vacant" && (
                <>
                  <div className="flex gap-4">
                    {CITIES.map((city) => (
                      <label key={city} className={CHECKBOX_ROW}>
                        <input
                          type="checkbox"
                          checked={visibleCities[city]}
                          onChange={() => props.onToggleCity(city)}
                          className="cursor-pointer"
                        />
                        {city}
                      </label>
                    ))}
                  </div>

                  {/* "Empty" on its own doesn't say empty *what*. Saint Paul
                      publishes a dwelling type, so the split between houses,
                      storefronts and mixed-use blocks is in the data and
                      belongs on screen — including the bucket Minneapolis
                      leaves blank, which is a third of the layer and
                      shouldn't look like a home. */}
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      What kind of building
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {BUILDING_USES.map((use) => (
                        <label key={use} className={CHECKBOX_ROW}>
                          <input
                            type="checkbox"
                            checked={visibleUses[use]}
                            onChange={() => props.onToggleUse(use)}
                            className="cursor-pointer"
                          />
                          <span className="flex-1">{BUILDING_USE_LABEL[use]}</span>
                          {tally && <span className="tabular-nums text-neutral-500">{tally.vacantByUse[use]}</span>}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                      Saint Paul records what each building is; Minneapolis&rsquo; register carries no building-type
                      field, so its {tally?.vacantByUse.unrecorded ?? 311} buildings are unclassified rather than
                      assumed to be homes.
                    </p>
                  </div>

                  <div className="space-y-1">
                    {Object.entries(VACANT_CATEGORY_COLOR).map(([category, color]) => (
                      <LegendRow key={category} color={color}>
                        Saint Paul category {category}
                      </LegendRow>
                    ))}
                    <LegendRow color={VACANT_UNCATEGORIZED_COLOR}>Minneapolis (uncategorized)</LegendRow>
                  </div>
                </>
              )}

              {kind === "tif" && (
                <>
                  <label className={CHECKBOX_ROW}>
                    <input
                      type="checkbox"
                      checked={housingOnly}
                      onChange={props.onToggleHousingOnly}
                      className="cursor-pointer"
                    />
                    Housing districts only
                  </label>
                  <div className="space-y-1">
                    <LegendRow color={TIF_HOUSING_COLOR} square>
                      Housing district
                    </LegendRow>
                    <LegendRow color={TIF_OTHER_COLOR} square>
                      Other or unstated type
                    </LegendRow>
                  </div>
                </>
              )}

              {kind === "relief" && (
                <label className={CHECKBOX_ROW}>
                  <input
                    type="checkbox"
                    checked={freeOnly}
                    onChange={props.onToggleFreeOnly}
                    className="cursor-pointer"
                  />
                  Free to enter only
                </label>
              )}

              <LayerCitation kind={kind} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
