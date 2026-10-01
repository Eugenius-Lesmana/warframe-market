# Tenno Market Intelligence — Product Requirements Document

> **Roadmap, not current state.** This is the original vision. The shipped app covers live order analysis, fair-price statistics, set-vs-parts comparison and the sniper; stored snapshots, time-series storage, anomaly and event-aware analysis are not built. See the README for what exists.

**Status:** Draft v1.0  
**Owner:** Eugen  
**Repository:** `WarframeMarket`  
**Product type:** Portfolio-grade web application and market-data system

## 1. Summary

Tenno Market Intelligence helps Warframe players make better buy and sell decisions in the player marketplace.

It does not claim an item has one objective “true value.” Instead, it estimates practical price ranges for a specific item and trade context:

- **Buy now** — the lowest credible live price likely available immediately.
- **Good buy** — a live listing meaningfully below the current reference range.
- **Sell now** — a competitive listing price for a player prioritizing speed.
- **Patient sell** — a higher target price that may require more waiting.
- **Reference range and confidence** — the plausible market range, with the evidence behind it.

The product combines live listings, stored historical snapshots, item metadata, and later supply/demand events. It is decision support, not a trading bot, investment advice, or a guaranteed price predictor.

## 2. Problem

Warframe’s player economy is active but hard to interpret. Existing price history and active listing pages leave several questions unanswered:

- A single item can show a very wide price range because sellers differ in urgency, availability, knowledge, quantity, and patience.
- The cheapest listing may be a genuine deal, a stale/offline listing, a mismatched variant, or an unusually urgent sale.
- A visible price does not reveal whether an item is liquid or whether a player can complete a trade at that price soon.
- Supply changes from Baro Ki’Teer, vaulting, unvaulting, events, and farmability can invalidate historical prices.
- Demand can shift after balance changes, popular builds, or newly discovered synergies between Warframes, weapons, and mods.

Players need a transparent answer to: **“At my desired speed, is this a sensible price?”**

## 3. Product vision

Build a credible market-intelligence system for a live digital economy:

```text
Live listings + item metadata + historical snapshots + known events
                              ↓
            price ranges, liquidity, anomalies, and confidence
                              ↓
          explainable buy/sell decisions and watchlist alerts
```

The portfolio value is the full system: API ingestion, data modeling, time-series storage, robust statistics, transparent scoring, event-aware analysis, and a polished decision-support UI.

## 4. Goals

### Primary goals

1. Help a player assess whether a current listing is a good buy, normal price, or likely overpriced.
2. Recommend a competitive selling range based on the player’s desired sale speed.
3. Build a historical dataset that supports trend and anomaly analysis.
4. Show *why* every recommendation was made and how reliable it is.
5. Deliver a complete, demonstrable project suitable for internship applications.

### Success criteria

- A player can search an in-scope item and get a useful recommendation in under five seconds after data is available.
- Every displayed recommendation identifies its data freshness, market depth, and confidence level.
- The product never presents a listing as a confirmed completed trade unless the source explicitly proves it.
- The core logic can be evaluated against snapshots and manually logged trade outcomes.

## 5. Non-goals

Version 1 will not:

- automate trades, messages, listing creation, or account actions;
- predict exact future prices or guarantee profit;
- support every Warframe marketplace item or every platform at launch;
- value Rivens, Kuva Lich/Sister weapons, or other highly individualized variants;
- automatically discover new community builds from social media;
- infer that every disappearing listing was sold;
- bypass API limits, scrape prohibited endpoints, or store player credentials.

## 6. Target users

### Primary: informed but time-constrained trader

Knows basic market terminology, wants to buy an item without overpaying or sell inventory without waiting indefinitely.

### Secondary: casual seller

Has unwanted inventory and wants a reasonable, quick-sale price without studying charts.

### Tertiary: market watcher

Tracks a small set of items and wants alerts for unusually favorable listings or market changes.

## 7. Launch scope

### Platform context

Launch with one explicit market context: **PC, crossplay setting chosen in the UI and stored with every snapshot.** Do not mix platform or crossplay contexts in a price calculation.

The final initial setting must be confirmed before implementation. If crossplay is enabled, all requests and all historical labels must reflect that.

### Included categories

- Prime sets and set parts
- Standard, Primed, and augment mods with comparable variants
- Selected Arcane items only when rank/variant handling is unambiguous

### Excluded categories

- Rivens: rolls, dispositions, and positive/negative attributes make each listing a separate product
- Lich/Sister weapons and ephemeras with variable bonuses
- Items whose price materially depends on rank, charges, stars, or another unsupported attribute
- Bulk listings until per-unit and per-trade behavior is fully normalized

### Initial tracked universe

Start with 30–50 hand-selected items across the included categories. Expand only after data quality, API scheduling, and price calculations are validated.

## 8. User stories and acceptance criteria

| ID | User story | Acceptance criteria |
|---|---|---|
| US-01 | As a buyer, I can search an item and see current credible sell listings. | Results include price, quantity, seller status, timestamp, platform/crossplay context, and data refresh time. |
| US-02 | As a buyer, I can tell whether a listing is unusually good. | A deal score includes the comparison range, confidence, and a short explanation. |
| US-03 | As a seller, I can choose between a quick-sale and patient-sale price. | The result shows separate ranges and explains the speed trade-off. |
| US-04 | As a player, I can see whether a market is liquid. | The page shows active buyer/seller counts, spread, order-book depth, and a plain-language liquidity label. |
| US-05 | As a watcher, I can view recent market movement. | After sufficient snapshots, the page shows a time series and flags unusual changes. |
| US-06 | As a skeptical user, I can understand uncertainty. | Every estimate states its data window, freshness, sample size, and confidence level. |
| US-07 | As a watchlist user, I can set a target buy or sell threshold. | The system records the item, context, threshold, direction, and alert status. Alerts may initially be in-app only. |

## 9. Core product requirements

### 9.1 Item search and normalization

The application must:

- search in-scope items by display name and slug;
- distinguish a complete set from its components;
- distinguish relevant variants such as blueprint versus built item;
- preserve rank, quantity, and subtype where applicable;
- display the active market context prominently;
- reject or label unsupported variants rather than comparing them incorrectly.

### 9.2 Live market view

For each item, show:

- lowest credible active sell listings;
- highest credible active buy listings;
- best bid / best ask / spread;
- count of credible active listings on each side;
- last data refresh and snapshot timestamp;
- seller online status when supplied by the API;
- a direct link to the original marketplace listing or item page where permitted.

### 9.3 Price recommendations

For each supported item, calculate and display:

| Output | Meaning |
|---|---|
| Buy now | Lowest credible online ask after variant and outlier checks. |
| Good-buy threshold | A conservative lower reference threshold; not a guarantee of availability. |
| Quick-sale range | Competitive price band near credible current asks and buy-side demand. |
| Patient-sale range | Higher reference band for sellers willing to wait. |
| Reference range | Robust current/historical range, not a claim of intrinsic value. |
| Deal score | Relative attractiveness of a specific listing. |
| Confidence | Evidence quality: sample size, freshness, depth, agreement, and volatility. |

Never show one unlabeled “fair price.”

### 9.4 Explanation requirements

Each recommendation must contain an explanation like:

> **Strong buy candidate — 35 platinum**  
> 42% below the 14-day reference midpoint. Seller is online. 12 credible sell listings observed; current spread is 8 platinum. Confidence: medium because prices changed sharply in the last 24 hours.

The wording must distinguish observed facts from inferences:

- **Observed:** listing price, count, seller status, snapshot time, event date.
- **Estimated:** reference range, liquidity, sale speed, anomaly probability.
- **Unknown:** whether an order completed, why a listing disappeared, whether a player will respond.

### 9.5 Historical analysis

Once the collector has enough data, provide:

- 24-hour, 7-day, and 14-day reference ranges;
- median, lower/upper quartiles, and range width;
- active supply and demand proxies;
- rolling spread and volatility;
- unusual-price and unusual-supply flags;
- annotations for known market events.

The UI must show “insufficient history” instead of manufacturing a historical conclusion.

### 9.6 Watchlists and alerts

Initial alert types:

- sell listing at or below a target buy price;
- buy listing at or above a target sell price;
- deal score above a configured threshold;
- reference-range movement beyond a configured percentage.

Start with in-app alerts. Email, Discord, or push notifications are later scope.

## 10. Data sources and collection policy

### Required source: Warframe.market public API

Use documented public endpoints for:

- tradable item metadata;
- item and set relationships;
- orders by item;
- top current orders;
- recent online orders when useful for discovery.

Reference documentation before implementation:

- [API overview](https://docs.warframe.market/docs/api/overview/)
- [items and collections](https://docs.warframe.market/docs/api/manifests/)
- [orders](https://docs.warframe.market/docs/api/orders/)

The collector must comply with the published request limit and use caching, batching, exponential backoff, and retry-safe logging. Do not treat a public API as permission to create excessive polling load.

### Later event sources

- Official Warframe patch notes
- Baro Ki’Teer inventory and schedule data from a reputable documented source
- Manually curated vault/unvault and event records
- Manually confirmed synergy records

Phase 1 event data is curated, not fully automated. A manual event table is faster to validate and more honest than premature “AI discovers the meta” claims.

## 11. Pricing and scoring model

### 11.1 Comparable listing set

Before a listing enters a calculation, it must match:

- item identity;
- platform and crossplay context;
- relevant subtype and rank;
- unit definition (single item versus bulk/per-trade); and
- an allowed freshness/status policy.

Listings failing these checks are excluded with an auditable reason. Low prices are not automatically removed merely because they are inconvenient; they are flagged as potential outliers and shown separately when relevant.

### 11.2 Initial reference calculations

Use robust statistics, not an arithmetic average:

- **Current competitive ask:** weighted median of the lowest credible active sell listings.
- **Current competitive bid:** weighted median of the highest credible active buy listings.
- **Reference range:** lower/upper quantiles of credible snapshots over the chosen window.
- **Spread:** competitive ask minus competitive bid.
- **Volatility:** robust dispersion of the reference midpoint across snapshots.

Weights may favor online and recently updated listings. The implementation must publish the exact policy in an “How this works” panel.

### 11.3 Deal score

An initial score can combine:

```text
price advantage × confidence × listing availability × market liquidity
```

Where:

- **price advantage** compares a listing to the relevant buy/sell reference;
- **confidence** falls for thin, stale, contradictory, or highly volatile data;
- **listing availability** favors current online listings;
- **liquidity** favors markets with sufficient credible orders and a manageable spread.

The score is comparative, not a profit forecast. Its formula and version must be stored with each calculation so results can be reproduced.

### 11.4 Confidence model

Confidence should begin as rules, not machine learning:

- Higher: many recent comparable orders, stable range, active online supply/demand, narrow spread.
- Lower: few orders, stale data, wide dispersion, sudden change, unsupported variant, or missing history.

Use labels such as **high**, **medium**, **low**, and **insufficient data**, each with a visible reason.

## 12. Data model

Store immutable snapshots. Do not overwrite a past view of the market.

| Entity | Core fields | Purpose |
|---|---|---|
| `items` | id, slug, name, category, tradable, metadata version | Canonical item identity and attributes. |
| `market_contexts` | id, platform, crossplay | Prevent incompatible price mixing. |
| `order_snapshots` | snapshot id, observed at, source order id, item id, context id, side, price, quantity, variant fields, seller status | Historical record of visible orders. |
| `market_metrics` | item/context/window, calculated at, bid, ask, quantiles, spread, depth, volatility, confidence | Reproducible calculated market state. |
| `events` | id, type, starts/ends, source URL, summary, confidence | Curated supply/demand context. |
| `item_event_links` | item id, event id, relationship, rationale | Explains why an event may affect an item. |
| `watchlists` | user/session id, item/context, direction, threshold, enabled | Alert configuration. |
| `alerts` | watchlist id, created at, triggering metric, status | Delivery/audit history. |

Store source timestamps separately from collection timestamps. Retain raw source payloads only when permitted and necessary for debugging; otherwise store normalized fields plus a request/response audit record.

## 13. Proposed architecture

```text
Warframe.market API
        ↓
Scheduled collector → raw validation → normalized snapshot store
                                        ↓
                         metrics and scoring job
                                        ↓
                           API / web application
                                        ↓
                    search, item view, watchlist, alerts
```

Implementation principles:

- Separate collection, normalization, calculation, and presentation.
- Make collectors idempotent; a retry must not duplicate snapshots.
- Record API errors, rate-limit responses, and missing fields.
- Calculate metrics from stored snapshots, never only from frontend state.
- Start with a simple scheduled job and database; do not add queues, microservices, authentication, or AI agents before the MVP needs them.

## 14. UX requirements

### Dashboard

- Search-first entry point
- Watchlist summary
- Most favorable current opportunities, clearly marked as estimates
- Data freshness and market-context controls

### Item detail page

1. Item identity and selected context
2. Buy-now / good-buy / quick-sell / patient-sell cards
3. Confidence and explanation
4. Current buy and sell order-book summary
5. Historical range chart when data exists
6. Event annotations and known caveats
7. Watchlist control

### Accessibility and trust

- Do not encode meaning by color alone.
- Use plain labels alongside scores and charts.
- Provide keyboard-accessible search and controls.
- Show a short disclaimer: estimates are based on public listings and are not confirmed sale prices.

## 15. Validation plan

### Data validation

- Confirm every stored order matches the requested item and market context.
- Test set/part, rank, quantity, and subtype normalization with known examples.
- Monitor snapshot gaps, duplicate source order IDs, null fields, and API failures.

### Model validation

- Compare reference ranges against manual market checks for a small test set.
- Log personal or volunteer trade attempts: listed price, contact time, completed/not completed, and time to completion.
- Measure score calibration: are high-confidence “good buys” more likely to be practical than low-confidence ones?
- Review false positives where a low listing was not realistically executable.

### Product validation

- Can a player explain why a recommendation was produced?
- Does a player make a decision faster than by inspecting raw listings alone?
- Are results useful enough that the player adds an item to a watchlist?

## 16. Milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M0: Data contract | Supported items, market context, API request policy, schema draft | One item can be fetched and normalized correctly. |
| M1: Collector | Scheduled snapshot collection for 30–50 items | Idempotent snapshots, retries, rate-limit handling, basic monitoring. |
| M2: Live analyzer | Item search and current order-book view | Correct comparable-order filtering and visible freshness. |
| M3: Price guidance | Reference range, deal score, confidence explanations | Manual validation on a defined test set. |
| M4: Historical UI | Trends, anomalies, and range charts | Sufficient retained history; no conclusions on sparse data. |
| M5: Watchlists | Threshold-based in-app alerts | Alerts trigger only from the selected market context. |
| M6: Event-aware layer | Curated events and item links | Each event relationship has a source and rationale. |

## 17. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Public listings are not completed trades | False certainty | Use “listing-based estimate” language; track execution proxies separately. |
| API changes or rate limits | Data gaps | Version API client, cache metadata, back off, monitor failures. |
| Thin markets / wide price ranges | Unstable estimates | Confidence penalties; show insufficient-data state. |
| Incorrect variant comparison | Misleading price guidance | Strict normalization and unsupported-variant exclusions. |
| Events cause rapid structural changes | Historical model lags | Event annotations, anomaly flags, lower confidence after shocks. |
| Scope expansion into Rivens/AI/social scraping | Delayed MVP | Keep those as post-MVP tracks. |
| Marketplace terms/policy changes | Compliance risk | Recheck source documentation and terms before deployment. |

## 18. Future opportunities

- Baro and vault/unvault supply calendar
- Event and patch-note ingestion with human approval workflow
- Item dependency graph: Warframe → weapon → mod → market item
- Riven-specific valuation with separate comparable-roll logic
- Player-reported trade outcomes to improve sale-speed estimates
- Explainable anomaly reports: “supply fell,” “spread widened,” or “patch-linked demand signal”
- Public portfolio case study documenting architecture, data limitations, and evaluation results

## 19. Open decisions before implementation

1. Exact launch context: PC only, or PC with crossplay enabled?
2. Initial 30–50 tracked items: which categories and specific items best reflect the player’s experience?
3. Snapshot cadence: enough to capture useful movement while staying comfortably within source limits.
4. Storage and hosting choice: local-first research prototype or deployable web app from the outset?
5. Whether initial watchlists are anonymous/browser-local or require accounts.

## 20. Definition of done for MVP

The MVP is complete when a player can select a supported item and market context, view credible current listings, receive separated buy/sell guidance with confidence and explanation, inspect collected historical behavior when enough data exists, and create an in-app threshold alert—all without unsupported claims about confirmed trades or future prices.
