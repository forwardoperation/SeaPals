import test from "node:test";
import assert from "node:assert/strict";
import {
  getOpponentActionUseKey,
  markOpponentActionUsed,
  supportLocksFurtherPlays,
  wasOpponentActionUsedThisTurn,
} from "./opponentActionRules.mjs";

test("opponent action identity distinguishes duplicate card instances", () => {
  const action = { id: "scavenge", name: "Scavenge" };
  assert.notEqual(
    getOpponentActionUseKey("reef-instance-a", action),
    getOpponentActionUseKey("reef-instance-b", action),
  );
  assert.equal(getOpponentActionUseKey("reef-instance-a", action), "reef-instance-a:scavenge");
  assert.equal(getOpponentActionUseKey("slot-instance", { actionName: "Enduring Attack" }), "slot-instance:enduring-attack");
});

test("opponent once-per-turn action use expires on the next turn without mutation", () => {
  const original = { existing: 2 };
  const marked = markOpponentActionUsed(original, "slot-a:stun", 4);
  assert.deepEqual(original, { existing: 2 });
  assert.equal(wasOpponentActionUsedThisTurn(marked, "slot-a:stun", 4), true);
  assert.equal(wasOpponentActionUsedThisTurn(marked, "slot-a:stun", 5), false);
});

test("only explicitly locking support cards stop further support plays", () => {
  assert.equal(supportLocksFurtherPlays({ id: "remote-search", text: "Search your deck for a Support card." }), false);
  assert.equal(supportLocksFurtherPlays({ id: "robotic-survey", locksFurtherSupportsThisTurn: true }), true);
  assert.equal(supportLocksFurtherPlays({ id: "capt-dani", text: "You cannot play another Support card this turn." }), true);
});
