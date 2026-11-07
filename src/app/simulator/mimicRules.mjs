export function isMimicAction(action) {
  return [action?.effect, ...(action?.effects ?? [])].some((effect) => effect?.type === "mimicAction");
}

/** Copy the action, never the donor creature's identity, passives, or usage. */
export function createMimicAction(mimicAction, donorAction, donor = {}) {
  const donorName = typeof donorAction === "string" ? donorAction.split(":")[0].trim() : donorAction?.name ?? "Action";
  const text = typeof donorAction === "string" ? donorAction : donorAction?.text ?? "";
  const copied = typeof donorAction === "object" ? donorAction : {};
  return {
    ...copied,
    id: mimicAction?.id ?? "mimic",
    name: `Mimic — ${donorName}`,
    text: text.replace(/Cost:\s*\d+\s*RP\.?/gi, "").trim(),
    cost: { rp: Number(mimicAction?.cost?.rp ?? 3) },
    oncePerTurn: true,
    mimic: {
      donorCardId: donor.cardId ?? donor.card?.id,
      donorInstanceId: donor.instanceId,
      donorActionName: donorName,
      donorActionIndex: donor.actionIndex,
      skipNextTurn: donorAction?.cooldown?.duration === "yourNextTurn" || /cannot (?:use|be performed|be used).*next turn/i.test(text),
    },
  };
}

/** Each choice identifies a physical donor and one printed Action (never On Play). */
export function collectMimicChoices(creatures, controller, mimicAction, { getAttack, getUtility }) {
  return creatures.flatMap((entry) => {
    if (entry.controller === controller || entry.card?.kind !== "creature" || entry.card.abilitiesStunned) return [];
    return (entry.card.actions ?? []).flatMap((donorAction, actionIndex) => {
      if (isMimicAction(donorAction)) return [];
      const donorAttack = getAttack({ ...entry.card, actions: [donorAction] });
      const effect = getUtility(donorAction);
      if ((!donorAttack && !effect) || effect?.type === "mimicAction") return [];
      const action = createMimicAction(mimicAction, donorAction, { ...entry, actionIndex });
      if (typeof donorAction === "string" && effect) action.effect = effect;
      const key = `${entry.instanceId}:${actionIndex}`;
      return [{
        key, donorCardId: entry.card.id, donorInstanceId: entry.instanceId,
        donorName: entry.card.name, actionIndex, action, effect,
        attack: donorAttack ? {
          ...donorAttack, id: action.id, actionName: action.name,
          actionCost: action.cost.rp, mimic: { ...action.mimic, choiceKey: key },
        } : null,
      }];
    });
  });
}
