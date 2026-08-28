import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { commitStarterSelection } from "./adventureOnboarding.mjs";
import { reconcileStarterCollection } from "./adventureCollection.mjs";
import {
  createActiveDuelDeckSnapshot,
  duplicateSavedDeck,
  fingerprintDeckCards,
  replaceSavedDeckDraft,
  setActiveSavedDeck,
} from "./adventureDecks.mjs";
import { assertAdventureDuelResultMatchesLaunch } from "./adventureDuel.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  completeAdventureEncounter,
  createNewAdventureSession,
  recordAdventureDuelResult,
} from "./adventureSession.mjs";
import { createAdventureStorageAdapter } from "./adventureStorage.mjs";
import { resolveStoryPlayerDeckSnapshot } from "../simulator/storyDeckRuntime.mjs";
import { createStoryDuelResult } from "../simulator/storyModeContract.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { prebuiltDecks } = jiti(path.join(projectRoot, "src/data/decks/prebuiltDecks.js"));

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("earned card to custom deck to immutable resident duel survives save and reload", () => {
  const profileId = "profile-1";
  const starterDeckId = "coral-garden";
  const starter = prebuiltDecks.find((deck) => deck.id === starterDeckId);
  assert.ok(starter);

  let save = commitStarterSelection(createNewAdventureSession(profileId), starterDeckId).save;
  save = reconcileStarterCollection(save, starter).save;
  save = completeAdventureEncounter(save, {
    encounterId: "encounter-shellshore-marina",
    opponentId: "marina",
  });
  const opening = openAdventurePack(save, "pack-pool-shellshore-discovery", {
    random: () => 0,
  });
  save = opening.save;
  const discoveryCardId = opening.guaranteedNewCardId;
  assert.ok(discoveryCardId);
  assert.equal(save.inventory.cards[discoveryCardId], 1);

  const duplicated = duplicateSavedDeck(save, starterDeckId, {
    id: "shellshore-discoveries",
    name: "Shellshore Discoveries",
    cardCatalog: cardsById,
  });
  const customCards = { ...duplicated.deck.cards };
  const removableCardId = Object.keys(customCards).find((cardId) => (
    cardsById[cardId]?.kind === "support" && customCards[cardId] > 0
  ));
  assert.ok(removableCardId, "starter needs a removable Support card for the custom-deck proof");
  if (customCards[removableCardId] === 1) delete customCards[removableCardId];
  else customCards[removableCardId] -= 1;
  customCards[discoveryCardId] = (customCards[discoveryCardId] ?? 0) + 1;

  save = replaceSavedDeckDraft(duplicated.save, duplicated.deckId, {
    name: "Shellshore Discoveries",
    cards: customCards,
  }, cardsById).save;
  save = setActiveSavedDeck(save, duplicated.deckId, cardsById).save;

  const backend = new MemoryStorage();
  const storage = createAdventureStorageAdapter({
    backend,
    now: () => new Date("2026-07-18T18:00:00.000Z"),
  });
  assert.equal(storage.startNewProfile(profileId, { saveValue: save }).ok, true);
  const reloaded = storage.loadProfile(profileId).save;
  assert.equal(reloaded.player.activeDeckId, duplicated.deckId);

  const launchSnapshot = createActiveDuelDeckSnapshot(reloaded, cardsById);
  const runtimeSnapshot = resolveStoryPlayerDeckSnapshot(
    launchSnapshot,
    cardsById,
    duplicated.deckId,
  );
  assert.equal(runtimeSnapshot.fingerprint, fingerprintDeckCards(customCards));
  assert.equal(runtimeSnapshot.cards.find((entry) => entry.cardId === discoveryCardId)?.quantity, 1);

  // Editing the persisted library after launch cannot mutate the frozen match.
  const editedAfterLaunch = replaceSavedDeckDraft(reloaded, duplicated.deckId, {
    name: "Changed After Launch",
    cards: Object.fromEntries(starter.cards.map((entry) => [entry.cardId, entry.quantity])),
  }, cardsById).save;
  assert.notEqual(
    fingerprintDeckCards(editedAfterLaunch.savedDecks[duplicated.deckId].cards),
    runtimeSnapshot.fingerprint,
  );
  assert.equal(runtimeSnapshot.name, "Shellshore Discoveries");
  assert.equal(runtimeSnapshot.cards.find((entry) => entry.cardId === discoveryCardId)?.quantity, 1);

  const result = createStoryDuelResult({
    encounterId: "encounter-shellshore-dorian",
    opponentId: "dorian",
    opponentName: "Dorian",
    playerDeckId: runtimeSnapshot.id,
    playerDeckSnapshot: runtimeSnapshot,
    opponentDeckId: "darkness-shroud",
    victoryTarget: 30,
    difficulty: "hard",
    playerVp: 30,
    opponentVp: 6,
    round: 4,
    turn: 8,
    message: "Victory: you reached 30 VP against Dorian's 6 VP.",
  });
  assertAdventureDuelResultMatchesLaunch(result, {
    encounterId: "encounter-shellshore-dorian",
    opponentId: "dorian",
    opponentDeckId: "darkness-shroud",
    victoryTarget: 30,
    playerDeckSnapshot: runtimeSnapshot,
  });
  const recorded = recordAdventureDuelResult(editedAfterLaunch, result).save;
  const provenance = recorded.progression.encounterResults["encounter-shellshore-dorian"].firstVictory;
  assert.equal(provenance.playerDeckId, duplicated.deckId);
  assert.equal(provenance.playerDeckFingerprint, runtimeSnapshot.fingerprint);

  assert.equal(storage.autosave(profileId, recorded, "custom-deck-dorian-result").ok, true);
  const finalReload = storage.loadProfile(profileId).save;
  assert.equal(
    finalReload.progression.encounterResults["encounter-shellshore-dorian"].firstVictory.playerDeckFingerprint,
    runtimeSnapshot.fingerprint,
  );
});
