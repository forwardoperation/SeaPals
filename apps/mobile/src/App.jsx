import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allCards, cardsById, getCardImage } from "@/data/cards";
import { prebuiltDecks } from "@/data/decks/prebuiltDecks";
import { SIMULATOR_RESUME_STORAGE_KEY } from "@/app/simulator/simulatorResumeState.mjs";
import { SIMULATOR_V2_LESSONS, SIMULATOR_V2_LESSON_PROGRESS_KEY, parseSimulatorV2LessonProgress } from "@/app/simulator/simulatorV2Lessons.mjs";
import { CORE_RULES } from "@/lib/rulesAssistant.mjs";
import { COLLECTION_KEY, CARDS_PER_PACK, readCollection, grantPack, openPack, deviceRandom } from "./collection.mjs";

const Simulator = lazy(() => import("@/app/simulator/SimulatorV2Experience.jsx"));
const STARTER = prebuiltDecks.find((deck) => deck.id === "coral-garden");
const PACK_POOL = [...new Set(prebuiltDecks.flatMap((deck) => deck.cards.map(({ cardId }) => cardId)))].filter((id) => cardsById[id]);
const LESSONS = new Map(SIMULATOR_V2_LESSONS.map((lesson) => [lesson.id, lesson]));
const SETTINGS_KEY = "searealm.settings.v1";
const ROUTES = new Set(["home", "play", "learn", "collection", "settings", "rules"]);
function currentRoute() { const route = window.location.hash.slice(1); return ROUTES.has(route) ? route : "home"; }
function navigate(route) { window.location.hash = route; }

function Icon({ name, ...props }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7V5Z" />,
    learn: <><path d="M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3V5Z" /><path d="M12 7v14" /></>,
    collection: <><rect x="7" y="3" width="13" height="17" rx="2" /><path d="M4 7H2v15h13v-2M11 8h5M11 12h5" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="16" cy="17" r="3" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function CardArt({ id, className = "", ...props }) {
  const card = cardsById[id];
  return <img className={className} src={getCardImage(card)} alt={card?.name ?? "SeaRealm card"} draggable="false" {...props} />;
}

function Modal({ title, onClose, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`app-modal ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
    {children}
  </dialog>;
}

export default function App({ storage }) {
  const [route, setRoute] = useState(currentRoute);
  const [collection, setCollection] = useState(() => {
    let value = grantPack(readCollection(storage.getItem(COLLECTION_KEY), STARTER.cards), "welcome", "Welcome to SeaRealm");
    const progress = parseSimulatorV2LessonProgress(storage.getItem(SIMULATOR_V2_LESSON_PROGRESS_KEY));
    for (const id of progress.completedLessonIds) value = grantPack(value, `lesson:${id}`, LESSONS.get(id)?.title ?? "Lesson complete");
    return value;
  });
  const collectionRef = useRef(collection);
  const [settings, setSettings] = useState(() => {
    try {
      const value = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "{}");
      return { reducedMotion: value.reducedMotion === true || window.matchMedia("(prefers-reduced-motion: reduce)").matches, textSpeed: ["normal", "fast", "instant"].includes(value.textSpeed) ? value.textSpeed : "normal" };
    } catch { return { reducedMotion: false, textSpeed: "normal" }; }
  });
  const [saveError, setSaveError] = useState(storage.getError());
  const [message, setMessage] = useState("");
  const [revealed, setRevealed] = useState(null);
  const [inspected, setInspected] = useState(null);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const update = () => { setRoute(currentRoute()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => storage.subscribe(setSaveError), [storage]);
  useEffect(() => { storage.setItem(COLLECTION_KEY, JSON.stringify(collection)); }, [collection, storage]);
  useEffect(() => { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings, storage]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  }, [settings.reducedMotion]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5500);
    return () => clearTimeout(timer);
  }, [message]);

  const onLessonComplete = useCallback((id) => {
    const lesson = LESSONS.get(id);
    if (!lesson) return;
    const next = grantPack(collectionRef.current, `lesson:${id}`, lesson.title ?? "Lesson complete");
    if (next === collectionRef.current) return;
    collectionRef.current = next;
    storage.setItem(COLLECTION_KEY, JSON.stringify(next));
    setCollection(next);
    setMessage("Lesson complete! A discovery pack is waiting in your collection.");
  }, [storage]);
  const runtime = useMemo(() => ({
    storage,
    onHome: () => navigate("home"),
    onLessonComplete,
    accessibilitySettings: settings,
  }), [storage, onLessonComplete, settings]);

  async function revealPack(id) {
    if (opening) return;
    setOpening(true);
    try {
      const next = openPack(collectionRef.current, id, PACK_POOL, deviceRandom);
      collectionRef.current = next;
      storage.setItem(COLLECTION_KEY, JSON.stringify(next));
      setCollection(next);
      await storage.flush();
      setRevealed(next.packs[id]);
    } catch { setMessage("Your pack is kept safe. Please retry saving before opening it again."); }
    finally { setOpening(false); }
  }

  const unopened = Object.entries(collection.packs).filter(([, pack]) => !pack.cardIds);
  const latestPack = Object.values(collection.packs).filter((pack) => pack.cardIds).at(-1);
  const owned = allCards.filter((card) => collection.cards[card.id] > 0);
  const shown = owned.filter((card) => card.name.toLowerCase().includes(search.toLowerCase()));
  const progress = parseSimulatorV2LessonProgress(storage.getItem(SIMULATOR_V2_LESSON_PROGRESS_KEY));
  const hasMatch = Boolean(storage.getItem(SIMULATOR_RESUME_STORAGE_KEY));
  const playing = route === "play" || route === "learn";

  return <>
    {saveError ? <div className="save-alert" role="alert">Your latest progress hasn’t saved yet. Keep the app open. <button onClick={() => { void storage.flush().catch(() => {}); }}>Retry saving</button></div> : null}
    {message ? <div className="app-toast" role="status">{message}</div> : null}
    {playing ? <Suspense fallback={<div className="boot-message" role="status">Diving into SeaRealm…</div>}>
      <Simulator key={route} initialDeckId="coral-garden" initialTutorial={route === "learn"} onExitTutorial={runtime.onHome} appRuntime={runtime} />
    </Suspense> : <div className="mobile-app">
      <header className="app-header">
        <button className="brand-button" onClick={() => navigate("home")} aria-label="SeaRealm home"><img src="/images/brand/searealm-tcg-logo.png" alt="SeaRealm Trading Card Game" /></button>
        <button className="icon-button" onClick={() => navigate("settings")} aria-label="Settings"><Icon name="settings" /></button>
      </header>
      <main className="app-content">
        {route === "home" ? <>
          <section className="ocean-hero">
            <div className="hero-copy"><p className="eyebrow">An ocean of possibilities</p><h1>Build a reef.<br />Discover an ocean.</h1><p>Meet incredible creatures and bring your own ecosystem to life.</p>
              <button className="primary-button" onClick={() => navigate("play")}>{hasMatch ? "Continue playing" : "Let’s play"}<Icon name="arrow" /></button>
              <span className="hero-note">Play at your pace. Ready wherever you are.</span>
            </div>
            <div className="hero-cards" aria-hidden="true"><CardArt id="french-angelfish" className="hero-card card-left" alt="" /><CardArt id="manta-ray" className="hero-card card-middle" alt="" /><CardArt id="green-sea-turtle" className="hero-card card-right" alt="" /></div>
          </section>
          <div className="home-grid">
            <button className="feature-tile lesson-tile" onClick={() => navigate("learn")}><span className="tile-icon"><Icon name="learn" /></span><span><span className="eyebrow">One discovery at a time</span><strong>Learn with Mr. Easterling</strong><span>Short, hands-on lessons. A new pack for every lesson.</span><span className="lesson-meter"><span style={{ width: `${progress.completedLessonIds.length / SIMULATOR_V2_LESSONS.length * 100}%` }} /></span><small>{progress.completedLessonIds.length} of {SIMULATOR_V2_LESSONS.length} lessons complete</small></span><Icon name="arrow" /></button>
            <button className="feature-tile collection-tile" onClick={() => navigate("collection")}><span className="tile-icon"><Icon name="collection" /></span><span><span className="eyebrow">Your ocean discoveries</span><strong>{unopened.length ? `${unopened.length} ${unopened.length === 1 ? "pack" : "packs"} to open` : "Your collection is growing"}</strong><span>{owned.length} different cards collected</span><small>Your Coral Garden starter cards are already here.</small></span><Icon name="arrow" /></button>
          </div>
          <p className="quiet-note">Your progress stays on this device.</p>
        </> : null}
        {route === "collection" ? <>
          <div className="page-heading"><p className="eyebrow">Every creature has a story</p><h1>Your collection</h1><p>{owned.length} different cards · Practice decks are always available to play.</p></div>
          <section className="pack-shelf" aria-label="Discovery packs"><div><span className="pack-mark" aria-hidden="true">✦</span><h2>{unopened.length ? "A little ocean mystery awaits." : "Keep exploring."}</h2><p>{unopened.length ? `Each discovery pack holds ${CARDS_PER_PACK} cards, with a new discovery whenever possible.` : "Complete a new lesson to earn another discovery pack."}</p></div>
            {unopened.length ? <button className="primary-button" disabled={opening} onClick={() => revealPack(unopened[0][0])}>{opening ? "Opening…" : `Open a pack · ${unopened.length}`}<Icon name="arrow" /></button> : <button className="secondary-button" onClick={() => navigate("learn")}>Explore lessons</button>}
          </section>
          {latestPack ? <button className="text-button" onClick={() => setRevealed(latestPack)}>View your latest pack</button> : null}
          <label className="collection-search"><span>Find a card</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your creatures, corals, and more" /></label>
          <div className="collection-grid">{shown.map((card) => <button className="collection-card" key={card.id} onClick={() => setInspected(card.id)} aria-label={`Inspect ${card.name}, ${collection.cards[card.id]} owned`}><CardArt id={card.id} loading="lazy" /><span>{card.name}</span><small>×{collection.cards[card.id]}</small></button>)}</div>
          {!shown.length ? <p className="quiet-note">No cards match that search.</p> : null}
        </> : null}
        {route === "settings" ? <>
          <div className="page-heading"><p className="eyebrow">Make yourself at home</p><h1>Your preferences</h1></div>
          <section className="settings-panel"><label className="setting-row"><span><strong>Reduce motion</strong><small>Quieter celebrations and less movement.</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings({ ...settings, reducedMotion: event.target.checked })} /></label>
            <label className="setting-row"><span><strong>Reading speed</strong><small>How quickly lesson dialogue appears.</small></span><select value={settings.textSpeed} onChange={(event) => setSettings({ ...settings, textSpeed: event.target.value })}><option value="normal">Normal</option><option value="fast">Fast</option><option value="instant">Instant</option></select></label>
          </section>
          <section className="settings-panel"><h2>Playing on this device</h2><p>This version plays offline. Your matches, completed lessons, and collected cards are saved here. Removing the app removes its saves; collections don’t move between devices yet.</p><p>Discovery packs are free rewards. There are no purchases, ads, accounts, or online chat in this version. Gameplay and collection data aren’t sent to SeaRealm.</p><button className="secondary-button" onClick={() => navigate("rules")}>Read the rules</button><p className="version-label">SeaRealm · Preview 0.1.0</p></section>
        </> : null}
        {route === "rules" ? <>
          <div className="page-heading"><p className="eyebrow">A handy field guide</p><h1>How to play</h1><p>Build your ecosystem, collect Reef Points, and grow your Victory Points.</p><button className="primary-button" onClick={() => navigate("learn")}>Try a guided lesson<Icon name="arrow" /></button></div>
          <section className="rules-list">{CORE_RULES.map((rule, index) => <details key={`${rule.title}:${index}`}><summary>{rule.title}</summary><p>{rule.text}</p></details>)}</section>
        </> : null}
      </main>
      <nav className="app-tabs" aria-label="Main navigation"><button aria-current={route === "home" ? "page" : undefined} onClick={() => navigate("home")}><Icon name="play" /><span>Play</span></button><button onClick={() => navigate("learn")}><Icon name="learn" /><span>Learn</span></button><button aria-current={route === "collection" ? "page" : undefined} onClick={() => navigate("collection")}><Icon name="collection" /><span>Collection</span>{unopened.length ? <b>{unopened.length}</b> : null}</button></nav>
    </div>}
    {revealed ? <Modal title="Your discovery pack" className="pack-modal" onClose={() => setRevealed(null)}><p className="eyebrow">{revealed.label}</p><h2>Meet your new discoveries.</h2><p>These cards are now in your collection.</p><div className="pack-reveal-cards">{revealed.cardIds.map((id) => <div key={id}><CardArt id={id} /><strong>{cardsById[id]?.name}</strong></div>)}</div><button className="primary-button" onClick={() => setRevealed(null)}>Keep exploring<Icon name="arrow" /></button></Modal> : null}
    {inspected ? <Modal title={cardsById[inspected]?.name ?? "Card details"} className="card-modal" onClose={() => setInspected(null)}><CardArt id={inspected} /><h2>{cardsById[inspected]?.name}</h2><p>{cardsById[inspected]?.flavorText}</p><p>{collection.cards[inspected]} in your collection</p></Modal> : null}
  </>;
}
