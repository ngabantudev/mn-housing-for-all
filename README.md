# mn-housing-for-all

A map of Minnesota's housing and homelessness crisis, built entirely from the cities' and county's own open data.

**→ [mn-housing-for-all.resistance.workers.dev](https://mn-housing-for-all.resistance.workers.dev)**

Three layers, one question each:

- **Empty** — 695 buildings the Twin Cities currently carry on their vacant-building registers, and how long each has sat that way. Click one to see its registration date, ward, and (in Saint Paul) the category that controls whether it can legally be sold or reoccupied.
- **Subsidy** — Saint Paul's 64 tax-increment financing districts, with the tax increment each has received as filed with the State Auditor. 29 are Housing districts, which Minnesota conditions on producing low-income housing.
- **Relief** — 211 indoor, publicly accessible locations across Hennepin County during a heat emergency, 167 of them free to enter.

Every source is listed with a description and a link on the [Open Sources](https://mn-housing-for-all.resistance.workers.dev/sources) page — 24 of them, covering the feeds the map pulls from, the cities' own portals, the reporting, the research, the budget documents, and the statutes. If a number appears anywhere in the app, the thing it came from is on that page, along with any limitation its publisher states.

Built with Next.js + TypeScript, MapLibre GL (OpenFreeMap "Liberty" style), and Tailwind CSS, deployed to Cloudflare Workers via OpenNext — the same stack as [mn-civic-watch](https://github.com/ngabantudev/mn-civic-watch).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data

The map reads three static GeoJSON files in `public/`, regenerated from live public ArcGIS feature services:

```bash
npm run data:all          # all three
npm run data:vacant       # Saint Paul + Minneapolis vacant building registers
npm run data:tif          # Saint Paul TIF districts
npm run data:relief       # Hennepin County indoor cooling locations
```

Each script prints what it pulled and flags what it dropped — buildings with no usable registration date, TIF districts with no type in the published table — so a run that quietly loses records is visible rather than silent. `scripts/arcgis.mjs` holds the shared paging, reprojection, and date/currency parsing.

Nothing on the map is hand-entered, estimated, or modeled.

The counts quoted above are from the most recent fetch and will drift as the cities update their registers. The tallies shown *in the app* are computed from the loaded data at runtime, so those stay correct on their own — it's only this file's prose that needs a touch-up after a refresh.

## Editorial decisions worth knowing about

Two things this project could have mapped and deliberately doesn't. Both are documented on the sources page so the calls are checkable rather than invisible:

- **Minneapolis' encampment survey layer is not drawn.** It's public, but the records stop in June 2021 and the free-text notes describe identifiable individuals including their immigration status and health details. Mapping current encampment locations also produces a targeting list for exactly the clearance operations this project exists to question.
- **Individual property owners are not named.** Minneapolis' vacant-building register names the owner of every registered building, including private individuals at their home address. Companies, banks, trusts, and public bodies are named here; individuals are collapsed to a generic label. The underlying record stays public at the source.

The Relief layer is also not a shelter-bed layer, and the app never calls it one — no Minnesota agency publishes an open, current list of shelter locations and bed counts. See the sources page for the full note on that gap.

## Deployment

Deployed to Cloudflare Workers at [mn-housing-for-all.resistance.workers.dev](https://mn-housing-for-all.resistance.workers.dev).

```bash
npm run preview    # build and run locally on workerd
npm run deploy     # build and deploy to Cloudflare Workers
```

All three routes prerender as static content; the Worker serves them plus the GeoJSON files from `public/`.
