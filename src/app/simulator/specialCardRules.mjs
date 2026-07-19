export const STUNNED_STATUS_TYPE = "stunned";

export function createStunnedStatus(sourceCardId = null) {
  return {
    type: STUNNED_STATUS_TYPE,
    sourceCardId,
  };
}

export function coralIsStunned(coral) {
  return (coral?.statuses ?? []).some((status) => status?.type === STUNNED_STATUS_TYPE);
}

export function coralCanUseOwnAbilities(coral) {
  return !coralIsStunned(coral);
}

/**
 * Stunned lasts through the end of the affected Coral controller's next turn.
 * Stun effects in the current card pool always target the opposing controller,
 * so the controller's end-turn transition is the authoritative expiry point.
 */
export function clearStunnedAtControllerTurnEnd(coral) {
  if (!coralIsStunned(coral)) return coral;
  return {
    ...coral,
    statuses: (coral.statuses ?? []).filter((status) => status?.type !== STUNNED_STATUS_TYPE),
  };
}

export function clearStunnedFromFoundationsAtControllerTurnEnd(foundations = []) {
  const recoveredFoundationIds = foundations
    .filter(coralIsStunned)
    .map((foundation) => foundation.id);
  return {
    foundations: foundations.map(clearStunnedAtControllerTurnEnd),
    recoveredFoundationIds,
  };
}

export function resolveStunnedAtControllerTurnBoundary(foundations = [], { turnComplete = true } = {}) {
  if (!turnComplete) {
    return {
      foundations,
      recoveredFoundationIds: [],
    };
  }
  return clearStunnedFromFoundationsAtControllerTurnEnd(foundations);
}

/**
 * Parasite first transfers RP from the opposing bank, then collects any
 * shortfall from the shared board supply. Both sources remain constrained by
 * the receiving controller's current RP-bank cap.
 */
export function resolveParasiteCollection({
  requested = 0,
  opposingRp = 0,
  recipientRp = 0,
  recipientCap = Infinity,
} = {}) {
  const wanted = Math.max(0, Math.floor(Number(requested) || 0));
  const source = Math.max(0, Number(opposingRp) || 0);
  const recipient = Math.max(0, Number(recipientRp) || 0);
  const numericCap = Number(recipientCap);
  const cap = Number.isFinite(numericCap) ? Math.max(0, numericCap) : Infinity;
  const availableRoom = Math.max(0, cap - recipient);
  const transferredFromOpponent = Math.min(wanted, source, availableRoom);
  const roomAfterTransfer = Math.max(0, availableRoom - transferredFromOpponent);
  const requestedFromSupply = Math.max(0, wanted - transferredFromOpponent);
  const collectedFromSupply = Math.min(requestedFromSupply, roomAfterTransfer);
  const collected = transferredFromOpponent + collectedFromSupply;

  return {
    requested: wanted,
    transferred: transferredFromOpponent,
    transferredFromOpponent,
    collectedFromSupply,
    collected,
    uncollected: wanted - collected,
    sourceAfter: source - transferredFromOpponent,
    recipientAfter: recipient + collected,
  };
}

/** Resolves one independent Ensnare flip for exactly one attack. */
export function resolveEnsnareForAttack(attack, random = Math.random) {
  const ensnare = attack?.ensnare;
  if (!ensnare || !Number.isFinite(Number(ensnare.penalty))) {
    return { attack, applied: false, coinResult: null, penalty: 0 };
  }
  const coinResult = random() < 0.5 ? "heads" : "tails";
  const applied = coinResult === "heads";
  const penalty = applied ? Math.max(0, Number(ensnare.penalty)) : 0;
  const { ensnarePenalty: _previousPenalty, ...baseAttack } = attack;
  return {
    attack: applied ? { ...baseAttack, ensnarePenalty: penalty } : baseAttack,
    applied,
    coinResult,
    penalty,
  };
}

export function isInvasiveSlotOwnedBy(slot, controller) {
  return Boolean(slot?.cardId && slot?.invasiveOwner === controller && slot?.controller === controller);
}

/**
 * Cards are affected by effects for the reef they physically occupy, but an
 * invasive card still returns to its controller's zones when it leaves play.
 */
export function getReefCardOwner(entry, hostController) {
  return entry?.invasiveOwner ?? entry?.controller ?? hostController;
}

export function canSpearfishReefCard(entry, hostController, foreignTargetCardIds = []) {
  if (!entry?.cardId) return false;
  const owner = getReefCardOwner(entry, hostController);
  return owner === hostController || (
    entry.invasiveOwner === owner
    && entry.controller === owner
    && foreignTargetCardIds.includes(entry.cardId)
  );
}

export function getInvasiveCreatureTargets(foundations = [], controller) {
  return foundations.flatMap((foundation) => (foundation.slots ?? [])
    .filter((slot) => isInvasiveSlotOwnedBy(slot, controller))
    .map((slot) => ({
      coralId: foundation.id,
      slotId: slot.id,
      cardId: slot.cardId,
      instanceId: slot.cardInstanceId ?? `${foundation.id}:${slot.id}:${slot.cardId}`,
    })));
}

export function isInvasiveOrphanOwnedBy(entry, controller) {
  return Boolean(entry?.cardId && entry?.invasiveOwner === controller && entry?.controller === controller);
}

export function getInvasiveOrphanTargets(orphanEntries = [], controller) {
  return orphanEntries.flatMap((entry, index) => isInvasiveOrphanOwnedBy(entry, controller) ? [{
    orphanIndex: index,
    cardId: entry.cardId,
    instanceId: entry.instanceId ?? entry.cardInstanceId ?? `orphan:${index}:${entry.cardId}`,
  }] : []);
}

/** Foreign invasive orphans stay visible on the host reef but are not usable. */
export function getLocallyControlledOrphans(orphanEntries = [], hostController) {
  return orphanEntries.filter((entry) => !entry?.invasiveOwner || (
    entry.invasiveOwner === hostController && entry.controller === hostController
  ));
}

export function removeInvasiveOrphan(orphanEntries = [], { instanceId, controller } = {}) {
  let removedCardId = null;
  const orphans = orphanEntries.filter((entry, index) => {
    const candidateInstanceId = entry.instanceId ?? entry.cardInstanceId ?? `orphan:${index}:${entry.cardId}`;
    if (candidateInstanceId !== instanceId || !isInvasiveOrphanOwnedBy(entry, controller)) return true;
    removedCardId = entry.cardId;
    return false;
  });
  return { orphans, removedCardId };
}

export function placeInvasiveCreature(foundations = [], {
  coralId,
  slotId,
  cardId,
  cardInstanceId = null,
  controller,
} = {}) {
  let placed = false;
  const nextFoundations = foundations.map((foundation) => {
    if (foundation.id !== coralId) return foundation;
    return {
      ...foundation,
      slots: (foundation.slots ?? []).map((slot) => {
        if (placed || slot.id !== slotId || slot.cardId) return slot;
        placed = true;
        return {
          ...slot,
          cardId,
          cardInstanceId,
          hostedCardIds: [],
          controller,
          invasiveOwner: controller,
        };
      }),
    };
  });
  return { foundations: nextFoundations, placed };
}

export function removeInvasiveCreature(foundations = [], { coralId, slotId, controller } = {}) {
  let removedCardId = null;
  const nextFoundations = foundations.map((foundation) => {
    if (foundation.id !== coralId) return foundation;
    return {
      ...foundation,
      slots: (foundation.slots ?? []).map((slot) => {
        if (slot.id !== slotId || !isInvasiveSlotOwnedBy(slot, controller)) return slot;
        removedCardId = slot.cardId;
        const {
          cardId: _cardId,
          cardInstanceId: _cardInstanceId,
          hostedCardIds: _hostedCardIds,
          controller: _controller,
          invasiveOwner: _invasiveOwner,
          ...emptySlot
        } = slot;
        return { ...emptySlot, cardId: null, cardInstanceId: null, hostedCardIds: [] };
      }),
    };
  });
  return { foundations: nextFoundations, removedCardId };
}

/**
 * Resolve the complete specialized-Support removal of a foreign invader. The
 * acting player owns the physical reef, while `invaderController` owns the card.
 */
export function resolveSpearfishingInvaderRemoval({
  foundations = [],
  orphanEntries = [],
  target,
  invaderController,
  eligibleCardIds = [],
  supportCardId = "spearfishing",
  actorDiscardPile = [],
  invaderDiscardPile = [],
  actorRp = 0,
  actorRpCap = Infinity,
  supportCost = 0,
  recoveredRp = 0,
} = {}) {
  const unchanged = {
    success: false,
    foundations,
    orphanEntries,
    actorDiscardPile,
    invaderDiscardPile,
    actorRp,
    removedCardId: null,
  };
  if (!target?.cardId || !eligibleCardIds.includes(target.cardId) || !invaderController) return unchanged;

  const removal = target.location === "slot"
    ? removeInvasiveCreature(foundations, {
        coralId: target.coralId,
        slotId: target.slotId,
        controller: invaderController,
      })
    : target.location === "orphan"
      ? removeInvasiveOrphan(orphanEntries, {
          instanceId: target.instanceId,
          controller: invaderController,
        })
      : null;
  const removedCardId = removal?.removedCardId ?? null;
  if (removedCardId !== target.cardId) return unchanged;

  const normalizedCap = Number.isFinite(actorRpCap) ? Math.max(0, actorRpCap) : Infinity;
  return {
    success: true,
    foundations: target.location === "slot" ? removal.foundations : foundations,
    orphanEntries: target.location === "orphan" ? removal.orphans : orphanEntries,
    actorDiscardPile: [...(supportCardId ? [supportCardId] : []), ...actorDiscardPile],
    invaderDiscardPile: [removedCardId, ...invaderDiscardPile],
    actorRp: Math.min(normalizedCap, Math.max(0, actorRp - supportCost) + recoveredRp),
    removedCardId,
  };
}
