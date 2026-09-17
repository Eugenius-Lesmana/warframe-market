# Tenno Market

Modern Electron + React desktop app for live PC crossplay listings, 90-day completed-sale statistics, and set-part comparisons.

The **Sniper** tab keeps up to 20 item watches while the app is open. Choose a price cap or leave it blank to use the calculated cheap target, then set the refresh interval and expiry. Only **Online in game** sellers trigger alerts. Whole-set offers and complete component baskets are checked independently, with every qualifying offer and a copyable in-game whisper shown in the deal card.

## Run locally

Install dependencies once:

```powershell
npm install
```

Start the desktop app:

```powershell
npm run dev
```

## Build a downloadable Windows app

```powershell
npm run package
```

This writes a Windows ZIP to `release-download/`. Extract it, then run `Tenno Market.exe`. Paste a Warframe.market URL and select **Analyze**.

## Command-line fallback

```powershell
python analyze_market.py https://warframe.market/items/strun_prime_set
```

Watch for a lower price or for an online seller to appear:

```powershell
python analyze_market.py https://warframe.market/items/strun_prime_set --watch --target 55 --interval 60
```

Without `--target`, watch mode derives a conservative cheap target from the 90-day history. On Windows it plays a system alert sound; keep the terminal running. It alerts only when a seller first appears after none were online, or when price newly crosses the target.

Run checks:

```powershell
python -m unittest -v
```

What it reports:

- **Fair price:** volume-weighted median of up to 90 days of completed-sale medians.
- **Typical range:** lower/upper quartiles of historical daily medians.
- **Cheap target:** conservative lower threshold; not a guarantee that a seller is available.
- **Buy now / reasonable buy / wait / expensive now:** comparison of the lowest online ask to historical sales and lower-priced offline alternatives.
- **Parts comparison:** uses the API's `quantityInSet` field, so repeated components are counted correctly. It shows each part's live ask, fair price, cheap target, offline alternative, and the buy-now/fair totals for the complete set.

Limits:

- Live orders are listings, not confirmed trades.
- An offline seller's `lastSeen` timestamp does not predict when they will return.
- The sample intentionally targets PC with crossplay enabled. Do not compare its results with another market context.
- No data is stored locally; it uses the marketplace's current API data each run.

Data endpoints:

- `GET /v2/orders/item/{slug}` — current visible orders
- `GET /v2/items/{slug}/set` — set members
- `GET /v1/items/{slug}/statistics` — completed-sale history
