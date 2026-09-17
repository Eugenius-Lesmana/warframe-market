"""Analyze a Warframe.market item URL using live orders and 90-day sale statistics."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


API_V2 = "https://api.warframe.market/v2"
API_V1 = "https://api.warframe.market/v1"
HEADERS = {"Language": "en", "Platform": "pc", "Crossplay": "true"}
ONLINE = {"online", "ingame"}


def slug_from_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or parsed.netloc not in {"warframe.market", "www.warframe.market"}:
        raise ValueError("Enter a Warframe.market item URL, e.g. https://warframe.market/items/strun_prime_set")
    parts = PurePosixPath(parsed.path).parts
    if len(parts) != 3 or parts[1] != "items" or not parts[2].replace("_", "").isalnum():
        raise ValueError("URL must look like https://warframe.market/items/item_slug")
    return parts[2]


class MarketClient:
    def __init__(self) -> None:
        self.last_request = 0.0

    def get(self, url: str, *, headers: dict[str, str] | None = None) -> dict:
        delay = 0.4 - (time.monotonic() - self.last_request)
        if delay > 0:
            time.sleep(delay)
        request = Request(url, headers=HEADERS | (headers or {}))
        try:
            with urlopen(request, timeout=20) as response:
                self.last_request = time.monotonic()
                return json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"Warframe.market returned HTTP {error.code} for {url}") from error
        except URLError as error:
            raise RuntimeError(f"Could not reach Warframe.market: {error.reason}") from error

    def orders(self, slug: str) -> list[dict]:
        return self.get(f"{API_V2}/orders/item/{slug}").get("data", [])

    def set_items(self, slug: str) -> list[dict]:
        return self.get(f"{API_V2}/items/{slug}/set").get("data", {}).get("items", [])

    def history(self, slug: str) -> list[dict]:
        payload = self.get(f"{API_V1}/items/{slug}/statistics", headers={"Platform": "pc"}).get("payload", {})
        series = payload.get("statistics_closed", {})
        return series.get("90days") or series.get("48hours") or []


def price(order: dict) -> float:
    return order["platinum"] / max(order.get("perTrade") or 1, 1)


def seller_status(order: dict) -> str:
    return order.get("user", {}).get("status", "unknown")


def active_sells(orders: list[dict], *, online_only: bool) -> list[dict]:
    sells = [order for order in orders if order.get("type") == "sell" and order.get("visible")]
    if online_only:
        sells = [order for order in sells if seller_status(order) in ONLINE]
    return sorted(sells, key=price)


def weighted_median(values: list[tuple[float, int]]) -> float | None:
    usable = sorted((value, weight) for value, weight in values if value > 0 and weight > 0)
    if not usable:
        return None
    midpoint = sum(weight for _, weight in usable) / 2
    running = 0
    for value, weight in usable:
        running += weight
        if running >= midpoint:
            return value
    return usable[-1][0]


def history_summary(rows: list[dict]) -> dict[str, float | int] | None:
    usable = [(float(row["median"]), int(row["volume"])) for row in rows if row.get("median") and row.get("volume")]
    if not usable:
        return None
    medians = [value for value, _ in usable]
    return {
        "fair": weighted_median(usable) or statistics.median(medians),
        "low": statistics.quantiles(medians, n=4, method="inclusive")[0] if len(medians) > 1 else medians[0],
        "high": statistics.quantiles(medians, n=4, method="inclusive")[2] if len(medians) > 1 else medians[0],
        "volume": sum(weight for _, weight in usable),
        "days": len(usable),
    }


def age(iso_time: str | None) -> str:
    if not iso_time:
        return "unknown"
    try:
        delta = datetime.now(UTC) - datetime.fromisoformat(iso_time.replace("Z", "+00:00"))
    except ValueError:
        return "unknown"
    minutes = max(0, int(delta.total_seconds() // 60))
    return f"{minutes // 60}h {minutes % 60}m ago" if minutes >= 60 else f"{minutes}m ago"


def recommendation(best_online: float | None, best_offline: dict | None, history: dict[str, float | int] | None) -> tuple[str, str]:
    if not history:
        return ("No historical verdict", "There are not enough completed-sale observations to estimate a fair range.")
    fair, low = float(history["fair"]), float(history["low"])
    cheap = min(fair * 0.85, low)
    if best_online is None:
        return ("Wait", "No online seller is available. The tool cannot predict when an offline seller will return.")
    if best_online <= cheap:
        return ("Buy now", f"The best online ask is at or below the cheap target of {cheap:.0f}p.")
    if best_online <= fair * 1.03:
        return ("Reasonable buy", "The best online ask is close to the historical fair price.")
    if best_offline and price(best_offline) <= fair:
        return ("Wait if you can", f"The cheapest online ask is above fair, while an offline seller lists at {price(best_offline):.0f}p.")
    return ("Expensive now", "The best online ask is meaningfully above the historical fair price.")


def set_comparison(client: MarketClient, set_items: list[dict], root_slug: str) -> tuple[dict[str, float | None], list[dict]]:
    parts = [item for item in set_items if item["slug"] != root_slug and item.get("tradable")]
    quotes: list[dict] = []
    for item in parts:
        orders = client.orders(item["slug"])
        online = active_sells(orders, online_only=True)
        offline = next((order for order in active_sells(orders, online_only=False) if seller_status(order) not in ONLINE), None)
        history = history_summary(client.history(item["slug"]))
        now = price(online[0]) if online else None
        quantity = int(item.get("quantityInSet") or 1)
        verdict, reason = recommendation(now, offline, history)
        quotes.append({
            "name": item["i18n"]["en"]["name"], "quantity": quantity, "now": now,
            "offline": offline, "history": history, "verdict": verdict, "reason": reason,
        })
    totals = {
        "now": sum(quote["now"] * quote["quantity"] for quote in quotes) if all(quote["now"] is not None for quote in quotes) else None,
        "fair": sum(float(quote["history"]["fair"]) * quote["quantity"] for quote in quotes) if all(quote["history"] for quote in quotes) else None,
        "cheap": sum(min(float(quote["history"]["fair"]) * .85, float(quote["history"]["low"])) * quote["quantity"] for quote in quotes) if all(quote["history"] for quote in quotes) else None,
    }
    return totals, quotes


def notify(message: str) -> None:
    print(f"\n!!! ALERT: {message} !!!\a", flush=True)
    if sys.platform == "win32":
        import winsound

        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)


def watch(url: str, target: float | None, interval: int) -> None:
    slug = slug_from_url(url)
    client = MarketClient()
    history = history_summary(client.history(slug))
    if target is None:
        if not history:
            raise ValueError("This item has no usable price history; pass --target <platinum> to watch it.")
        target = min(float(history["fair"]) * 0.85, float(history["low"]))
    print(f"Watching {slug} every {interval}s. Alert target: <={target:.0f}p. Press Ctrl+C to stop.")
    previous_online: int | None = None
    previous_good = False
    try:
        while True:
            online = active_sells(client.orders(slug), online_only=True)
            best = price(online[0]) if online else None
            good = best is not None and best <= target
            now = datetime.now().astimezone().strftime("%H:%M:%S")
            print(f"{now} | online sellers: {len(online)} | best ask: {best:.0f}p" if best is not None else f"{now} | online sellers: 0 | best ask: none")
            if previous_online == 0 and online:
                notify(f"An online seller appeared at {best:.0f}p.")
            if good and not previous_good:
                notify(f"Good-price target reached: {best:.0f}p (target {target:.0f}p).")
            previous_online, previous_good = len(online), good
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nWatch stopped.")


def report(url: str) -> str:
    slug = slug_from_url(url)
    client = MarketClient()
    orders = client.orders(slug)
    items = client.set_items(slug)
    history = history_summary(client.history(slug))
    title = next((item.get("i18n", {}).get("en", {}).get("name") for item in items if item.get("slug") == slug), slug.replace("_", " ").title())
    online = active_sells(orders, online_only=True)
    offline = active_sells(orders, online_only=False)
    best_online = price(online[0]) if online else None
    best_offline = next((order for order in offline if seller_status(order) not in ONLINE), None)
    verdict, reason = recommendation(best_online, best_offline, history)
    lines = [f"\n{title} - PC crossplay", "=" * (len(title) + 15)]
    lines += [f"Verdict: {verdict}", reason, ""]
    if history:
        lines += [
            f"90-day completed sales: {history['volume']} trades across {history['days']} daily observations",
            f"Fair price: ~{history['fair']:.0f}p | typical range: {history['low']:.0f}-{history['high']:.0f}p | cheap target: <={min(float(history['fair']) * .85, float(history['low'])):.0f}p",
        ]
    else:
        lines.append("90-day completed sales: unavailable")
    lines += ["", f"Online sellers: {len(online)} | visible sellers: {len(offline)}"]
    lines.append(f"Best online ask: {best_online:.0f}p" if best_online is not None else "Best online ask: none")
    if best_offline:
        lines.append(f"Cheapest offline alternative: {price(best_offline):.0f}p - last seen {age(best_offline.get('user', {}).get('lastSeen'))}")
    if online:
        lines.append("Best online asks: " + ", ".join(f"{price(order):.0f}p" for order in online[:5]))
    if len(items) > 1:
        totals, quotes = set_comparison(client, items, slug)
        lines += ["", "Buying components separately:"]
        for quote in quotes:
            label = f"  {quote['name']} x{quote['quantity']}"
            lines.append(f"{label}: online {quote['now']:.0f}p each" if quote["now"] is not None else f"{label}: no online seller")
            if quote["history"]:
                history = quote["history"]
                cheap = min(float(history["fair"]) * .85, float(history["low"]))
                lines.append(f"    fair ~{history['fair']:.0f}p each | cheap <= {cheap:.0f}p | {quote['verdict']}")
            if quote["offline"]:
                lines.append(f"    lower offline option: {price(quote['offline']):.0f}p each - last seen {age(quote['offline'].get('user', {}).get('lastSeen'))}")
        lines.append(f"  Buy-now component total: {totals['now']:.0f}p" if totals["now"] is not None else "  Buy-now component total: unavailable because at least one part has no online seller")
        if totals["fair"] is not None:
            lines.append(f"  Component fair total: ~{totals['fair']:.0f}p | component cheap target: <= {totals['cheap']:.0f}p")
        if totals["now"] is not None and best_online is not None:
            difference = best_online - totals["now"]
            lines.append(f"  Versus set: components are {abs(difference):.0f}p {'cheaper' if difference > 0 else 'more expensive'}.")
    lines += ["", "Notes: historical figures are completed-sale aggregates; live orders are listings, not guaranteed trades.", "Offline status shows only when a seller was last seen; it cannot estimate their return time."]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Warframe.market item URL")
    parser.add_argument("--watch", action="store_true", help="Poll for a new online seller or a target-price listing")
    parser.add_argument("--target", type=float, help="Alert when the best online ask reaches this platinum price")
    parser.add_argument("--interval", type=int, default=60, help="Polling interval in seconds; minimum 20 (default: 60)")
    args = parser.parse_args()
    try:
        if args.interval < 20:
            raise ValueError("--interval must be at least 20 seconds.")
        if args.target is not None and args.target <= 0:
            raise ValueError("--target must be greater than zero.")
        if args.watch:
            watch(args.url, args.target, args.interval)
        else:
            print(report(args.url))
    except (RuntimeError, ValueError) as error:
        raise SystemExit(f"Error: {error}") from error


if __name__ == "__main__":
    main()
