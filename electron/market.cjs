const API_V1 = "https://api.warframe.market/v1";
const API_V2 = "https://api.warframe.market/v2";
const headers = { Language: "en", Platform: "pc", Crossplay: "true" };
const onlineStatuses = new Set(["online", "ingame"]);
const ingameStatuses = new Set(["ingame"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const price = (order) => order.platinum / Math.max(order.perTrade || 1, 1);
const status = (order) => order.user?.status || "unknown";

function slugFromUrl(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error("Paste a Warframe.market item URL."); }
  if (url.protocol !== "https:" || !["warframe.market", "www.warframe.market"].includes(url.hostname)) throw new Error("Paste a Warframe.market item URL.");
  const [, kind, slug, ...rest] = url.pathname.replace(/\/+$/, "").split("/");
  if (kind !== "items" || !slug || rest.length || !/^[a-z0-9_]+$/i.test(slug)) throw new Error("Use a link like https://warframe.market/items/strun_prime_set");
  return slug;
}

function client() {
  let lastRequest = 0;
  return async (url, extraHeaders = {}) => {
    await sleep(Math.max(0, 400 - (Date.now() - lastRequest)));
    const response = await fetch(url, { headers: { ...headers, ...extraHeaders } });
    lastRequest = Date.now();
    if (!response.ok) throw new Error(`Warframe.market returned HTTP ${response.status}.`);
    return response.json();
  };
}

function activeSells(orders, statuses) {
  return orders.filter((order) => order.type === "sell" && order.visible && (!statuses || statuses.has(status(order)))).sort((a, b) => price(a) - price(b));
}

const whisper = (seller, item, unitPrice, quantity = 1) => `/w ${seller} Hi! I want to buy: "${item}"${quantity > 1 ? ` x${quantity}` : ""} for ${Math.round(unitPrice)} platinum${quantity > 1 ? " each" : ""}. (warframe.market)`;
const offer = (order, item, itemUrl, quantity = 1) => ({
  id: order.id, seller: order.user?.ingameName || "Unknown", status: order.user?.status, price: price(order), available: Number(order.quantity || 1),
  reputation: Number(order.user?.reputation || 0), url: itemUrl, buyQuantity: quantity,
  message: whisper(order.user?.ingameName || "Unknown", item, price(order), quantity),
});

function weightedMedian(values) {
  const sorted = values.filter(([, weight]) => weight > 0).toSorted((a, b) => a[0] - b[0]);
  let total = sorted.reduce((sum, [, weight]) => sum + weight, 0) / 2;
  for (const [value, weight] of sorted) {
    total -= weight;
    if (total <= 0) return value;
  }
  return null;
}

function quantile(sorted, fraction) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * (position - lower);
}

function historySummary(rows) {
  const values = rows.filter((row) => row.median && row.volume).map((row) => [Number(row.median), Number(row.volume)]);
  if (!values.length) return null;
  const medians = values.map(([value]) => value).toSorted((a, b) => a - b);
  return { fair: weightedMedian(values), low: quantile(medians, .25), high: quantile(medians, .75), volume: values.reduce((sum, [, volume]) => sum + volume, 0), days: values.length };
}

function age(isoTime) {
  if (!isoTime || Number.isNaN(Date.parse(isoTime))) return "unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(isoTime)) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m ago` : `${minutes}m ago`;
}

function recommendation(bestOnline, bestOffline, history) {
  if (!history) return { label: "No historical verdict", reason: "Not enough completed-sale observations to estimate a fair range." };
  const cheap = Math.min(history.fair * .85, history.low);
  if (bestOnline == null) return { label: "Wait", reason: "No online seller is available. Return time cannot be predicted." };
  if (bestOnline <= cheap) return { label: "Buy now", reason: `The lowest online ask meets the ${Math.round(cheap)}p cheap target.` };
  if (bestOnline <= history.fair * 1.03) return { label: "Reasonable buy", reason: "The lowest online ask is close to historical fair value." };
  if (bestOffline && price(bestOffline) <= history.fair) return { label: "Wait if you can", reason: `An offline seller lists at ${Math.round(price(bestOffline))}p, below the current online price.` };
  return { label: "Expensive now", reason: "The lowest online ask is meaningfully above historical fair value." };
}

async function getHistory(get, slug) {
  const data = await get(`${API_V1}/items/${slug}/statistics`);
  const series = data.payload?.statistics_closed || {};
  const rows = series["90days"]?.length ? series["90days"] : series["48hours"] || [];
  const summary = historySummary(rows);
  return summary && { ...summary, window: series["90days"]?.length ? "90 days" : "48 hours" };
}

async function componentAnalysis(get, item) {
  const [orderData, history] = [await get(`${API_V2}/orders/item/${item.slug}`), await getHistory(get, item.slug)];
  const online = activeSells(orderData.data || [], onlineStatuses);
  const ingame = activeSells(orderData.data || [], ingameStatuses);
  const all = activeSells(orderData.data || []);
  const offline = all.find((order) => !onlineStatuses.has(status(order))) || null;
  const now = online[0] ? price(online[0]) : null;
  const name = item.i18n.en.name;
  const url = `https://warframe.market/items/${item.slug}`;
  return {
    name, slug: item.slug, url, quantity: Number(item.quantityInSet || 1), now, history,
    offers: ingame.map((order) => offer(order, name, url)),
    offline: offline ? { price: price(offline), lastSeen: age(offline.user?.lastSeen) } : null,
    verdict: recommendation(now, offline, history),
  };
}

function componentBasket(components) {
  const parts = [];
  let total = 0;
  for (const component of components) {
    let remaining = component.quantity;
    const offers = [];
    for (const current of component.offers) {
      if (!remaining) break;
      const buyQuantity = Math.min(remaining, current.available);
      offers.push({ ...current, buyQuantity, message: whisper(current.seller, component.name, current.price, buyQuantity) });
      total += current.price * buyQuantity;
      remaining -= buyQuantity;
    }
    if (remaining) return null;
    parts.push({ name: component.name, slug: component.slug, url: component.url, quantity: component.quantity, subtotal: offers.reduce((sum, current) => sum + current.price * current.buyQuantity, 0), offers });
  }
  return parts.length ? { total, parts } : null;
}

async function analyze(url) {
  const slug = slugFromUrl(url);
  const get = client();
  const orderData = await get(`${API_V2}/orders/item/${slug}`);
  const setData = await get(`${API_V2}/items/${slug}/set`);
  const history = await getHistory(get, slug);
  const items = setData.data?.items || [];
  const root = items.find((item) => item.slug === slug);
  const all = activeSells(orderData.data || []);
  const online = activeSells(orderData.data || [], onlineStatuses);
  const ingame = activeSells(orderData.data || [], ingameStatuses);
  const bestOnline = online[0] ? price(online[0]) : null;
  const bestOffline = all.find((order) => !onlineStatuses.has(status(order))) || null;
  const components = [];
  for (const item of items.filter((item) => item.slug !== slug && item.tradable)) components.push(await componentAnalysis(get, item));
  const total = (key, reducer) => components.length > 0 && components.every((item) => item[key] != null) ? components.reduce((sum, item) => sum + reducer(item), 0) : null;
  return {
    title: root?.i18n?.en?.name || slug.replaceAll("_", " "), sourceUrl: url, context: "PC crossplay",
    verdict: recommendation(bestOnline, bestOffline, history), history,
    market: { onlineCount: online.length, ingameCount: ingame.length, visibleCount: all.length, bestOnline, onlineAsks: online.slice(0, 5).map(price), ingameOffers: ingame.map((order) => offer(order, root?.i18n?.en?.name || slug.replaceAll("_", " "), url)), offline: bestOffline ? { price: price(bestOffline), lastSeen: age(bestOffline.user?.lastSeen) } : null },
    components, componentBasket: componentBasket(components), totals: {
      now: total("now", (item) => item.now * item.quantity),
      fair: total("history", (item) => item.history.fair * item.quantity),
      cheap: total("history", (item) => Math.min(item.history.fair * .85, item.history.low) * item.quantity),
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { analyze, slugFromUrl, weightedMedian, historySummary, recommendation, componentBasket, age };
