"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cardsById } from "@/data/cards";
import { getDeckAnalytics } from "@/lib/decks/deckAnalytics";
import {
  createSavedDeck,
  deleteSavedDeck,
  duplicateSavedDeck,
  replaceSavedDeckDraft,
  setActiveSavedDeck,
  validateAdventureDeck,
} from "./adventureDecks.mjs";
import styles from "./adventure.module.css";

const MAX_DECK_SIZE = 60;
const MAX_CARD_COPIES = 4;

function recordToEntries(cards = {}) {
  return Object.entries(cards)
    .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
    .map(([cardId, quantity]) => ({ cardId, quantity }))
    .sort((left, right) => left.cardId.localeCompare(right.cardId));
}

function labelFromIdentifier(value) {
  return String(value ?? "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function cardRuleLines(card) {
  const candidates = [
    card?.text,
    ...(card?.playRequirements ?? []),
    ...(card?.playRestrictions ?? []),
    ...(card?.passives ?? []),
    ...(card?.onPlay ?? []),
    ...(card?.actions ?? []),
    ...(card?.specialRules ?? []),
    card?.maintenance,
  ];
  const lines = candidates.flatMap((candidate) => {
    if (typeof candidate === "string") return [candidate.trim()];
    if (!candidate || typeof candidate !== "object") return [];
    const text = String(candidate.text ?? candidate.description ?? "").trim();
    const name = String(candidate.name ?? "").trim();
    if (!text) return [];
    return [name ? `${name}: ${text}` : text];
  }).filter(Boolean);
  return [...new Set(lines)];
}

function quantityRecordsMatch(left = {}, right = {}) {
  const leftEntries = recordToEntries(left);
  const rightEntries = recordToEntries(right);
  return leftEntries.length === rightEntries.length
    && leftEntries.every((entry, index) => (
      entry.cardId === rightEntries[index]?.cardId
      && entry.quantity === rightEntries[index]?.quantity
    ));
}

function useModalFocusTrap(active = true) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const selector = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
    const firstControl = dialog.querySelector(selector) ?? dialog;
    firstControl.focus({ preventScroll: true });

    function keepFocusInside(event) {
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const controls = [...dialog.querySelectorAll(selector)]
        .filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", keepFocusInside);
    return () => {
      dialog.removeEventListener("keydown", keepFocusInside);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return dialogRef;
}

function draftFromDeck(deckId, deck) {
  return {
    id: deckId,
    name: deck?.name ?? "Untitled Deck",
    cards: { ...(deck?.cards ?? {}) },
  };
}

function getValidation(deck, ownedCards) {
  try {
    return validateAdventureDeck(deck, ownedCards, cardsById);
  } catch (error) {
    return { isValid: false, errors: [error?.message ?? "This deck could not be checked."], warnings: [] };
  }
}

function DeckMetric({ label, value, target = null, tone = "cyan" }) {
  return (
    <div className={`${styles.deckMetric} ${styles[`deckMetric${tone}`] ?? ""}`}>
      <span>{label}</span>
      <strong>{value}{target !== null ? ` / ${target}` : ""}</strong>
    </div>
  );
}

export default function AdventureDecksModal({
  save,
  notice = null,
  blocked = false,
  initialDeckId = null,
  featuredCardIds = [],
  onCommit,
  onClose,
}) {
  const dialogRef = useModalFocusTrap(!blocked);
  const savedDeckIds = Object.keys(save.savedDecks);
  const startingDeckId = initialDeckId && save.savedDecks[initialDeckId]
    ? initialDeckId
    : save.player.activeDeckId && save.savedDecks[save.player.activeDeckId]
      ? save.player.activeDeckId
      : savedDeckIds[0] ?? null;
  const [selectedDeckId, setSelectedDeckId] = useState(startingDeckId);
  const [draft, setDraft] = useState(() => (
    startingDeckId ? draftFromDeck(startingDeckId, save.savedDecks[startingDeckId]) : null
  ));
  const [category, setCategory] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(featuredCardIds.length > 0);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [previewCardId, setPreviewCardId] = useState(null);

  useEffect(() => {
    if (selectedDeckId && save.savedDecks[selectedDeckId]) return;
    const nextId = save.player.activeDeckId && save.savedDecks[save.player.activeDeckId]
      ? save.player.activeDeckId
      : Object.keys(save.savedDecks)[0] ?? null;
    setSelectedDeckId(nextId);
    setDraft(nextId ? draftFromDeck(nextId, save.savedDecks[nextId]) : null);
  }, [save.player.activeDeckId, save.savedDecks, selectedDeckId]);

  const featuredCardSet = useMemo(() => new Set(featuredCardIds), [featuredCardIds]);
  const catalogCards = useMemo(() => Object.entries(cardsById)
    .map(([cardId, card]) => ({ cardId, owned: save.inventory.cards[cardId] ?? 0, card }))
    .filter((entry) => entry.card)
    .sort((left, right) => left.card.name.localeCompare(right.card.name)), [save.inventory.cards]);
  const categories = useMemo(() => [...new Set(catalogCards.map((entry) => entry.card.category))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right)), [catalogCards]);
  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogCards.filter(({ cardId, card }) => (
      (category === "all" || card.category === category)
      && (!featuredOnly || featuredCardSet.has(cardId))
      && (!query || card.name.toLowerCase().includes(query) || cardId.includes(query))
    ));
  }, [catalogCards, category, featuredCardSet, featuredOnly, search]);

  const draftEntries = useMemo(() => recordToEntries(draft?.cards), [draft?.cards]);
  const analytics = useMemo(() => getDeckAnalytics(draftEntries), [draftEntries]);
  const validation = useMemo(() => (
    draft ? getValidation({ id: draft.id, name: draft.name, cards: draft.cards }, save.inventory.cards) : null
  ), [draft, save.inventory.cards]);
  const isStarterDraft = draft?.id === save.player.starterDeckId;
  const activeDeckId = save.player.activeDeckId;
  const persistedDraft = draft ? save.savedDecks[draft.id] : null;
  const draftDirty = Boolean(
    draft
    && persistedDraft
    && (
      draft.name !== persistedDraft.name
      || !quantityRecordsMatch(draft.cards, persistedDraft.cards)
    )
  );
  const categoryComposition = useMemo(() => {
    const quantities = {};
    for (const { cardId, quantity } of draftEntries) {
      const categoryName = labelFromIdentifier(cardsById[cardId]?.category ?? "other");
      quantities[categoryName] = (quantities[categoryName] ?? 0) + quantity;
    }
    return Object.entries(quantities)
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [draftEntries]);

  function warnAboutUnsavedChanges() {
    if (!draftDirty) return false;
    setMessage({
      kind: "error",
      text: "This deck has unsaved changes. Save it, or choose Undo changes, before leaving or opening another deck.",
    });
    return true;
  }

  function commitResult(result, checkpointId, successMessage) {
    onCommit(result.save, { checkpointId, message: successMessage });
    return result.save;
  }

  function selectDeck(deckId) {
    const deck = save.savedDecks[deckId];
    if (!deck) return;
    setSelectedDeckId(deckId);
    setDraft(draftFromDeck(deckId, deck));
    setPendingDeleteId(null);
    setMessage(null);
  }

  function requestDeckSelection(deckId) {
    if (deckId !== draft?.id && warnAboutUnsavedChanges()) return;
    selectDeck(deckId);
  }

  function requestClose() {
    if (warnAboutUnsavedChanges()) return;
    onClose();
  }

  function createDeck() {
    if (warnAboutUnsavedChanges()) return;
    try {
      const result = createSavedDeck(save, { name: "New Reef Deck", cards: {} });
      commitResult(result, `deck-created:${result.deckId}`, "New deck created. Add owned cards, then save your draft.");
      setSelectedDeckId(result.deckId);
      setDraft(draftFromDeck(result.deckId, result.deck));
      setMessage({ kind: "info", text: "New deck created. It can be saved while incomplete, but must be legal before activation." });
    } catch (error) {
      setMessage({ kind: "error", text: error?.message ?? "A new deck could not be created." });
    }
  }

  function duplicateDeck(deckId) {
    if (warnAboutUnsavedChanges()) return;
    try {
      const result = duplicateSavedDeck(save, deckId, { cardCatalog: cardsById });
      commitResult(result, `deck-duplicated:${result.deckId}`, `${result.deck.name} added to your deck library.`);
      setSelectedDeckId(result.deckId);
      setDraft(draftFromDeck(result.deckId, result.deck));
      setMessage({ kind: "info", text: "Copy ready. Rename it and exchange cards from your collection." });
    } catch (error) {
      setMessage({ kind: "error", text: error?.message ?? "That deck could not be duplicated." });
    }
  }

  function confirmDelete(deckId) {
    if (deckId === draft?.id && warnAboutUnsavedChanges()) return;
    try {
      const result = deleteSavedDeck(save, deckId, { fallbackDeckId: save.player.starterDeckId });
      commitResult(result, `deck-deleted:${deckId}`, "Deck removed from this voyage.");
      const nextId = result.save.player.activeDeckId ?? Object.keys(result.save.savedDecks)[0] ?? null;
      setSelectedDeckId(nextId);
      setDraft(nextId ? draftFromDeck(nextId, result.save.savedDecks[nextId]) : null);
      setPendingDeleteId(null);
      setMessage({ kind: "info", text: "Deck deleted." });
    } catch (error) {
      setMessage({ kind: "error", text: error?.message ?? "That deck could not be deleted." });
    }
  }

  function adjustCard(cardId, amount) {
    if (!draft || isStarterDraft) return;
    const current = draft.cards[cardId] ?? 0;
    const owned = save.inventory.cards[cardId] ?? 0;
    const draftTotal = Object.values(draft.cards).reduce((total, quantity) => total + quantity, 0);
    const next = Math.max(0, Math.min(current + amount, owned, MAX_CARD_COPIES));
    if (amount > 0 && draftTotal >= MAX_DECK_SIZE) return;
    setDraft((value) => {
      const cards = { ...value.cards };
      if (next === 0) delete cards[cardId];
      else cards[cardId] = next;
      return { ...value, cards };
    });
    setMessage(null);
  }

  function saveDraft({ activate = false } = {}) {
    if (!draft || isStarterDraft) return;
    try {
      const replaced = replaceSavedDeckDraft(save, draft.id, {
        name: draft.name,
        cards: draft.cards,
      }, cardsById);
      const result = activate
        ? setActiveSavedDeck(replaced.save, draft.id, cardsById)
        : replaced;
      const successMessage = activate
        ? `${draft.name} is now your active adventure deck.`
        : `${draft.name} saved to this voyage.`;
      commitResult(result, `${activate ? "deck-activated" : "deck-saved"}:${draft.id}`, successMessage);
      setDraft(draftFromDeck(draft.id, result.save.savedDecks[draft.id]));
      setMessage({ kind: "info", text: successMessage });
    } catch (error) {
      const details = Array.isArray(error?.errors) && error.errors.length
        ? ` ${error.errors.join(" ")}`
        : "";
      setMessage({ kind: "error", text: `${error?.message ?? "That deck could not be saved."}${details}` });
    }
  }

  function activateLibraryDeck(deckId) {
    try {
      const result = setActiveSavedDeck(save, deckId, cardsById);
      commitResult(result, `deck-activated:${deckId}`, `${result.deck.name} is now active.`);
      setMessage({ kind: "info", text: `${result.deck.name} will be used for your next duel.` });
    } catch (error) {
      const details = Array.isArray(error?.errors) && error.errors.length
        ? ` ${error.errors.join(" ")}`
        : "";
      setMessage({ kind: "error", text: `${error?.message ?? "That deck is not ready."}${details}` });
      selectDeck(deckId);
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.decksLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="decks-title"
    >
      <section className={styles.decksCard}>
        <header className={styles.decksHeader}>
          <div>
            <div className={styles.introEyebrow}>Deck workshop</div>
            <h2 id="decks-title">Build from cards you own</h2>
            <p>Keep exactly 60 cards, no more than four copies of one card, at least one base Foundation, and at least 30 printed VP.</p>
          </div>
          <button type="button" className={styles.decksClose} onClick={requestClose}>Close</button>
        </header>

        {notice || message ? (
          <div
            className={`${styles.deckBuilderNotice} ${(message ?? notice)?.kind === "error" ? styles.deckBuilderNoticeError : ""}`}
            role={(message ?? notice)?.kind === "error" ? "alert" : "status"}
          >
            {message?.text ?? notice?.message}
          </div>
        ) : null}

        <div className={styles.decksWorkspace}>
          <aside className={styles.deckLibrary} aria-label="Saved deck library">
            <div className={styles.deckLibraryHeading}>
              <div>
                <span>Deck library</span>
                <strong>{savedDeckIds.length} saved</strong>
              </div>
              <button type="button" onClick={createDeck}>New deck</button>
            </div>
            <div className={styles.deckLibraryList}>
              {savedDeckIds.map((deckId) => {
                const deck = save.savedDecks[deckId];
                const deckEntries = recordToEntries(deck.cards);
                const deckAnalytics = getDeckAnalytics(deckEntries);
                const deckValidation = getValidation({ id: deckId, ...deck }, save.inventory.cards);
                const isStarter = deckId === save.player.starterDeckId;
                const isActive = deckId === activeDeckId;
                return (
                  <article key={deckId} className={`${styles.deckLibraryItem} ${selectedDeckId === deckId ? styles.deckLibraryItemSelected : ""}`}>
                    <button type="button" className={styles.deckLibrarySelect} onClick={() => requestDeckSelection(deckId)}>
                      <span>
                        <strong>{deck.name}</strong>
                        <small>{isStarter ? "Issued starter" : "Custom deck"}</small>
                      </span>
                      <span className={deckValidation.isValid ? styles.deckLegal : styles.deckNeedsWork}>
                        {deckValidation.isValid ? "Legal" : "Needs work"}
                      </span>
                      <em>{deckAnalytics.totalCards} cards / {deckAnalytics.totalVictoryPoints} VP</em>
                      {isActive ? <b>ACTIVE</b> : null}
                    </button>
                    <div className={styles.deckLibraryActions}>
                      <button type="button" onClick={() => duplicateDeck(deckId)}>Duplicate</button>
                      {!isActive ? <button type="button" onClick={() => activateLibraryDeck(deckId)}>Use deck</button> : null}
                      {!isStarter ? (
                        pendingDeleteId === deckId ? (
                          <>
                            <button type="button" className={styles.deckDeleteConfirm} onClick={() => confirmDelete(deckId)}>Confirm delete</button>
                            <button type="button" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                          </>
                        ) : <button type="button" onClick={() => setPendingDeleteId(deckId)}>Delete</button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>

          <section className={styles.deckEditor} aria-label="Selected deck editor">
            {draft ? (
              <>
                <div className={styles.deckEditorHeader}>
                  <label>
                    <span>Deck name</span>
                    <input
                      type="text"
                      maxLength={80}
                      value={draft.name}
                      readOnly={isStarterDraft}
                      onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
                    />
                  </label>
                  <div className={styles.deckEditorActions}>
                    {isStarterDraft ? (
                      <button type="button" onClick={() => duplicateDeck(draft.id)}>Duplicate to customize</button>
                    ) : (
                      <>
                        <button type="button" className={styles.deckSecondaryAction} onClick={() => selectDeck(draft.id)}>Undo changes</button>
                        <button type="button" onClick={() => saveDraft()}>Save draft</button>
                        <button type="button" disabled={!validation?.isValid} onClick={() => saveDraft({ activate: true })}>Save &amp; use</button>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.deckMetricsGrid}>
                  <DeckMetric label="Cards" value={analytics.totalCards} target={60} tone={analytics.totalCards === 60 ? "green" : "amber"} />
                  <DeckMetric label="Printed VP" value={analytics.totalVictoryPoints} target={30} tone={analytics.totalVictoryPoints >= 30 ? "green" : "amber"} />
                  <DeckMetric label="Average RP" value={analytics.averageRpCost.toFixed(1)} />
                  <DeckMetric label="Status" value={validation?.isValid ? "Legal" : "Needs work"} tone={validation?.isValid ? "green" : "amber"} />
                </div>

                <div className={styles.deckTraitPanel}>
                  <div>
                    <strong>Deck tendencies</strong>
                    <small>These indicators describe patterns in the selected cards—not deck strength or guaranteed results.</small>
                  </div>
                  <div className={styles.deckTraitGrid}>
                    {analytics.traitBars.map((trait) => (
                      <div key={trait.label} className={styles.deckTrait}>
                        <span>{trait.label}</span>
                        <div><i style={{ width: `${trait.value}%` }} /></div>
                        <b>{trait.value}</b>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${styles.deckTraitPanel} ${styles.deckCompositionPanel}`}>
                  <div>
                    <strong>Composition and VP share</strong>
                    <small>Card counts show what fills the deck. VP share shows where its printed victory points come from.</small>
                  </div>
                  <div className={styles.deckCompositionBody}>
                    <div className={styles.deckCompositionChips} aria-label="Category composition">
                      {categoryComposition.map((entry) => (
                        <span key={entry.label}><b>{entry.count}</b> {entry.label}</span>
                      ))}
                    </div>
                    <div className={styles.deckTraitGrid} aria-label="Victory point share by creature class">
                      {analytics.classBars.map((bar) => (
                        <div key={bar.category} className={styles.deckTrait}>
                          <span>{bar.label}</span>
                          <div><i style={{ width: `${bar.percent}%` }} /></div>
                          <b>{bar.victoryPoints} VP / {bar.percent}%</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {!validation?.isValid ? (
                  <section className={styles.deckIssues} aria-labelledby="deck-issues-title">
                    <strong id="deck-issues-title">Before this deck can duel</strong>
                    <ul>{validation?.errors?.map((error) => <li key={error}>{error}</li>)}</ul>
                  </section>
                ) : null}

                {!isStarterDraft && analytics.totalCards >= MAX_DECK_SIZE ? (
                  <div className={styles.deckFullHint} role="status">
                    Deck full: remove one card before adding a discovery from your collection.
                  </div>
                ) : null}

                <div className={styles.deckCollectionTools}>
                  <div className={styles.deckCategoryTabs} aria-label="Filter card catalog">
                    <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>
                    {featuredCardIds.length ? (
                      <button
                        type="button"
                        aria-pressed={featuredOnly}
                        onClick={() => setFeaturedOnly((value) => !value)}
                      >
                        New from pack ({featuredCardIds.length})
                      </button>
                    ) : null}
                    {categories.map((cardCategory) => (
                      <button
                        key={cardCategory}
                        type="button"
                        aria-pressed={category === cardCategory}
                        onClick={() => setCategory(cardCategory)}
                      >
                        {labelFromIdentifier(cardCategory)}
                      </button>
                    ))}
                  </div>
                  <label className={styles.deckSearch}>
                    <span>Search cards</span>
                    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Card name" />
                  </label>
                </div>

                <div className={styles.deckOwnedCardList} aria-label="Card catalog">
                  {visibleCards.map(({ cardId, owned, card }) => {
                    const quantity = draft.cards[cardId] ?? 0;
                    const conditionOnly = card.kind === "condition";
                    const canIncrease = !isStarterDraft
                      && !conditionOnly
                      && quantity < Math.min(owned, MAX_CARD_COPIES)
                      && analytics.totalCards < MAX_DECK_SIZE;
                    const lockedReason = conditionOnly
                      ? "Condition cards use the shared Condition deck."
                      : owned <= 0
                        ? "Not owned yet—earn this card from challenges or packs."
                        : quantity >= MAX_CARD_COPIES
                          ? "Four-copy limit reached."
                          : quantity >= owned
                            ? "Every owned copy is already in this deck."
                            : analytics.totalCards >= MAX_DECK_SIZE
                              ? "Deck full—remove a card before adding this one."
                              : null;
                    const rules = cardRuleLines(card);
                    const previewOpen = previewCardId === cardId;
                    return (
                      <article
                        key={cardId}
                        className={`${styles.deckOwnedCard} ${quantity ? styles.deckOwnedCardSelected : ""} ${featuredCardSet.has(cardId) ? styles.deckOwnedCardFeatured : ""} ${!owned || conditionOnly ? styles.deckOwnedCardLocked : ""}`}
                      >
                        <button
                          type="button"
                          className={styles.deckCardPreviewButton}
                          aria-expanded={previewOpen}
                          onClick={() => setPreviewCardId((value) => value === cardId ? null : cardId)}
                        >
                          {card.image ? <Image src={card.image} alt="" width={54} height={76} /> : <span aria-hidden="true">?</span>}
                          <span>
                            <strong>{card.name}</strong>
                            <small>{labelFromIdentifier(card.category)} / {labelFromIdentifier(card.kind)}</small>
                            <em>{lockedReason ?? `${owned} owned / maximum ${Math.min(owned, MAX_CARD_COPIES)} usable`}</em>
                          </span>
                        </button>
                        <div className={styles.deckQuantityControl}>
                          <button type="button" disabled={isStarterDraft || quantity <= 0} aria-label={`Remove one ${card.name}`} onClick={() => adjustCard(cardId, -1)}>−</button>
                          <output aria-label={`${quantity} ${card.name} in deck`}>{quantity}</output>
                          <button type="button" disabled={!canIncrease} title={lockedReason ?? undefined} aria-label={`Add one ${card.name}`} onClick={() => adjustCard(cardId, 1)}>+</button>
                        </div>
                        {previewOpen ? (
                          <div className={styles.deckCardPreview}>
                            <div>
                              <span>{Number(card.cost?.rp ?? 0)} RP</span>
                              {card.victoryPoints != null ? <span>{Number(card.victoryPoints)} VP</span> : null}
                              {card.health != null ? <span>{Number(card.health)} HP</span> : null}
                              {card.defense?.dice ? <span>Defense {card.defense.dice}</span> : null}
                            </div>
                            {rules.length
                              ? rules.map((rule) => <p key={rule}>{rule}</p>)
                              : <p>This card has no additional rules text.</p>}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  {!visibleCards.length ? (
                    <div className={styles.deckCatalogEmpty}>
                      No cards match these filters. Clear the search or show the full catalog.
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.deckEmptyState}>
                <h3>No decks yet</h3>
                <p>Create a deck or choose a starter to begin building.</p>
                <button type="button" onClick={createDeck}>Create deck</button>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
