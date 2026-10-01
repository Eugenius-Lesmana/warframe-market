import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cli"))
from analyze_market import buy_target, history_summary, main, price, recommendation, set_comparison, slug_from_url, weighted_median


class AnalyzerTests(unittest.TestCase):
    def test_parses_item_url(self):
        self.assertEqual(slug_from_url("https://warframe.market/items/strun_prime_set"), "strun_prime_set")

    def test_rejects_other_urls(self):
        with self.assertRaises(ValueError):
            slug_from_url("https://example.com/items/strun_prime_set")

    def test_normalizes_bulk_price(self):
        self.assertEqual(price({"platinum": 24, "perTrade": 3}), 8)

    def test_weighted_median(self):
        self.assertEqual(weighted_median([(40, 1), (60, 8), (100, 1)]), 60)

    def test_history_summary(self):
        summary = history_summary([{"median": 40, "volume": 2}, {"median": 60, "volume": 8}])
        self.assertEqual(summary["fair"], 60)
        self.assertEqual(summary["volume"], 10)

    def test_waits_when_offline_offer_is_fair(self):
        history = {"fair": 60, "low": 50, "high": 70, "volume": 10, "days": 2}
        verdict, _ = recommendation(75, {"platinum": 55, "perTrade": 1}, history)
        self.assertEqual(verdict, "Wait if you can")

    def test_set_comparison_uses_quantity_in_set_and_component_history(self):
        class Client:
            def orders(self, slug):
                return [{"type": "sell", "visible": True, "platinum": 10 if slug == "barrel" else 5, "perTrade": 1, "user": {"status": "online"}}]

            def history(self, _slug):
                return [{"median": 12, "volume": 5}]

        items = [
            {"slug": "set", "tradable": True},
            {"slug": "barrel", "tradable": True, "quantityInSet": 2, "i18n": {"en": {"name": "Barrel"}}},
            {"slug": "link", "tradable": True, "quantityInSet": 1, "i18n": {"en": {"name": "Link"}}},
        ]
        totals, quotes = set_comparison(Client(), items, "set")
        self.assertEqual(totals["now"], 25)
        self.assertEqual(totals["fair"], 36)
        self.assertEqual(quotes[0]["quantity"], 2)

    def test_weighted_median_ignores_zero_and_empty(self):
        self.assertIsNone(weighted_median([]))
        self.assertIsNone(weighted_median([(0, 5), (50, 0)]))
        self.assertEqual(weighted_median([(50, 3)]), 50)

    def test_one_sale_day_has_flat_range(self):
        summary = history_summary([{"median": 50, "volume": 3}])
        self.assertEqual((summary["low"], summary["high"]), (50, 50))

    def test_missing_history_gives_no_verdict(self):
        self.assertIsNone(history_summary([{"median": 0, "volume": 4}, {"median": 30, "volume": 0}]))
        verdict, _ = recommendation(20, None, None)
        self.assertEqual(verdict, "No historical verdict")

    def test_no_online_seller_waits(self):
        history = {"fair": 60, "low": 50, "high": 70, "volume": 10, "days": 2}
        self.assertEqual(recommendation(None, None, history)[0], "Wait")

    def test_trailing_slash_url(self):
        self.assertEqual(slug_from_url("https://warframe.market/items/strun_prime_set/"), "strun_prime_set")

    def test_cheap_target_is_lifted_to_the_market_floor(self):
        history = {"fair": 70, "low": 55, "high": 80, "volume": 10, "days": 2}
        self.assertEqual(buy_target(history), 55)
        self.assertEqual(buy_target(history, 60), 60)
        self.assertEqual(buy_target(history, 90), 70 * 0.97)
        self.assertEqual(buy_target(history, 40), 55)

    def test_rejects_fast_watch_interval(self):
        with patch("sys.argv", ["analyze_market.py", "https://warframe.market/items/strun_prime_set", "--watch", "--interval", "1"]):
            with self.assertRaises(SystemExit) as error:
                main()
        self.assertIn("at least 20", str(error.exception))


if __name__ == "__main__":
    unittest.main()
