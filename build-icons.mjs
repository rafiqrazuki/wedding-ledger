/*
 * Builds the app icons with the days-remaining count baked in.
 *
 * The home screen icon is copied by the phone at the moment the app is added
 * and never re-fetched, so the only way it can show a current number is for
 * the file itself to be rebuilt. A scheduled workflow runs this once a day and
 * commits the result; re-adding the app to a home screen then installs an icon
 * showing that day's count.
 *
 * The date and the couple's names are read from the app itself: it publishes
 * them to a single row that anyone may read, so the icon always agrees with
 * what the settings sheet says. Nothing else in the ledger is exposed.
 *
 *   node build-icons.mjs
 *   WEDDING_DATE=2027-03-01 COUPLE="A & B" node build-icons.mjs   # override
 *   TODAY=2026-12-10 node build-icons.mjs                         # for testing
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

/* Fallbacks only. The real date and names come from the app itself — see
   loadFromApp() below — so the icon can't drift away from what the app shows. */
let WEDDING_DATE = process.env.WEDDING_DATE || "";
let COUPLE = process.env.COUPLE || "Our Wedding";

const SUPABASE_URL = "https://bmlssxfcrslhqhadqkps.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbHNzeGZjcnNsaHFoYWRxa3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjUyNDEsImV4cCI6MjEwMzkwMTI0MX0.2nL1hupQURyWxSyzxw5n3jnZlWHK3snrzbbmNCFgKNg";

/* The app publishes just its date and display name to one row that anyone may
   read. Nothing else in the ledger is exposed. */
async function loadFromApp() {
  if (process.env.WEDDING_DATE && process.env.COUPLE) return "overridden by env";
  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/ledger?id=eq.__public_date__&select=data",
      { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }
    );
    if (!res.ok) return "lookup failed: HTTP " + res.status;
    const rows = await res.json();
    const d = rows && rows[0] && rows[0].data;
    if (!d) return "the app has not published a date yet";
    if (!process.env.WEDDING_DATE && d.date) WEDDING_DATE = d.date;
    if (!process.env.COUPLE && d.couple) COUPLE = d.couple;
    return "read from the app: " + (d.couple || "?") + ", " + (d.date || "no date");
  } catch (e) {
    return "lookup failed: " + e.message;
  }
}

const SIZES = [180, 192, 512];
const FONT = "build/IBMPlexMono-SemiBold.ttf";

/* The job is scheduled just after midnight in Malaysia, which is still the
   previous day in UTC — so "today" has to be worked out in local terms or the
   icon sits a day behind what the app shows. */
const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN || 480);   // UTC+8

const BG = "#0E5C43";      // deep emerald
const RING = "#FBFCFA";    // cream
const GEM = "#CFA25A";     // brass

function daysLeft() {
  const today = process.env.TODAY
    ? new Date(process.env.TODAY + "T00:00:00Z")
    : new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (!WEDDING_DATE) return null;
  const [y, m, d] = WEDDING_DATE.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86400000);
}

const xml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* The couple's names sit along the bottom of every icon, shrunk to fit so a
   longer pair of names can't run off the tile. */
function namesEl(y = 88) {
  const text = COUPLE.toUpperCase();
  let size = 8.4;
  let spacing = 1.3;
  const width = () => text.length * (size * 0.6 + spacing);
  while (width() > 86 && size > 4.5) {
    size -= 0.2;
    spacing = Math.max(0.35, spacing - 0.06);
  }
  return `<text x="50" y="${y}" font-family="IBM Plex Mono" font-weight="600" font-size="${size.toFixed(2)}"
        letter-spacing="${spacing.toFixed(2)}" fill="${GEM}" text-anchor="middle">${xml(text)}</text>`;
}

/* A ring on its own: no date set, the day itself, or a date already gone by. */
function ringBody(gold) {
  return `<circle cx="50" cy="52" r="21" fill="none" stroke="${gold ? GEM : RING}" stroke-width="6.5"/>
  <path d="M50 16 L58.5 28 L41.5 28 Z" fill="${GEM}"/>
  ${namesEl()}`;
}

/* Counting down: the ring above, the number through the middle, the names
   below. The number shrinks as it gains digits so four figures still fit. */
function countBody(days) {
  const label = String(days);
  const n = label.length;
  const fontSize = n >= 4 ? 28 : n === 3 ? 35 : 40;

  return `<circle cx="50" cy="27" r="10" fill="none" stroke="${GEM}" stroke-width="3"/>
  <path d="M50 5.5 L55.5 15.5 L44.5 15.5 Z" fill="${GEM}"/>
  <text x="50" y="70" font-family="IBM Plex Mono" font-weight="600" font-size="${fontSize}"
        fill="${RING}" text-anchor="middle">${label}</text>
  ${namesEl()}`;
}

/* Android crops a maskable icon to a circle roughly 80% across, so the artwork
   is scaled into that safe area — otherwise the names get sliced off the
   bottom. The background still bleeds to the edges. */
function svgDoc(size, body, maskable) {
  const inner = maskable ? `<g transform="translate(16,16) scale(0.68)">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  ${inner}
</svg>`;
}

console.log(await loadFromApp());

const days = daysLeft();
const fontData = readFileSync(FONT);

const body = days === null || days <= 0 ? ringBody(days === 0) : countBody(days);

function render(svg, size) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { fontBuffers: [fontData], defaultFontFamily: "IBM Plex Mono", loadSystemFonts: false },
  })
    .render()
    .asPng();
}

for (const size of SIZES) {
  writeFileSync(`icon-${size}.png`, render(svgDoc(size, body, false), size));
  console.log(`wrote icon-${size}.png`);
}

writeFileSync("icon-maskable-512.png", render(svgDoc(512, body, true), 512));
console.log("wrote icon-maskable-512.png");

/* Phones cache the icon by URL. Stamping the count on means re-adding the app
   to a home screen fetches the current one instead of the one it kept. */
const stamp = days === null ? 0 : days;

let html = readFileSync("index.html", "utf8");
const before = html;
html = html.replace(/icon-180\.png(\?d=-?\d+)?/g, `icon-180.png?d=${stamp}`);
if (html !== before) {
  writeFileSync("index.html", html);
  console.log("stamped index.html");
}

let mf = readFileSync("manifest.webmanifest", "utf8");
const mfBefore = mf;
mf = mf
  .replace(/icon-192\.png(\?d=-?\d+)?/g, `icon-192.png?d=${stamp}`)
  .replace(/icon-512\.png(\?d=-?\d+)?/g, `icon-512.png?d=${stamp}`)
  .replace(/icon-maskable-512\.png(\?d=-?\d+)?/g, `icon-maskable-512.png?d=${stamp}`);
if (mf !== mfBefore) {
  writeFileSync("manifest.webmanifest", mf);
  console.log("stamped manifest.webmanifest");
}

console.log(
  days === null
    ? "no wedding date set"
    : days > 0
      ? `${days} day${days === 1 ? "" : "s"} to ${WEDDING_DATE}`
      : days === 0
        ? "the wedding is today"
        : `${Math.abs(days)} days since ${WEDDING_DATE}`
);
