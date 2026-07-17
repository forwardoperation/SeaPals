"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Simulator from "@/app/simulator/Simulator";
import {
  SCENES,
  START_STATE,
  getContinuousInteraction,
  movePlayerContinuous,
} from "./adventureWorld.mjs";
import styles from "./adventure.module.css";

const PROGRESS_KEY = "seapals-reefbound-progress-v1";

const TRAINERS = {
  marina: {
    id: "marina",
    sceneId: "coral-home",
    name: "Marina",
    title: "Coral Gardener",
    deckId: "coral-garden",
    difficulty: "easy",
    victoryTarget: 10,
    crest: "Coral Crest",
    color: "coral",
    intro: [
      "Welcome to Coral Cottage! Every strong ecosystem starts with a patient gardener.",
      "I use clever reef friendships to build Victory Points fast. Want to test your SeaPals deck against mine?",
    ],
    rematch: [
      "Your Coral Crest still shines! A good Reefkeeper never turns down more practice.",
      "Would you like another 10 VP duel with my Coral Garden deck?",
    ],
    victory: [
      "That was a beautiful ecosystem! You read the current and reached 10 VP first.",
      "Take the Coral Crest. Dorian across the village studies the creatures of the deep—he will be a tougher challenge.",
    ],
  },
  dorian: {
    id: "dorian",
    sceneId: "deep-home",
    name: "Dorian",
    title: "Deep Sea Researcher",
    deckId: "darkness-shroud",
    difficulty: "medium",
    victoryTarget: 10,
    crest: "Abyss Crest",
    color: "deep",
    intro: [
      "You made it to Deepwater House. Down here, patience matters more than sunlight.",
      "My Darkness Shroud deck hides powerful creatures in the abyss. Show me how your reef handles the pressure.",
    ],
    rematch: [
      "The Abyss Crest belongs to you, but the deep is never the same twice.",
      "Ready to face my Darkness Shroud deck again?",
    ],
    victory: [
      "Impressive. You kept building even when the deep pushed back.",
      "The Abyss Crest is yours. Shellshore Village now recognizes you as a Tidebound Champion!",
    ],
  },
};

const LOCATION_NAMES = {
  town: "Shellshore Village",
  "coral-home": "Coral Cottage",
  "deep-home": "Deepwater House",
};

const DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

const MOVEMENT_VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

function actorPosition(position, scene) {
  return {
    left: `${((position.x + 0.5) / scene.width) * 100}%`,
    top: `${((position.y + 0.5) / scene.height) * 100}%`,
    width: `${100 / scene.width}%`,
    height: `${100 / scene.height}%`,
    zIndex: 20 + Math.round(position.y * 10),
  };
}

function SpriteArtwork({ character = "player", facing = "down", moving = false, portrait = false }) {
  const facingName = `${facing[0].toUpperCase()}${facing.slice(1)}`;
  return (
    <span
      className={`${styles.spriteArtwork} ${styles[`${character}SpriteArtwork`]} ${styles[`spriteFacing${facingName}`]} ${moving ? styles.spriteWalking : ""} ${portrait ? styles.spritePortrait : ""}`}
      aria-hidden="true"
    />
  );
}

function AdventureTrainerSprite({ trainer, defeated, scene }) {
  return (
    <div
      className={styles.characterCell}
      style={actorPosition({ x: 5, y: 2 }, scene)}
      aria-label={`${trainer.name}, ${trainer.title}`}
    >
      <span className={styles.characterShadow} />
      <SpriteArtwork character={trainer.id} facing="down" />
      <span className={`${styles.trainerMarker} ${defeated ? styles.trainerDefeated : ""}`}>
        {defeated ? "★" : "!"}
      </span>
    </div>
  );
}

function AdventurePlayerSprite({ position, facing, moving, interaction, scene }) {
  return (
    <div
      className={`${styles.characterCell} ${styles.playerCell}`}
      style={actorPosition(position, scene)}
      aria-label="You"
    >
      <span className={styles.characterShadow} />
      <SpriteArtwork facing={facing} moving={moving} />
      {interaction ? <span className={styles.actionCue} aria-hidden="true">A</span> : null}
    </div>
  );
}

function movementVector(keyDirections, touchDirections) {
  const vector = { x: 0, y: 0 };
  for (const direction of [...keyDirections.values(), ...touchDirections]) {
    const delta = MOVEMENT_VECTORS[direction];
    if (delta) {
      vector.x += delta.x;
      vector.y += delta.y;
    }
  }
  return vector;
}

function movementFacing(keyDirections, touchDirections, vector) {
  const activeDirections = [...keyDirections.values(), ...touchDirections];
  for (let index = activeDirections.length - 1; index >= 0; index -= 1) {
    const direction = activeDirections[index];
    const delta = MOVEMENT_VECTORS[direction];
    if (delta && delta.x * vector.x + delta.y * vector.y > 0) return direction;
  }
  return Math.abs(vector.x) >= Math.abs(vector.y)
    ? vector.x > 0 ? "right" : "left"
    : vector.y > 0 ? "down" : "up";
}

function Conversation({ conversation, trainer, defeated, onAdvance, onChallenge, onClose }) {
  const lines = conversation.mode === "victory"
    ? trainer.victory
    : defeated
      ? trainer.rematch
      : trainer.intro;
  const finalLine = conversation.index === lines.length - 1;
  const isVictory = conversation.mode === "victory";

  return (
    <div className={styles.dialogueLayer} role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker">
      <div className={styles.dialogueBox}>
        <div className={`${styles.portrait} ${styles[`portrait${trainer.color}`]}`}>
          <SpriteArtwork character={trainer.id} facing="down" portrait />
        </div>
        <div className={styles.dialogueCopy}>
          <div className={styles.dialogueMeta}>
            <strong id="dialogue-speaker">{trainer.name}</strong>
            <span>{trainer.title}</span>
          </div>
          <p>{lines[conversation.index]}</p>
          <div className={styles.dialogueActions}>
            {!finalLine ? (
              <button type="button" autoFocus onClick={onAdvance}>Next</button>
            ) : isVictory ? (
              <button type="button" autoFocus onClick={onClose}>Continue exploring</button>
            ) : (
              <>
                <button type="button" autoFocus className={styles.challengeButton} onClick={onChallenge}>
                  {defeated ? "Rematch" : "Start duel"}
                </button>
                <button type="button" className={styles.quietButton} onClick={onClose}>Not yet</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectionButton({ direction, label, onStart, onStop }) {
  const suppressClickRef = useRef(false);
  const clickStopTimerRef = useRef(null);

  useEffect(() => () => {
    if (clickStopTimerRef.current) window.clearTimeout(clickStopTimerRef.current);
  }, []);

  function releaseClickSuppression() {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function cancelClickStopTimer() {
    if (!clickStopTimerRef.current) return;
    window.clearTimeout(clickStopTimerRef.current);
    clickStopTimerRef.current = null;
  }

  function startPointer(event) {
    event.preventDefault();
    cancelClickStopTimer();
    suppressClickRef.current = true;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; movement still stops on pointer-up.
    }
    onStart(direction);
  }

  function stopPointer(event) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onStop(direction);
    releaseClickSuppression();
  }

  function nudgeFromClick() {
    if (suppressClickRef.current) return;
    onStart(direction);
    cancelClickStopTimer();
    clickStopTimerRef.current = window.setTimeout(() => {
      clickStopTimerRef.current = null;
      onStop(direction);
    }, 140);
  }

  return (
    <button
      type="button"
      className={`${styles.directionButton} ${styles[`direction${direction}`]}`}
      aria-label={`Walk ${direction}`}
      onPointerDown={startPointer}
      onPointerUp={stopPointer}
      onPointerCancel={stopPointer}
      onClick={nudgeFromClick}
      onBlur={() => {
        onStop(direction);
        releaseClickSuppression();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          cancelClickStopTimer();
          suppressClickRef.current = true;
          onStart(direction);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onStop(direction);
          releaseClickSuppression();
        }
      }}
    >
      {label}
    </button>
  );
}

function Intro({ onStart }) {
  return (
    <div className={styles.introLayer} role="dialog" aria-modal="true" aria-labelledby="adventure-title">
      <div className={styles.introCard}>
        <div className={styles.introEyebrow}>A SeaPals Story</div>
        <h1 id="adventure-title">REEFBOUND</h1>
        <div className={styles.introDivider}><span>◆</span></div>
        <p>
          Two Reefkeepers live in Shellshore Village. Explore their homes, talk to each one,
          and win a 10 VP SeaPals duel to earn both crests.
        </p>
        <div className={styles.introControls}>
          <span><kbd>WASD</kbd> or arrows to walk</span>
          <span><kbd>ENTER</kbd> to interact</span>
        </div>
        <button type="button" autoFocus onClick={onStart}>Begin adventure</button>
      </div>
    </div>
  );
}

function Completion({ onContinue, onReset }) {
  return (
    <div className={styles.introLayer} role="dialog" aria-modal="true" aria-labelledby="completion-title">
      <div className={`${styles.introCard} ${styles.completionCard}`}>
        <div className={styles.crestPair}><span>★</span><span>★</span></div>
        <div className={styles.introEyebrow}>Both crests earned</div>
        <h2 id="completion-title">TIDEBOUND CHAMPION</h2>
        <p>
          Marina and Dorian recognize your skill. You explored both homes and conquered two
          different SeaPals strategies.
        </p>
        <div className={styles.completionActions}>
          <button type="button" autoFocus onClick={onContinue}>Keep exploring</button>
          <button type="button" className={styles.quietButton} onClick={onReset}>Start over</button>
        </div>
      </div>
    </div>
  );
}

function interactionLabel(interaction) {
  if (!interaction) return "Walk closer to a door or Reefkeeper";
  if (interaction.type === "trainer") return `Talk to ${TRAINERS[interaction.trainerId]?.name ?? "Reefkeeper"}`;
  if (interaction.type === "exit") return "Leave this home";
  if (interaction.targetScene === "coral-home") return "Enter Coral Cottage";
  if (interaction.targetScene === "deep-home") return "Enter Deepwater House";
  return "Interact";
}

export default function AdventureGame() {
  const [sceneId, setSceneId] = useState(START_STATE.sceneId);
  const [position, setPosition] = useState(START_STATE.position);
  const [facing, setFacing] = useState(START_STATE.facing);
  const [started, setStarted] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [activeTrainerId, setActiveTrainerId] = useState(null);
  const [postDuelTrainerId, setPostDuelTrainerId] = useState(null);
  const [defeated, setDefeated] = useState(() => new Set());
  const [progressReady, setProgressReady] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const keyboardDirectionsRef = useRef(new Map());
  const touchDirectionsRef = useRef(new Set());
  const movementActiveRef = useRef(false);
  const movementPausedRef = useRef(true);
  const interactRef = useRef(null);

  const scene = SCENES[sceneId];
  const movementPaused = !started || Boolean(conversation) || Boolean(activeTrainerId) || showCompletion;
  movementPausedRef.current = movementPaused;
  const interaction = useMemo(
    () => getContinuousInteraction(sceneId, position, facing),
    [sceneId, position, facing],
  );

  const setMovementActive = useCallback((nextActive) => {
    if (movementActiveRef.current === nextActive) return;
    movementActiveRef.current = nextActive;
    setIsMoving(nextActive);
  }, []);

  const clearMovement = useCallback(() => {
    keyboardDirectionsRef.current.clear();
    touchDirectionsRef.current.clear();
    setMovementActive(false);
  }, [setMovementActive]);

  const syncMovementActive = useCallback(() => {
    const vector = movementVector(keyboardDirectionsRef.current, touchDirectionsRef.current);
    setMovementActive(
      !movementPausedRef.current && (vector.x !== 0 || vector.y !== 0),
    );
  }, [setMovementActive]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "null");
      if (Array.isArray(saved?.defeated)) {
        setDefeated(new Set(saved.defeated.filter((id) => TRAINERS[id])));
      }
    } catch {
      // Ignore malformed local progress and begin a fresh adventure.
    }
    setProgressReady(true);
  }, []);

  useEffect(() => {
    if (!progressReady) return;
    try {
      window.localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ defeated: [...defeated] }),
      );
    } catch {
      // The adventure remains playable when storage is unavailable or full.
    }
  }, [defeated, progressReady]);

  useEffect(() => {
    if (activeTrainerId || !postDuelTrainerId) return;
    setConversation({ trainerId: postDuelTrainerId, index: 0, mode: "victory" });
    setPostDuelTrainerId(null);
  }, [activeTrainerId, postDuelTrainerId]);

  useEffect(() => {
    if (movementPaused || !isMoving) return undefined;

    let animationFrame = 0;
    let previousTime = null;

    function updateMovement(timestamp) {
      const elapsedMs = previousTime === null ? 0 : Math.min(timestamp - previousTime, 50);
      previousTime = timestamp;
      const vector = movementVector(keyboardDirectionsRef.current, touchDirectionsRef.current);
      if (vector.x === 0 && vector.y === 0) {
        setMovementActive(false);
        return;
      }

      if (elapsedMs > 0) {
        const nextFacing = movementFacing(
          keyboardDirectionsRef.current,
          touchDirectionsRef.current,
          vector,
        );
        setFacing((current) => current === nextFacing ? current : nextFacing);
        setPosition((current) => {
          const next = movePlayerContinuous(
            sceneId,
            current,
            vector,
            elapsedMs,
            { speed: 3.6, radius: 0.22, maxStepDistance: 0.08 },
          );
          return next.x === current.x && next.y === current.y ? current : next;
        });
      }

      animationFrame = window.requestAnimationFrame(updateMovement);
    }

    animationFrame = window.requestAnimationFrame(updateMovement);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isMoving, movementPaused, sceneId, setMovementActive]);

  useEffect(() => {
    if (movementPaused) {
      setMovementActive(false);
      return;
    }
    syncMovementActive();
  }, [movementPaused, setMovementActive, syncMovementActive]);

  function beginTouchDirection(direction) {
    if (movementPaused) return;
    touchDirectionsRef.current.add(direction);
    setFacing(direction);
    syncMovementActive();
  }

  function endTouchDirection(direction) {
    touchDirectionsRef.current.delete(direction);
    syncMovementActive();
  }

  function interact() {
    if (!started || conversation || activeTrainerId || showCompletion || !interaction) return;
    clearMovement();
    if (interaction.type === "trainer") {
      setConversation({ trainerId: interaction.trainerId, index: 0, mode: "challenge" });
      return;
    }
    if (interaction.targetScene && interaction.spawn) {
      setSceneId(interaction.targetScene);
      setPosition(interaction.spawn);
      setFacing(interaction.facing ?? "up");
    }
  }

  interactRef.current = interact;

  function advanceConversation() {
    if (!conversation) return;
    const trainer = TRAINERS[conversation.trainerId];
    const lines = conversation.mode === "victory"
      ? trainer.victory
      : defeated.has(trainer.id)
        ? trainer.rematch
        : trainer.intro;
    setConversation((current) => ({
      ...current,
      index: Math.min(current.index + 1, lines.length - 1),
    }));
  }

  function closeConversation() {
    const wasVictory = conversation?.mode === "victory";
    setConversation(null);
    if (wasVictory && defeated.size === Object.keys(TRAINERS).length) {
      setShowCompletion(true);
    }
  }

  function startDuel() {
    if (!conversation) return;
    clearMovement();
    setActiveTrainerId(conversation.trainerId);
    setConversation(null);
  }

  function recordVictory(trainerId) {
    setDefeated((current) => {
      const next = new Set(current);
      next.add(trainerId);
      return next;
    });
    setPostDuelTrainerId(trainerId);
  }

  function resetProgress() {
    clearMovement();
    setDefeated(new Set());
    setSceneId(START_STATE.sceneId);
    setPosition(START_STATE.position);
    setFacing(START_STATE.facing);
    setConversation(null);
    setShowCompletion(false);
  }

  useEffect(() => {
    function onKeyDown(event) {
      const direction = DIRECTIONS[event.key];
      if (direction) {
        if (event.target?.closest?.("input, select, textarea, [contenteditable='true']")) return;
        if (movementPausedRef.current) return;
        event.preventDefault();
        keyboardDirectionsRef.current.set(event.code || event.key, direction);
        setFacing(direction);
        syncMovementActive();
        return;
      }
      if (
        (event.key === "Enter" || event.key === " ")
        && !event.target?.closest?.("button, a, input, select, textarea, summary")
      ) {
        event.preventDefault();
        interactRef.current?.();
      }
    }

    function onKeyUp(event) {
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      keyboardDirectionsRef.current.delete(event.code || event.key);
      syncMovementActive();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearMovement);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearMovement);
    };
  }, [clearMovement, syncMovementActive]);

  if (activeTrainerId) {
    const trainer = TRAINERS[activeTrainerId];
    return (
      <Simulator
        key={`reefbound-${trainer.id}`}
        storyMode={{
          encounterId: `shellshore:${trainer.id}`,
          opponentId: trainer.id,
          playerDeckId: "coral-garden",
          opponentDeckId: trainer.deckId,
          victoryTarget: trainer.victoryTarget,
          difficulty: trainer.difficulty,
          opponentName: trainer.name,
          onExit: () => setActiveTrainerId(null),
          onVictory: () => recordVictory(trainer.id),
        }}
      />
    );
  }

  const activeConversationTrainer = conversation ? TRAINERS[conversation.trainerId] : null;
  const progress = defeated.size;
  const mapThemeClass = sceneId === "town"
    ? styles.townMap
    : sceneId === "coral-home"
      ? styles.coralHomeMap
      : styles.deepHomeMap;

  return (
    <main className={styles.gameShell}>
      <div className={styles.oceanGlow} aria-hidden="true" />
      <header className={styles.gameHeader}>
        <a href="/" className={styles.exitLink} aria-label="Exit adventure and return home">←</a>
        <div className={styles.brandLockup}>
          <img src="/images/brand/SeaPalsTCGLogoWhite.svg" alt="SeaPals TCG" />
          <span>REEFBOUND</span>
        </div>
        <div className={styles.locationPill}>
          <span>NOW EXPLORING</span>
          <strong>{LOCATION_NAMES[sceneId]}</strong>
        </div>
        <div className={styles.compactProgress} aria-label={`${progress} of 2 crests earned`}>
          <span className={defeated.has("marina") ? styles.earned : ""}>★</span>
          <span className={defeated.has("dorian") ? styles.earned : ""}>★</span>
        </div>
      </header>

      <div className={styles.gameLayout}>
        <aside className={styles.sidePanel}>
          <div className={styles.panelEyebrow}>Current quest</div>
          <h2>Meet the Reefkeepers</h2>
          <p>Enter both homes and win each resident&apos;s 10 VP duel.</p>
          <div className={styles.questProgress}>
            <span style={{ width: `${(progress / 2) * 100}%` }} />
          </div>
          <strong>{progress} / 2 crests earned</strong>
          <div className={styles.controlLegend}>
            <div><kbd>WASD</kbd><span>Walk</span></div>
            <div><kbd>↵</kbd><span>Interact</span></div>
          </div>
        </aside>

        <section className={styles.stageColumn} aria-label={`${LOCATION_NAMES[sceneId]} game area`}>
          <div className={styles.interactionBar} aria-live="polite">
            <span className={interaction ? styles.readyDot : ""} />
            {interactionLabel(interaction)}
            {interaction ? <kbd>ENTER</kbd> : null}
          </div>
          <div
            className={`${styles.map} ${mapThemeClass}`}
            style={{
              gridTemplateColumns: `repeat(${scene.width}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${scene.height}, minmax(0, 1fr))`,
              aspectRatio: `${scene.width} / ${scene.height}`,
            }}
            role="application"
            aria-label={`Top-down map of ${LOCATION_NAMES[sceneId]}. Use arrow keys or WASD to walk.`}
          >
            {sceneId !== "town" ? (
              <AdventureTrainerSprite
                trainer={TRAINERS[sceneId === "coral-home" ? "marina" : "dorian"]}
                defeated={defeated.has(sceneId === "coral-home" ? "marina" : "dorian")}
                scene={scene}
              />
            ) : null}
            <AdventurePlayerSprite
              position={position}
              facing={facing}
              moving={isMoving}
              interaction={interaction}
              scene={scene}
            />
          </div>

          <div className={styles.controlDock}>
            <div className={styles.dpad} aria-label="Movement controls">
              <DirectionButton direction="up" label="▲" onStart={beginTouchDirection} onStop={endTouchDirection} />
              <DirectionButton direction="left" label="◀" onStart={beginTouchDirection} onStop={endTouchDirection} />
              <span className={styles.dpadCenter} />
              <DirectionButton direction="right" label="▶" onStart={beginTouchDirection} onStop={endTouchDirection} />
              <DirectionButton direction="down" label="▼" onStart={beginTouchDirection} onStop={endTouchDirection} />
            </div>
            <button type="button" className={styles.actionButton} disabled={!interaction} onClick={interact}>
              <span>A</span>
              Interact
            </button>
          </div>
        </section>

        <aside className={`${styles.sidePanel} ${styles.trainerPanel}`}>
          <div className={styles.panelEyebrow}>Village challengers</div>
          {Object.values(TRAINERS).map((trainer) => {
            const won = defeated.has(trainer.id);
            return (
              <div key={trainer.id} className={`${styles.trainerCard} ${won ? styles.trainerCardWon : ""}`}>
                <span className={`${styles.miniPortrait} ${styles[`portrait${trainer.color}`]}`}>
                  <SpriteArtwork character={trainer.id} facing="down" portrait />
                </span>
                <span>
                  <strong>{trainer.name}</strong>
                  <small>{trainer.title}</small>
                  <em>{won ? `${trainer.crest} earned` : `${trainer.difficulty} · 10 VP`}</em>
                </span>
                <b>{won ? "★" : "?"}</b>
              </div>
            );
          })}
          {progress ? (
            <button type="button" className={styles.resetButton} onClick={resetProgress}>Reset adventure</button>
          ) : null}
        </aside>
      </div>

      {!started ? <Intro onStart={() => setStarted(true)} /> : null}
      {activeConversationTrainer ? (
        <Conversation
          conversation={conversation}
          trainer={activeConversationTrainer}
          defeated={defeated.has(activeConversationTrainer.id)}
          onAdvance={advanceConversation}
          onChallenge={startDuel}
          onClose={closeConversation}
        />
      ) : null}
      {showCompletion ? (
        <Completion onContinue={() => setShowCompletion(false)} onReset={resetProgress} />
      ) : null}
    </main>
  );
}
