"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdventureLayeredMapObject, AdventurePlayerSprite, AdventureTrainerSprite,
  DirectionButton, mapThemeClassForScene,
} from "../../adventure/AdventureGame";
import AdventurePerspectiveGround, { useAdventureGraphics, useAdventureViewport } from "../../adventure/AdventurePerspective";
import {
  createAdventureFrameGate, createAdventurePerspective, getPerspectiveObjectRect,
  isPerspectiveActorVisible, isPerspectiveRectVisible,
} from "../../adventure/adventurePerspective.mjs";
import { getAdventureCameraLayout } from "../../adventure/adventureCamera.mjs";
import { SCENES, movePlayerContinuous, getDoorwayTransition, getContinuousInteraction } from "../../adventure/adventureWorld.mjs";
import { ADVENTURE_CONTENT } from "../../adventure/adventureContent.mjs";
import styles from "../../adventure/adventure.module.css";
import qa from "./preview.module.css";

const PRESETS = {
  "Home street": { sceneId: "town", x: 4.2, y: 5.6 },
  "Town square": { sceneId: "town", x: 20, y: 6 },
  Waterfront: { sceneId: "town", x: 20.5, y: 16.45 },
  Aquarium: { sceneId: "town", x: 27.6, y: 23.72 },
  Bedroom: { sceneId: "player-bedroom", x: 5, y: 4 },
  Home: { sceneId: "player-home", x: 7, y: 6 },
  Sunpatch: { sceneId: "sunpatch-cay-town", ...SCENES["sunpatch-cay-town"].spawn },
};
const VECTORS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
const NPCS = Object.fromEntries(ADVENTURE_CONTENT.npcs.map((npc) => [npc.id, npc]));

export default function ReefboundPreview({ embedded }) {
  const [phone, setPhone] = useState(false);
  const [location, setLocation] = useState(PRESETS.Waterfront);
  const [facing, setFacing] = useState("down");
  const [direction, setDirection] = useState(null);
  const [preference, setPreference] = useState("auto");
  const { mode, worldFrameRate, batterySaver } = useAdventureGraphics(preference);
  const [benchmark, setBenchmark] = useState(false);
  const [stats, setStats] = useState("");
  const [mapRef, viewport] = useAdventureViewport();
  const locationRef = useRef(location);
  const touchStartedAt = useRef(0);
  const touchReleaseTimer = useRef(null);
  locationRef.current = location;
  const scene = SCENES[location.sceneId];
  const camera = mode !== "classic"
    ? createAdventurePerspective(scene, { x: location.x + 0.5, y: location.y + 0.5 }, viewport)
    : null;
  const renderScene = camera ? { ...scene, projection: camera } : scene;
  const flatCamera = getAdventureCameraLayout({ worldWidth: scene.width, worldHeight: scene.height, playerX: location.x + 0.5, playerY: location.y + 0.5 });
  const themeClass = mapThemeClassForScene(scene);
  const objects = scene.layeredObjects.filter((object) => !camera || isPerspectiveRectVisible(getPerspectiveObjectRect(object, camera), camera));
  const characters = scene.interactions.filter((interaction) => NPCS[interaction.npcId ?? interaction.trainerId]
    && (!camera || isPerspectiveActorVisible(interaction.at, camera)));
  const interaction = getContinuousInteraction(scene.id, location, facing);

  function beginTouchDirection(value) {
    clearTimeout(touchReleaseTimer.current);
    touchStartedAt.current = performance.now();
    setDirection(value);
  }
  function endTouchDirection(value) {
    // Match the game's short-tap grace period, including the next animation frame.
    const delay = Math.max(0, 60 - (performance.now() - touchStartedAt.current));
    clearTimeout(touchReleaseTimer.current);
    touchReleaseTimer.current = setTimeout(() => {
      setDirection((current) => current === value ? null : current);
    }, delay);
  }

  useEffect(() => {
    const down = (event) => {
      if (["SELECT", "INPUT", "BUTTON"].includes(event.target.tagName)) return;
      if (KEYS[event.key]) { event.preventDefault(); setDirection(KEYS[event.key]); }
    };
    const up = (event) => { if (KEYS[event.key]) setDirection(null); };
    const stop = () => setDirection(null);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    return () => {
      clearTimeout(touchReleaseTimer.current);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
    };
  }, []);

  useEffect(() => {
    if (!direction && !benchmark) return undefined;
    let frame;
    let start = null;
    let renderedFrames = 0;
    const gate = createAdventureFrameGate(worldFrameRate, 50);
    const tick = (timestamp) => {
      start ??= timestamp;
      const elapsed = gate(timestamp);
      if (elapsed) {
        const heading = benchmark ? (Math.floor((timestamp - start) / 1000) % 2 ? "left" : "right") : direction;
        const current = locationRef.current;
        const next = movePlayerContinuous(current.sceneId, current, VECTORS[heading], elapsed, { ignoreActorTiles: true });
        const doorway = getDoorwayTransition(current.sceneId, next, heading);
        locationRef.current = doorway
          ? { sceneId: doorway.targetScene, ...doorway.spawn }
          : { sceneId: current.sceneId, ...next };
        setLocation(locationRef.current);
        setFacing(doorway?.facing ?? heading);
        renderedFrames++;
      }
      if (benchmark && timestamp - start >= 5000) {
        setStats(`${(renderedFrames * 1000 / (timestamp - start)).toFixed(1)} updates/s over 5 seconds · ${Math.round(viewport.width)} × ${Math.round(viewport.height)}`);
        setBenchmark(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [direction, benchmark, worldFrameRate, viewport.width, viewport.height]);

  return (
    <main className={`${qa.shell} ${batterySaver ? styles.batterySaverMode : ""}`}>
      <header className={qa.header}>
        <div><small>LOCAL VISUAL PREVIEW</small><h1>Reefbound</h1></div>
        {!embedded ? <button onClick={() => { setPhone(!phone); setDirection(null); }}> {phone ? "Desktop view" : "Phone view"}</button> : null}
      </header>
      {!embedded ? <p>This is a viewer demo. <a href="/dev/reefbound/play">Play the full game without email sign-in</a>, or <a href="/adventure">continue with your family account</a>.</p> : null}
      {phone && !embedded ? (
        <iframe className={qa.phone} title="Reefbound phone viewport" src="/dev/reefbound?embedded=1" />
      ) : (
        <>
          <div className={qa.toolbar}>
            <label>Location <select onChange={(event) => { setLocation(PRESETS[event.target.value]); setDirection(null); }} defaultValue="Waterfront">
              {Object.keys(PRESETS).map((label) => <option key={label}>{label}</option>)}
            </select></label>
            <label>World view <select value={preference} onChange={(event) => setPreference(event.target.value)}>
              <option value="auto">Automatic ({batterySaver ? "battery saver" : "full quality"})</option>
              <option value="perspective">3D perspective</option><option value="battery">Battery saver</option><option value="classic">Classic overhead</option>
            </select></label>
          </div>
          <div className={qa.stage}>
            <div className={qa.location}><strong>{scene.name}</strong><span>{location.x.toFixed(2)}, {location.y.toFixed(2)} · {objects.length} objects · {characters.length} residents</span></div>
            <div ref={mapRef} className={`${styles.map} ${camera ? styles.perspectiveMap : ""}`} role="application" aria-label="Reefbound preview. Use arrow keys or touch controls to explore." tabIndex={0}>
              <div className={`${styles.mapWorld} ${camera ? styles.perspectiveWorld : themeClass}`} style={camera ? undefined : {
                width: `${flatCamera.worldWidthPercent}%`, height: `${flatCamera.worldHeightPercent}%`, left: `${flatCamera.leftPercent}%`, top: `${flatCamera.topPercent}%`, backgroundImage: scene.artPath ? `url("${scene.artPath}")` : undefined,
              }}>
                {camera ? <AdventurePerspectiveGround scene={scene} camera={camera} themeClass={themeClass} /> : null}
                {objects.map((object) => <AdventureLayeredMapObject key={object.id} object={object} scene={renderScene} />)}
                {characters.map((npc) => <AdventureTrainerSprite key={npc.id} trainer={NPCS[npc.npcId ?? npc.trainerId]} position={npc.at} facing={npc.facing ?? "down"} scene={renderScene} markersEnabled={false} />)}
                <AdventurePlayerSprite position={location} facing={facing} moving={Boolean(direction || benchmark)} walkSpeed={scene.movement.speed} scene={renderScene} interaction={interaction} />
              </div>
            </div>
            <div className={styles.controlDock}>
              <div className={styles.dpad}>
                {Object.keys(VECTORS).map((value) => <DirectionButton key={value} direction={value}
                  onStart={beginTouchDirection} onStop={endTouchDirection} />)}
                <span className={styles.dpadCenter} aria-hidden="true" />
              </div>
              <span className={qa.hint}>{interaction ? `${interaction.type} within reach` : "Walk into doorways to explore."}</span>
            </div>
          </div>
          <footer className={qa.footer}>
            <button disabled={benchmark} onClick={() => { setStats(""); setBenchmark(true); }}> {benchmark ? "Measuring…" : "Run 5-second movement check"}</button>
            <output>{stats}</output>
            <p>Uses the game’s renderer, collision, doorways, and sprite animation. This local preview does not access account saves.</p>
          </footer>
        </>
      )}
    </main>
  );
}
