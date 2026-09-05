# Wedding Ledger

A small budget tracker for a wedding: every item, what it costs, what you've
paid as a deposit, and what's still owed — measured against the budget you set.

**Live: https://rafiqrazuki.github.io/wedding-ledger/**

## What it does

- Set a total budget, an event name, a date, and a currency.
- Add each item with its cost and any deposit already paid.
- See five running totals: budget, total cost, deposits paid, balance to pay,
  and cash in hand (budget minus what has actually left your pocket).
- A bar splits the budget into paid / still owed / unspoken-for, and turns red
  if the bookings overshoot.
- Each item shows its own balance and a status: Unpaid, Deposit paid, Settled.

## Where the data lives

In your browser's local storage, on the device you're using. Nothing is sent
anywhere — there is no server and no account.

That means the list does **not** sync between your phone and your laptop, and
anyone else opening the link starts with an empty list of their own. To move a
list to another device, open **Budget & details** and use *Save a backup file*,
then *Restore from a backup* on the other device.

Clearing your browser's site data will erase the list, so keep a backup file
somewhere safe.

## Running it

There is no build step. `index.html` is the whole app — open it directly in a
browser, or serve the folder with any static file server.

The app icons show the ring and the couple's names, and carry no day count.
A phone copies the icon when you add the app to a home screen and never asks
again, so a number baked into it would freeze on install day. The countdown
lives in the app, the browser tab icon and the icon badge instead.

```bash
npm ci
node build-icons.mjs                      # uses the date in build-icons.mjs
WEDDING_DATE=2027-03-01 node build-icons.mjs
TODAY=2026-12-10 node build-icons.mjs     # pretend it is another day
```

**The date and names come from the app's own settings.** Saving settings writes
a `__public_date__` row holding only the date and the display name, and one RLS
policy lets anyone read that single row, so the icon build can pick it up:

```sql
create policy "anyone may read the wedding date" on public.ledger
  for select to anon using (id = '__public_date__');
```

Everything else stays behind the sign-in. `WEDDING_DATE` and `COUPLE` remain as
environment overrides for testing.

```bash
COUPLE="Rafiq & Lily" WEDDING_DATE=2026-12-12 node build-icons.mjs
```

The icon URLs carry a `?v=<hash>` stamp taken from the artwork, so a phone
re-adding the app can't be served a stale image — and the stamp only moves when
the icon genuinely changes, which keeps the nightly job from committing for the
sake of it. The ring turns gold on the wedding day, so the job still runs.

## Files

| File                    | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `index.html`            | The entire app: markup, styles, and logic            |
| `manifest.webmanifest`  | Makes it installable to a phone home screen          |
| `icon-*.png`            | App icons                                            |
| `build-icons.mjs`       | Bakes the days-remaining count into the icons        |
| `build/`                | IBM Plex Mono, used by the icon build (OFL licensed) |
| `.github/workflows/`    | Daily job that rebuilds and commits the icons        |
