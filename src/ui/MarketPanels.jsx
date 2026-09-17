const price = (value) => value == null ? "—" : `${Math.round(value)}p`;

export function Metrics({ history, market }) {
  const cheap = history && Math.min(history.fair * .85, history.low);
  return <section className="metrics">
    <Metric label="Fair price" value={history ? `~${price(history.fair)}` : "Unavailable"} detail={history ? `${history.volume.toLocaleString()} completed sales` : "No sale history"} />
    <Metric label="Typical range" value={history ? `${price(history.low)} – ${price(history.high)}` : "—"} detail={history ? `${history.days} daily observations` : ""} />
    <Metric label="Cheap target" value={history ? `≤ ${price(cheap)}` : "—"} detail="A patient-buy goal" />
    <Metric label="Best online ask" value={price(market.bestOnline)} detail={`${market.onlineCount} online sellers`} />
  </section>;
}

function Metric({ label, value, detail }) {
  return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

export function MarketSnapshot({ market }) {
  return <section className="panel"><div className="panel-title"><div><p className="eyebrow">Live order book</p><h2>What is available now</h2></div><span className="count">{market.visibleCount} visible sellers</span></div>
    <div className="order-grid"><div><p className="label">Best online asks</p><p className="ask-list">{market.onlineAsks.length ? market.onlineAsks.map(price).join(" · ") : "No online sellers"}</p></div><div><p className="label">Lower offline option</p><p className="ask-list">{market.offline ? `${price(market.offline.price)} · last seen ${market.offline.lastSeen}` : "None found"}</p></div></div>
  </section>;
}

export function ComponentBreakdown({ components, totals, setAsk }) {
  return <section className="panel"><div className="panel-title"><div><p className="eyebrow">Set optimization</p><h2>Buy components separately</h2></div><span className="count">{components.length} distinct parts</span></div>
    <div className="component-list">{components.map((item) => <article className="component" key={item.name}><div className="component-name"><strong>{item.name}</strong><span>×{item.quantity}</span></div><div><p className="label">Online / fair / cheap</p><p>{price(item.now)} / {item.history ? `~${price(item.history.fair)} / ≤ ${price(Math.min(item.history.fair * .85, item.history.low))}` : "history unavailable"}</p></div><div><p className="label">Advice</p><p>{item.verdict.label}</p>{item.offline && <span className="muted">Offline: {price(item.offline.price)}, {item.offline.lastSeen}</span>}</div></article>)}</div>
    <div className="totals"><Metric label="Components now" value={price(totals.now)} detail="Lowest online asks" /><Metric label="Components fair" value={totals.fair == null ? "—" : `~${price(totals.fair)}`} detail="Historical component value" /><Metric label="Set vs. parts" value={setAsk != null && totals.now != null ? `${price(Math.abs(setAsk - totals.now))} ${setAsk < totals.now ? "set cheaper" : "parts cheaper"}` : "—"} detail="Current online comparison" /></div>
  </section>;
}
