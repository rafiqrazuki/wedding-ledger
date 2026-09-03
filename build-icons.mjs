/*
 * Builds the app icons with the days-remaining count baked in.
 *
 * The home screen icon is copied by the phone at the moment the app is added
 * and never re-fetched, so the only way it can show a current number is for
 * the file itself to be rebuilt. A scheduled workflow runs this once a day and
 * commits the result; re-adding the app to a home screen then installs an icon
 * showing that day's count.
 *
 *   node build-icons.mjs                 # uses WEDDING_DATE below
 *   WEDDING_DATE=2027-03-01 node build-icons.mjs
 *   TODAY=2026-12-10 node build-icons.mjs        # for testing
 *
 * Keep WEDDING_DATE in step with the date set inside the app — the app reads
 * its date from the database, which this build can't see.
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const WEDDING_DATE = process.env.WEDDING_DATE || "2026-12-12";
const COUPLE = process.env.COUPLE || "Rafiq & Lily";
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
function ringSvg(size, gold) {
  const S = size;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <circle cx="50" cy="52" r="21" fill="none" stroke="${gold ? GEM : RING}" stroke-width="6.5"/>
  <path d="M50 16 L58.5 28 L41.5 28 Z" fill="${GEM}"/>
  ${namesEl()}
</svg>`;
}

/* Counting down: the ring above, the number through the middle, the names
   below. The number shrinks as it gains digits so four figures still fit. */
function countSvg(size, days) {
  const S = size;
  const label = String(days);
  const n = label.length;
  const fontSize = n >= 4 ? 28 : n === 3 ? 35 : 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <circle cx="50" cy="27" r="10" fill="none" stroke="${GEM}" stroke-width="3"/>
  <path d="M50 5.5 L55.5 15.5 L44.5 15.5 Z" fill="${GEM}"/>
  <text x="50" y="70" font-family="IBM Plex Mono" font-weight="600" font-size="${fontSize}"
        fill="${RING}" text-anchor="middle">${label}</text>
  ${namesEl()}
</svg>`;
}

const days = daysLeft();
const fontData = readFileSync(FONT);

for (const size of SIZES) {
  const svg = days === null || days <= 0 ? ringSvg(size, days === 0) : countSvg(size, days);
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { fontBuffers: [fontData], defaultFontFamily: "IBM Plex Mono", loadSystemFonts: false },
  })
    .render()
    .asPng();
  writeFileSync(`icon-${size}.png`, png);
  console.log(`wrote icon-${size}.png`);
}

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
  .replace(/icon-512\.png(\?d=-?\d+)?/g, `icon-512.png?d=${stamp}`);
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
