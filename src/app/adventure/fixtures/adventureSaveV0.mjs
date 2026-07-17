/**
 * Representative payload written by the original Reefbound prototype before
 * a schema version existed. Duplicate and unknown trainer IDs are intentional
 * migration cases.
 */
export const ADVENTURE_SAVE_V0_FIXTURE = Object.freeze({
  profileId: "profile-legacy-1",
  sceneId: "coral-home",
  position: Object.freeze({ x: 5.25, y: 4.5 }),
  facing: "left",
  defeated: Object.freeze(["marina", "marina", "unknown-visitor", null, "dorian"]),
});
