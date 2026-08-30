export const RULES_CHAT_PLACEMENTS = Object.freeze({
  SITE: "site",
  SIMULATOR: "simulator",
});

const SITE_SUGGESTIONS = Object.freeze([
  "How do I start a game?",
  "How does attacking work?",
  "What does a Parrotfish do?",
]);

function normalizedConditionName(value) {
  const conditionName = String(value ?? "").trim();
  return conditionName && !/^no active condition$/i.test(conditionName)
    ? conditionName
    : null;
}

export function shouldRenderRulesChat(pathname, placement = RULES_CHAT_PLACEMENTS.SITE) {
  if (placement === RULES_CHAT_PLACEMENTS.SIMULATOR) return true;
  const route = String(pathname ?? "");
  return !route.startsWith("/simulator")
    && route !== "/instructions/tutorial"
    && !route.startsWith("/adventure")
    && !route.startsWith("/auth")
    && !route.startsWith("/privacy")
    && !route.startsWith("/store")
    && !route.startsWith("/terms");
}

export function getRulesChatGreeting(placement = RULES_CHAT_PLACEMENTS.SITE) {
  if (placement === RULES_CHAT_PLACEMENTS.SIMULATOR) {
    return "Hi! I’m Finn. Ask me about a rule, a card, or a simulator control. Opening this chat will not change your match.";
  }
  return "Ahoy! I’m Finn, your SeaPals rules buddy. What would you like to know?";
}

export function getRulesChatSuggestions({
  placement = RULES_CHAT_PLACEMENTS.SITE,
  gamePhase = null,
  activeConditionName = null,
} = {}) {
  if (placement !== RULES_CHAT_PLACEMENTS.SIMULATOR) return SITE_SUGGESTIONS;

  const conditionName = normalizedConditionName(activeConditionName);
  const conditionQuestion = conditionName ? `What does ${conditionName} do?` : null;
  const phase = String(gamePhase ?? "").toLowerCase();

  if (phase === "setup") {
    return Object.freeze([
      "What should I do now?",
      "What can I play during setup?",
      "What does Coral Reef require?",
    ]);
  }
  if (phase === "draw") {
    return Object.freeze([
      "What should I do now?",
      "Which deck should I draw from?",
      conditionQuestion ?? "What is RP?",
    ]);
  }
  if (phase === "main") {
    return Object.freeze([
      "What should I do now?",
      "Why can’t I play this card?",
      conditionQuestion ?? "What does Coral Reef require?",
    ]);
  }
  if (phase === "opponent") {
    return Object.freeze([
      "What should I do now?",
      "What happens during the opponent’s turn?",
      conditionQuestion ?? "How does defense work?",
    ]);
  }
  return Object.freeze([
    "What should I do now?",
    "How do Coral slots work?",
    "What does Coral Reef require?",
  ]);
}
