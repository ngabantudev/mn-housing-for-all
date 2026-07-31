import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_META, CATEGORY_ORDER, SOURCES, SOURCES_BY_CATEGORY, type Source } from "@/lib/sources";
import { LAYER_COLOR, LAYER_COLOR_SOFT, LAYER_LABEL } from "@/lib/housingTheme";

export const metadata: Metadata = {
  title: "Open sources — MN Housing for All",
  description:
    "Every dataset, report, statute, and story behind this map, with a link to each one and a description of what it actually contains.",
};

function LayerBadge({ source }: { source: Source }) {
  if (!source.layer) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: LAYER_COLOR_SOFT[source.layer], color: LAYER_COLOR[source.layer] }}
    >
      {LAYER_LABEL[source.layer]} layer
    </span>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    // The id is what the map's per-layer citation links to. scroll-mt keeps
    // the card's own heading clear of the viewport edge on arrival, so a
    // reader following a citation lands on the title rather than mid-card.
    <li id={source.id} className="scroll-mt-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 target:ring-2 target:ring-neutral-900/15">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
          {source.format}
        </span>
        <LayerBadge source={source} />
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug text-neutral-900">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
        >
          {source.title}
        </a>
      </h3>

      <p className="mt-0.5 text-sm text-neutral-500">
        {source.publisher}
        {source.year && ` · ${source.year}`}
      </p>

      <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">{source.description}</p>

      {source.caveat && (
        <p className="mt-2.5 border-l-2 border-amber-300 pl-3 text-sm leading-relaxed text-neutral-600">
          <span className="font-medium text-amber-800">Caveat: </span>
          {source.caveat}
        </p>
      )}

      <p className="mt-3 break-all font-mono text-xs text-neutral-400">{source.url}</p>
    </li>
  );
}

export default function SourcesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 font-sans sm:px-6 sm:py-14">
      <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900">
        &larr; Back to the map
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Open sources</h1>

      <p className="mt-4 text-base leading-relaxed text-neutral-700">
        Everything this project stands on, with a link to each source and a description of what it actually contains.
        The rule is simple: if a number appears anywhere in this app, the thing it came from is on this page and you can
        go check it.
      </p>

      <p className="mt-3 text-base leading-relaxed text-neutral-700">
        Nothing on the map is hand-entered, estimated, or modeled. The four feeds at the top are public ArcGIS feature
        services, re-fetched by scripts in this repository, and the map draws exactly what they return. Where a
        publisher states a limitation on their own data, that limitation is reproduced here rather than smoothed over —
        and where this project decided <em>not</em> to map something it could have, that decision is listed too, with
        the reasoning.
      </p>

      <p className="mt-6 text-sm text-neutral-500">
        {SOURCES.length} sources across {CATEGORY_ORDER.length} categories.
      </p>

      <nav aria-label="Jump to category" className="mt-3 flex flex-wrap gap-2">
        {CATEGORY_ORDER.map((category) => (
          <a
            key={category}
            href={`#${category}`}
            className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
          >
            {CATEGORY_META[category].title}
          </a>
        ))}
      </nav>

      {CATEGORY_ORDER.map((category) => {
        const sources = SOURCES_BY_CATEGORY[category];
        if (sources.length === 0) return null;
        return (
          <section key={category} id={category} className="mt-12 scroll-mt-6">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{CATEGORY_META[category].title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{CATEGORY_META[category].blurb}</p>
            <ul className="mt-5 space-y-4">
              {sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mt-14 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Refreshing the data</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          The map reads three static GeoJSON files. To rebuild them from the live services above:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 px-4 py-3 font-mono text-xs text-neutral-100">
          npm run data:all
        </pre>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">
          Each script prints what it pulled and flags what it had to drop — buildings with no usable registration date,
          TIF districts with no district type in the published table — so a run that quietly loses records is visible
          rather than silent.
        </p>
      </section>

      <footer className="mt-12 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
        <p>
          Public data, reproduced without warranty. The GIS data here is made available under the Minnesota Government
          Data Practices Act and is provided by its publishers &ldquo;as is&rdquo; — consult each source&rsquo;s own
          documentation before relying on it for anything consequential.
        </p>
      </footer>
    </main>
  );
}
