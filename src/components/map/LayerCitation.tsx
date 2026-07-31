import Link from "next/link";
import type { LayerKind } from "@/lib/types";
import { feedSourcesForLayer } from "@/lib/sources";

/**
 * The citation line under every layer's controls: who published this data,
 * linked to the publisher's own copy, plus a link into the sources page
 * entry describing what the file actually contains and where it falls short.
 *
 * On the layer itself rather than only on /sources, because a reader
 * deciding what a dot means is deciding it here, with the map in front of
 * them — a citation one page away is one they will not go and check.
 */
export default function LayerCitation({ kind }: { kind: LayerKind }) {
  const feeds = feedSourcesForLayer(kind);
  const linkClass = "underline underline-offset-2 hover:text-neutral-900";
  return (
    <p className="border-t border-neutral-100 pt-2 text-[11px] leading-snug text-neutral-500">
      Data:{" "}
      {feeds.map((source, i) => (
        <span key={source.id}>
          {i > 0 && " · "}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {source.short ?? source.publisher}
          </a>
        </span>
      ))}
      {feeds[0] && (
        <>
          {" · "}
          <Link href={`/sources#${feeds[0].id}`} className={linkClass}>
            what&rsquo;s in it
          </Link>
        </>
      )}
      {kind === "vacant" && (
        <>
          {" · "}
          <Link href="/sources#rules" className={linkClass}>
            why a building lands here
          </Link>
        </>
      )}
      {/* The person who brought the layer here, credited on the layer
          itself. Someone had to know this data existed and that it was
          worth mapping; that doesn't show up anywhere in the file. */}
      {feeds.map((source) =>
        source.credit ? (
          <span key={`${source.id}-credit`}>
            {" · via "}
            <a href={source.credit.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {source.credit.org}
            </a>
          </span>
        ) : null,
      )}
    </p>
  );
}
