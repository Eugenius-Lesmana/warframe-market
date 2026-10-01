const test = require("node:test");
const assert = require("node:assert/strict");
const { slugFromUrl, buyTarget, sellAdvice, weightedQuantile, weightedMedian, historySummary, recommendation, componentBasket, age } = require("./electron/market.cjs");

test("slugFromUrl accepts a trailing slash and rejects junk with a friendly message", () => {
  assert.equal(slugFromUrl("https://warframe.market/items/strun_prime_set/"), "strun_prime_set");
  assert.throws(() => slugFromUrl("not a url"), /Warframe.market item URL/);
  assert.throws(() => slugFromUrl("https://example.com/items/x"), /Warframe.market item URL/);
});

test("weightedMedian handles empty, zero-weight and single rows", () => {
  assert.equal(weightedMedian([]), null);
  assert.equal(weightedMedian([[50, 0]]), null);
  assert.equal(weightedMedian([[50, 3]]), 50);
  assert.equal(weightedMedian([[40, 1], [60, 8], [100, 1]]), 60);
});

test("historySummary matches the Python quartiles and drops empty rows", () => {
  const summary = historySummary([{ median: 40, volume: 2 }, { median: 60, volume: 8 }, { median: 50, volume: 1 }, { median: 0, volume: 9 }]);
  assert.deepEqual({ fair: summary.fair, low: summary.low, high: summary.high, volume: summary.volume, days: summary.days }, { fair: 60, low: 45, high: 55, volume: 11, days: 3 });
  assert.equal(historySummary([{ median: 0, volume: 4 }]), null);
});

test("recommendation covers the four verdicts", () => {
  const history = { fair: 60, low: 50 };
  assert.equal(recommendation(null, null, history).label, "Wait");
  assert.equal(recommendation(45, null, history).label, "Buy now");
  assert.equal(recommendation(61, null, history).label, "Reasonable buy");
  assert.equal(recommendation(75, { platinum: 55, perTrade: 1 }, history).label, "Wait if you can");
  assert.equal(recommendation(75, null, history).label, "Expensive now");
  assert.equal(recommendation(10, null, null).label, "No historical verdict");
});

test("componentBasket splits a part across sellers and fails when stock is short", () => {
  const part = (quantity, offers) => ({ name: "Barrel", slug: "b", url: "u", quantity, offers });
  const offer = (id, price, available) => ({ id, seller: id, price, available });
  const basket = componentBasket([part(2, [offer("a", 10, 1), offer("b", 12, 5)])]);
  assert.equal(basket.total, 22);
  assert.deepEqual(basket.parts[0].offers.map((o) => o.buyQuantity), [1, 1]);
  assert.equal(componentBasket([part(3, [offer("a", 10, 1)])]), null);
  assert.equal(componentBasket([]), null);
});

test("age returns 'unknown' for missing or malformed timestamps", () => {
  assert.equal(age(undefined), "unknown");
  assert.equal(age("garbage"), "unknown");
});

test("buyTarget is lifted to the lowest listing but stays under fair", () => {
  const history = { fair: 70, low: 55 };
  assert.equal(buyTarget(history, null), 55);
  assert.equal(buyTarget(history, 60), 60);
  assert.equal(buyTarget(history, 40), 55);
  assert.equal(buyTarget(history, 90), 70 * .97);
  assert.equal(buyTarget(null, 60), null);
});

test("an online ask just above a lifted target is not a Buy now", () => {
  const history = { fair: 70, low: 55 };
  assert.equal(recommendation(60, null, history, 60).label, "Buy now");
  assert.notEqual(recommendation(62, null, history, 60).label, "Buy now");
});

test("weightedQuantile orders the tiers", () => {
  const rows = [[40, 1], [50, 4], [60, 4], [80, 1]];
  assert.deepEqual([.25, .5, .75].map((q) => weightedQuantile(rows, q)), [50, 50, 60]);
});

const sellHistory = () => historySummary([40, 50, 50, 60, 60, 70, 80].map((median) => ({ median, volume: 10 })));

test("sellAdvice undercuts the cheapest online seller inside the usual range", () => {
  const advice = sellAdvice(sellHistory(), [65, 70, 75], []);
  assert.equal(advice.recommended.price, 64);
  assert.equal(advice.recommended.rank, 1);
  assert.ok(advice.tiers[0].price <= advice.tiers[1].price && advice.tiers[1].price <= advice.tiers[2].price);
});

test("sellAdvice never lists below the quick-sale price when sellers undercut", () => {
  const history = sellHistory();
  assert.equal(sellAdvice(history, [30, 31], []).recommended.price, history.sellQuick);
});

test("sellAdvice caps at the patient price and falls back to fair with no competitors", () => {
  const history = sellHistory();
  assert.equal(sellAdvice(history, [200], []).recommended.price, history.sellPatient);
  assert.equal(sellAdvice(history, [], []).recommended.price, history.fair);
  assert.equal(sellAdvice(null, [], []), null);
});

test("sellAdvice offers an instant sale only when a bid reaches the quick-sale price", () => {
  const history = sellHistory();
  assert.equal(sellAdvice(history, [70], [10]).instant, null);
  assert.equal(sellAdvice(history, [70], [60]).instant.price, 60);
});
