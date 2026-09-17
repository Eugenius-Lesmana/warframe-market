import { useState } from "react";
import Icon from "./Icon";

const example = "https://warframe.market/items/strun_prime_set";
const price = (value) => value == null ? "calculating" : `${Math.round(value)}p`;
const remaining = (expiresAt) => {
  if (!expiresAt) return "No expiry";
  const minutes = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left` : `${minutes}m left`;
};
const isDeal = (watch) => watch.status.startsWith("deal");
const dealLabel = { "deal-item": "Set deal found", "deal-components": "Component basket found", "deal-both": "Set and component deals found" };

export default function Sniper({ watches, setWatches }) {
  const [url, setUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState("60");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  async function add(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await window.market.sniperAdd({ url, targetPrice, durationMinutes, intervalSeconds });
      setUrl(""); setTargetPrice("");
    } catch (reason) { setError(reason.message || "Could not create the watch."); }
    finally { setSaving(false); }
  }
  async function remove(id) { await window.market.sniperRemove(id); setWatches((items) => items.filter((item) => item.id !== id)); }
  async function copy(message, id) { await window.market.copy(message); setCopied(id); setTimeout(() => setCopied(""), 1600); }

  return <section className="sniper-page">
    <section className="page-intro"><div><p className="eyebrow">Price watcher</p><h1><Icon name="sniper" size={28}/>Sniper</h1><p>Only sellers marked <strong>Online in game</strong> can trigger alerts. Whole sets and complete component baskets are both checked.</p></div><span className="sniper-count">{watches.length}/20 watches</span></section>
    <form className="watch-form" onSubmit={add}>
      <label className="field"><span className="field-heading">Item link</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={example} required spellCheck="false" /><small className="field-helper">Warframe Market URL</small></label>
      <label className="field"><span className="field-heading">Price target</span><input type="number" min="1" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="Auto cheap price" /><small className="field-helper">Optional</small></label>
      <label className="field"><span className="field-heading">Watch for</span><input type="number" min="1" max="1440" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="Infinite" /><small className="field-helper">Minutes</small></label>
      <label className="field"><span className="field-heading">Refresh every</span><input type="number" min="30" max="1800" value={intervalSeconds} onChange={(event) => setIntervalSeconds(event.target.value)} /><small className="field-helper">Seconds · min 30</small></label>
      <button className="start-watch" disabled={saving}><Icon name="sniper"/>{saving ? "Adding..." : "Start watch"}</button>
    </form>
    <p className="watch-hint">Leave the target blank to use the historical cheap-price threshold. Keep Tenno Market open while watching.</p>
    {error && <section className="error" role="alert">{error}</section>}
    {!watches.length && <section className="empty"><p>Add an item to watch for an in-game seller or a cheaper complete component basket.</p></section>}
    <section className="watch-list">{watches.map((watch) => <Watch key={watch.id} watch={watch} copied={copied} copy={copy} remove={remove}/>)}</section>
  </section>;
}

function Watch({ watch, copied, copy, remove }) {
  const deal = isDeal(watch);
  return <article className={`watch ${deal ? "deal" : ""}`}>
    <div className="watch-main"><div><p className="eyebrow">{deal ? dealLabel[watch.status] || "Deal found" : watch.status}</p><h2>{watch.title}</h2><p className="muted">Target ≤ {price(watch.threshold ?? watch.targetPrice)} · {remaining(watch.expiresAt)} · every {watch.intervalSeconds}s</p>{watch.error && <p className="watch-error">{watch.error}</p>}</div>
      {deal && <div className="deal-price"><strong>{price(watch.hit.price)}</strong><span>{watch.hit.kind === "components" ? "component total" : "best option"}</span></div>}
    </div>
    {watch.hit?.offers?.length > 0 && <OfferList title={`${watch.hit.offers.length} set offer${watch.hit.offers.length === 1 ? "" : "s"} within range`} offers={watch.hit.offers} copied={copied} copy={copy}/>} 
    {watch.hit?.basket && <Basket basket={watch.hit.basket} copied={copied} copy={copy}/>} 
    <div className="watch-actions"><span>Checked {watch.lastCheckedAt ? new Date(watch.lastCheckedAt).toLocaleTimeString() : "now"}</span><button className="quiet" type="button" onClick={() => remove(watch.id)}><Icon name="trash"/>Remove</button></div>
  </article>;
}

function OfferList({ title, offers, copied, copy }) {
  return <section className="deal-section"><h3><Icon name="alert"/>{title}</h3><div className="offer-list">{offers.map((offer) => <Offer key={offer.id} offer={offer} copied={copied} copy={copy}/>)}</div></section>;
}

function Basket({ basket, copied, copy }) {
  const messages = basket.parts.flatMap((part) => part.offers.map((offer) => offer.message)).join("\n");
  return <section className="deal-section basket"><div className="deal-section-heading"><h3><Icon name="parts"/>Complete component basket · {price(basket.total)}</h3><button className="secondary" onClick={() => copy(messages, "all-components")}><Icon name="copy"/>{copied === "all-components" ? "Copied" : "Copy all whispers"}</button></div>
    {basket.parts.map((part) => <div className="basket-part" key={part.slug}><div><strong>{part.name} ×{part.quantity}</strong><span>{price(part.subtotal)}</span></div>{part.offers.map((offer) => <Offer key={offer.id} offer={offer} copied={copied} copy={copy}/>)}</div>)}
  </section>;
}

function Offer({ offer, copied, copy }) {
  return <article className="offer"><div className="seller"><strong>{offer.seller}</strong><span>{price(offer.price)}{offer.buyQuantity > 1 ? ` each · ×${offer.buyQuantity}` : ""} · {offer.available} available · +{offer.reputation} rep</span></div><code>{offer.message}</code><div className="offer-actions"><button className="secondary" onClick={() => copy(offer.message, offer.id)}><Icon name="copy"/>{copied === offer.id ? "Copied" : "Copy whisper"}</button><button className="secondary" onClick={() => window.market.open(offer.url)}><Icon name="external"/>Market</button></div></article>;
}
