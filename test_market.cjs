const test = require("node:test");
const assert = require("node:assert/strict");
const { slugFromUrl, weightedMedian, historySummary, recommendation, componentBasket, age } = require("./electron/market.cjs");

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
  assert.deepEqual(summary, { fair: 60, low: 45, high: 55, volume: 11, days: 3 });
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
