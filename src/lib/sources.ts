import type { LayerKind } from "./types";

// Everything this project reads, cites, or deliberately declined to use.
//
// The rule for this file: if a number appears anywhere in the app, the
// thing it came from is listed here with a link a reader can follow to
// check it. That includes the sources whose data is fetched automatically
// (`feeds`, below) and the reports and statutes behind the framing.
//
// Descriptions are written from the source itself — what it actually
// contains, what it doesn't, and what its own publisher says its limits
// are — not from a summary of a summary.

export type SourceFormat =
  | "Live feature service"
  | "Interactive map"
  | "Open data portal"
  | "Report (PDF)"
  | "Peer-reviewed study"
  | "Statute"
  | "Investigative journalism"
  | "Government page";

export type SourceCategory = "feeds" | "maps" | "law" | "research" | "fiscal" | "journalism";

export const CATEGORY_ORDER: SourceCategory[] = ["feeds", "maps", "journalism", "research", "fiscal", "law"];

export const CATEGORY_META: Record<SourceCategory, { title: string; blurb: string }> = {
  feeds: {
    title: "Data this map pulls from directly",
    blurb:
      "Public ArcGIS feature services re-fetched by the scripts in this repository. Every dot and polygon on the map comes from one of these — nothing on it is hand-entered, estimated, or modeled.",
  },
  maps: {
    title: "Maps and portals worth opening yourself",
    blurb:
      "The cities' and county's own front-ends for the same data, plus the portals where the rest of it lives. These carry layers, filters, and record detail this map does not reproduce.",
  },
  journalism: {
    title: "Reporting",
    blurb: "Investigative work documenting what encampment clearance does to the people living through it.",
  },
  research: {
    title: "Research and evaluation",
    blurb:
      "Peer-reviewed studies and program evaluations on the costs of displacement and the outcomes of permanent supportive housing.",
  },
  fiscal: {
    title: "Budget and fiscal documents",
    blurb: "Primary budget records for the decisions this data is usually invoked to argue about.",
  },
  law: {
    title: "Statutes and legal frameworks",
    blurb:
      "The Minnesota law that governs sacred communities, religious and nonprofit corporations, and charitable solicitation — the statutory path a rapid-deployment micro-housing project would actually run through.",
  },
};

export interface Source {
  id: string;
  title: string;
  url: string;
  publisher: string;
  /** Publication or last-updated year, as the source itself states it. */
  year: string | null;
  category: SourceCategory;
  format: SourceFormat;
  /** What the source actually contains. */
  description: string;
  /** Which map layer, if any, is built from this source. */
  layer?: LayerKind;
  /** Known gaps, staleness, or caveats — from the publisher where they state one. */
  caveat?: string;
}

export const SOURCES: Source[] = [
  // --- Feeds: the layers on the map ---------------------------------------
  {
    id: "stpaul-vacant",
    title: "Saint Paul Vacant Buildings",
    url: "https://information.stpaul.gov/maps/284c28f3acea45bd8a513f4d80bb0e67/explore?location=44.944400%2C-93.103200%2C12",
    publisher: "City of Saint Paul",
    year: "2026",
    category: "feeds",
    format: "Live feature service",
    layer: "vacant",
    description:
      "Every building on Saint Paul's vacant-building register, as an addressed point with the date it was registered, the dwelling type, the council ward and planning district, and the city's vacancy category. The categories escalate: Category I is registration, fees, restored utilities and a Truth-in-Sale-of-Housing report; Category II blocks sale until code orders are met; Category III is condemned. 384 buildings at last fetch.",
  },
  {
    id: "mpls-vbr",
    title: "Minneapolis Vacant Building Registration (October 2025)",
    url: "https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/VBR_October2025/FeatureServer/0",
    publisher: "City of Minneapolis",
    year: "2025",
    category: "feeds",
    format: "Live feature service",
    layer: "vacant",
    description:
      "Geocoded snapshot of Minneapolis' vacant building registrations, with the registration date, ward, neighborhood, parcel ID, and registered owner. 311 buildings at last fetch. This map names owners that are companies, banks, trusts, or public bodies, and withholds the names of private individuals — the underlying record stays public at the source.",
    caveat:
      "Minneapolis publishes several overlapping vacant-building layers. The older 'VBR' and 'VBR and Vacant CPED Properties' services are 2016-vintage and are not used here.",
  },
  {
    id: "stpaul-tif",
    title: "Saint Paul Tax Increment Financing (TIF) districts",
    url: "https://experience.arcgis.com/experience/84f4974467bf405ca727f8606ec2e8b3/page/Page?views=Detailed-map-%28longer-load-time%29#data_s=id%3AdataSource_1-19f390605c8-layer-6%3A2",
    publisher: "City of Saint Paul, Planning & Economic Development",
    year: "2026",
    category: "feeds",
    format: "Live feature service",
    layer: "tif",
    description:
      "All TIF districts established by the Saint Paul Housing and Redevelopment Authority and the Saint Paul Port Authority, plus the project areas they sit within and the parcels participating in each. Each district carries its number, type, certification date, required decertification date, and the tax increment received and expended as filed with the State Auditor. 64 districts at last fetch, 29 of them typed 'Housing'.",
    caveat:
      "The city's own note: records active or certified only before the mid-2010s may not be reflected. Eleven districts carry no district type in the published table, so the Housing count is a floor, not an exact figure.",
  },
  {
    id: "hennepin-cooling",
    title: "Hennepin County Cooling Option Map",
    url: "https://hennepin.maps.arcgis.com/apps/webappviewer/index.html?id=9cde49f4f25d4cca885e58a967ec786f",
    publisher: "Hennepin County",
    year: "2026",
    category: "feeds",
    format: "Live feature service",
    layer: "relief",
    description:
      "The county's master list of places to get out of the heat: libraries, recreation and community centers, government buildings, shopping malls, movie theaters, and Salvation Army offices, plus outdoor beaches and wading pools. Each point carries an address, phone, hours, website, and whether there is a fee to enter. The county's own app also overlays transit routes and downtown skyway walking areas. This map keeps the indoor, currently-active subset — 211 locations, 167 of them free.",
    caveat:
      "The county's own disclaimer: operating status, hours, and restrictions change without their knowledge — verify with the location before relying on it. This is a heat-relief list, not a shelter-bed list; see the note on shelter data below.",
  },

  // --- Maps and portals ----------------------------------------------------
  {
    id: "stpaul-tif-program",
    title: "Saint Paul HRA — Tax Increment Financing program",
    url: "https://www.stpaul.gov/departments/planning-and-economic-development/housing-and-redevelopment-authority-hra/tax-increment",
    publisher: "City of Saint Paul",
    year: "2026",
    category: "maps",
    format: "Government page",
    description:
      "The program's home page: what TIF is, the five district types Minnesota recognizes (redevelopment, housing, renewal and renovation, economic development, and soils condition), and the note that housing districts are qualified on post-redevelopment conditions and require low-income housing. Publishes the 2023 and 2024 annual disclosure reports filed with the State Auditor each August 1, HRA board presentations from 2024 and 2025, and 2026 budget committee materials.",
  },
  {
    id: "stpaul-portal",
    title: "Saint Paul Open Information portal",
    url: "https://information.stpaul.gov/",
    publisher: "City of Saint Paul",
    year: null,
    category: "maps",
    format: "Open data portal",
    description:
      "Saint Paul's ArcGIS Hub. Beyond the two layers used here it carries publicly owned parcels held by the housing agency, Ramsey County tax-forfeit properties, rental rehab loan eligibility, percent of population renting by census tract, housing starts, principal zoning over time, and the 1-to-4-unit rezoning study parcels.",
  },
  {
    id: "mpls-portal",
    title: "Minneapolis Open Data",
    url: "https://opendata.minneapolismn.gov/",
    publisher: "City of Minneapolis",
    year: null,
    category: "maps",
    format: "Open data portal",
    description:
      "Minneapolis' ArcGIS Hub. Relevant layers beyond the vacant-building register include affordable housing production by AMI and year, condemned-by-boarding properties, the zones where overnight shelters are permitted, housing policy areas, and the low-income housing tax credit portfolio.",
  },
  {
    id: "shelter-data-gap",
    title: "Shelter locations and bed counts — no open source",
    url: "https://www.mnhomeless.org/",
    publisher: "Note on a gap in the public record",
    year: null,
    category: "maps",
    format: "Open data portal",
    description:
      "No Minnesota agency publishes an open, current, machine-readable list of homeless shelter locations and bed counts. The nearest-sounding public layer, Minneapolis' 'Minneapolis_Shelters', is the city's civil-defense emergency shelter list — fire stations and similar — and would be actively misleading on a housing map. Wilder Research's homelessness work is the closest thing to a standing public count. This map therefore shows free indoor daytime relief locations and says so, rather than implying a bed inventory it does not have.",
  },
  {
    id: "mpls-encampments-excluded",
    title: "Minneapolis Homeless Encampments survey — deliberately not mapped",
    url: "https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Homeless_Encampments_(View)/FeatureServer/0",
    publisher: "City of Minneapolis",
    year: "2021",
    category: "maps",
    format: "Live feature service",
    description:
      "A public 259-point outreach survey of encampment sites, carrying a risk rating and free-text field notes. It is listed here for completeness and is not drawn on this map, for two reasons: the records run only from November 2019 to June 2021, so the locations are five years stale; and the notes describe identifiable individuals, including their immigration status and health details. Publishing precise, current encampment locations also hands a targeting list to exactly the clearance operations this project exists to question.",
    caveat: "Excluded by choice, not by oversight. The link is here so the decision is checkable.",
  },

  // --- Journalism ----------------------------------------------------------
  {
    id: "propublica-swept-away",
    title: "Swept Away",
    url: "https://www.propublica.org/series/swept-away",
    publisher: "ProPublica",
    year: "2024–2025",
    category: "journalism",
    format: "Investigative journalism",
    description:
      "An eight-part investigation by Asia Fields, Nicole Santa Cruz, Ruth Talbot and Maya Miller into what cities do with the belongings they seize during encampment clearances. The reporting documents property that cities promise to store and rarely return — birth certificates and IDs, medication, work tools, cremated ashes — and traces how losing those documents pushes a person further from an exit out of homelessness. Includes an investigation finding Albuquerque destroyed belongings in violation of its own written policy, and a methods piece on reporting with unhoused sources. The 2024 U.S. Supreme Court decision permitting more aggressive clearances is the legal backdrop.",
    caveat: "National in scope, not Minnesota-specific, and there is no downloadable dataset — the reporting itself is the source.",
  },

  // --- Research ------------------------------------------------------------
  {
    id: "hud-encampments",
    title: "Exploring Homelessness Among People Living in Encampments and Associated Costs",
    url: "https://www.huduser.gov/portal/sites/default/files/pdf/Exploring-Homelessness-Among-People.pdf",
    publisher: "U.S. Department of Housing and Urban Development & Abt Associates",
    year: "2020",
    category: "research",
    format: "Report (PDF)",
    description:
      "Dunton, Yetvin and Brown's multi-city study of encampments and what they cost the public. The origin of the per-person encampment clearance cost range that gets quoted in Minnesota fiscal arguments.",
  },
  {
    id: "jama-displacement",
    title:
      "Population-Level Health Effects of Involuntary Displacement of People Experiencing Unsheltered Homelessness Who Inject Drugs in US Cities",
    url: "https://jamanetwork.com/journals/jama/fullarticle/2803839",
    publisher: "JAMA, 329(17), 1478–1486",
    year: "2023",
    category: "research",
    format: "Peer-reviewed study",
    description:
      "Barocas et al. model the downstream mortality, hospitalization, and overdose effects of involuntarily displacing unsheltered people who inject drugs. The peer-reviewed basis for treating a sweep as a health intervention with measurable costs rather than a neutral cleanup.",
  },
  {
    id: "urban-denver-sib",
    title: "Breaking the Homelessness-Jail Cycle with Housing First: Denver Supportive Housing Social Impact Bond Evaluation",
    url: "https://www.urban.org/sites/default/files/publication/104501/breaking-the-homelessness-jail-cycle-with-housing-first_1.pdf",
    publisher: "Urban Institute",
    year: "2021",
    category: "research",
    format: "Report (PDF)",
    description:
      "Cunningham et al.'s randomized controlled trial of permanent supportive housing in Denver — the strongest available causal evidence on housing retention and the offsetting reductions in jail bookings and emergency service use. The source of the per-person net public savings figure used in Minnesota supportive-housing arguments.",
  },
  {
    id: "csh-mn",
    title: "Reducing Unsheltered Homelessness",
    url: "https://www.csh.org/wp-content/uploads/Reducing-Unsheltered-Homelessness-One-Pager-CSH-2025.pdf",
    publisher: "Corporation for Supportive Housing (CSH) Minnesota",
    year: "2025",
    category: "research",
    format: "Report (PDF)",
    description:
      "CSH's Minnesota-specific fiscal benchmarks for supportive housing against emergency-system costs — the local unit costs behind most per-person comparisons in state and county policy memos.",
  },
  {
    id: "wilder-study",
    title: "Minnesota Statewide Homeless Study — Twin Cities Metro & Ramsey County sub-analysis",
    url: "https://www.mnhomeless.org/wp-content/uploads/2026/05/TCRG_MNHomelessStudy.pdf",
    publisher: "Amherst H. Wilder Foundation",
    year: "2026",
    category: "research",
    format: "Report (PDF)",
    description:
      "Wilder's long-running statewide count and survey, broken out for the Twin Cities metro and Ramsey County. The standing reference for how many people are homeless in this region and who they are — the demand side of every number on this map.",
  },
  {
    id: "air-hearth",
    title: "Evaluation of the Minnesota Supportive Housing and Managed Care Pilot",
    url: "https://www.air.org/resource/report/evaluation-minnesota-supportive-housing-and-managed-care-pilot",
    publisher: "American Institutes for Research & Hearth Connection",
    year: "2009",
    category: "research",
    format: "Report (PDF)",
    description:
      "Minnesota's own pilot evaluation of supportive housing paired with managed care. Older than the rest of the research here, and included because it is state-specific: the outcomes are from Minnesota programs, not extrapolated from another state's.",
  },

  // --- Fiscal --------------------------------------------------------------
  {
    id: "stpaul-jpa-news",
    title: "City of Saint Paul Authorizes Investment Expanding Capacity and Services",
    url: "https://www.stpaul.gov/news/city-saint-paul-authorizes-investment-expanding-capacity-and-services",
    publisher: "City of Saint Paul",
    year: "2026",
    category: "fiscal",
    format: "Government page",
    description:
      "The city's own announcement of the July 22, 2026 joint powers agreement with Ramsey County to expand emergency shelter capacity — the $1.08M authorization that the fiscal arguments around the Pig's Eye Park clearance turn on.",
  },
  {
    id: "stpaul-general-fund",
    title: "Adopted City General Fund Summary & Departmental Allocations",
    url: "https://www.stpaul.gov/sites/default/files/financial-services/city-general-fund-summary-2026-adopted-city-saint-paul-budget_0.pdf",
    publisher: "City of Saint Paul, Financial Services Department",
    year: "2026",
    category: "fiscal",
    format: "Report (PDF)",
    description:
      "The adopted 2026 general fund, by department. Where to check which line an encampment-clearance or shelter cost actually falls on, and which of them are city general fund versus county or Medicaid.",
  },
  {
    id: "stpaul-budget-overview",
    title: "Mayor's Proposed Budget Overview & Fiscal Framework",
    url: "https://www.stpaul.gov/sites/default/files/mayors-office/2026-city-saint-paul-budget-overview0.pdf",
    publisher: "City of Saint Paul, Mayor's Office",
    year: "2026",
    category: "fiscal",
    format: "Report (PDF)",
    description:
      "The mayor's framing of the 2026 budget, including the structural deficit that constrains every housing decision in the city this year.",
  },
  {
    id: "stpaul-star",
    title: "Neighborhood STAR Program",
    url: "https://www.stpaul.gov/departments/planning-economic-development/neighborhood-star-program",
    publisher: "City of Saint Paul, Planning & Economic Development",
    year: null,
    category: "fiscal",
    format: "Government page",
    description:
      "Saint Paul's sales-tax-funded capital grant and loan program for neighborhood physical improvements. Relevant here because it can fund permanent capital infrastructure — site preparation, utility hookups, construction — for projects inside city limits with a long enough asset life, which is the funding route a sacred-settlement pilot would use.",
  },

  // --- Law -----------------------------------------------------------------
  {
    id: "mn-327-30",
    title: "Minn. Stat. § 327.30 — Sacred Communities and Micro Unit Dwellings",
    url: "https://www.revisor.mn.gov/statutes/cite/327.30",
    publisher: "Minnesota Office of the Revisor of Statutes",
    year: "2023",
    category: "law",
    format: "Statute",
    description:
      "Authorizes religious institutions to host 'sacred communities' — settlements of micro unit dwellings under 400 square feet on their own property, tied into the host building's utilities and common facilities — as permanent housing for people who have experienced homelessness. Requires municipalities to approve them as conditional uses without layering on additional local zoning standards, and requires the host to file written plans for utilities, emergency access, and sanitation.",
  },
  {
    id: "mn-315",
    title: "Minn. Stat. ch. 315 — Religious Corporations",
    url: "https://www.revisor.mn.gov/statutes/cite/315",
    publisher: "Minnesota Office of the Revisor of Statutes",
    year: null,
    category: "law",
    format: "Statute",
    description:
      "Defines the religious corporations eligible to host a sacred community under § 327.30 — the entity test a prospective faith-institution partner has to satisfy first.",
  },
  {
    id: "mn-317a",
    title: "Minn. Stat. ch. 317A — Nonprofit Corporations",
    url: "https://www.revisor.mn.gov/statutes/cite/317A",
    publisher: "Minnesota Office of the Revisor of Statutes",
    year: null,
    category: "law",
    format: "Statute",
    description:
      "Minnesota's nonprofit corporation act — the chapter articles of incorporation are filed under, and the source of the minimum director and officer requirements for a new housing or mutual aid organization.",
  },
  {
    id: "mn-309",
    title: "Minn. Stat. ch. 309 — Charitable Solicitation",
    url: "https://www.revisor.mn.gov/statutes/cite/309",
    publisher: "Minnesota Office of the Revisor of Statutes",
    year: null,
    category: "law",
    format: "Statute",
    description:
      "The Minnesota Charitable Solicitation Act. Sets the threshold above which an organization soliciting donations must register with the Attorney General — the compliance step a grass-roots funding drive crosses before it realizes it has.",
  },
];

export const SOURCES_BY_CATEGORY: Record<SourceCategory, Source[]> = CATEGORY_ORDER.reduce(
  (acc, category) => {
    acc[category] = SOURCES.filter((s) => s.category === category);
    return acc;
  },
  {} as Record<SourceCategory, Source[]>,
);
