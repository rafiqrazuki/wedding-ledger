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
const SIZES = [180, 192, 512];
const FONT = "build/IBMPlexMono-SemiBold.ttf";

const BG = "#0E5C43";      // deep emerald
const RING = "#FBFCFA";    // cream
const GEM = "#CFA25A";     // brass

function daysLeft() {
  const today = process.env.TODAY ? new Date(process.env.TODAY + "T00:00:00Z") : new Date();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, d] = WEDDING_DATE.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86400000);
}

/* The ring: no date, the day itself, or a date already gone by. */
function ringSvg(size, gold) {
  const S = size;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <circle cx="50" cy="57.5" r="25" fill="none" stroke="${gold ? GEM : RING}" stroke-width="7.5"/>
  <path d="M50 16 L60 30 L40 30 Z" fill="${GEM}"/>
</svg>`;
}

/* Counting down. Past two digits the word is dropped so the number can fill
   the tile, matching what the in-app icon does. */
function countSvg(size, days) {
  const S = size;
  const label = String(days);
  const wide = label.length >= 3;
  const fontSize = wide ? 52 : label.length === 2 ? 54 : 60;
  const y = wide ? 68 : 60;

  const word = wide
    ? ""
    : `<text x="50" y="84" font-family="IBM Plex Mono" font-weight="600" font-size="12"
        letter-spacing="1.2" fill="${GEM}" text-anchor="middle">${days === 1 ? "DAY" : "DAYS"}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <text x="50" y="${y}" font-family="IBM Plex Mono" font-weight="600" font-size="${fontSize}"
        fill="${RING}" text-anchor="middle" textLength="${wide ? 78 : ""}" ${wide ? 'lengthAdjust="spacingAndGlyphs"' : ""}>${label}</text>
  ${word}
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

console.log(
  days === null
    ? "no wedding date set"
    : days > 0
      ? `${days} day${days === 1 ? "" : "s"} to ${WEDDING_DATE}`
      : days === 0
        ? "the wedding is today"
        : `${Math.abs(days)} days since ${WEDDING_DATE}`
);
