import { ADVENTURE_CONTENT } from "./adventureContent.mjs";

const FIELD_NOTE_LOCATION_BY_ID = Object.freeze({
  "field-note-harbor-basics": "Shellshore Harbor",
  "field-note-coral-observations": "Sunpatch Cay",
  "field-note-estuary-conditions": "Brackwater Landing",
  "field-note-current-connections": "Current Commons",
  "field-note-kelp-food-web": "Kelpwatch Island",
  "field-note-deep-adaptations": "Trenchlight Station",
  "field-note-archipelago-reflection": "Champion's Wake",
});

export function buildUnlockedAdventureFieldNotes(entryIds, content = ADVENTURE_CONTENT) {
  if (!Array.isArray(entryIds)) return Object.freeze([]);

  const notesById = new Map((content?.fieldNotes ?? []).map((note) => [note.id, note]));
  const seen = new Set();
  return Object.freeze(entryIds.flatMap((entryId) => {
    if (seen.has(entryId)) return [];
    seen.add(entryId);
    const note = notesById.get(entryId);
    return note ? [note] : [];
  }));
}

export function getAdventureFieldNoteEyebrow(noteId, content = ADVENTURE_CONTENT) {
  const noteIndex = (content?.fieldNotes ?? []).findIndex((note) => note.id === noteId);
  if (noteIndex < 0) return "Reefbound Field Note";

  const number = String(noteIndex + 1).padStart(2, "0");
  const location = FIELD_NOTE_LOCATION_BY_ID[noteId] ?? "Reefbound Journal";
  return `Field Note ${number} / ${location}`;
}
