"use client";

import { useEffect, useMemo, useState } from "react";
import Simulator from "@/app/simulator/Simulator";
import {
  SCENES,
  START_STATE,
  getInteraction,
  movePlayer,
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

function townTilesWithSymbol(symbol) {
  return SCENES.town.tiles.flatMap((row, y) =>
    [...row].flatMap((tile, x) => tile === symbol ? [{ x, y }] : []),
  );
}

const TOWN_PATH = townTilesWithSymbol("p");
const TOWN_TREES = townTilesWithSymbol("t");

function gridPosition(x, y, width = 1, height = 1) {
  return {
    gridColumn: `${x + 1} / span ${width}`,
    gridRow: `${y + 1} / span ${height}`,
  };
}

function House({ x, name, variant, defeated }) {
  return (
    <div
      className={`${styles.house} ${styles[`house${variant}`]}`}
      style={gridPosition(x, 1, 5, 4)}
      aria-label={name}
    >
      <div className={styles.houseRoof} />
      <div className={styles.houseFront}>
        <span className={styles.window} />
        <span className={styles.houseSign}>{name}</span>
        <span className={styles.window} />
      </div>
      <div className={styles.houseDoor}>
        <span className={styles.doorKnob} />
        {defeated ? <span className={styles.crestOnDoor}>★</span> : null}
      </div>
    </div>
  );
}

function TownScene({ defeated }) {
  return (
    <>
      <div className={styles.waterStrip} style={gridPosition(0, 0, 1, 10)}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={styles.wave} />
        ))}
      </div>
      {TOWN_PATH.map((tile, index) => (
        <span
          key={`${tile.x}-${tile.y}-${index}`}
          className={styles.pathTile}
          style={gridPosition(tile.x, tile.y)}
        />
      ))}
      <House
        x={1}
        name="Coral Cottage"
        variant="Coral"
        defeated={defeated.has("marina")}
      />
      <House
        x={10}
        name="Deepwater House"
        variant="Deep"
        defeated={defeated.has("dorian")}
      />
      {TOWN_TREES.map((tree) => (
        <span
          key={`${tree.x}-${tree.y}`}
          className={styles.tree}
          style={gridPosition(tree.x, tree.y)}
          aria-hidden="true"
        />
      ))}
      <div className={styles.signpost} style={gridPosition(7, 5, 2, 1)}>
        <span>REEFKEEPERS</span>
      </div>
      <span className={styles.shellPatch} style={gridPosition(1, 8, 2, 1)}>
        ◇　·　◇
      </span>
    </>
  );
}

function HomeScene({ sceneId, defeated }) {
  const isCoral = sceneId === "coral-home";
  const trainerId = isCoral ? "marina" : "dorian";
  return (
    <>
      <div className={`${styles.roomBackdrop} ${isCoral ? styles.coralRoom : styles.deepRoom}`} />
      <div className={styles.backWall} style={gridPosition(0, 0, 12, 1)}>
        <span className={styles.wallPicture}>{isCoral ? "♒" : "✦"}</span>
        <span className={styles.wallTitle}>{isCoral ? "GROW WITH THE REEF" : "EXPLORE THE UNKNOWN"}</span>
      </div>
      <div className={styles.aquarium} style={gridPosition(3, 4, 2, 1)}>
        <span>◌</span><span>‹°)))&gt;&lt;</span>
      </div>
      <div className={styles.bookshelf} style={gridPosition(9, 4, 2, 1)}>
        {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
      </div>
      <div className={`${styles.rug} ${isCoral ? styles.coralRug : styles.deepRug}`} style={gridPosition(4, 3, 4, 3)} />
      <div className={styles.exitMat} style={gridPosition(5, 7, 2, 1)}>
        EXIT
      </div>
      <TrainerSprite trainer={TRAINERS[trainerId]} defeated={defeated.has(trainerId)} />
    </>
  );
}

function PixelPerson({ color = "#2dd4bf", facing = "down", trainer = false }) {
  return (
    <span
      className={`${styles.pixelPerson} ${styles[`facing${facing[0].toUpperCase()}${facing.slice(1)}`]} ${trainer ? styles.trainerPerson : ""}`}
      style={{ "--sprite-shirt": color }}
      aria-hidden="true"
    >
      <span className={styles.spriteHair} />
      <span className={styles.spriteHead} />
      <span className={styles.spriteBody} />
      <span className={styles.spriteLegs} />
    </span>
  );
}

function TrainerSprite({ trainer, defeated }) {
  const color = trainer.color === "coral" ? "#fb7185" : "#818cf8";
  return (
    <div
      className={styles.characterCell}
      style={gridPosition(5, 2)}
      aria-label={`${trainer.name}, ${trainer.title}`}
    >
      <span className={styles.characterShadow} />
      <PixelPerson color={color} trainer />
      <span className={`${styles.trainerMarker} ${defeated ? styles.trainerDefeated : ""}`}>
        {defeated ? "★" : "!"}
      </span>
    </div>
  );
}

function PlayerSprite({ position, facing }) {
  return (
    <div
      className={`${styles.characterCell} ${styles.playerCell}`}
      style={gridPosition(position.x, position.y)}
      aria-label="You"
    >
      <span className={styles.characterShadow} />
      <PixelPerson color="#06b6d4" facing={facing} />
    </div>
  );
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
          <PixelPerson color={trainer.color === "coral" ? "#fb7185" : "#818cf8"} trainer />
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

function DirectionButton({ direction, label, onMove }) {
  return (
    <button
      type="button"
      className={`${styles.directionButton} ${styles[`direction${direction}`]}`}
      aria-label={`Walk ${direction}`}
      onClick={() => onMove(direction)}
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

  const scene = SCENES[sceneId];
  const interaction = useMemo(
    () => getInteraction(sceneId, position, facing),
    [sceneId, position, facing],
  );

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

  function walk(direction) {
    if (!started || conversation || activeTrainerId || showCompletion) return;
    setFacing(direction);
    setPosition((current) => movePlayer(sceneId, current, direction));
  }

  function interact() {
    if (!started || conversation || activeTrainerId || showCompletion || !interaction) return;
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
    setDefeated(new Set());
    setSceneId(START_STATE.sceneId);
    setPosition(START_STATE.position);
    setFacing(START_STATE.facing);
    setConversation(null);
    setShowCompletion(false);
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (activeTrainerId) return;
      if (event.target?.closest?.("button, a, input, select, textarea, summary")) return;
      const direction = DIRECTIONS[event.key];
      if (direction) {
        event.preventDefault();
        walk(direction);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && !conversation) {
        event.preventDefault();
        interact();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (activeTrainerId) {
    const trainer = TRAINERS[activeTrainerId];
    return (
      <Simulator
        key={`reefbound-${trainer.id}`}
        storyMode={{
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
            className={`${styles.map} ${sceneId === "town" ? styles.townMap : styles.homeMap}`}
            style={{
              gridTemplateColumns: `repeat(${scene.width}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${scene.height}, minmax(0, 1fr))`,
              aspectRatio: `${scene.width} / ${scene.height}`,
            }}
            role="application"
            aria-label={`Top-down map of ${LOCATION_NAMES[sceneId]}. Use arrow keys or WASD to walk.`}
          >
            {sceneId === "town" ? (
              <TownScene defeated={defeated} />
            ) : (
              <HomeScene sceneId={sceneId} defeated={defeated} />
            )}
            <PlayerSprite position={position} facing={facing} />
            {interaction ? (
              <span className={styles.actionCue} style={gridPosition(position.x, position.y)} aria-hidden="true">A</span>
            ) : null}
          </div>

          <div className={styles.controlDock}>
            <div className={styles.dpad} aria-label="Movement controls">
              <DirectionButton direction="up" label="▲" onMove={walk} />
              <DirectionButton direction="left" label="◀" onMove={walk} />
              <span className={styles.dpadCenter} />
              <DirectionButton direction="right" label="▶" onMove={walk} />
              <DirectionButton direction="down" label="▼" onMove={walk} />
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
                  <PixelPerson color={trainer.color === "coral" ? "#fb7185" : "#818cf8"} trainer />
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
