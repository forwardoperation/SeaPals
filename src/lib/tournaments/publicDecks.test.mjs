import assert from "node:assert/strict";
import test from "node:test";

import { PUBLIC_TOURNAMENT_DECK_COLUMNS } from "./publicDecks.mjs";

test("public tournament deck projection excludes private review fields", () => {
  const columns = new Set(
    PUBLIC_TOURNAMENT_DECK_COLUMNS.split(",").map((column) => column.trim()),
  );

  assert.deepEqual(columns, new Set([
    "id",
    "player_name",
    "deck_name",
    "cards",
    "status",
    "created_at",
  ]));
  assert.equal(columns.has("player_email"), false);
  assert.equal(columns.has("edit_token"), false);
  assert.equal(columns.has("admin_notes"), false);
});
