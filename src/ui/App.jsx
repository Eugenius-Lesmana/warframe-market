import { useEffect, useState } from "react";
import { ComponentBreakdown, MarketSnapshot, Metrics, SellAdvice, SetSell } from "./MarketPanels";
import Sniper from "./Sniper";
import Icon from "./Icon";

const example = "https://warframe.market/items/strun_prime_set";

export default function App() {
  const [url, setUrl] = useState(example);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("analyze");
  const [watches, setWatches] = useState([]);

  useEffect(() => {
    window.market.sniperList().then(setWatches);
    return window.market.onSniperUpdate(setWatches);
  }, []);

  async function analyze(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await window.market.analyze(url.trim()));
    } catch (reason) {
      setResult(null);
      setError(reason.message || "Could not analyze this item.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="shell">
    <header className="hero">
      <div className="brand"><span className="brand-mark">T</span><span>Tenno Market</span></div>
      <nav aria-label="Main navigation"><button className={tab === "analyze" ? "active-tab" : "tab"} onClick={() => setTab("analyze")}><Icon name="analyze"/>Analyze now</button><button className={tab === "sniper" ? "active-tab" : "tab"} onClick={() => setTab("sniper")}><Icon name="sniper"/>Sniper{watches.some((watch) => watch.status.startsWith("deal")) && <i />}</button></nav>
    </header>
    {tab === "sniper" ? <Sniper watches={watches} setWatches={setWatches} /> : <>
    <section className="page-intro analyze-intro"><div><p className="eyebrow">Market snapshot</p><h1><Icon name="analyze" size={28}/>Analyze now</h1><p>Compare live listings with completed sales, fair value, and the cost of buying each set component separately.</p></div></section>
    <section className="search-card">
      <form onSubmit={analyze}>
        <label htmlFor="item-url">Warframe.market item link</label>
        <div className="search-row">
          <input id="item-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={example} spellCheck="false" />
          <button className="analyze-button" disabled={loading}><Icon name="analyze"/>{loading ? "Analyzing..." : "Analyze item"}</button>
        </div>
      </form>
      <small>PC crossplay market · Prices are estimates, not guaranteed trades.</small>
    </section>
    {error && <section className="error" role="alert">{error}</section>}
    {!result && !error && <section className="empty"><p>Paste an item link to compare the live order book with up to 90 days of completed sales.</p></section>}
    {result && <Result result={result} />}
    </>}
  </main>;
}

function Result({ result }) {
  const verdictClass = result.verdict.label.toLowerCase().replaceAll(" ", "-");
  return <>
    <section className="item-heading">
      <div><p className="eyebrow">{result.context}</p><h1>{result.title}</h1></div>
      <button className="link-button" onClick={() => window.market.open(result.sourceUrl)}><Icon name="external"/>Open market</button>
    </section>
    <section className={`verdict ${verdictClass}`}>
      <p className="eyebrow">Decision</p><h2>{result.verdict.label}</h2><p>{result.verdict.reason}</p>
    </section>
    <Metrics history={result.history} market={result.market} buyTarget={result.buyTarget} />
    <MarketSnapshot market={result.market} />
    <SellAdvice sell={result.sell} />
    <SetSell setSell={result.setSell} />
    {result.components.length > 0 && <ComponentBreakdown components={result.components} totals={result.totals} setAsk={result.market.bestOnline} />}
    <footer>Updated {new Date(result.generatedAt).toLocaleTimeString()} · Offline last-seen data does not predict return time.</footer>
  </>;
}
