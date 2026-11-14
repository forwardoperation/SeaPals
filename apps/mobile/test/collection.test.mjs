import { test } from "node:test";
import assert from "node:assert/strict";
import { createCollection, readCollection, grantPack, openPack } from "../src/collection.mjs";

test("repeated lesson completions and reloads cannot grant or open the same pack twice", () => {
  const awarded = grantPack(createCollection([{ cardId: "coral", quantity: 2 }]), "lesson:first-reef", "First reef");
  const restored = readCollection(JSON.stringify(awarded));
  assert.equal(grantPack(restored, "lesson:first-reef", "First reef"), restored);
  const opened = openPack(restored, "lesson:first-reef", ["coral", "fish", "crab", "shark"], () => .1);
  assert.equal(opened.packs["lesson:first-reef"].cardIds.length, 3);
  assert.equal(new Set(opened.packs["lesson:first-reef"].cardIds).size, 3);
  const reopened = readCollection(JSON.stringify(opened));
  assert.equal(openPack(reopened, "lesson:first-reef", [], () => { throw new Error("Should not draw again"); }), reopened);
  assert.equal(awarded.cards.coral, 2);
  assert.equal(awarded.packs["lesson:first-reef"].cardIds, null);
});

test("packs guarantee a new card when one is available and work with a complete collection", () => {
  let collection = createCollection(["a", "b", "c"].map((cardId) => ({ cardId, quantity: 1 })));
  collection = grantPack(collection, "welcome", "Welcome");
  const opened = openPack(collection, "welcome", ["a", "b", "c", "new"], () => 0);
  assert.equal(opened.packs.welcome.cardIds[0], "new");
  const next = grantPack(opened, "lesson:next", "Next lesson");
  assert.equal(openPack(next, "lesson:next", ["a", "b", "c", "new"], () => .99).packs["lesson:next"].cardIds.length, 3);
});

test("unearned packs and invalid random values cannot change inventory", () => {
  const collection = grantPack(createCollection(), "welcome", "Welcome");
  assert.throws(() => openPack(collection, "unearned", ["a", "b", "c"], () => 0), /not been earned/);
  for (const value of [NaN, -1, 1, Infinity]) {
    assert.throws(() => openPack(collection, "welcome", ["a", "b", "c"], () => value));
  }
  assert.deepEqual(collection.cards, {});
  assert.equal(collection.packs.welcome.cardIds, null);
});

test("corrupt or newer collections fail without replacing saved data", () => {
  for (const value of ["oops", '{"version":2}', '{"version":1,"cards":{"a":-1},"packs":{}}', '{"version":1,"cards":{},"packs":{"x":{"label":"X","cardIds":[]}}}']) {
    assert.throws(() => readCollection(value));
  }
});
