"use client";

import Link from "next/link";
import type { FeatureProperties, LayerKind, ReliefProperties, TifProperties, VacantProperties } from "@/lib/types";
import {
  LAYER_COLOR,
  LAYER_COLOR_SOFT,
  REGISTRATION_CAVEAT,
  REGISTRATION_TRIGGER,
  buildingNoun,
  reliefTypeLabel,
  formatDate,
  formatDollars,
  formatDuration,
} from "@/lib/housingTheme";
import { feedSourcesForLayer } from "@/lib/sources";

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
  // "Empty duplex for 7 years" carries the whole argument in one line where
  // "Empty for 7 years" left a reader to picture whatever they liked —
  // usually a house, which is wrong for the 73 commercial buildings and the
  // 14 mixed-use ones on this layer. Where the city publishes no type the
  // noun stays "building", which is the most the record supports.
  const noun = buildingNoun(site.dwellingType);
  return (
    <>
      {duration ? (
        // The headline, not a field in the list: what it is and how long
        // it's been empty is the whole point of putting this building on a
        // map, and burying either in a definition list would waste it.
        <p className="text-2xl font-semibold text-amber-800 leading-tight">
          Empty {noun} &mdash; {duration}
        </p>
      ) : (
        <p className="text-2xl font-semibold text-amber-800 leading-tight">Empty {noun}</p>
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
          Minneapolis&rsquo; register doesn&rsquo;t rate buildings by severity the way Saint Paul&rsquo;s does, and
          carries no building-type field either, so there&rsquo;s no category or use here. The program covers
          residential and commercial buildings alike.
        </p>
      )}

      {/* Why it's on the register at all. Without this a reader supplies
          their own explanation — abandoned, derelict, nobody wants it —
          when what the record actually says is narrower and duller: it met
          one of the ordinance's conditions. */}
      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Why it&rsquo;s registered</p>
        <p className="mt-1 text-sm leading-snug text-neutral-700">{REGISTRATION_TRIGGER[site.city]}</p>
        <p className="mt-1.5 text-xs leading-snug text-neutral-500">{REGISTRATION_CAVEAT}</p>
      </div>
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
      <p className="text-lg font-semibold text-teal-700 leading-tight">{reliefTypeLabel(site.type)}</p>
      <dl className="mt-3 space-y-1.5">
        <Row label="Address" value={`${site.address}, ${site.city}`} />
        <Row label="Hours" value={site.hours} />
        {/* The county's own note, verbatim. It's the field that says whether
            the pool is indoors, what a non-swimming adult pays, and — on
            rows the county hasn't re-statused — that the place is shut for
            the season. */}
        <Row label="County note" value={site.notes} />
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

const KIND_LABEL: Record<LayerKind, string> = {
  vacant: "Vacant building",
  tif: "TIF district",
  // The county's own term for this list — see LAYER_LABEL in housingTheme.
  relief: "Cooling site",
};

/**
 * Where this record came from, on the record itself. Every claim in the
 * modal above is the publisher's, not this project's, and a reader who
 * doubts one should be one click from the file it was read out of rather
 * than having to take the map's word for it.
 */
function SourceFooter({ site }: { site: FeatureProperties }) {
  const feeds = feedSourcesForLayer(site.kind).filter(
    // The vacant layer has one feed per city; cite the one this building is
    // actually from, not both.
    (source) => site.kind !== "vacant" || source.publisher.includes(site.city === "St. Paul" ? "Saint Paul" : "Minneapolis"),
  );
  if (feeds.length === 0) return null;
  return (
    <p className="mt-4 border-t border-neutral-100 pt-2.5 text-xs leading-snug text-neutral-500">
      Source:{" "}
      {feeds.map((source, i) => (
        <span key={source.id}>
          {i > 0 && " · "}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-neutral-900"
          >
            {source.title}
          </a>
        </span>
      ))}
      {" · "}
      <Link href={`/sources#${feeds[0].id}`} className="underline underline-offset-2 hover:text-neutral-900">
        what this data does and doesn&rsquo;t contain
      </Link>
      {feeds.map((source) =>
        source.credit ? (
          <span key={`${source.id}-credit`} className="mt-1 block">
            Brought to this project by {source.credit.name} of{" "}
            <a
              href={source.credit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-neutral-900"
            >
              {source.credit.org}
            </a>
            .
          </span>
        ) : null,
      )}
    </p>
  );
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
      // Handle for layout checks: whether this card overlaps the filter
      // panel is a geometry question, and the only honest way to answer it
      // is to measure both rects in a real viewport.
      data-site-modal=""
      // Breakpoint is `md`, not `sm`: at 640px a 20rem filter panel and a
      // 22rem detail card don't both fit across the viewport, so the
      // side-by-side layout has to wait for 768px. Height is capped in dvh
      // so a long TIF record scrolls inside the card rather than running off
      // the bottom of the screen.
      className="pointer-events-auto w-full max-h-[55dvh] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white font-sans shadow-2xl md:max-h-[calc(100dvh-1.5rem)] md:w-88 md:rounded-2xl lg:w-95"
      style={{ borderTopColor: accent, borderTopWidth: 4 }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: LAYER_COLOR_SOFT[site.kind], color: accent }}
            >
              {KIND_LABEL[site.kind]}
            </span>
            <h2 className="mt-1.5 text-base font-semibold text-neutral-900 leading-snug wrap-break-word">
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
          <SourceFooter site={site} />
        </div>
      </div>
    </div>
  );
}
