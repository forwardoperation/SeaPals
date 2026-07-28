"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./companion.module.css";

const PLAYER_COLORS = ["#22d3ee", "#f6c84c", "#f472b6", "#a78bfa"];
const DICE = [4, 6, 8, 10, 12, 20];

function clamp(value, max) {
  return Math.max(0, Math.min(max, value));
}

function MetricTracker({ player, label, shortLabel, value, max, step, onChange }) {
  return (
    <div className={styles.metricTracker}>
      <div className={styles.metricLabel}>
        <span>{label}</span>
        <small>{shortLabel}</small>
      </div>
      <output className={styles.score} aria-live="polite">{value}</output>
      <button className={styles.stepButton} type="button" onClick={() => onChange(clamp(value + step, max))} aria-label={`Add ${step} ${label} for Player ${player + 1}`}>
        <span aria-hidden="true">+</span>
      </button>
      <div className={styles.railWrap}>
        <input
          className={styles.slider}
          type="range"
          min="0"
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={`Player ${player + 1} ${label}`}
          style={{ "--fill": `${(value / max) * 100}%` }}
        />
      </div>
      <button className={styles.stepButton} type="button" onClick={() => onChange(clamp(value - step, max))} aria-label={`Subtract ${step} ${label} for Player ${player + 1}`}>
        <span aria-hidden="true">−</span>
      </button>
    </div>
  );
}

function PlayerTracker({ player, scores, vpTarget, onChange }) {
  const color = PLAYER_COLORS[player];

  return (
    <article className={styles.playerCard} style={{ "--player-color": color }}>
      <div className={styles.playerLabel}>
        <span className={styles.playerDot} aria-hidden="true" />
        Player {player + 1}
      </div>
      <div className={styles.metricGrid}>
        <MetricTracker
          player={player}
          label="Victory Points"
          shortLabel={`of ${vpTarget}`}
          value={scores.vp[player]}
          max={vpTarget}
          step={1}
          onChange={(value) => onChange("vp", value)}
        />
        <MetricTracker
          player={player}
          label="School Density"
          shortLabel="of 500"
          value={scores.density[player]}
          max={500}
          step={10}
          onChange={(value) => onChange("density", value)}
        />
        <MetricTracker
          player={player}
          label="Resource Points"
          shortLabel="of 30"
          value={scores.rp[player]}
          max={30}
          step={1}
          onChange={(value) => onChange("rp", value)}
        />
      </div>
    </article>
  );
}

function Die({ sides, rollingDie, result, onRoll }) {
  const rolling = rollingDie === sides;
  return (
    <button
      type="button"
      className={`${styles.dieButton} ${rolling ? styles.rolling : ""}`}
      onClick={() => onRoll(sides)}
      aria-label={`Roll a D${sides}`}
      disabled={rolling}
    >
      <span className={styles.dieShape} aria-hidden="true">
        <span className={styles.dieResult}>{result ?? sides}</span>
      </span>
      <span className={styles.dieName}>D{sides}</span>
    </button>
  );
}

export default function Companion() {
  const [playerCount, setPlayerCount] = useState(1);
  const [scores, setScores] = useState({
    vp: [0, 0, 0, 0],
    density: [0, 0, 0, 0],
    rp: [0, 0, 0, 0],
  });
  const [vpTarget, setVpTarget] = useState(30);
  const [results, setResults] = useState({});
  const [rollingDie, setRollingDie] = useState(null);
  const rollTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(rollTimer.current), []);

  const setPlayerScore = (player, metric, nextValue) => {
    setScores((current) => {
      const nextMetricScores = [...current[metric]];
      nextMetricScores[player] = nextValue;
      return { ...current, [metric]: nextMetricScores };
    });
  };

  const roll = (sides) => {
    window.clearTimeout(rollTimer.current);
    setRollingDie(sides);
    let flashes = 0;
    const shuffle = window.setInterval(() => {
      flashes += 1;
      setResults((current) => ({ ...current, [sides]: Math.floor(Math.random() * sides) + 1 }));
      if (flashes >= 7) window.clearInterval(shuffle);
    }, 65);
    rollTimer.current = window.setTimeout(() => {
      window.clearInterval(shuffle);
      setResults((current) => ({ ...current, [sides]: Math.floor(Math.random() * sides) + 1 }));
      setRollingDie(null);
    }, 540);
  };

  const resetAll = () => setScores({
    vp: [0, 0, 0, 0],
    density: [0, 0, 0, 0],
    rp: [0, 0, 0, 0],
  });

  return (
    <main className={styles.shell}>
      <div className={styles.bubbles} aria-hidden="true" />
      <section className={styles.hero}>
        <div className={styles.playerPicker} aria-label="Number of players">
          <span>Players</span>
          <div>
            {[1, 2, 3, 4].map((count) => (
              <button key={count} type="button" className={playerCount === count ? styles.selected : ""} onClick={() => setPlayerCount(count)} aria-pressed={playerCount === count}>
                {count}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="tracker-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionKicker}>LIVE TRACKER</p>
            <h2 id="tracker-title">Points &amp; School Density</h2>
          </div>
        </div>

        <div className={styles.trackerMeta}>
          <div className={styles.targetSwitch} aria-label="Victory point target">
            <span>Game to</span>
            {[10, 30].map((target) => (
              <button key={target} type="button" onClick={() => setVpTarget(target)} className={vpTarget === target ? styles.targetSelected : ""} aria-pressed={vpTarget === target}>{target} VP</button>
            ))}
          </div>
          <button type="button" className={styles.resetButton} onClick={resetAll}>Reset all</button>
        </div>

        <div className={styles.trackers} style={{ "--players": playerCount }}>
          {Array.from({ length: playerCount }, (_, player) => (
            <PlayerTracker
              key={player}
              player={player}
              scores={scores}
              vpTarget={vpTarget}
              onChange={(metric, value) => setPlayerScore(player, metric, value)}
            />
          ))}
        </div>
        <p className={styles.dragHint}>Victory and Resource Points move by 1. School Density moves by 10.</p>
      </section>

      <section className={`${styles.panel} ${styles.dicePanel}`} aria-labelledby="dice-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionKicker}>DICE TRAY</p>
            <h2 id="dice-title">Choose a die. Make some waves.</h2>
          </div>
          <p className={styles.lastRoll} aria-live="polite">
            {rollingDie ? `Rolling D${rollingDie}…` : Object.keys(results).length ? "Tap any die to roll again" : "Ready to roll"}
          </p>
        </div>
        <div className={styles.diceGrid}>
          {DICE.map((sides) => <Die key={sides} sides={sides} rollingDie={rollingDie} result={results[sides]} onRoll={roll} />)}
        </div>
      </section>
    </main>
  );
}
