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

To regenerate the icons after changing the colours:

```bash
node build-icons.mjs
```

## Files

| File                    | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `index.html`            | The entire app: markup, styles, and logic            |
| `manifest.webmanifest`  | Makes it installable to a phone home screen          |
| `icon-*.png`            | App icons                                            |
| `build-icons.mjs`       | Regenerates the icons (Node, no dependencies)        |
