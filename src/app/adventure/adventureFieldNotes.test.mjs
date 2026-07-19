import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  buildUnlockedAdventureFieldNotes,
  getAdventureFieldNoteEyebrow,
} from "./adventureFieldNotes.mjs";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("the Field Note library contains every known unlocked note in acquisition order", () => {
  const requestedIds = [
    "field-note-harbor-basics",
    "field-note-current-connections",
    "unknown-migrated-note",
    "field-note-coral-observations",
    "field-note-current-connections",
  ];

  const notes = buildUnlockedAdventureFieldNotes(requestedIds);

  assert.deepEqual(notes.map(({ id }) => id), [
    "field-note-harbor-basics",
    "field-note-current-connections",
    "field-note-coral-observations",
  ]);
  assert.ok(notes.every(({ glossary }) => glossary.length > 0));
  assert.equal(Object.isFrozen(notes), true);
  assert.deepEqual(buildUnlockedAdventureFieldNotes(null), []);
});

test("Field Note display labels cover the whole authored journal", () => {
  const labels = ADVENTURE_CONTENT.fieldNotes.map(({ id }) => getAdventureFieldNoteEyebrow(id));

  assert.equal(labels[0], "Field Note 01 / Elverson Shore");
  assert.equal(labels.at(-1), "Field Note 07 / Champion's Wake");
  assert.equal(new Set(labels).size, ADVENTURE_CONTENT.fieldNotes.length);
  assert.equal(getAdventureFieldNoteEyebrow("missing-note"), "Reefbound Field Note");
});

test("the pause menu opens an accessible selectable journal on the latest unlocked note", () => {
  assert.match(component, /fieldNoteCount > 0[\s\S]*Open Field Notes \(\{fieldNoteCount\}\)/);
  assert.match(component, /buildUnlockedAdventureFieldNotes\(gameSave\?\.fieldNotes\.entryIds \?\? \[\]\)[\s\S]*?\.filter\(\(note\) => note\.id === SHELLSHORE_FIELD_NOTE\.id\)/);
  assert.match(component, /<nav className=\{styles\.fieldNoteJournal\} aria-label="Unlocked Field Notes">/);
  assert.match(component, /journalNotes\.map\(\(entry\) =>[\s\S]*aria-current=\{entry\.id === note\.id \? "page" : undefined\}[\s\S]*onClick=\{\(\) => onSelect\(entry\.id\)\}/);
  assert.match(component, /setActiveFieldNoteId\(unlockedFieldNotes\.at\(-1\)\?\.id \?\? SHELLSHORE_FIELD_NOTE\.id\)/);
  assert.doesNotMatch(component, /setActiveFieldNoteId\(gameSave\.fieldNotes\.entryIds\.at\(-1\)/);
  assert.match(component, /note\.glossary\.map\(\(entry\) =>/);
  assert.match(component, /reviewRequired \? \[note\] : notes/);
});

test("the Field Note index has clear selected, keyboard-focus, and responsive states", () => {
  assert.match(styles, /\.fieldNoteJournal button:focus-visible\s*\{/);
  assert.match(styles, /\.fieldNoteJournal button\[aria-current="page"\]\s*\{/);
  assert.match(styles, /\.fieldNoteCard \.fieldNoteJournal ul\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.fieldNoteCard \.fieldNoteJournal ul\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});
