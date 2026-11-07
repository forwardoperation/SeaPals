import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import nextConfig from "../../../next.config.mjs";
import { getCardAliases } from "../../lib/rulesKnowledgeBank.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { encyclopediaCreatureBySlug, encyclopediaSlugByCardId } = jiti(
  path.join(projectRoot, "src/data/encyclopedia/index.js")
);

test("the renamed Day Octopus keeps its saved card ID and old-name knowledge lookup", () => {
  const card = cardsById.octopus;
  assert.equal(card.id, "octopus");
  assert.equal(card.name, "Day Octopus");
  assert.ok(getCardAliases(card).includes("octopus"));
  assert.ok(getCardAliases(card).includes("Day Octopus"));
  const creature = encyclopediaCreatureBySlug[encyclopediaSlugByCardId.octopus];
  assert.equal(creature.name, "Day Octopus");
  assert.equal(creature.scientificName, "Octopus cyanea");
  assert.ok(creature.aliases.includes("Octopus"));
  assert.deepEqual(creature.cardIds, ["octopus"]);
});

test("the old Octopus encyclopedia URL permanently redirects to its current profile", async () => {
  const redirect = (await nextConfig.redirects())
    .find((entry) => entry.source === "/encyclopedia/octopus");
  assert.equal(redirect.permanent, true);
  assert.equal(redirect.destination, "/encyclopedia/day-octopus");
  const destination = encyclopediaCreatureBySlug[redirect.destination.split("/").at(-1)];
  assert.deepEqual(destination.cardIds, ["octopus"]);
});
