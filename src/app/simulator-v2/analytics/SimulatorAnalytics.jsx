"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./SimulatorAnalytics.module.css";

const METRICS = [
  ["rpCollected", "RP collected", "Resources gained during play; starting RP is excluded."],
  ["ecoBoostGained", "Eco-boost capacity gained", "Increases in RP bank capacity from Eco Boost."],
  ["finalVp", "Final VP", "Victory points at the end of the game, including losses."],
  ["schoolDensityGained", "School density gained", "Increases in foundation School Density capacity."],
  ["stunsApplied", "Coral stun applications", "Stun effects applied to this side’s coral, including repeat applications."],
  ["coralDamage", "Coral HP damage", "Damage incurred by this side’s coral, in HP."],
  ["schoolDamage", "School HP damage", "Damage incurred by this side’s creature schools, in HP."],
];
const fmt = (value, digits = 1) => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
const pct = (value) => value == null ? "—" : `${fmt(value)}%`;
const label = (value) => String(value ?? "").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function downloadReport(data) {
  const rows = [["section", "item", "opponent_or_type", "count_or_wins", "games", "per_game_or_win_rate_pct", "share_pct", "coverage"]];
  for (const section of ["cards", "actions", "onPlay", "passives"]) {
    for (const row of data[section] ?? []) rows.push([section, section !== "cards" && row.cardName ? `${row.cardName}: ${row.name}` : row.name, row.type ?? "", row.count, row.eligibleGames, row.perGame, row.sharePct, data.coverage?.[section] ?? ""]);
  }
  for (const section of ["actions", "onPlay", "passives"]) {
    for (const row of data.abilityTotals?.[section] ?? []) rows.push([`${section}_combined`, row.name, "all source cards", row.count, row.eligibleGames, row.perGame, row.sharePct, data.coverage?.[section] ?? ""]);
  }
  for (const row of data.decks ?? []) {
    rows.push(["decks", row.name, "", row.wins, row.games, row.winRate, "", ""]);
    for (const [key, name] of METRICS) {
      const metric = row.metrics?.[key];
      rows.push(["deck_metrics", row.name, name, metric?.total, metric?.sampleSize, metric?.average, "", metric?.coverage]);
    }
  }
  for (const row of data.matchups ?? []) rows.push(["matchups", row.deckName, row.opponentDeckName, row.wins, row.games, row.winRate, "", ""]);
  for (const [key, name] of METRICS) {
    const metric = data.summary?.metrics?.[key];
    rows.push(["metrics", name, "", metric?.total, metric?.sampleSize, metric?.average, "", metric?.coverage]);
  }
  for (const [key, value] of Object.entries(data.filters ?? {})) rows.push(["filter", key, value]);
  rows.push(["summary", "Matches", "", data.summary?.games]);
  rows.push(["summary", "VP lead changes per match", "", "", data.summary?.games, data.summary?.vpLeadChanges]);
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `seapals-v2-${data.filters?.cohort ?? "human"}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SectionTitle({ eyebrow, title, description }) {
  return <div className={styles.sectionTitle}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function Metric({ name, value, detail, accent = false }) {
  return <article className={`${styles.metric} ${accent ? styles.accentMetric : ""}`}><p>{name}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function CoverageNote({ coverage }) {
  if (!coverage || coverage === "complete") return null;
  return <p className={styles.coverage}>{coverage === "unavailable" ? "Tracking is not available for this metric in these games. A dash means unknown, not zero." : "Partial tracking: these are observed events, which may undercount actual use. Games without tracking are excluded from the average."}</p>;
}

function Rankings({ title, description, rows: sourceRows = [], totals, coverage, id, cards = false }) {
  const [grouping, setGrouping] = useState("ability");
  const rows = totals && grouping === "ability" ? totals : sourceRows;
  const [order, setOrder] = useState("most");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const types = [...new Set(rows.map((row) => row.category ?? row.type).filter(Boolean))];
  const filtered = useMemo(() => rows
    .filter((row) => type === "all" || (row.category ?? row.type) === type)
    .filter((row) => `${row.name} ${row.cardName ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (order === "most" ? b.count - a.count : a.count - b.count) || a.name.localeCompare(b.name)), [rows, order, query, type]);
  const visible = showAll ? filtered : filtered.slice(0, 10);
  return <section id={id} className={styles.panel}>
    <div className={styles.rankHeader}><div><h3>{title}</h3><p>{description}</p></div><label className={styles.inlineLabel}>Rank by<select aria-label={`${title} ranking`} value={order} onChange={(event) => setOrder(event.target.value)}><option value="most">Most used</option><option value="least">Least used</option></select></label></div>
    <CoverageNote coverage={coverage} />
    {totals && <div className={styles.grouping} role="group" aria-label={`${title} grouping`}><button type="button" aria-pressed={grouping === "ability"} onClick={() => setGrouping("ability")}>Combined abilities</button><button type="button" aria-pressed={grouping === "card"} onClick={() => setGrouping("card")}>By source card</button></div>}
    <div className={styles.rankTools}><label className={styles.search}><span className={styles.srOnly}>Search {title.toLowerCase()}</span><input type="search" placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>{cards && <label className={styles.inlineLabel}>Card type<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option>{types.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>}<span className={styles.rowCount}>{filtered.length} entries</span></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${title} statistics`}><table><thead><tr><th scope="col">{cards ? "Card" : "Ability / action"}</th><th scope="col">Uses</th><th scope="col">Per game</th><th scope="col">Share</th><th scope="col" title="Games with a source card in the selected side’s deck or a recorded use">Deck games</th><th scope="col" title="Uses divided by games with an eligible source card or recorded use">Per deck game</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><th scope="row"><span>{row.name}</span><small>{cards ? label(row.category ?? row.type) : row.cardName ?? "All source cards"}</small></th><td>{fmt(row.count, 0)}</td><td>{fmt(row.perGame, 2)}</td><td>{pct(row.sharePct)}</td><td>{fmt(row.eligibleGames, 0)}</td><td>{fmt(row.perEligibleGame, 2)}</td></tr>)}</tbody></table></div>
    {!visible.length && <p className={styles.emptyInline}>{coverage === "unavailable" ? "No recorded events available." : "No entries match these filters."}</p>}
    {filtered.length > 10 && <button type="button" className={styles.textButton} onClick={() => setShowAll(!showAll)}>{showAll ? "Show top 10" : `Show all ${filtered.length} entries`}</button>}
  </section>;
}

export default function SimulatorAnalytics() {
  const [cohort, setCohort] = useState("human");
  const [difficulty, setDifficulty] = useState("all");
  const [deck, setDeck] = useState("all");
  const [period, setPeriod] = useState("30d");
  const [refresh, setRefresh] = useState(0);
  const [distributionGroup, setDistributionGroup] = useState("types");
  const [data, setData] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    async function load() {
      try {
        const response = await fetch(`/api/simulator/analytics?${new URLSearchParams({ cohort, difficulty, deck, period })}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || result.available === false) throw new Error(result.error ?? "Analytics are temporarily unavailable.");
        if (!controller.signal.aborted) {
          setData(result);
          setOptions(result.options?.decks ?? []);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message === "Failed to fetch" ? "Could not connect to analytics. Please try again." : failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [cohort, difficulty, deck, period, refresh]);

  const summary = data?.summary;
  const hasGames = Boolean(summary?.games);
  const sideName = cohort === "human" ? "human" : "AI";
  const supportCards = data?.cards?.filter((card) => card.type === "support") ?? [];
  const habitatCards = data?.cards?.filter((card) => card.type === "habitat") ?? [];
  const opponentDecks = [...new Map((data?.matchups ?? []).map((row) => [row.opponentDeckId, row.opponentDeckName])).entries()];

  return <main className={styles.dashboard}>
    <header className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.badge}><span />Public · Anonymous · Simulator V2</span><Link href="/simulator-v2">Play a match <span aria-hidden="true">↗</span></Link></div>
      <p className={styles.heroEyebrow}>The data beneath the surface</p><h1>Simulator analytics</h1><p className={styles.heroDescription}>Explore how decks compete, which cards shape a game, and where the balance shifts. Every insight starts with actual play.</p>
      <div className={styles.heroFoot}><span>Human decisions. AI strategies. One shared view of the game.</span><a href="#methodology">How we measure <span aria-hidden="true">↓</span></a></div>
    </header>

    <section className={styles.controls} aria-label="Analytics filters">
      <div className={styles.controlTop}><div className={styles.tabs} role="group" aria-label="Player statistics"><button type="button" aria-pressed={cohort === "human"} onClick={() => setCohort("human")}>Human statistics</button><button type="button" aria-pressed={cohort === "ai"} onClick={() => setCohort("ai")}>AI statistics</button></div><button type="button" className={styles.exportButton} disabled={!hasGames || loading} onClick={() => downloadReport(data)}>Export CSV <span aria-hidden="true">↓</span></button></div>
      <div className={styles.filters}><label>{cohort === "ai" ? "AI difficulty" : "Opponent difficulty"}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>{cohort === "ai" ? "AI deck" : "Human deck"}<select value={deck} onChange={(event) => setDeck(event.target.value)}><option value="all">All decks</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Completed in<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select></label><button type="button" className={styles.refreshButton} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</button></div>
      <p className={styles.filterNote}>Showing the {sideName} side of completed v2 matches. Each match contributes one {sideName} performance. Tutorials and adventure games are excluded.</p>
    </section>

    <div aria-live="polite" aria-busy={loading}>
      {loading && <div className={styles.loading}>Reading the currents… <span>Loading simulator statistics</span></div>}
      {error && <section className={styles.emptyState} role="alert"><span className={styles.emptyIcon} aria-hidden="true">≈</span><h2>Analytics are not available yet</h2><p>{error}</p><p>Once collection is connected, completed Simulator V2 matches will appear here.</p><button type="button" className={styles.primaryButton} onClick={() => setRefresh((value) => value + 1)}>Try again</button></section>}
      {data && !hasGames && <section className={styles.emptyState}><span className={styles.emptyIcon} aria-hidden="true">≈</span><p className={styles.eyebrow}>A new ocean of data</p><h2>No completed matches in this view</h2><p>Try another deck, difficulty, or date range. New v2 matches will build this report as players finish games.</p><Link className={styles.primaryButton} href="/simulator-v2">Play Simulator V2 <span aria-hidden="true">↗</span></Link></section>}
    </div>

    {hasGames && <>
      <nav className={styles.sectionNav} aria-label="Report sections"><a href="#overview">Overview</a><a href="#cards">Cards</a><a href="#decks">Decks & matchups</a><a href="#economy">Resources & status</a><a href="#abilities">Actions & abilities</a></nav>
      <section id="overview"><SectionTitle eyebrow="01 / At a glance" title={`${cohort === "human" ? "Human" : "AI"} performance`} description={`${fmt(summary.games, 0)} completed matches in the selected sample. Win rate includes every sampled game.`} /><div className={styles.metricGrid}><Metric name="Completed matches" value={fmt(summary.games, 0)} detail={`${fmt(summary.wins, 0)} wins · ${fmt(summary.losses, 0)} losses · ${fmt(summary.draws, 0)} draws`} /><Metric name={`${cohort === "human" ? "Human" : "AI"} win rate`} value={pct(summary.winRate)} detail="Wins ÷ completed games" accent /><Metric name="Average game length" value={`${fmt(summary.avgRounds)} rounds`} detail={`${fmt(summary.avgDurationMinutes)} minutes elapsed on average`} /><Metric name="VP lead changes" value={fmt(summary.vpLeadChanges, 2)} detail={`Per match · first lead and ties excluded${data.coverage?.vpLeadChanges === "partial" ? " · partial tracking" : ""}`} /></div>{summary.games < 30 && <p className={styles.sampleNote}>Early sample: fewer than 30 games. Treat these results as observations, not a reliable ranking of deck strength.</p>}{data.dataWindow?.truncated && <p className={styles.sampleNote}>This report reached its data limit and covers the newest {fmt(data.dataWindow.reportCount ?? summary.games, 0)} matching games. Narrow the date range for a more focused comparison.</p>}</section>

      <section id="cards"><SectionTitle eyebrow="02 / What gets played" title="Card usage" description="Per-game averages include games with zero uses. Deck-game averages count games whose deck contained that card or which recorded a use. Share is a percentage of recorded plays." />
        <div className={styles.panel}><h3>Distribution by card type</h3><div className={styles.grouping} role="group" aria-label="Distribution grouping"><button type="button" aria-pressed={distributionGroup === "types"} onClick={() => setDistributionGroup("types")}>Card kinds</button><button type="button" aria-pressed={distributionGroup === "categories"} onClick={() => setDistributionGroup("categories")}>Creature classes & foundations</button></div><div className={styles.distribution}>{data[distributionGroup]?.filter((row) => row.count > 0).map((row, index) => <div key={row.type} className={styles.distributionRow}><div><strong>{label(row.type)}</strong><span>{fmt(row.count, 0)} plays · {fmt(row.perGame, 2)} / game</span></div><div className={styles.barTrack}><div className={styles.bar} style={{ width: `${Math.min(100, row.sharePct)}%`, "--bar-color": ["#007d8a", "#359f83", "#416bc0", "#a88737", "#8e73b4", "#47798c", "#c7775c"][index % 7] }} /></div><strong>{pct(row.sharePct)}</strong>{row.topCard && <p>Most played: <b>{row.topCard.name}</b> · {fmt(row.topCard.perGame, 2)} / game · {pct(row.topCard.shareOfTypePct)} of this type</p>}</div>)}</div></div>
        <Rankings id="card-rankings" title="All cards" cards rows={data.cards} coverage={data.coverage?.cards} description="Switch to least used to surface overlooked cards, including zero-play cards from sampled decks. Shares remain relative to all card plays when searching or filtering types." />
        <Rankings title="Support cards" rows={supportCards} cards coverage={data.coverage?.cards} description="Support plays and average copies used per game." />
        <Rankings title="Habitat cards" rows={habitatCards} cards coverage={data.coverage?.cards} description="Habitat plays across the selected decks." />
      </section>

      <section id="decks"><SectionTitle eyebrow="03 / The matchup" title="Deck performance" description="Compare overall wins and head-to-head results. These are observed outcomes against human or AI opponents, not controlled balance experiments." /><div className={styles.panel}><div className={styles.tableScroll} role="region" aria-label="Deck win rates" tabIndex={0}><table><thead><tr><th scope="col">Deck</th><th scope="col">Games</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Draws</th><th scope="col">Win rate</th></tr></thead><tbody>{data.decks?.map((row) => <tr key={row.id}><th scope="row">{row.name}</th><td>{fmt(row.games, 0)}</td><td>{fmt(row.wins, 0)}</td><td>{fmt(row.losses, 0)}</td><td>{fmt(row.draws, 0)}</td><td><span className={styles.winRate}>{pct(row.winRate)}</span></td></tr>)}</tbody></table></div></div>
        <div className={styles.panel}><h3>Head-to-head win rates</h3><p className={styles.panelDescription}>Rows are the selected {sideName} deck; columns are the opposing deck. Each cell includes wins and games.</p><div className={styles.tableScroll} role="region" aria-label="Deck matchup matrix" tabIndex={0}><table className={styles.matrix}><thead><tr><th scope="col">{cohort === "human" ? "Human" : "AI"} deck ↓ / Opponent →</th>{opponentDecks.map(([id, name]) => <th scope="col" key={id}>{name}</th>)}</tr></thead><tbody>{data.decks?.map((row) => <tr key={row.id}><th scope="row">{row.name}</th>{opponentDecks.map(([id]) => { const cell = data.matchups?.find((matchup) => matchup.deckId === row.id && matchup.opponentDeckId === id); return <td key={id}>{cell ? <div className={styles.matrixCell} style={{ backgroundColor: `rgba(0, 125, 138, ${0.04 + (cell.winRate ?? 0) / 600})` }}><strong>{pct(cell.winRate)}</strong><small>{cell.wins} / {cell.games} won</small></div> : <span title="No games for this matchup">—</span>}</td>; })}</tr>)}</tbody></table></div></div>
      </section>

      <section id="economy"><SectionTitle eyebrow="04 / Inside the ecosystem" title="Resources, scoring & status" description={`Averages for the ${sideName} side of a game. Each metric shows how many games supplied tracking.`} /><div className={styles.resourceGrid}>{METRICS.map(([key, name, description]) => { const metric = summary.metrics?.[key]; return <article className={styles.resourceCard} key={key}><p>{name}</p><strong>{fmt(metric?.average, 2)}<small> / game</small></strong><p className={styles.resourceDescription}>{description}</p><span>{fmt(metric?.sampleSize ?? 0, 0)} tracked games{metric?.coverage === "partial" ? " · partial" : ""}</span><CoverageNote coverage={metric?.coverage} /></article>; })}</div><div className={styles.panel}><h3>Breakdown by deck</h3><p className={styles.panelDescription}>Values are per-game averages. Parentheses show the number of tracked games; * marks partial coverage.</p><div className={styles.tableScroll} role="region" aria-label="Resources and status by deck" tabIndex={0}><table><thead><tr><th scope="col">Deck</th>{METRICS.map(([key, name]) => <th scope="col" key={key}>{name}</th>)}</tr></thead><tbody>{data.decks?.map((row) => <tr key={row.id}><th scope="row">{row.name}</th>{METRICS.map(([key]) => { const metric = row.metrics?.[key]; return <td key={key}>{fmt(metric?.average, 2)}{metric?.average != null && <small>({fmt(metric.sampleSize, 0)}){metric.coverage === "partial" ? " *" : ""}</small>}</td>; })}</tr>)}</tbody></table></div></div></section>

      <section id="abilities"><SectionTitle eyebrow="05 / Decisions & effects" title="Actions and abilities" description="Rank actual recorded uses. An on-play resolution, an activated action, and a passive trigger are separate events." /><Rankings title="Actions" rows={data.actions} totals={data.abilityTotals?.actions} coverage={data.coverage?.actions} description="Activated actions, including attacks, by the card and action name." /><Rankings title="On-play abilities" rows={data.onPlay} totals={data.abilityTotals?.onPlay} coverage={data.coverage?.onPlay} description="Recorded ability resolutions when a card enters play." /><Rankings title="Passive abilities" rows={data.passives} totals={data.abilityTotals?.passives} coverage={data.coverage?.passives} description="Recorded passive triggers. Continuous bonuses do not have a discrete use count." /></section>
    </>}

    <section id="methodology" className={styles.methodology}><p className={styles.eyebrow}>Read the numbers well</p><h2>What this report measures</h2><div className={styles.methodGrid}><div><h3>A match is the unit</h3><p>Only completed, instrumented Simulator V2 matches contribute. Human and AI tabs report opposite sides of those matches. Difficulty always describes the AI opponent. Abandoned games, tutorials, adventure games, and original simulator games are excluded.</p></div><div><h3>Zero and unknown are different</h3><p>Least-used rankings include unused cards only when they were in a sampled deck. A dash means the metric was not measured. Partial coverage counts observed events and can understate actual activity.</p></div><div><h3>Outcomes need context</h3><p>Deck choice, difficulty, player experience, and sample size all affect win rates. Per-game counts include zero-use games. VP lead changes count switches between outright leaders; the first lead and ties do not add changes.</p></div><div><h3>Anonymous, combined results</h3><p>Reports contain game counters and deck IDs. They do not include names, account identifiers, chat, or replay logs. The public page and CSV expose combined statistics. Results are reported by the browser and are not a competitive leaderboard.</p></div></div>{data?.methodology?.length > 0 && <details><summary>Additional measurement details</summary><ul>{data.methodology.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}<Link href="/simulator-v2">Return to Simulator V2 <span aria-hidden="true">↗</span></Link></section>
  </main>;
}
