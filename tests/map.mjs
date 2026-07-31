#!/usr/bin/env node
// tests/map.mjs
//
// End-to-end checks for the map, run against a server you start yourself:
//
//   npm run dev &        (or: npm run preview, or point at the deployed URL)
//   npm run test:e2e
//   npm run test:e2e -- https://mn-housing-for-all.resistance.workers.dev
//
// Two things are checked here, both of which are the kind of thing that
// looks fine in a diff and is broken on screen:
//
//   1. Layout geometry. The detail card and the filter panel are two
//      absolutely-positioned overlays on the same map. Whether they collide
//      is a question about rectangles in a real viewport, and the only
//      honest way to answer it is to measure both.
//
//   2. Filter behaviour. Every filter control has to drop an open detail
//      card when it hides the feature that card describes — a failure that
//      is completely silent, since nothing errors and the card simply
//      starts describing something the reader can no longer see.
//
// Plain Playwright rather than a test runner: this is one file, it needs no
// fixtures, and `node tests/map.mjs` is one less thing to learn.

import { chromium } from "playwright";

const BASE_URL = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";

// Wide enough for the side-by-side layout, the two sizes either side of the
// md breakpoint where it switches, and two phones.
const VIEWPORTS = [
  { name: "desktop 1440", width: 1440, height: 900, touch: false, sideBySide: true },
  { name: "laptop 1024", width: 1024, height: 700, touch: false, sideBySide: true },
  { name: "md edge 768", width: 768, height: 800, touch: false, sideBySide: true },
  { name: "tablet 820", width: 820, height: 1180, touch: true, sideBySide: true },
  { name: "phone 390", width: 390, height: 844, touch: true, sideBySide: false },
  { name: "phone 360", width: 360, height: 740, touch: true, sideBySide: false },
];

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "  ok" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function newPage(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  // The GeoJSON fetches and the first fitBounds happen after load.
  await page.waitForTimeout(3500);
  return { page, errors };
}

const cardCount = (page) => page.locator("[data-site-modal]").count();

/**
 * Clicks around the map until a detail card opens, optionally holding out
 * for one whose text matches. The features are scattered, so a single fixed
 * sample point misses far more often than it hits.
 *
 * Starts below the header card, which overlays the top of the map and whose
 * links would otherwise be clicked instead.
 */
async function openCard(page, viewport, match) {
  let any = null;
  for (let fx = 0.4; fx <= 0.95; fx += 0.05) {
    for (let fy = viewport.sideBySide ? 0.08 : 0.55; fy <= 0.92; fy += 0.06) {
      await page.mouse.click(Math.round(viewport.width * fx), Math.round(viewport.height * fy));
      await page.waitForTimeout(70);
      if ((await cardCount(page)) === 0) continue;
      const text = await page.locator("[data-site-modal]").textContent();
      if (!match || text?.includes(match)) return text;
      any ??= text;
    }
  }
  return any;
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width === 0 || r.height === 0 ? "hidden" : { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const panel = rect(document.querySelector("#layer-panel"));
    const card = rect(document.querySelector("[data-site-modal]"));
    const box = (r) => r && r !== "hidden";
    return {
      panel,
      card,
      overlaps:
        box(panel) && box(card)
          ? !(
              panel.x + panel.w <= card.x ||
              card.x + card.w <= panel.x ||
              panel.y + panel.h <= card.y ||
              card.y + card.h <= panel.y
            )
          : null,
      offscreen: box(card) ? card.x < 0 || card.y < 0 || card.x + card.w > innerWidth : false,
      pageScrollsX: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

async function layoutChecks(browser) {
  for (const viewport of VIEWPORTS) {
    const { page, errors } = await newPage(browser, viewport);

    // On a phone the panel starts folded behind its handle.
    const handle = page.getByRole("button", { name: /Layers & filters/i });
    const collapsible = await handle.isVisible().catch(() => false);
    check(`${viewport.name}: panel ${viewport.sideBySide ? "always open" : "starts collapsed"}`,
      collapsible === !viewport.sideBySide);
    if (collapsible) {
      await handle.click();
      await page.waitForTimeout(300);
      check(`${viewport.name}: handle opens the panel`, (await geometry(page)).panel !== "hidden");
      await handle.click();
      await page.waitForTimeout(300);
    }

    const text = await openCard(page, viewport);
    const g = await geometry(page);
    check(`${viewport.name}: a feature opens a card`, Boolean(text), text?.slice(0, 40).replace(/\s+/g, " "));
    check(`${viewport.name}: card clear of the filter panel`, g.overlaps === false || g.panel === "hidden");
    check(`${viewport.name}: card fully on screen`, g.offscreen === false);
    check(`${viewport.name}: no horizontal page scroll`, g.pageScrollsX === false);
    check(`${viewport.name}: no console errors`, errors.length === 0, errors[0]?.slice(0, 80));

    await page.context().close();
  }
}

async function filterChecks(browser) {
  const viewport = VIEWPORTS[0];
  const { page } = await newPage(browser, viewport);
  const panel = page.getByRole("group", { name: "Map layers" });
  const layerBox = (name) => panel.locator("label", { hasText: name }).locator("input");

  check(
    "all three layers start on",
    (await page.locator("#layer-panel > div > div:first-child > label > input:checked").count()) === 3,
  );

  await layerBox("Cooling sites").click();
  await page.waitForTimeout(250);
  check("unchecking a layer collapses its filters", !(await page.getByText("Free to enter only").isVisible().catch(() => false)));
  await layerBox("Cooling sites").click();
  await page.waitForTimeout(250);
  check("re-checking a layer restores them", await page.getByText("Free to enter only").isVisible());

  if (await openCard(page, viewport, "St. Paul")) {
    await layerBox(/^St\. Paul$/).click();
    await page.waitForTimeout(350);
    check("hiding a city closes a card from that city", (await cardCount(page)) === 0);
    await layerBox(/^St\. Paul$/).click();
    await page.waitForTimeout(250);
  } else {
    check("hiding a city closes a card from that city", false, "no Saint Paul card found");
  }

  if (await openCard(page, viewport, "Empty single-family home")) {
    await page.locator("#layer-panel label", { hasText: "Homes" }).locator("input").click();
    await page.waitForTimeout(350);
    check("hiding a building use closes a card of that use", (await cardCount(page)) === 0);
    await page.locator("#layer-panel label", { hasText: "Homes" }).locator("input").click();
    await page.waitForTimeout(250);
  } else {
    check("hiding a building use closes a card of that use", false, "no single-family card found");
  }

  // The other half of the rule: a filter that doesn't hide the open feature
  // has to leave it alone. An earlier version closed the card on every
  // filter change, which is tidy to implement and infuriating to use.
  if (await openCard(page, viewport, "Vacant building")) {
    await page.getByText("Housing districts only").click();
    await page.waitForTimeout(350);
    check("an unrelated filter leaves the card open", (await cardCount(page)) === 1);
  } else {
    check("an unrelated filter leaves the card open", false, "no vacant card found");
  }

  await page.context().close();
}

const browser = await chromium.launch();
console.log(`\nmap e2e — ${BASE_URL}\n`);
await layoutChecks(browser);
console.log("");
await filterChecks(browser);
await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed\n`);
process.exit(passed === results.length ? 0 : 1);
