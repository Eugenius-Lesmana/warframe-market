const fs = require("fs");
const { randomUUID } = require("crypto");
const { analyze, slugFromUrl } = require("./market.cjs");

const read = (file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; } };
const cheap = (history) => history && Math.min(history.fair * .85, history.low);
const expiry = (durationMinutes, now = Date.now()) => durationMinutes === "" || durationMinutes == null ? null : new Date(now + Math.max(1, Math.min(1440, Number(durationMinutes) || 60)) * 60000).toISOString();

function findDeal(result, target) {
  const offers = (result.market.ingameOffers || []).filter((current) => current.price <= target);
  const basket = result.componentBasket?.total <= target ? result.componentBasket : null;
  if (!offers.length && !basket) return null;
  const kind = offers.length && basket ? "both" : basket ? "components" : "item";
  return { kind, price: Math.min(offers[0]?.price ?? Infinity, basket?.total ?? Infinity), target, foundAt: result.generatedAt, offers, basket };
}

function createSniper({ storagePath, notify, publish }) {
  let watches = read(storagePath);
  const timers = new Map();
  const save = () => fs.writeFileSync(storagePath, JSON.stringify(watches, null, 2));
  const send = () => publish(watches);
  const stop = (id) => { clearTimeout(timers.get(id)); timers.delete(id); };

  async function check(id) {
    const watch = watches.find((item) => item.id === id);
    if (!watch) return;
    if (watch.expiresAt && Date.now() >= Date.parse(watch.expiresAt)) {
      watch.status = "expired"; save(); send(); stop(id); return;
    }
    watch.status = "checking"; watch.error = ""; save(); send();
    try {
      const result = await analyze(watch.url);
      if (!watches.includes(watch)) return;
      const target = watch.targetPrice ?? cheap(result.history);
      Object.assign(watch, { title: result.title, lastCheckedAt: result.generatedAt, threshold: target, status: "watching", error: "" });
      const hit = target == null ? null : findDeal(result, target);
      if (hit) {
        const key = JSON.stringify([hit.kind, hit.price, hit.offers.map((current) => current.id), hit.basket?.parts.flatMap((part) => part.offers.map((current) => current.id))]);
        watch.status = `deal-${hit.kind}`;
        watch.hit = hit;
        if (key !== watch.notificationKey) {
          watch.notificationKey = key;
          const detail = hit.kind === "components" ? `Components total ${Math.round(hit.price)}p.` : hit.kind === "both" ? `Set and component options are within ${Math.round(target)}p.` : `${hit.offers.length} in-game offer${hit.offers.length === 1 ? "" : "s"} within ${Math.round(target)}p.`;
          notify(result.title, `${detail} Open Sniper to copy the whisper.`);
        }
      } else {
        watch.hit = null;
        watch.notificationKey = null;
      }
    } catch (error) {
      watch.status = "error"; watch.error = error.message || "Could not refresh this watch."; watch.lastCheckedAt = new Date().toISOString();
    }
    save(); send();
    if (watches.some((item) => item.id === id)) timers.set(id, setTimeout(() => check(id), watch.intervalSeconds * 1000));
  }

  function add({ url, targetPrice, intervalSeconds, durationMinutes }) {
    if (watches.filter((item) => item.status !== "expired").length >= 20) throw new Error("Keep up to 20 active watches.");
    const numericTarget = targetPrice === "" || targetPrice == null ? null : Number(targetPrice);
    if (numericTarget != null && (!Number.isFinite(numericTarget) || numericTarget <= 0)) throw new Error("Target price must be a positive number.");
    const interval = Math.max(30, Math.min(1800, Number(intervalSeconds) || 60));
    const watch = { id: randomUUID(), url: String(url).trim(), title: "New watch", targetPrice: numericTarget, intervalSeconds: interval, expiresAt: expiry(durationMinutes), status: "checking", error: "", lastCheckedAt: null, threshold: null, hit: null, notificationKey: null };
    if (!watch.url) throw new Error("Paste a Warframe.market item link.");
    slugFromUrl(watch.url);
    watches.push(watch); save(); send(); check(watch.id);
    return watch;
  }

  function remove(id) { stop(id); watches = watches.filter((watch) => watch.id !== id); save(); send(); }
  function start() { watches.filter((watch) => !watch.expiresAt || Date.now() < Date.parse(watch.expiresAt)).forEach((watch) => check(watch.id)); }
  return { add, list: () => watches, remove, start };
}

module.exports = { createSniper, expiry, findDeal };
