const test = require("node:test");
const assert = require("node:assert/strict");
const { expiry, findDeal } = require("./electron/sniper.cjs");

const result = (offers = [], basket = null) => ({ market: { ingameOffers: offers }, componentBasket: basket, generatedAt: "2026-01-01T00:00:00Z" });

test("lists every in-range in-game offer", () => {
  const hit = findDeal(result([{ id: "a", price: 35 }, { id: "b", price: 40 }, { id: "c", price: 41 }]), 40);
  assert.equal(hit.kind, "item");
  assert.deepEqual(hit.offers.map(({ id }) => id), ["a", "b"]);
});

test("detects a complete component basket under the set target", () => {
  const basket = { total: 39, parts: [{ name: "Part", offers: [] }] };
  assert.equal(findDeal(result([], basket), 40).kind, "components");
  assert.equal(findDeal(result([], { ...basket, total: 41 }), 40), null);
});

test("distinguishes simultaneous set and component deals", () => {
  const hit = findDeal(result([{ id: "set", price: 40 }], { total: 38, parts: [] }), 40);
  assert.equal(hit.kind, "both");
  assert.equal(hit.price, 38);
});

test("defaults watch duration to no expiry", () => {
  assert.equal(expiry(""), null);
  assert.equal(expiry(null), null);
  assert.equal(expiry("60", 0), "1970-01-01T01:00:00.000Z");
});
