import type { LayerKind, Tally } from "@/lib/types";
import { formatDollars } from "@/lib/housingTheme";

/**
 * One line per layer that's switched on, rather than one line about
 * whichever layer is selected. With the layers stacked the headline is the
 * stack: empty houses, the subsidy that was supposed to fill them, and
 * where people go instead.
 */
export default function HeadlineStats({ tally, active }: { tally: Tally; active: Record<LayerKind, boolean> }) {
  const nothingOn = !Object.values(active).some(Boolean);
  return (
    <div className="mt-1 space-y-0.5 text-xs leading-snug text-neutral-600">
      {active.vacant && (
        <p>
          <strong className="text-amber-800">{tally.vacantTotal.toLocaleString("en-US")}</strong> buildings registered
          vacant — {tally.vacantByUse.home} homes, {tally.vacantByUse.business} businesses, {tally.vacantByUse.mixed}{" "}
          mixed-use, and {tally.vacantByUse.unrecorded} Minneapolis records with no building type.
        </p>
      )}
      {active.tif && (
        <p>
          <strong className="text-violet-700">{formatDollars(tally.housingTifDollars)}</strong> in tax increment
          received across {tally.housingTifCount} housing districts.
        </p>
      )}
      {active.relief && (
        <p>
          <strong className="text-teal-700">{tally.reliefFreeCount}</strong> cooling sites across Hennepin County you
          can enter for free.
        </p>
      )}
      {nothingOn && <p>No layers shown. Switch one on below.</p>}
    </div>
  );
}
