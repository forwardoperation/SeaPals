// Instance-based rules shared by Simulator and Reefbound. A stun belongs to a
// physical card, not its printed ID or the slot it happens to occupy.
export function abilityInstanceId(id) {
  return String(id ?? "").replace(/^slot-card:/, "").replace(/^hosted:hosted:/, "hosted:").replace(/^hosted:orphan-hosted:/, "orphan-hosted:");
}

export function creatureAbilitiesAreStunned(statuses = {}, instanceId) {
  return Boolean(instanceId && statuses[`ability:${abilityInstanceId(instanceId)}`]?.some((status) => status.type === "abilityStun"));
}

export function stunCreatureAbilities(statuses = {}, instanceId, sourceCardId) {
  if (!instanceId) return statuses;
  const key = `ability:${abilityInstanceId(instanceId)}`;
  return { ...statuses, [key]: [
    ...(statuses[key] ?? []).filter((status) => status.type !== "abilityStun"),
    { type: "abilityStun", sourceCardId, expiresTurn: Number.MAX_SAFE_INTEGER },
  ] };
}

export function clearCreatureAbilityStuns(statuses = {}) {
  return Object.fromEntries(Object.entries(statuses).map(([key, effects]) => [key, effects.filter((effect) => effect.type !== "abilityStun")]).filter(([, effects]) => effects.length));
}

export function creatureAbilityCard(card, statuses, instanceId) {
  return card && creatureAbilitiesAreStunned(statuses, instanceId)
    ? { ...card, passives: [], actions: [], onPlay: [], bonusVictoryPoints: undefined, abilitiesStunned: true }
    : card;
}

export function onPlayAttackIsAvailable(attack, ownHabitats = [], opposingHabitats = []) {
  return Boolean(attack && (!attack.requiredHabitatId || [...ownHabitats, ...opposingHabitats].includes(attack.requiredHabitatId)));
}

// Keep physical location separate from ownership (an invading Lionfish lives
// on the other reef). Hosted array indices are never compacted after removal.
export function collectReefAbilityCreatures(states, cardLookup) {
  const entries = [];
  for (const physicalController of ["player", "opponent"]) {
    const state = states[physicalController] ?? {};
    const add = (entry) => {
      const card = cardLookup[entry.cardId];
      if (card?.kind !== "creature") return;
      entries.push({ ...entry, physicalController, card: creatureAbilityCard(card, states[entry.controller]?.creatureStatuses, entry.instanceId) });
    };
    for (const coral of state.corals ?? []) {
      add({ cardId: coral.cardId, instanceId: `foundation:${coral.id}`, coralId: coral.id, location: "foundation", controller: physicalController });
      for (const slot of coral.slots ?? []) {
        const controller = slot.invasiveOwner ?? slot.controller ?? physicalController;
        if (slot.cardId) add({ cardId: slot.cardId, instanceId: slot.cardInstanceId ?? slot.instanceId ?? `${coral.id}:${slot.id}:${slot.cardId}`, coralId: coral.id, slotId: slot.id, location: "slot", controller });
        (slot.hostedCardIds ?? []).forEach((cardId, hostedIndex) => {
          if (cardId) add({ cardId, instanceId: `hosted:${slot.id}:${hostedIndex}`, coralId: coral.id, slotId: slot.id, hostedIndex, location: "hosted-slot", controller });
        });
      }
    }
    const reef = state.reefCreatureInstances ?? (state.reefCreatures ?? []).map((cardId, index) => ({ cardId, instanceId: `legacy-${physicalController}-reef-${index}-${cardId}` }));
    reef.forEach((entry, reefIndex) => add({ ...entry, reefIndex, location: "reef", controller: entry.invasiveOwner ?? entry.controller ?? physicalController }));
    const orphans = state.orphanCreatureInstances ?? state.orphanCreatures ?? [];
    orphans.forEach((entry, orphanIndex) => {
      const controller = entry.invasiveOwner ?? entry.controller ?? physicalController;
      const instanceId = entry.instanceId ?? `orphan:${orphanIndex}:${entry.cardId}`;
      add({ ...entry, instanceId, orphanIndex, location: "orphan", controller });
      (entry.hostedCardIds ?? []).forEach((cardId, hostedIndex) => {
        if (cardId) add({ cardId, instanceId: `orphan-hosted:${instanceId}:${hostedIndex}`, orphanInstanceId: instanceId, orphanIndex, hostedIndex, location: "hosted-orphan", controller });
      });
    });
  }
  return entries;
}

// Aggregate rules still use printed card lists. Match suppressed copies by
// count so stunning one duplicate never disables every copy of that card.
export function suppressStunnedAbilityCards(cards, state, cardLookup) {
  if (!state?.creatureStatuses) return cards;
  const suppressed = new Map();
  for (const entry of collectReefAbilityCreatures({ player: state, opponent: { creatureStatuses: state.creatureStatuses } }, cardLookup)) {
    if (entry.card.abilitiesStunned) suppressed.set(entry.cardId, (suppressed.get(entry.cardId) ?? 0) + 1);
  }
  return cards.map((card) => {
    if (!suppressed.get(card?.id)) return card;
    suppressed.set(card.id, suppressed.get(card.id) - 1);
    return { ...card, passives: [], actions: [], onPlay: [], bonusVictoryPoints: undefined, abilitiesStunned: true };
  });
}

export function getNeurotoxicDefenseFlips(defender, attacker, creatures, random = Math.random) {
  if (!defender?.card?.passives?.some((passive) => passive.effect?.type === "neurotoxicDefense")) return [];
  const targets = [
    ...(attacker?.card?.category === "predator" ? [attacker] : []),
    ...((defender.location === "slot" || defender.location === "hosted-slot") ? creatures.filter((entry) => entry.physicalController === defender.physicalController && entry.coralId === defender.coralId && ["slot", "hosted-slot"].includes(entry.location)) : []),
  ];
  // The card says each creature on the same coral, so the Cowfish itself is
  // included. Each physical creature gets its own independent coin.
  return targets.filter((entry, index) => targets.findIndex((other) => other.instanceId === entry.instanceId) === index)
    .map((target) => ({ target, result: random() < 0.5 ? "heads" : "tails" }));
}

export function getOpportunistTriggers(creatures, attackingController, attackerInstanceId) {
  return creatures.flatMap((entry) => {
    if (entry.controller !== attackingController || abilityInstanceId(entry.instanceId) === abilityInstanceId(attackerInstanceId)) return [];
    const passive = entry.card?.passives?.find((ability) => ability.effect?.type === "opportunist");
    return passive ? [{ ...entry, attack: { ...passive.effect, type: "attack", target: { categories: passive.effect.targetCategories }, actionName: passive.name, actionCost: 0, repeat: 1, triggered: true } }] : [];
  });
}
