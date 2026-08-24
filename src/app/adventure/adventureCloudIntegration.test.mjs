import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("./AdventureGame.jsx", import.meta.url),
  "utf8",
);

function sourceBetween(startMarker, endMarker) {
  const start = component.indexOf(startMarker);
  const end = component.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return component.slice(start, end);
}

test("cloud conflicts cancel stale slot dialogs and guard destructive callbacks", () => {
  const surfaceConflict = sourceBetween(
    "const surfaceCloudConflict = useCallback",
    "function blockProtectedCloudProfileMutation",
  );
  assert.match(surfaceConflict, /setNewGameSetup\(null\)/);
  assert.match(surfaceConflict, /setConfirmation\(\(current\)[\s\S]*current\?\.profileId \? null : current/);

  const beginNewGame = sourceBetween("function beginNewGame", "function requestNewGame");
  const deleteProfile = sourceBetween("function deleteProfileEverywhere", "function requestDeleteProfile");
  const claimSave = sourceBetween("function claimSaveSlotAndSave", "function manualSave");
  assert.match(beginNewGame, /blockProtectedCloudProfileMutation\(profileId\)/);
  assert.match(deleteProfile, /blockProtectedCloudProfileMutation\(profileId\)/);
  assert.match(claimSave, /blockProtectedCloudProfileMutation\(current\.profileId\)/);
});

test("a conflict remains locked while its explicit choice is being applied", () => {
  const lock = sourceBetween("function isCloudSaveSlotLocked", "function CloudSaveStatus");
  assert.match(lock, /status\?\.state === "conflict"/);
  assert.match(lock, /status\?\.state === "resolving"/);

  const resolution = sourceBetween(
    "const resolveCloudConflictChoice = useCallback",
    "const keepBothCloudConflictCopies = useCallback",
  );
  assert.match(resolution, /cloudConflictResolutionRef\.current\.has\(profileId\)/);
  assert.match(resolution, /setCloudConflict\(\{ \.\.\.visibleConflict, resolving: true \}\)/);
  assert.match(resolution, /updateCloudStatus\(profileId, "resolving"/);
});
