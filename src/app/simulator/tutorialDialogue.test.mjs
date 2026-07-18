import test from "node:test";
import assert from "node:assert/strict";
import {
  createProfessorAnnouncement,
  createProfessorSpeechKey,
  createProfessorSpokenMessage,
  getProfessorConversationLead,
  getProfessorSpeechDuration,
  getProfessorVisibleGraphemeCount,
  segmentProfessorMessage,
} from "./tutorialDialogue.mjs";

test("Professor speech segmentation preserves complete Unicode graphemes", () => {
  const message = "Reefkeeper 🪸—café e\u0301lan!";
  const graphemes = segmentProfessorMessage(message);
  assert.equal(graphemes.join(""), message);
  assert.ok(graphemes.includes("🪸"));
  assert.ok(graphemes.includes("e\u0301"));
});

test("Professor speech duration stays useful for short and verbose lessons", () => {
  assert.equal(getProfessorSpeechDuration(0), 0);
  assert.equal(getProfessorSpeechDuration(1), 700);
  assert.equal(getProfessorSpeechDuration(1000), 3800);
  assert.ok(getProfessorSpeechDuration(100) > getProfessorSpeechDuration(10));
});

test("Professor speech progresses monotonically and completes exactly", () => {
  const options = { graphemeCount: 100, durationMs: 1000 };
  const frames = [0, 200, 500, 900, 1000].map((elapsedMs) => (
    getProfessorVisibleGraphemeCount({ ...options, elapsedMs })
  ));
  assert.deepEqual(frames, [0, 20, 50, 90, 100]);
});

test("reduced motion and Show all expose the complete message immediately", () => {
  assert.equal(getProfessorVisibleGraphemeCount({ graphemeCount: 80, elapsedMs: 0, reducedMotion: true }), 80);
  assert.equal(getProfessorVisibleGraphemeCount({ graphemeCount: 80, elapsedMs: 0, showAll: true }), 80);
});

test("speech identity changes for either a new cue or changed copy", () => {
  const original = createProfessorSpeechKey("draw:choose", "Choose Foundation.");
  assert.equal(original, createProfessorSpeechKey("draw:choose", "Choose Foundation."));
  assert.notEqual(original, createProfessorSpeechKey("draw:ready", "Choose Foundation."));
  assert.notEqual(original, createProfessorSpeechKey("draw:choose", "Choose Pals."));
});

test("Professor announcements expose one complete atomic lesson", () => {
  const announcement = createProfessorAnnouncement({
    guideName: "Professor Marlow Current",
    step: 3,
    total: 7,
    message: "Foundation cards establish your economy.",
    help: {
      id: "tutorial-draw-card",
      title: "Choose a deck with a plan",
      action: "Add one Foundation card.",
      targetLabel: "the Foundation Deck control",
    },
  });
  assert.match(announcement, /Professor Marlow Current.*Step 3 of 7/i);
  assert.match(announcement, /Foundation cards establish your economy/i);
  assert.match(announcement, /Next: Add one Foundation card/i);
  assert.match(announcement, /Look for the Foundation Deck control/i);
});

test("Professor announcements speak the final VP goal instead of a completed checklist step", () => {
  const announcement = createProfessorAnnouncement({
    guideName: "Professor Marlow Current",
    step: 7,
    total: 7,
    message: "Build the last three VP.",
    help: {
      id: "tutorial-finish-duel",
      progressLabel: "Final goal • 7/10 VP",
      title: "Finish the practice duel",
    },
  });
  assert.match(announcement, /Final goal • 7\/10 VP/i);
  assert.doesNotMatch(announcement, /Step 7 of 7/i);
});

test("Professor lead-ins describe the board instead of replying to an imaginary player", () => {
  const blocked = createProfessorSpokenMessage({
    title: "No legal attack yet",
    message: "Spanish Hogfish cannot attack until it has a compatible target.",
    target: "turn-button",
  });
  assert.match(blocked, /^The turn control is next\./);
  assert.doesNotMatch(blocked, /no worries|question|you asked|as you said/i);

  const draw = createProfessorSpokenMessage({
    title: "Choose a deck",
    message: "Foundation cards establish your economy.",
    target: "draw-controls",
  });
  assert.match(draw, /^Now choose this round's draw\./);
  assert.doesNotMatch(draw, /question/i);
});

test("authored greetings can explicitly opt out of structural lead-ins", () => {
  const message = "Welcome back. Arrow Crab is next in your Pals Deck.";
  const help = { lead: "", message, target: "draw-controls" };
  assert.equal(getProfessorConversationLead(help), "");
  assert.equal(createProfessorSpokenMessage(help), message);
});

test("Professor target lead-ins stay contextual and neutral", () => {
  const cases = [
    ["hand", "Let's begin with your hand."],
    ["placement", "Now choose a legal place."],
    ["continue-actions", "The draw is complete."],
    ["opponent-board", "Now look across at my ecosystem."],
    ["utility-action-button", "This card action is ready."],
  ];
  cases.forEach(([target, expected]) => {
    assert.equal(getProfessorConversationLead({ target, message: "Review the current game state." }), `${expected} `);
  });
});
