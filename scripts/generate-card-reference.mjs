import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { getTutorialCardReferenceRules } from "../src/app/simulator/tutorialCardLessons.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { fsCache: false });
const { allCards } = jiti(path.join(root, "src/data/cards/index.js"));
const clean = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const name = (card) => `${card.subtitle ? `${card.subtitle} ` : ""}${card.name}${card.stageLabel ? ` (${card.stageLabel})` : ""}`;
const intro = "Generated from `src/data/cards` with `npm run docs:cards`. These are the playable card definitions shared by the simulators and Finn. For the gallery audit and designs outside the playable catalog, see [gallery-card-audit.md](gallery-card-audit.md).\n";
const creatures = allCards.filter((card) => card.kind === "creature");
const roster = [
  "# SeaRealm Creature Roster", "", intro,
  "| Creature | ID | Zone | Class | RP | VP | HP | School Density | Density required | Defense |",
  "|---|---|---|---|---:|---:|---:|---:|---:|---|",
  ...creatures.map((card) => `| ${[name(card), card.id, card.zone, card.category, card.cost?.rp ?? 0, card.victoryPoints ?? 0, card.health, card.schoolDensity, card.schoolDensityRequirement, card.defense?.dice].map(clean).join(" | ")} |`),
  "", "RP is play cost. School Density is supplied capacity; density required is committed capacity. Printed VP applies while the card remains in play. Conditional rules, targets, and timings are in the [complete card reference](card-rules-reference.md).", "",
].join("\n");
const reference = ["# SeaRealm Card Rules Reference", "", intro, `Playable cards: ${allCards.length}.`, ""];
for (const card of allCards) {
  reference.push(`## ${name(card)}`, "", `ID: \`${card.id}\`. ${[card.zone, card.category, card.supportType].filter(Boolean).join(" / ")}. [Gallery](/gallery#card-${card.id}).`, "");
  const stats = [`Play cost: ${card.cost?.rp ?? 0} RP`];
  if (card.victoryPoints != null) stats.push(`${card.victoryPoints} VP`);
  if (card.health != null) stats.push(`${card.health} HP`);
  if (card.defense?.dice) stats.push(`Defense: ${card.defense.dice}`);
  if (card.schoolDensity != null) stats.push(`School Density: ${card.schoolDensity}`);
  if (card.schoolDensityRequirement != null) stats.push(`Density required: ${card.schoolDensityRequirement}`);
  reference.push(`${stats.join("; ")}.`, "");
  if (card.supportType) reference.push(card.supportType === "aide" ? "One Aide per turn. Items may still be played afterward." : "Items have no per-turn count limit and may be played after an Aide.", "");
  if (card.weaknesses?.length) reference.push(`Weaknesses: ${card.weaknesses.join(", ")}.`, "");
  if (card.slots?.length) reference.push(`Slots: ${card.slots.map((slot) => `${slot.count ?? 1} ${slot.zone ?? card.zone} ${slot.slotClass ?? slot.slotType}`).join(", ")}.`, "");
  const rules = getTutorialCardReferenceRules(card);
  for (const rule of rules) reference.push(`- **${clean(rule.label)}${rule.name ? ` — ${clean(rule.name)}` : ""}:** ${clean(rule.text)}`);
  reference.push("");
}
const outputs = new Map([["docs/creature-roster.md", roster], ["docs/card-rules-reference.md", reference.join("\n")]]);
let stale = false;
for (const [relative, content] of outputs) {
  const destination = path.join(root, relative);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, "utf8").replaceAll("\r\n", "\n") !== content) {
      console.error(`Stale card documentation: ${relative}. Run npm run docs:cards.`);
      stale = true;
    }
  } else fs.writeFileSync(destination, content);
}
if (stale) process.exitCode = 1;
else console.log(`${process.argv.includes("--check") ? "Verified" : "Generated"} card reference and roster (${allCards.length} cards, ${creatures.length} creatures).`);
