import assert from "node:assert/strict";
import test from "node:test";

import { summarizeSurveyResponses } from "./surveySummary.mjs";

const questions = [
  {
    id: "favorite",
    type: "radio",
    options: ["Reef", "Ocean"],
  },
  {
    id: "features",
    type: "checkbox",
    options: ["Cards", "Story"],
  },
  {
    id: "score",
    type: "scale",
    min: 1,
    max: 10,
  },
  {
    id: "free_text",
    type: "textarea",
  },
];

test("public survey summaries expose only authored aggregate choices", () => {
  const summary = summarizeSurveyResponses(
    [
      {
        answers: {
          favorite: "Reef",
          favorite_other: "My full name is Private Person",
          features: ["Cards", "private@example.com"],
          score: 9,
          free_text: "Call me at a private phone number.",
        },
      },
      {
        answers: {
          favorite: "Injected identifying answer",
          features: ["Story"],
          score: 11,
          free_text: "Another identifying answer.",
        },
      },
    ],
    questions,
  );

  assert.deepEqual(summary.favorite, {
    type: "radio",
    counts: { Reef: 1 },
  });
  assert.deepEqual(summary.features, {
    type: "checkbox",
    counts: { Cards: 1, Story: 1 },
  });
  assert.deepEqual(summary.score, {
    type: "scale",
    average: 9,
    count: 1,
  });
  assert.equal(summary.free_text, undefined);
  assert.doesNotMatch(JSON.stringify(summary), /Private Person|private@example|phone/i);
});

test("legacy Booster pack interest rolls into the authored Dive Packs summary", () => {
  const summary = summarizeSurveyResponses([
    { answers: { see_next: ["Booster packs"] } },
    { answers: { see_next: ["Dive Packs"] } },
  ]);

  assert.deepEqual(summary.see_next, {
    type: "checkbox",
    counts: { "Dive Packs": 2 },
  });
});
