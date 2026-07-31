"use client";

import type { FeatureProperties, ReliefProperties, TifProperties, VacantProperties } from "@/lib/types";
import { LAYER_COLOR, LAYER_COLOR_SOFT, formatDate, formatDollars, formatDuration } from "@/lib/housingTheme";

// Saint Paul's own descriptions of what each vacant-building category
// obliges an owner to do, condensed from the city's Vacant Buildings Map
// metadata. Shown instead of a bare "Category 2", which tells a resident
// nothing about whether the house next door can be brought back.
const CATEGORY_MEANING: Record<string, string> = {
  "1": "Registered and fees paid; utilities restored and code orders met for legal occupancy.",
  "2": "Cannot be sold until code compliance is achieved. Registration, fees, and a Truth-in-Sale-of-Housing report required.",
  "3": "Condemned and structurally substandard. Cannot be sold or occupied until rehabilitated.",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="shrink-0 text-neutral-500 w-32">{label}</dt>
      <dd className="text-neutral-900 min-w-0">{value}</dd>
    </div>
  );
}

function VacantBody({ site }: { site: VacantProperties }) {
  const duration = formatDuration(site.vacantSince);
  const meaning = site.category ? CATEGORY_MEANING[site.category] : null;
  return (
    <>
      {duration && (
        // The headline number, not a field in the list: "empty for 7 years"
        // is the whole point of putting this building on a map, and burying
        // it in a definition list would waste it.
        <p className="text-2xl font-semibold text-amber-800 leading-tight">
          Empty for {duration}
        </p>
      )}
      <dl className="mt-3 space-y-1.5">
        <Row label="City" value={site.city} />
        <Row label="Registered" value={formatDate(site.vacantSince)} />
        <Row label="Building type" value={site.dwellingType} />
        <Row label="Ward" value={site.ward ? `Ward ${site.ward}` : null} />
        <Row label="Neighborhood" value={site.neighborhood} />
        <Row label="Owner" value={site.owner} />
        <Row
          label="Category"
          value={site.category ? `Category ${site.category}` : null}
        />
      </dl>
      {meaning && <p className="mt-3 text-sm text-neutral-600 leading-snug">{meaning}</p>}
      {site.category === null && (
        <p className="mt-3 text-sm text-neutral-500 leading-snug">
          Minneapolis&rsquo; register doesn&rsquo;t rate buildings by severity the way Saint Paul&rsquo;s does, so
          there&rsquo;s no category here.
        </p>
      )}
    </>
  );
}

function TifBody({ site }: { site: TifProperties }) {
  const isHousing = site.districtType === "Housing";
  return (
    <>
      <p className="text-2xl font-semibold text-violet-700 leading-tight">
        {formatDollars(site.incrementReceived)}
      </p>
      <p className="text-sm text-neutral-500">in tax increment received to date</p>
      <dl className="mt-3 space-y-1.5">
        <Row
          label="District type"
          value={
            site.districtType ? (
              <span className={isHousing ? "font-semibold text-violet-700" : undefined}>{site.districtType}</span>
            ) : (
              <span className="text-neutral-400">Not stated in the published table</span>
            )
          }
        />
        <Row label="District no." value={site.tifNumber} />
        <Row label="Established by" value={site.creator === "HRA" ? "Housing & Redevelopment Authority" : site.creator} />
        <Row label="Certified" value={formatDate(site.certifiedDate)} />
        <Row label="Decertifies" value={site.decertificationDate} />
        <Row label="Increment spent" value={site.incrementExpended === null ? null : formatDollars(site.incrementExpended)} />
        <Row label="Project area" value={site.projectArea} />
      </dl>
      {isHousing && (
        <p className="mt-3 text-sm text-neutral-600 leading-snug">
          Minnesota conditions housing TIF districts on producing low-income housing — this is captured property-tax
          growth that is legally tied to it.
        </p>
      )}
    </>
  );
}

function ReliefBody({ site }: { site: ReliefProperties }) {
  return (
    <>
      <p className="text-lg font-semibold text-teal-700 leading-tight">{site.type}</p>
      <dl className="mt-3 space-y-1.5">
        <Row label="Address" value={`${site.address}, ${site.city}`} />
        <Row label="Hours" value={site.hours} />
        <Row label="Phone" value={site.phone ? <a className="underline" href={`tel:${site.phone}`}>{site.phone}</a> : null} />
        <Row
          label="Cost"
          value={site.free ? <span className="text-teal-700 font-medium">Free to enter</span> : "May charge a fee"}
        />
      </dl>
      {site.website && (
        <a
          href={site.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-teal-700 underline underline-offset-2"
        >
          Hours and details &rarr;
        </a>
      )}
      <p className="mt-3 text-xs text-neutral-500 leading-snug">
        Hennepin County&rsquo;s own caution: hours and operating status change without notice. Call ahead.
      </p>
    </>
  );
}

export function siteTitle(site: FeatureProperties): string {
  return site.kind === "vacant" ? site.address : site.name;
}

export default function SiteModal({
  site,
  pinned,
  onClose,
}: {
  site: FeatureProperties;
  pinned: boolean;
  onClose: () => void;
}) {
  const accent = LAYER_COLOR[site.kind];
  return (
    <div
      className="pointer-events-auto w-full sm:w-[380px] max-h-[55dvh] sm:max-h-[70dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-neutral-200 font-sans"
      style={{ borderTopColor: accent, borderTopWidth: 4 }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: LAYER_COLOR_SOFT[site.kind], color: accent }}
            >
              {site.kind === "vacant" ? "Vacant building" : site.kind === "tif" ? "TIF district" : "Heat relief"}
            </span>
            <h2 className="mt-1.5 text-base font-semibold text-neutral-900 leading-snug break-words">
              {siteTitle(site)}
            </h2>
          </div>
          {pinned && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-3">
          {site.kind === "vacant" && <VacantBody site={site} />}
          {site.kind === "tif" && <TifBody site={site} />}
          {site.kind === "relief" && <ReliefBody site={site} />}
        </div>
      </div>
    </div>
  );
}
