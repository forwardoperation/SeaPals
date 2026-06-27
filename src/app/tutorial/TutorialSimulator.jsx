import Image from "next/image";
import { cardsById } from "@/data/cards";

const TARGET_VP = 10;

const ids = {
  brainBase: "brain-coral-base",
  brainStage1: "brain-coral-stage-1",
  brainStage2: "brain-coral-stage-2",
  blueTang: "blue-tang",
  triggerfish: "picasso-triggerfish",
  emeraldCrab: "emerald-crab",
  blueCrab: "blue-crab",
  greatBarracuda: "great-barracuda",
  spinnerDolphins: "spinner-dolphins",
  placeholder: "reef-foundation-placeholder",
};

const slotNames = ["Coral", "Fish", "Invertebrate", "Predator", "Predator"];
const startingFoundation = [ids.brainBase, ids.brainStage1, ids.brainStage2, ids.placeholder];
const startingPals = [ids.blueTang, ids.emeraldCrab, ids.greatBarracuda, ids.spinnerDolphins];
const TUTORIAL_SCENE_STORAGE_KEY = "seapals-tutorial-scene";

const scenes = [
  {
    phase: "Practice Mode",
    text: "This is practice mode. Follow my guidance and we will play a tiny reef game to 10 VP.",
    menu: ["Draw your starting cards.", "Build a coral foundation.", "Play reef Pals into slots.", "Attack, then reach 10 VP."],
    prompt: "Begin",
  },
  {
    phase: "Opening Setup",
    text: "First, separate your deck into a Foundation Deck and a Pals Deck. In this lesson, I will choose the cards for you.",
    menu: ["Foundation Deck: coral and upgrades.", "Pals Deck: creatures and support.", "Win this lesson at 10 VP."],
    prompt: "Next",
  },
  {
    phase: "Draw Step",
    text: "Draw four cards from the Foundation Deck. Look for a base coral first.",
    menu: ["Choose Foundation Deck.", "Draw four cards.", "Find Brain Coral Base."],
    prompt: "Draw Foundation",
  },
  {
    phase: "Draw Step",
    text: "Now draw four cards from the Pals Deck. These cards will score VP and make attacks.",
    menu: ["Choose Pals Deck.", "Draw four cards.", "Keep Blue Tang ready."],
    foundationDrawn: true,
    prompt: "Draw Pals",
  },
  {
    phase: "Play Foundation",
    text: "You start with 3 RP. Spend 1 RP to play Brain Coral Base as your foundation.",
    menu: ["Pay 1 RP.", "Put Brain Coral in the Coral slot.", "Open Fish and Invertebrate slots."],
    foundationDrawn: true,
    palsDrawn: true,
    rp: 3,
    prompt: "Play Coral",
  },
  {
    phase: "Opponent Setup",
    text: "The opponent also plays Brain Coral, then places Triggerfish in a Fish slot. Their VP is now 2.",
    menu: ["Opponent plays coral.", "Opponent plays Triggerfish.", "Opponent reaches 2 VP."],
    foundationDrawn: true,
    palsDrawn: true,
    rp: 2,
    coralHp: 10,
    playerBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish", active: true },
    ],
    opponentVp: 2,
    prompt: "Continue",
  },
  {
    phase: "Round 1",
    text: "At the start of the round, reveal a Condition card. This practice condition is calm, so nothing changes.",
    menu: ["Reveal condition.", "Read its effect.", "Apply it to both players."],
    foundationDrawn: true,
    palsDrawn: true,
    rp: 2,
    coralHp: 10,
    condition: "Clear Current: no extra effect.",
    playerBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish" },
    ],
    opponentVp: 2,
    prompt: "Reveal",
  },
  {
    phase: "Your Turn 1",
    text: "A turn begins with Choose and Collect. Draw from the Pals Deck, gain 1 RP, then collect 1 RP from Brain Coral.",
    menu: ["Choose Pals Deck.", "Gain 1 turn RP.", "Collect 1 RP from coral."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    rp: 4,
    coralHp: 10,
    condition: "Clear Current: no extra effect.",
    playerBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish" },
    ],
    opponentVp: 2,
    prompt: "Draw + Collect",
  },
  {
    phase: "Hand Menu",
    text: "Choose Blue Tang from your hand and play it into the Fish slot. Blue Tang gives you 2 VP while it stays in play.",
    menu: ["Select Blue Tang.", "Pay 1 RP.", "Place it in the Fish slot."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    highlightHand: ids.blueTang,
    rp: 4,
    coralHp: 10,
    condition: "Clear Current: no extra effect.",
    playerBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish" },
    ],
    opponentVp: 2,
    prompt: "Play Blue Tang",
  },
  {
    phase: "Build Phase",
    text: "Upgrade Brain Coral to Stage 1. Upgraded coral produces more RP and supports stronger reef slots.",
    menu: ["Collect 2 RP.", "Pay 2 RP.", "Upgrade Brain Coral."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    rp: 3,
    coralHp: 20,
    playerVp: 2,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage1, slot: "Coral", active: true },
      { cardId: ids.blueTang, slot: "Fish" },
    ],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish" },
    ],
    opponentVp: 2,
    prompt: "Upgrade",
  },
  {
    phase: "Hand Menu",
    text: "Play Emerald Crab into the Invertebrate slot. Small VP cards help you climb toward the target.",
    menu: ["Select Emerald Crab.", "Pay 1 RP.", "Add 1 VP in play."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    highlightHand: ids.emeraldCrab,
    rp: 3,
    coralHp: 20,
    playerVp: 2,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage1, slot: "Coral" },
      { cardId: ids.blueTang, slot: "Fish" },
    ],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish" },
    ],
    opponentVp: 2,
    prompt: "Play Crab",
  },
  {
    phase: "Build Phase",
    text: "Collect RP, then play Great Barracuda into the Predator slot. Predators are how you pressure the opponent.",
    menu: ["Collect 3 RP.", "Pay 3 RP.", "Place a Predator."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    highlightHand: ids.greatBarracuda,
    rp: 5,
    coralHp: 20,
    playerVp: 3,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage1, slot: "Coral" },
      { cardId: ids.blueTang, slot: "Fish" },
      { cardId: ids.emeraldCrab, slot: "Invertebrate" },
    ],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish" },
    ],
    opponentVp: 2,
    prompt: "Play Predator",
  },
  {
    phase: "Attack Menu",
    text: "Open the attack menu. Choose Great Barracuda's attack, then target the opposing Triggerfish.",
    menu: ["> Attack", "Card", "Check", "Done"],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    rp: 2,
    coralHp: 20,
    playerVp: 6,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage1, slot: "Coral" },
      { cardId: ids.blueTang, slot: "Fish" },
      { cardId: ids.emeraldCrab, slot: "Invertebrate" },
      { cardId: ids.greatBarracuda, slot: "Predator", active: true },
    ],
    opponentBoard: [
      { cardId: ids.brainBase, slot: "Coral" },
      { cardId: ids.triggerfish, slot: "Fish", targeted: true },
    ],
    opponentVp: 2,
    prompt: "Attack",
  },
  {
    phase: "Attack Result",
    text: "Your attack roll is higher than the defense roll. Triggerfish is discarded, so the opponent loses its 2 VP.",
    menu: ["Attack roll: 6.", "Defense roll: 3.", "Triggerfish is discarded."],
    attack: "Great Barracuda hits Triggerfish. Opponent VP drops to 0.",
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    rp: 2,
    coralHp: 20,
    playerVp: 6,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage1, slot: "Coral" },
      { cardId: ids.blueTang, slot: "Fish" },
      { cardId: ids.emeraldCrab, slot: "Invertebrate" },
      { cardId: ids.greatBarracuda, slot: "Predator", active: true },
    ],
    opponentBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentVp: 0,
    prompt: "Continue",
  },
  {
    phase: "Build Phase",
    text: "Upgrade Brain Coral to Stage 2. This opens room for another Predator and gives your reef a stronger foundation.",
    menu: ["Collect RP.", "Pay upgrade cost.", "Upgrade to Stage 2."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    rp: 0,
    coralHp: 60,
    playerVp: 6,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage2, slot: "Coral", active: true },
      { cardId: ids.blueTang, slot: "Fish" },
      { cardId: ids.emeraldCrab, slot: "Invertebrate" },
      { cardId: ids.greatBarracuda, slot: "Predator" },
    ],
    opponentBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentVp: 0,
    prompt: "Upgrade",
  },
  {
    phase: "Final Play",
    text: "Now play Spinner Dolphins into the second Predator slot. You reach 10 VP in play and win the practice duel.",
    menu: ["Select Spinner Dolphins.", "Pay 4 RP.", "Reach 10 VP."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    highlightHand: ids.spinnerDolphins,
    rp: 4,
    coralHp: 60,
    playerVp: 6,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage2, slot: "Coral" },
      { cardId: ids.blueTang, slot: "Fish" },
      { cardId: ids.emeraldCrab, slot: "Invertebrate" },
      { cardId: ids.greatBarracuda, slot: "Predator" },
    ],
    opponentBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentVp: 0,
    prompt: "Play Dolphins",
  },
  {
    phase: "Lesson Complete",
    text: "You win. You practiced drawing, collecting RP, building coral, playing Pals, attacking, removing VP, and reaching the victory target.",
    menu: ["You reached 10 VP.", "VP counted only while in play.", "Replay the lesson whenever you want."],
    foundationDrawn: true,
    palsDrawn: true,
    handExtra: [ids.blueCrab],
    rp: 0,
    coralHp: 60,
    playerVp: 10,
    condition: "Clear Current: no extra effect.",
    playerBoard: [
      { cardId: ids.brainStage2, slot: "Coral" },
      { cardId: ids.blueTang, slot: "Fish" },
      { cardId: ids.emeraldCrab, slot: "Invertebrate" },
      { cardId: ids.greatBarracuda, slot: "Predator" },
      { cardId: ids.spinnerDolphins, slot: "Predator" },
    ],
    opponentBoard: [{ cardId: ids.brainBase, slot: "Coral" }],
    opponentVp: 0,
    prompt: "Restart",
    reset: true,
  },
];

const sceneActions = [
  { type: "menu", label: "Click the practice checklist to begin." },
  { type: "deck", deck: "foundation", label: "Click the Foundation Deck to set it up." },
  { type: "deck", deck: "foundation", label: "Click the Foundation Deck to draw four cards." },
  { type: "deck", deck: "pals", label: "Click the Pals Deck to draw four cards." },
  { type: "hand", cardId: ids.brainBase, label: "Click Brain Coral Base in your hand." },
  { type: "board", owner: "Opponent", cardId: ids.triggerfish, label: "Click the opponent's Triggerfish." },
  { type: "condition", label: "Click the condition box." },
  { type: "status", owner: "You", field: "rp", label: "Click your RP bank." },
  { type: "hand", cardId: ids.blueTang, label: "Click Blue Tang in your hand." },
  { type: "board", owner: "Your", cardId: ids.brainStage1, label: "Click upgraded Brain Coral." },
  { type: "hand", cardId: ids.emeraldCrab, label: "Click Emerald Crab in your hand." },
  { type: "hand", cardId: ids.greatBarracuda, label: "Click Great Barracuda in your hand." },
  { type: "board", owner: "Opponent", cardId: ids.triggerfish, label: "Click the targeted Triggerfish." },
  { type: "attack", label: "Click the attack result." },
  { type: "board", owner: "Your", cardId: ids.brainStage2, label: "Click Stage 2 Brain Coral." },
  { type: "hand", cardId: ids.spinnerDolphins, label: "Click Spinner Dolphins in your hand." },
  { type: "status", owner: "You", field: "vp", label: "Click your 10 VP total to restart." },
];

function getCard(cardId) {
  return cardsById[cardId] ?? null;
}

function cardName(cardId) {
  const card = getCard(cardId);
  if (!card) return "Practice Card";
  return [card.name, card.subtitle, card.stageLabel].filter(Boolean).join(" ");
}

function cost(cardId) {
  return Number(getCard(cardId)?.cost?.rp ?? 0);
}

function vp(cardId) {
  return Number(getCard(cardId)?.victoryPoints ?? 0);
}

function hp(cardId) {
  return Number(getCard(cardId)?.health ?? 0);
}

function handFor(scene) {
  const hand = [];
  if (scene.foundationDrawn) hand.push(...startingFoundation);
  if (scene.palsDrawn) hand.push(...startingPals);
  if (scene.handExtra) hand.push(...scene.handExtra);

  for (const entry of scene.playerBoard ?? []) {
    const index = hand.indexOf(entry.cardId);
    if (index >= 0) hand.splice(index, 1);
  }

  const coralInPlay = scene.playerBoard?.find((entry) => entry.slot === "Coral")?.cardId;
  const spentFoundation =
    coralInPlay === ids.brainStage2
      ? [ids.brainBase, ids.brainStage1, ids.brainStage2]
      : coralInPlay === ids.brainStage1
        ? [ids.brainBase, ids.brainStage1]
        : [coralInPlay].filter(Boolean);

  for (const cardId of spentFoundation) {
    const index = hand.indexOf(cardId);
    if (index >= 0) hand.splice(index, 1);
  }

  return hand;
}

function nextSceneIndex(index, scene) {
  return scene.reset || index >= scenes.length - 1 ? 0 : index + 1;
}

function actionMatches(action, target) {
  if (!action || action.type !== target.type) return false;
  if (action.owner && action.owner !== target.owner) return false;
  if (action.field && action.field !== target.field) return false;
  if (action.cardId && action.cardId !== target.cardId) return false;
  if (action.deck && action.deck !== target.deck) return false;
  return true;
}

function ActionTarget({ action, index, scene, target, children }) {
  if (!actionMatches(action, target)) return children;

  return (
    <div
      role="button"
      tabIndex={0}
      data-tutorial-scene={nextSceneIndex(index, scene)}
      className="tutorial-action-target"
      aria-label={action.label}
    >
      {children}
      <span className="tutorial-action-badge">{scene.prompt}</span>
    </div>
  );
}

function CardMini({ cardId, selected = false, targeted = false }) {
  const card = getCard(cardId);

  return (
    <div
      className={`relative min-h-24 rounded-lg border bg-white p-2 shadow-sm transition ${
        selected ? "border-cyan-500 ring-2 ring-cyan-300" : "border-slate-200"
      } ${targeted ? "border-rose-500 ring-2 ring-rose-300" : ""}`}
    >
      {card?.image ? (
        <Image
          src={card.image}
          alt={cardName(cardId)}
          width={120}
          height={168}
          className="mx-auto h-16 w-auto object-contain"
        />
      ) : (
        <div className="grid h-16 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-[9px] font-bold uppercase text-slate-400">
          Placeholder
        </div>
      )}
      <div className="mt-2 truncate text-[11px] font-bold uppercase leading-3 text-slate-900">
        {cardName(cardId)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-500">
        <span>{cost(cardId) ? `${cost(cardId)} RP` : hp(cardId) ? `${hp(cardId)} HP` : "Card"}</span>
        <span>{vp(cardId) ? `${vp(cardId)} VP` : ""}</span>
      </div>
      {selected ? (
        <div className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-cyan-600 text-[10px] font-black text-white">
          !
        </div>
      ) : null}
    </div>
  );
}

function EmptySlot({ label }) {
  return (
    <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-cyan-300 bg-cyan-50/60 p-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
      {label}
    </div>
  );
}

function Panel({ title, aside, children, tone = "white" }) {
  const bg = tone === "blue" ? "bg-sky-50 ring-sky-100" : "bg-white ring-cyan-100";

  return (
    <section className={`rounded-lg p-4 shadow-sm ring-1 ${bg}`}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-cyan-100 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
          {title}
        </h2>
        {aside ? <div className="text-xs font-bold text-slate-400">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SlotRow({ title, owner, entries = [], sceneIndex, scene, action }) {
  const seen = {};

  return (
    <Panel title={title} aside={`${entries.length} cards`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {slotNames.map((slotName, slotIndex) => {
          const count = seen[slotName] ?? 0;
          seen[slotName] = count + 1;
          const entry = entries.filter((item) => item.slot === slotName)[count];

          return entry ? (
            <ActionTarget
              key={`${title}-${slotName}-${slotIndex}-${entry.cardId}`}
              action={action}
              index={sceneIndex}
              scene={scene}
              target={{ type: "board", owner, cardId: entry.cardId }}
            >
              <CardMini
                cardId={entry.cardId}
                selected={entry.active}
                targeted={entry.targeted}
              />
            </ActionTarget>
          ) : (
            <EmptySlot
              key={`${title}-${slotName}-${slotIndex}`}
              label={`${owner} ${slotName}`}
            />
          );
        })}
      </div>
    </Panel>
  );
}

function CoachPanel({ scene, progress, action }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-cyan-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">
            Coach Reef / {scene.phase}
          </div>
          <p className="mt-3 text-xl font-bold leading-8 text-slate-900 md:text-2xl">
            {scene.text}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            data-tutorial-scene="0"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-cyan-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-cyan-50"
          >
            Restart
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900 ring-1 ring-cyan-100">
        {action?.label ?? "Click the highlighted item to continue."}
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          <span>Tutorial Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-cyan-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}

function StatusPanel({ label, scene, index, action }) {
  const isPlayer = label === "You";
  const deckText = isPlayer
    ? `${16 - (scene.foundationDrawn ? 4 : 0)}/${24 - (scene.palsDrawn ? 4 : 0)}`
    : "24";

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-cyan-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm font-bold text-slate-900">
            <ActionTarget
              action={action}
              index={index}
              scene={scene}
              target={{ type: "status", owner: label, field: "vp" }}
            >
              <span>VP {isPlayer ? scene.playerVp ?? 0 : scene.opponentVp ?? 0}/{TARGET_VP}</span>
            </ActionTarget>
            <ActionTarget
              action={action}
              index={index}
              scene={scene}
              target={{ type: "status", owner: label, field: "deck" }}
            >
              <span>Deck {deckText}</span>
            </ActionTarget>
          </div>
        </div>
        {isPlayer ? (
          <div className="text-right text-sm font-bold text-slate-700">
            <ActionTarget
              action={action}
              index={index}
              scene={scene}
              target={{ type: "status", owner: label, field: "rp" }}
            >
              <div>RP {scene.rp ?? 0}</div>
            </ActionTarget>
            <ActionTarget
              action={action}
              index={index}
              scene={scene}
              target={{ type: "status", owner: label, field: "coralHp" }}
            >
              <div>Coral HP {scene.coralHp || "-"}</div>
            </ActionTarget>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DeckStack({ title, caption, deck, scene, index, action }) {
  const deckFace = (
    <div className="relative min-h-32 rounded-lg border border-cyan-100 bg-white p-4 shadow-sm transition">
      <div className="absolute right-4 top-4 h-24 w-16 rounded-md border-2 border-cyan-700 bg-cyan-50 shadow-[6px_6px_0_rgb(186,230,253),12px_12px_0_rgb(224,242,254)]" />
      <div className="relative z-[1] pr-24">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
          {title}
        </h3>
        <p className="mt-2 text-sm font-bold leading-5 text-slate-500">{caption}</p>
      </div>
    </div>
  );

  return (
    <ActionTarget
      action={action}
      index={index}
      scene={scene}
      target={{ type: "deck", deck }}
    >
      {deckFace}
    </ActionTarget>
  );
}

function DecksPanel({ scene, index, action }) {
  return (
    <Panel title="Decks">
      <div className="grid gap-3 md:grid-cols-2">
        <DeckStack
          title="Foundation Deck"
          caption="Coral bases and coral upgrades."
          deck="foundation"
          scene={scene}
          index={index}
          action={action}
        />
        <DeckStack
          title="Pals Deck"
          caption="Fish, invertebrates, predators, and support."
          deck="pals"
          scene={scene}
          index={index}
          action={action}
        />
      </div>
    </Panel>
  );
}

function MenuPanel({ scene, index, action }) {
  const content = (
    <Panel title={scene.phase}>
      <ol className="grid gap-2">
        {scene.menu.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-sm font-bold leading-6 text-slate-700">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-100 text-xs text-cyan-800">
              {item.startsWith(">") ? ">" : index + 1}
            </span>
            <span>{item.replace(/^>\s*/, "")}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );

  return (
    <ActionTarget
      action={action}
      index={index}
      scene={scene}
      target={{ type: "menu" }}
    >
      {content}
    </ActionTarget>
  );
}

function HandPanel({ scene, index, action }) {
  const hand = handFor(scene);

  return (
    <Panel title="Hand" aside={`${hand.length} cards`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {hand.length ? (
          hand.map((cardId, handIndex) => (
            <ActionTarget
              key={`${cardId}-${handIndex}`}
              action={action}
              index={index}
              scene={scene}
              target={{ type: "hand", cardId }}
            >
              <CardMini
                cardId={cardId}
                selected={scene.highlightHand === cardId}
              />
            </ActionTarget>
          ))
        ) : (
          <div className="col-span-full">
            <EmptySlot label="Cards appear here" />
          </div>
        )}
      </div>
    </Panel>
  );
}

function SceneScreen({ scene, index }) {
  const progress = Math.round((index / (scenes.length - 1)) * 100);
  const action = sceneActions[index];

  return (
    <section className={`tutorial-scene scene-${index} grid gap-4`}>
      <CoachPanel scene={scene} progress={progress} action={action} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusPanel label="Opponent" scene={scene} index={index} action={action} />
        <StatusPanel label="You" scene={scene} index={index} action={action} />
      </div>

      <DecksPanel scene={scene} index={index} action={action} />

      <SlotRow
        title="Opponent Reef"
        owner="Opponent"
        entries={scene.opponentBoard}
        sceneIndex={index}
        scene={scene}
        action={action}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <SlotRow
            title="Your Reef"
            owner="Your"
            entries={scene.playerBoard}
            sceneIndex={index}
            scene={scene}
            action={action}
          />
          <HandPanel scene={scene} index={index} action={action} />
        </div>

        <aside className="grid content-start gap-4">
          <MenuPanel scene={scene} index={index} action={action} />
          <ActionTarget
            action={action}
            index={index}
            scene={scene}
            target={{ type: "condition" }}
          >
            <Panel title="Condition" tone="blue">
              <p className="text-sm font-bold leading-6 text-slate-700">
                {scene.condition ?? "No condition revealed."}
              </p>
            </Panel>
          </ActionTarget>
          {scene.attack ? (
            <ActionTarget
              action={action}
              index={index}
              scene={scene}
              target={{ type: "attack" }}
            >
              <section className="rounded-lg bg-rose-50 p-4 shadow-sm ring-1 ring-rose-200">
                <h2 className="mb-3 border-b border-rose-100 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-700">
                  Attack Result
                </h2>
                <p className="text-sm font-bold leading-6 text-rose-950">
                  {scene.attack}
                </p>
              </section>
            </ActionTarget>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

export default function TutorialSimulator() {
  const sceneSelectors = scenes
    .map(
      (_, index) =>
        `#tutorial-scene-${index}:checked ~ .tutorial-stage .scene-${index} { display: grid; }`
    )
    .join("\n");

  return (
    <main className="pb-12">
      <section className="mb-6">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">
          Reef Practice Tutorial
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
          SeaPals Practice Duel
        </h1>
      </section>

      <div className="relative grid gap-4">
        {scenes.map((scene, index) => (
          <input
            key={`scene-control-${scene.phase}-${index}`}
            id={`tutorial-scene-${index}`}
            className="tutorial-scene-control"
            type="radio"
            name="tutorial-scene"
            defaultChecked={index === 0}
            aria-hidden="true"
          />
        ))}

        <div className="tutorial-stage">
          {scenes.map((scene, index) => (
            <SceneScreen
              key={`scene-screen-${scene.phase}-${index}`}
              scene={scene}
              index={index}
            />
          ))}
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const key = ${JSON.stringify(TUTORIAL_SCENE_STORAGE_KEY)};
              const controls = Array.from(document.querySelectorAll('.tutorial-scene-control'));
              if (!controls.length) return;

              const showScene = (index, preserveScroll = true) => {
                if (!Number.isInteger(index) || !controls[index]) return;
                const scrollX = window.scrollX;
                const scrollY = window.scrollY;

                controls[index].checked = true;
                window.localStorage.setItem(key, String(index));

                if (preserveScroll) {
                  window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
                }
              };

              const restore = () => {
                const saved = Number(window.localStorage.getItem(key));
                showScene(saved, false);
              };

              restore();

              controls.forEach((control, index) => {
                control.addEventListener('change', () => {
                  if (control.checked) window.localStorage.setItem(key, String(index));
                });
              });

              document.addEventListener('click', (event) => {
                const trigger = event.target.closest('[data-tutorial-scene]');
                if (!trigger) return;
                event.preventDefault();
                showScene(Number(trigger.dataset.tutorialScene));
              });

              document.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const trigger = event.target.closest('[data-tutorial-scene]');
                if (!trigger) return;
                event.preventDefault();
                showScene(Number(trigger.dataset.tutorialScene));
              });

              window.addEventListener('pageshow', restore);
            })();
          `,
        }}
      />

      <style>{`
        @keyframes scene-in {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes tutorial-target-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.28), 0 12px 28px rgba(15, 23, 42, 0.08);
          }
          50% {
            box-shadow: 0 0 0 7px rgba(8, 145, 178, 0.14), 0 16px 34px rgba(15, 23, 42, 0.12);
          }
        }

        .tutorial-scene-control {
          position: absolute;
          height: 1px;
          width: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .tutorial-scene {
          display: none;
          animation: scene-in 180ms ease-out;
        }

        .tutorial-action-target {
          position: relative;
          display: block;
          cursor: pointer;
          border-radius: 0.75rem;
          outline: 2px solid rgb(8, 145, 178);
          outline-offset: 4px;
          animation: tutorial-target-pulse 1.2s ease-in-out infinite;
        }

        .tutorial-action-target:hover {
          outline-color: rgb(14, 116, 144);
        }

        .tutorial-action-badge {
          position: absolute;
          right: -0.5rem;
          top: -0.75rem;
          z-index: 10;
          max-width: min(12rem, calc(100% + 1rem));
          border-radius: 9999px;
          background: rgb(14, 116, 144);
          color: white;
          padding: 0.35rem 0.65rem;
          font-size: 0.7rem;
          font-weight: 800;
          line-height: 1;
          letter-spacing: 0.08em;
          text-align: center;
          text-transform: uppercase;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
        }

        ${sceneSelectors}
      `}</style>
    </main>
  );
}
