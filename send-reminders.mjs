/*
 * Sends the daily task reminders.
 *
 * Runs once each morning from .github/workflows/reminders.yml. It looks for
 * timeline tasks that are due today or tomorrow and still unticked, then
 * pushes one notification per bucket to every device that has turned
 * reminders on.
 *
 *   SUPABASE_SERVICE_KEY=... VAPID_PRIVATE_KEY=... node send-reminders.mjs
 *   DRY_RUN=1 ... node send-reminders.mjs      # print, send nothing
 *   TODAY=2026-12-26 ... node send-reminders.mjs
 *
 * The service key bypasses row-level security, which is the only way an
 * unattended job can read the couple's private tasks. It lives in the repo's
 * GitHub secrets and must never be written into the page or the repo.
 */
import webpush from "web-push";

const SUPABASE_URL = "https://bmlssxfcrslhqhadqkps.supabase.co";
const VAPID_PUBLIC = "BPK9CUAH2jkg_5xPE_I5GhJHeUASyH_n1o21xqmqY83GirS0JStwRY0rjDEWzBHw1Kk1fDSKrzqsZoN_qam8d8g";
const CONTACT = "mailto:noreply@wedding.local";
const APP_URL = "https://rafiqrazuki.github.io/wedding-ledger/";
const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN || 480);   // Malaysia, UTC+8

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const DRY_RUN = !!process.env.DRY_RUN;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_KEY is not set — nothing to do.");
  process.exit(1);
}
if (!VAPID_PRIVATE && !DRY_RUN) {
  console.error("VAPID_PRIVATE_KEY is not set — nothing to do.");
  process.exit(1);
}

const pad2 = (n) => (n < 10 ? "0" : "") + n;

function isoToday(offsetDays) {
  if (process.env.TODAY) {
    const [y, m, d] = process.env.TODAY.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + (offsetDays || 0)));
    return t.toISOString().slice(0, 10);
  }
  const local = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  const t = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + (offsetDays || 0)));
  return t.toISOString().slice(0, 10);
}

async function rest(path, init) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(init && init.headers),
    },
  });
  if (!res.ok) throw new Error(path + " → HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  return res.status === 204 ? null : res.json();
}

const today = isoToday(0);
const tomorrow = isoToday(1);

/* ---- what is due ---- */

const rows = await rest("ledger?select=id,data");
const due = { [today]: [], [tomorrow]: [] };

for (const row of rows || []) {
  const d = row.data || {};
  if (d.kind !== "task" || d.deleted || d.done) continue;
  if (d.date === today || d.date === tomorrow) due[d.date].push(d.title || "Untitled task");
}

function notice(list, when, tag) {
  if (!list.length) return null;
  const title = list.length === 1 ? list[0] : list.length + " things " + when;
  const body = list.length === 1 ? "Due " + when : list.join(" · ");
  return { title, body, tag, url: APP_URL };
}

const messages = [
  notice(due[today], "today", "due-today"),
  notice(due[tomorrow], "tomorrow", "due-tomorrow"),
].filter(Boolean);

console.log(`${today} — ${due[today].length} due today, ${due[tomorrow].length} due tomorrow`);

if (!messages.length) {
  console.log("Nothing due; no notifications sent.");
  process.exit(0);
}
for (const m of messages) console.log(`  → "${m.title}" — ${m.body}`);

/* ---- who gets them ---- */

const subs = await rest("push_subscriptions?select=endpoint,p256dh,auth,label");
console.log(`${(subs || []).length} device(s) subscribed`);

if (DRY_RUN) {
  console.log("DRY_RUN set — stopping before sending.");
  process.exit(0);
}
if (!subs || !subs.length) {
  console.log("No devices subscribed; nothing sent.");
  process.exit(0);
}

webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);

let sent = 0, dropped = 0, failed = 0;

for (const s of subs) {
  const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
  for (const m of messages) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(m));
      sent++;
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) {
        /* the push service has retired this endpoint: forget the device */
        dropped++;
        try {
          await rest("push_subscriptions?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
        } catch (e) { /* it will be retried tomorrow */ }
        break;
      }
      failed++;
      console.error(`  ! ${s.label || "device"}: ${code || ""} ${err && err.message}`);
    }
  }
}

console.log(`sent ${sent}, dropped ${dropped} stale, ${failed} failed`);
if (failed && !sent) process.exit(1);
