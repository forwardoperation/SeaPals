import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_ACTOR_DEFAULTS,
  advanceAdventureActorStates,
  createAdventureActorStates,
  focusAdventureActor,
  getAdventureActorBlockers,
  getAdventureFacingToward,
  getAdventureActorPositionOverrides,
} from "./adventureActors.mjs";
import {
  SCENES,
  canOccupyContinuousPosition,
  movePlayerContinuous,
} from "./adventureWorld.mjs";
import { ELVERSON_AMBIENT_RESIDENTS } from "./adventureElversonResidents.mjs";

const AUTHORED_PATROL_IDS = Object.freeze([
  "interaction-brackwater-rhea",
  "interaction-current-guide",
  "interaction-kelpwatch-guide",
  "interaction-sunpatch-tavi",
  "interaction-trenchlight-guide",
]);

const ELVERSON_TOWN_RESIDENTS = Object.freeze([
  Object.freeze({
    id: "interaction-elverson-fisherman-wyeth",
    at: Object.freeze({ x: 18.05, y: 20.85 }),
  }),
  Object.freeze({
    id: "interaction-elverson-town-theo",
    at: Object.freeze({ x: 7, y: 8.35 }),
  }),
  Object.freeze({
    id: "interaction-elverson-eli",
    at: Object.freeze({ x: 16.8, y: 8.35 }),
  }),
  Object.freeze({
    id: "interaction-elverson-micah",
    at: Object.freeze({ x: 24.2, y: 8.35 }),
  }),
  Object.freeze({
    id: "interaction-elverson-town-erik",
    at: Object.freeze({ x: 34.5, y: 8.35 }),
  }),
]);

const ELVERSON_RELOCATED_RESIDENTS = Object.freeze([
  Object.freeze({
    sceneId: "academy-lab",
    id: "interaction-elverson-finn",
    at: Object.freeze({ x: 4.25, y: 3.45 }),
  }),
  Object.freeze({
    sceneId: "elverson-oceanic-home",
    id: "interaction-elverson-charlotte",
    at: Object.freeze({ x: 5, y: 2.5 }),
  }),
  Object.freeze({
    sceneId: "elverson-marine-research-lab",
    id: "interaction-elverson-explorer-jordan",
    at: Object.freeze({ x: 10.5, y: 4.5 }),
  }),
]);

function sunpatchGuide(overrides = {}) {
  const authored = SCENES["sunpatch-cay-town"].interactions.find(
    (interaction) => interaction.id === "interaction-sunpatch-tavi",
  );
  return {
    ...authored,
    patrol: {
      waypoints: [authored.at, { x: 8.25, y: 6 }],
      speed: 1,
      pauseMs: 0,
      mode: "ping-pong",
      ...overrides,
    },
  };
}

test("actor patrols advance continuously from their authored anchor", () => {
  const interaction = sunpatchGuide();
  let actors = createAdventureActorStates([interaction]);

  actors = advanceAdventureActorStates(
    "sunpatch-cay-town",
    [interaction],
    actors,
    16,
    { playerPosition: { x: 3, y: 3 } },
  );
  actors = advanceAdventureActorStates(
    "sunpatch-cay-town",
    [interaction],
    actors,
    500,
    { playerPosition: { x: 3, y: 3 } },
  );

  const actor = actors[interaction.id];
  assert.ok(actor.position.x > interaction.at.x);
  assert.ok(actor.position.x < 8.25, "a patrol step should interpolate rather than teleport");
  assert.equal(actor.position.y, interaction.at.y);
  assert.equal(actor.facing, "right");
  assert.equal(actor.moving, true);
});

test("patrol speed stays constant near a waypoint and the first dwell happens only once", () => {
  const near = sunpatchGuide({
    waypoints: [{ x: 7, y: 6 }, { x: 7.5, y: 6 }],
    pauseMs: 80,
  });
  const far = sunpatchGuide({
    waypoints: [{ x: 7, y: 6 }, { x: 9, y: 6 }],
    pauseMs: 80,
  });
  let nearActors = createAdventureActorStates([near]);
  let farActors = createAdventureActorStates([far]);
  assert.equal(nearActors[near.id].waypointIndex, 1, "the first target should be beyond the anchor");

  nearActors = advanceAdventureActorStates(
    "sunpatch-cay-town", [near], nearActors, 80, { playerPosition: { x: 3, y: 3 } },
  );
  farActors = advanceAdventureActorStates(
    "sunpatch-cay-town", [far], farActors, 80, { playerPosition: { x: 3, y: 3 } },
  );
  assert.equal(nearActors[near.id].position.x, 7, "the authored opening dwell should be honored");

  nearActors = advanceAdventureActorStates(
    "sunpatch-cay-town", [near], nearActors, 80, { playerPosition: { x: 3, y: 3 } },
  );
  farActors = advanceAdventureActorStates(
    "sunpatch-cay-town", [far], farActors, 80, { playerPosition: { x: 3, y: 3 } },
  );
  const nearTravel = nearActors[near.id].position.x - 7;
  const farTravel = farActors[far.id].position.x - 7;
  assert.ok(nearTravel > 0, "the guide should leave after one dwell, not wait a second time");
  assert.ok(Math.abs(nearTravel - farTravel) < 1e-9, "short remaining legs should not ease below patrol speed");
});

test("nearby players pause a guide without making the guide turn psychically", () => {
  const interaction = sunpatchGuide();
  const actors = createAdventureActorStates([interaction]);
  actors[interaction.id] = { ...actors[interaction.id], facing: "left" };
  const paused = advanceAdventureActorStates(
    "sunpatch-cay-town",
    [interaction],
    actors,
    500,
    { playerPosition: { x: 7, y: 6.8 } },
  );

  assert.deepEqual(paused[interaction.id].position, interaction.at);
  assert.equal(paused[interaction.id].moving, false);
  assert.equal(paused[interaction.id].facing, "left");
});

test("conversation focus cardinal-faces only the selected live actor", () => {
  const interaction = sunpatchGuide();
  const bystander = {
    ...interaction,
    id: "interaction-sunpatch-bystander",
    at: { x: 10, y: 7 },
  };
  const actors = createAdventureActorStates([interaction, bystander]);
  actors[interaction.id] = {
    ...actors[interaction.id],
    position: { x: 7.4, y: 6.25 },
    facing: "left",
    moving: true,
    waypointIndex: 1,
    patrolDirection: -1,
    dwellRemainingMs: 0,
    blockedMs: 640,
  };

  const focused = focusAdventureActor(
    actors,
    interaction.id,
    { x: 7.45, y: 7.1 },
  );

  assert.notEqual(focused, actors);
  assert.notEqual(focused[interaction.id], actors[interaction.id]);
  assert.equal(focused[interaction.id].facing, "down");
  assert.equal(focused[interaction.id].moving, false);
  assert.equal(focused[interaction.id].dwellRemainingMs, 200);
  assert.equal(focused[interaction.id].blockedMs, 0);
  assert.deepEqual(focused[interaction.id].position, { x: 7.4, y: 6.25 });
  assert.equal(focused[interaction.id].waypointIndex, 1);
  assert.equal(focused[interaction.id].patrolDirection, -1);
  assert.strictEqual(focused[bystander.id], actors[bystander.id]);
  assert.equal(actors[interaction.id].moving, true, "focus must not mutate the prior state");
});

test("conversation facing resolves every approach to a stable cardinal row", () => {
  const origin = { x: 5, y: 5 };
  assert.equal(getAdventureFacingToward(origin, { x: 5, y: 3 }), "up");
  assert.equal(getAdventureFacingToward(origin, { x: 5, y: 7 }), "down");
  assert.equal(getAdventureFacingToward(origin, { x: 2, y: 5 }), "left");
  assert.equal(getAdventureFacingToward(origin, { x: 8, y: 5 }), "right");
  assert.equal(
    getAdventureFacingToward(origin, { x: 6, y: 4 }),
    "up",
    "exact diagonal ties should use one deterministic animation row",
  );
  assert.equal(
    getAdventureFacingToward(origin, origin, "left"),
    "left",
    "overlapping positions should retain the actor's last valid facing",
  );
});

test("conversation focus is a no-op when no live actor matches", () => {
  const actors = createAdventureActorStates([sunpatchGuide()]);
  assert.strictEqual(
    focusAdventureActor(actors, "interaction-missing", { x: 1, y: 1 }),
    actors,
  );
});

test("reduced motion keeps patrolling residents at stable authored anchors", () => {
  const interaction = sunpatchGuide();
  const actors = {
    ...createAdventureActorStates([interaction]),
    [interaction.id]: {
      ...createAdventureActorStates([interaction])[interaction.id],
      position: { x: 8, y: 6 },
      moving: true,
    },
  };
  const reduced = advanceAdventureActorStates(
    "sunpatch-cay-town",
    [interaction],
    actors,
    500,
    { reducedMotion: true },
  );

  assert.deepEqual(reduced[interaction.id].position, interaction.at);
  assert.equal(reduced[interaction.id].moving, false);
  assert.equal(reduced[interaction.id].waypointIndex, 0);
});

test("actor helpers share one live position for rendering, targeting, and collision", () => {
  const interaction = sunpatchGuide();
  const actors = createAdventureActorStates([interaction]);
  actors[interaction.id] = { ...actors[interaction.id], position: { x: 8, y: 6 } };

  const overrides = getAdventureActorPositionOverrides(actors);
  const blockers = getAdventureActorBlockers(actors);
  assert.deepEqual(overrides[interaction.id], { x: 8, y: 6 });
  assert.deepEqual(blockers, [{
    id: interaction.id,
    position: { x: 8, y: 6 },
    radius: ADVENTURE_ACTOR_DEFAULTS.radius,
    collisionRadiusX: ADVENTURE_ACTOR_DEFAULTS.collisionRadiusX,
    collisionRadiusY: ADVENTURE_ACTOR_DEFAULTS.collisionRadiusY,
  }]);
  assert.equal(canOccupyContinuousPosition(
    "sunpatch-cay-town",
    { x: 8, y: 6 },
    0.22,
    { dynamicBlockers: blockers, ignoreActorTiles: true },
  ), false);
});

test("actor blockers protect planted feet without catching a close visual pass", () => {
  const blockers = [{
    id: "resident",
    position: { x: 14, y: 7 },
    radius: ADVENTURE_ACTOR_DEFAULTS.radius,
    collisionRadiusX: ADVENTURE_ACTOR_DEFAULTS.collisionRadiusX,
    collisionRadiusY: ADVENTURE_ACTOR_DEFAULTS.collisionRadiusY,
  }];
  const movementOptions = {
    dynamicBlockers: blockers,
    ignoreActorTiles: true,
    radius: 0.22,
    speed: 4,
    maxStepDistance: 0.04,
  };

  const directApproach = movePlayerContinuous(
    "town",
    { x: 13, y: 7 },
    { x: 1, y: 0 },
    500,
    movementOptions,
  );
  const closePass = movePlayerContinuous(
    "town",
    { x: 13, y: 7.41 },
    { x: 1, y: 0 },
    500,
    movementOptions,
  );

  assert.ok(
    directApproach.x <= 14 - ADVENTURE_ACTOR_DEFAULTS.collisionRadiusX + 1e-9,
    `a direct approach must stop at the resident's feet, received x=${directApproach.x}`,
  );
  assert.ok(
    closePass.x >= 14.99,
    `a visibly clear shoulder-to-shoulder pass should remain open, received x=${closePass.x}`,
  );
});

test("all authored patrol waypoints and straight legs stay on real walkable ground", () => {
  const patrols = Object.values(SCENES).flatMap((scene) => scene.interactions
    .filter((interaction) => interaction.patrol)
    .map((interaction) => ({ scene, interaction })));
  assert.deepEqual(
    patrols.map(({ interaction }) => interaction.id).sort(),
    [
      ...AUTHORED_PATROL_IDS,
      ...ELVERSON_AMBIENT_RESIDENTS
        .filter((resident) => resident.patrol)
        .map((resident) => `interaction-elverson-${resident.id}`),
    ].sort(),
  );

  for (const { scene, interaction } of patrols) {
    const waypoints = interaction.patrol.waypoints;
    for (const [index, waypoint] of waypoints.entries()) {
      assert.equal(
        canOccupyContinuousPosition(
          scene.id,
          waypoint,
          ADVENTURE_ACTOR_DEFAULTS.radius,
          { ignoreActorTiles: true },
        ),
        true,
        `${interaction.id} waypoint ${index} must be on walkable artwork`,
      );
      const destination = waypoints[(index + 1) % waypoints.length];
      const delta = { x: destination.x - waypoint.x, y: destination.y - waypoint.y };
      const distance = Math.hypot(delta.x, delta.y);
      const moved = movePlayerContinuous(scene.id, waypoint, delta, (distance / 0.5) * 1000, {
        speed: 0.5,
        radius: ADVENTURE_ACTOR_DEFAULTS.radius,
        maxStepDistance: 0.03,
        ignoreActorTiles: true,
      });
      assert.ok(
        Math.hypot(moved.x - destination.x, moved.y - destination.y) < 0.04,
        `${interaction.id} leg ${index} must not cross water, furniture, or a station`,
      );
    }
  }
});

test("Elverson v3 keeps its five town residents at their authored stationary anchors", () => {
  const residents = SCENES.town.interactions.filter(({ type }) => (
    type === "npc" || type === "trainer"
  ));
  assert.deepEqual(
    residents.map(({ id, at }) => ({ id, at })),
    [...ELVERSON_TOWN_RESIDENTS],
  );

  for (const interaction of residents) {
    assert.equal(interaction.type, "npc");
    assert.equal(Object.hasOwn(interaction, "patrol"), false);
    assert.equal(
      canOccupyContinuousPosition(
        "town",
        interaction.at,
        ADVENTURE_ACTOR_DEFAULTS.radius,
        { ignoreActorTiles: true },
      ),
      true,
      `${interaction.id} anchor ${interaction.at.x},${interaction.at.y} must stay clear`,
    );
  }
});

test("relocated Elverson residents remain static in their currently authored rooms", () => {
  for (const expected of ELVERSON_RELOCATED_RESIDENTS) {
    const scene = SCENES[expected.sceneId];
    const interaction = scene.interactions.find(({ id }) => id === expected.id);
    assert.ok(interaction, `${expected.id} must remain authored in ${expected.sceneId}`);
    assert.deepEqual(interaction.at, expected.at);
    assert.equal(Object.hasOwn(interaction, "patrol"), false);

    const initial = createAdventureActorStates([interaction]);
    const advanced = advanceAdventureActorStates(
      expected.sceneId,
      [interaction],
      initial,
      120_000,
    );
    assert.deepEqual(advanced[interaction.id].position, expected.at);
    assert.equal(advanced[interaction.id].moving, false);
    assert.equal(advanced[interaction.id].blockedMs, 0);
  }
});

test("Elverson only exposes patrol metadata explicitly authored by its resident registry", () => {
  for (const resident of ELVERSON_AMBIENT_RESIDENTS) {
    const interaction = SCENES[resident.sceneId].interactions.find(
      ({ id }) => id === `interaction-elverson-${resident.id}`,
    );
    assert.ok(interaction, `${resident.id} must be authored in ${resident.sceneId}`);
    assert.deepEqual(interaction.at, resident.at);
    if (resident.patrol) {
      assert.deepEqual(interaction.patrol, resident.patrol);
    } else {
      assert.equal(Object.hasOwn(interaction, "patrol"), false);
    }
  }
});

test("later-world authored patrols keep moving without becoming blocked", () => {
  for (const interactionId of AUTHORED_PATROL_IDS) {
    const scene = Object.values(SCENES).find((candidate) => (
      candidate.interactions.some(({ id }) => id === interactionId)
    ));
    const interaction = scene?.interactions.find(({ id }) => id === interactionId);
    assert.ok(scene && interaction, `${interactionId} must remain authored`);

    let actors = createAdventureActorStates(scene.interactions);
    let greatestTravel = 0;
    let greatestBlockedMs = 0;
    for (let step = 0; step < 1200; step += 1) {
      actors = advanceAdventureActorStates(scene.id, scene.interactions, actors, 100, {
        playerPosition: { x: -100, y: -100 },
      });
      const actor = actors[interactionId];
      greatestTravel = Math.max(
        greatestTravel,
        Math.hypot(actor.position.x - interaction.at.x, actor.position.y - interaction.at.y),
      );
      greatestBlockedMs = Math.max(greatestBlockedMs, actor.blockedMs);
    }

    assert.ok(greatestTravel > 0.25, `${interactionId} must leave its anchor`);
    assert.equal(greatestBlockedMs, 0, `${interactionId} must have a collision-free patrol`);
  }
});

test("malformed patrols and blocker radii fail before animation starts", () => {
  const interaction = sunpatchGuide({ waypoints: [{ x: 7, y: 6 }] });
  assert.throws(() => createAdventureActorStates([interaction]), /at least two waypoints/);
  assert.throws(() => getAdventureActorBlockers({}, { radius: 0 }), /must be positive/);
  assert.throws(
    () => advanceAdventureActorStates("sunpatch-cay-town", [], {}, -1),
    /non-negative finite number/,
  );
});
