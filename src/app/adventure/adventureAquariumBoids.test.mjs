import assert from "node:assert/strict";
import test from "node:test";
import {
  AQUARIUM_BOIDS_FIXED_STEP_SECONDS,
  aquariumFishPitchDegrees,
  createAquariumBoids,
  createAquariumBoidsSimulationKey,
  stepAquariumBoids,
} from "./adventureAquariumBoids.mjs";

const BOUNDS = Object.freeze({ minX: 0, maxX: 100, minY: 0, maxY: 60 });
const ROUTE = Object.freeze([
  Object.freeze({ xPercent: 15, yPercent: 30 }),
  Object.freeze({ xPercent: 50, yPercent: 18 }),
  Object.freeze({ xPercent: 85, yPercent: 36 }),
]);

test("fish pitch uses native-right local quadrants and safe presentation limits", () => {
  assert.ok(aquariumFishPitchDegrees(4, -2, 1, 25) < 0, "right-up pitches negatively");
  assert.ok(aquariumFishPitchDegrees(4, 2, 1, 25) > 0, "right-down pitches positively");
  assert.ok(aquariumFishPitchDegrees(-4, -2, -1, 25) > 0, "left-up mirrors local pitch");
  assert.ok(aquariumFishPitchDegrees(-4, 2, -1, 25) < 0, "left-down mirrors local pitch");
  assert.equal(aquariumFishPitchDegrees(0, 4, 1, 90), 25);
  assert.equal(aquariumFishPitchDegrees(0, -4, -1, 12), 12);
  assert.equal(aquariumFishPitchDegrees(0, 0, 1), 0);
  assert.equal(aquariumFishPitchDegrees(Infinity, 1, 1), 0);
  assert.equal(aquariumFishPitchDegrees(1, Number.NaN, 1), 0);
  assert.equal(aquariumFishPitchDegrees(1, 4, 1, -10), 0);
  assert.ok(Math.abs(aquariumFishPitchDegrees(1, 10, 1)) <= 22);
});

function createSchool(overrides = {}) {
  return createAquariumBoids({
    seed: "boids-test",
    memberCount: 5,
    behaviorKind: "contour-school",
    bounds: BOUNDS,
    route: ROUTE,
    ...overrides,
  });
}

function centroid(agents) {
  return agents.reduce((total, agent) => ({
    x: total.x + (agent.x / agents.length),
    y: total.y + (agent.y / agents.length),
  }), { x: 0, y: 0 });
}

function averageDistanceFromCenter(agents) {
  const center = centroid(agents);
  return agents.reduce((total, agent) => (
    total + Math.hypot(agent.x - center.x, agent.y - center.y)
  ), 0) / agents.length;
}

function averageHeadingDifference(agents) {
  let total = 0;
  let comparisons = 0;
  for (let left = 0; left < agents.length; left += 1) {
    for (let right = left + 1; right < agents.length; right += 1) {
      const leftAngle = Math.atan2(agents[left].vy, agents[left].vx);
      const rightAngle = Math.atan2(agents[right].vy, agents[right].vx);
      total += Math.abs(Math.atan2(
        Math.sin(leftAngle - rightAngle),
        Math.cos(leftAngle - rightAngle),
      ));
      comparisons += 1;
    }
  }
  return total / comparisons;
}

function minimumPairDistance(agents) {
  let result = Infinity;
  for (let left = 0; left < agents.length; left += 1) {
    for (let right = left + 1; right < agents.length; right += 1) {
      result = Math.min(result, Math.hypot(
        agents[left].x - agents[right].x,
        agents[left].y - agents[right].y,
      ));
    }
  }
  return result;
}

function nearestNeighborDistances(agents) {
  return agents.map((agent, agentIndex) => Math.min(...agents.map((other, otherIndex) => (
    agentIndex === otherIndex
      ? Infinity
      : Math.hypot(agent.x - other.x, agent.y - other.y)
  ))));
}

function pairDistances(agents) {
  const distances = [];
  for (let left = 0; left < agents.length; left += 1) {
    for (let right = left + 1; right < agents.length; right += 1) {
      distances.push(Math.hypot(
        agents[left].x - agents[right].x,
        agents[left].y - agents[right].y,
      ));
    }
  }
  return distances;
}

test("complete simulation keys are canonical and sensitive to every renderer input", () => {
  const profile = {
    kind: "school",
    behaviorKind: "contour-school",
    speed: 0.9,
    social: { cohesion: 0.82, spacingPercent: 6, visualCount: 4 },
    timing: { pauseSeconds: { min: 0.2, max: 0.8 }, burstSeconds: { min: 1.5, max: 3 } },
    habitat: {
      contourPath: {
        id: "upper-contour",
        points: [{ xPercent: 4, yPercent: 54 }, { xPercent: 17, yPercent: 45 }],
      },
      coverPoints: [],
    },
  };
  const inputs = {
    trackIdentity: "reef-community:blue-tang",
    memberCount: 4,
    movementProfile: profile,
    bounds: { minX: 3, maxX: 97, minY: 5, maxY: 94 },
  };
  const baseline = createAquariumBoidsSimulationKey(inputs);
  const reorderedEquivalent = createAquariumBoidsSimulationKey({
    bounds: { maxY: 94, minY: 5, maxX: 97, minX: 3 },
    movementProfile: {
      habitat: {
        coverPoints: [],
        contourPath: {
          points: [{ yPercent: 54, xPercent: 4 }, { yPercent: 45, xPercent: 17 }],
          id: "upper-contour",
        },
      },
      timing: { burstSeconds: { max: 3, min: 1.5 }, pauseSeconds: { max: 0.8, min: 0.2 } },
      social: { visualCount: 4, spacingPercent: 6, cohesion: 0.82 },
      speed: 0.9,
      behaviorKind: "contour-school",
      kind: "school",
    },
    memberCount: 4,
    trackIdentity: "reef-community:blue-tang",
  });
  assert.equal(reorderedEquivalent, baseline);

  const changedInputs = [
    { ...inputs, trackIdentity: "oceanic-community:blue-tang" },
    { ...inputs, memberCount: 5 },
    { ...inputs, movementProfile: { ...profile, kind: "cruiser" } },
    { ...inputs, movementProfile: { ...profile, speed: 0.91 } },
    {
      ...inputs,
      movementProfile: {
        ...profile,
        timing: { ...profile.timing, pauseSeconds: { min: 0.3, max: 0.8 } },
      },
    },
    {
      ...inputs,
      movementProfile: {
        ...profile,
        habitat: {
          ...profile.habitat,
          contourPath: {
            ...profile.habitat.contourPath,
            points: [{ xPercent: 4.01, yPercent: 54 }, { xPercent: 17, yPercent: 45 }],
          },
        },
      },
    },
    { ...inputs, maxForce: 7.25 },
  ];
  for (const changed of changedInputs) {
    assert.notEqual(createAquariumBoidsSimulationKey(changed), baseline);
  }
});

test("seeded initialization and fixed-step advancement are deterministic and pure", () => {
  const first = createSchool();
  const second = createSchool();
  assert.deepEqual(first, second);
  assert.equal(first.config.fixedStepSeconds, AQUARIUM_BOIDS_FIXED_STEP_SECONDS);

  const snapshot = structuredClone(first);
  const advanced = stepAquariumBoids(first, 180);
  assert.deepEqual(first, snapshot, "advancing must not mutate prior state");
  assert.deepEqual(advanced, stepAquariumBoids(second, 180));
  assert.equal(advanced.stepCount, 180);
  assert.ok(Math.abs(advanced.timeSeconds - 6) < 1e-10);
  assert.notDeepEqual(advanced.agents, first.agents);
});

test("alignment converges independently moving neighbors toward a common heading", () => {
  const initialAgents = [
    { x: 46, y: 28, vx: 3, vy: 0 },
    { x: 48, y: 30, vx: 0, vy: 3 },
    { x: 50, y: 29, vx: -2.5, vy: 1 },
    { x: 52, y: 31, vx: 1, vy: -2.5 },
    { x: 54, y: 30, vx: 2.5, vy: 1 },
  ];
  let state = createSchool({
    initialAgents,
    separationWeight: 0,
    cohesionWeight: 0,
    targetWeight: 0,
    boundaryWeight: 0,
    alignmentWeight: 2.4,
    minSpeed: 0,
  });
  const before = averageHeadingDifference(state.agents);
  state = stepAquariumBoids(state, 90);
  assert.ok(averageHeadingDifference(state.agents) < before * 0.55);
});

test("cohesion pulls a dispersed school toward its shared center", () => {
  const initialAgents = [
    { x: 25, y: 20, vx: 0.1, vy: 0 },
    { x: 35, y: 38, vx: 0.1, vy: 0 },
    { x: 50, y: 12, vx: 0.1, vy: 0 },
    { x: 65, y: 38, vx: 0.1, vy: 0 },
    { x: 75, y: 20, vx: 0.1, vy: 0 },
  ];
  let state = createSchool({
    initialAgents,
    perceptionRadius: 80,
    separationWeight: 0,
    alignmentWeight: 0,
    targetWeight: 0,
    boundaryWeight: 0,
    cohesionWeight: 2.2,
    minSpeed: 0,
  });
  const before = averageDistanceFromCenter(state.agents);
  state = stepAquariumBoids(state, 150);
  assert.ok(averageDistanceFromCenter(state.agents) < before * 0.72);
});

test("separation prevents overlapping agents and increases nearest-neighbor spacing", () => {
  const initialAgents = Array.from({ length: 5 }, (_, index) => ({
    x: 48,
    y: 30,
    vx: 0.1,
    vy: 0,
  }));
  let state = createSchool({
    initialAgents,
    separationRadius: 8,
    perceptionRadius: 12,
    separationWeight: 3,
    alignmentWeight: 0,
    cohesionWeight: 0,
    targetWeight: 0,
    boundaryWeight: 0,
    minSpeed: 0,
  });
  const before = minimumPairDistance(state.agents);
  state = stepAquariumBoids(state, 50);
  assert.equal(before, 0);
  assert.ok(minimumPairDistance(state.agents) > 0.5);
});

test("the school follows a moving habitat contour target without endpoint teleporting", () => {
  let state = createSchool({ routeSpeed: 18, targetWeight: 2.2 });
  const startCenter = centroid(state.agents);
  const targets = [];
  for (let step = 0; step < 240; step += 1) {
    const previousTarget = state.target;
    state = stepAquariumBoids(state);
    targets.push(state.target);
    assert.ok(
      Math.hypot(state.target.x - previousTarget.x, state.target.y - previousTarget.y) < 1,
      "ping-pong target must move continuously through a reversal",
    );
  }
  const endCenter = centroid(state.agents);
  assert.ok(Math.hypot(endCenter.x - startCenter.x, endCenter.y - startCenter.y) > 8);
  assert.ok(Math.max(...targets.map((target) => target.x)) > 75);
  assert.ok(targets.some((target, index) => index > 0 && target.x < targets[index - 1].x));
});

test("cover schools dart, contract into refuge, hide, then reform", () => {
  const refuge = { x: 76, y: 42 };
  let state = createSchool({
    behaviorKind: "cover-school-ball",
    coverPoints: [refuge],
    initialSpread: 8,
    refuge: {
      firstDartSeconds: 1,
      cadenceSeconds: 9,
      dartSeconds: 1.2,
      holdSeconds: 2.4,
      reformSeconds: 1.5,
    },
  });
  const initialSpread = averageDistanceFromCenter(state.agents);
  const seen = new Set([state.phase]);
  let hiddenState = null;
  for (let step = 0; step < 210; step += 1) {
    state = stepAquariumBoids(state);
    seen.add(state.phase);
    if (state.phase === "hide") hiddenState = state;
  }
  assert.deepEqual([...seen].sort(), ["dart", "hide", "hover", "reform"]);
  assert.ok(hiddenState);
  const hiddenCenter = centroid(hiddenState.agents);
  assert.ok(Math.hypot(hiddenCenter.x - refuge.x, hiddenCenter.y - refuge.y) < 12);
  assert.ok(averageDistanceFromCenter(hiddenState.agents) < initialSpread * 0.72);
});

test("compact cover schools retain visible boid spacing through repeated refuge cycles", () => {
  const movementProfile = {
    behaviorKind: "cover-school-ball",
    groupSize: 5,
    speed: 0.82,
    social: { visualCount: 5, spacingPercent: 3.2, cohesion: 0.94 },
    timing: {
      pauseSeconds: { min: 1.5, max: 3 },
      refugeCadenceSeconds: { min: 8, max: 8 },
      burstSeconds: { min: 0.8, max: 0.8 },
    },
    habitat: {
      contourPath: {
        points: [
          { xPercent: 34, yPercent: 55 },
          { xPercent: 42, yPercent: 49 },
          { xPercent: 53, yPercent: 50 },
          { xPercent: 61, yPercent: 57 },
          { xPercent: 52, yPercent: 63 },
          { xPercent: 40, yPercent: 62 },
        ],
      },
      coverPoints: [
        { xPercent: 47, yPercent: 56 },
        { xPercent: 78, yPercent: 51 },
      ],
    },
  };
  let state = createAquariumBoids({
    seed: "long-running-chromis",
    movementProfile,
    bounds: { minX: 3, maxX: 97, minY: 5, maxY: 94 },
    refuge: {
      firstDartSeconds: 1,
      cadenceSeconds: 8,
      dartSeconds: 0.8,
      holdSeconds: 2,
      reformSeconds: 1.4,
    },
  });
  const phaseSpacing = new Map();
  let closestHiddenCentroid = Infinity;
  for (let step = 0; step < 1800; step += 1) {
    state = stepAquariumBoids(state);
    const distances = nearestNeighborDistances(state.agents);
    const samples = phaseSpacing.get(state.phase) ?? [];
    samples.push(...distances);
    phaseSpacing.set(state.phase, samples);
    if (state.phase === "hide") {
      const center = centroid(state.agents);
      closestHiddenCentroid = Math.min(
        closestHiddenCentroid,
        Math.hypot(center.x - state.target.x, center.y - state.target.y),
      );
    }
  }

  for (const phase of ["hover", "dart", "hide", "reform"]) {
    const samples = phaseSpacing.get(phase);
    assert.ok(samples?.length > 0, `expected ${phase} samples`);
    const averageSpacing = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    assert.ok(Math.min(...samples) >= 1.2, `${phase} members must never collapse together`);
    assert.ok(averageSpacing >= 1.8 && averageSpacing <= 2.6, `${phase} spacing must stay tight`);
    assert.ok(Math.max(...samples) <= 3.1, `${phase} members must remain a compact ball`);
  }
  assert.ok(closestHiddenCentroid < 0.5, "the spaced school must still reach coral cover");
});

test("shelter-school spacing remains broad enough for large fish silhouettes", () => {
  let state = createAquariumBoids({
    seed: "long-running-grunts",
    memberCount: 5,
    behaviorKind: "shelter-school",
    bounds: { minX: 3, maxX: 97, minY: 5, maxY: 94 },
    route: [
      { x: 34, y: 55 },
      { x: 42, y: 49 },
      { x: 53, y: 50 },
      { x: 61, y: 57 },
      { x: 52, y: 63 },
      { x: 40, y: 62 },
    ],
    coverPoints: [{ x: 47, y: 56 }],
    social: { spacingPercent: 5, cohesion: 0.78 },
  });
  const samples = [];
  for (let step = 0; step < 1200; step += 1) {
    state = stepAquariumBoids(state);
    if (step >= 120) samples.push(...nearestNeighborDistances(state.agents));
  }
  const averageSpacing = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  assert.ok(averageSpacing >= 4 && averageSpacing <= 8);
  assert.ok(Math.min(...samples) > 2.5);
});

test("seeded individual wander visibly reshapes stable schools without breaking cohesion", () => {
  const scenarios = [
    {
      behaviorKind: "contour-school",
      memberCount: 4,
      spacingPercent: 6,
      nearestBounds: [4, 8],
      centerLimit: 7,
    },
    {
      behaviorKind: "shelter-school",
      memberCount: 5,
      spacingPercent: 5,
      nearestBounds: [4, 8],
      centerLimit: 7,
    },
    {
      behaviorKind: "cover-school-ball",
      memberCount: 5,
      spacingPercent: 3.2,
      nearestBounds: [1.2, 3.1],
      centerLimit: 3.5,
    },
  ];

  for (const scenario of scenarios) {
    let state = createSchool({
      seed: `dynamic-${scenario.behaviorKind}`,
      behaviorKind: scenario.behaviorKind,
      memberCount: scenario.memberCount,
      social: { spacingPercent: scenario.spacingPercent, cohesion: 0.85 },
      coverPoints: scenario.behaviorKind === "contour-school" ? [] : [{ x: 48, y: 34 }],
      refuge: { enabled: false },
    });
    state = stepAquariumBoids(state, 900);
    const before = pairDistances(state.agents);
    state = stepAquariumBoids(state, 120);
    const after = pairDistances(state.agents);
    const changes = before.map((distance, index) => Math.abs(distance - after[index]));
    assert.ok(
      changes.filter((change) => change > 0.15).length >= 2,
      `${scenario.behaviorKind} must visibly reshape over four seconds`,
    );

    const nearest = nearestNeighborDistances(state.agents);
    assert.ok(Math.min(...nearest) >= scenario.nearestBounds[0]);
    assert.ok(Math.max(...nearest) <= scenario.nearestBounds[1]);
    assert.ok(averageDistanceFromCenter(state.agents) <= scenario.centerLimit);
  }
});

test("contour and shelter schools sustain smooth non-stalling motion for sixty seconds", () => {
  const scenarios = [
    {
      id: "tang",
      movementProfile: {
        behaviorKind: "contour-school",
        groupSize: 4,
        speed: 0.9,
        social: { visualCount: 4, spacingPercent: 6, cohesion: 0.82 },
        timing: {},
        habitat: {
          contourPath: {
            points: [
              { xPercent: 4, yPercent: 54 },
              { xPercent: 17, yPercent: 45 },
              { xPercent: 31, yPercent: 52 },
              { xPercent: 46, yPercent: 46 },
              { xPercent: 61, yPercent: 55 },
              { xPercent: 77, yPercent: 42 },
              { xPercent: 96, yPercent: 51 },
            ],
          },
          coverPoints: [],
        },
      },
    },
    {
      id: "grunt",
      movementProfile: {
        behaviorKind: "shelter-school",
        groupSize: 5,
        speed: 0.72,
        social: { visualCount: 5, spacingPercent: 5, cohesion: 0.78 },
        timing: {
          pauseSeconds: { min: 0.8, max: 1.8 },
          refugeCadenceSeconds: { min: 10, max: 18 },
          burstSeconds: { min: 1, max: 2 },
        },
        habitat: {
          contourPath: {
            points: [
              { xPercent: 34, yPercent: 55 },
              { xPercent: 42, yPercent: 49 },
              { xPercent: 53, yPercent: 50 },
              { xPercent: 61, yPercent: 57 },
              { xPercent: 52, yPercent: 63 },
              { xPercent: 40, yPercent: 62 },
            ],
          },
          coverPoints: [{ xPercent: 47, yPercent: 56 }],
        },
      },
    },
  ];

  for (const scenario of scenarios) {
    let state = createAquariumBoids({
      seed: `sixty-second-${scenario.id}`,
      movementProfile: scenario.movementProfile,
      bounds: { minX: 3, maxX: 97, minY: 5, maxY: 94 },
    });
    let previousAgents = state.agents;
    let previousCenter = centroid(state.agents);
    let twoSecondPath = 0;
    let windowSteps = 0;
    for (let step = 0; step < 1800; step += 1) {
      state = stepAquariumBoids(state);
      const center = centroid(state.agents);
      twoSecondPath += Math.hypot(center.x - previousCenter.x, center.y - previousCenter.y);
      previousCenter = center;
      windowSteps += 1;

      state.agents.forEach((agent, agentIndex) => {
        const previous = previousAgents[agentIndex];
        const speed = Math.hypot(agent.vx, agent.vy);
        const acceleration = Math.hypot(
          agent.vx - previous.vx,
          agent.vy - previous.vy,
        ) / state.config.fixedStepSeconds;
        const headingChange = Math.abs(Math.atan2(
          Math.sin(agent.heading - previous.heading),
          Math.cos(agent.heading - previous.heading),
        ));
        assert.ok(speed >= state.config.minSpeed - 0.02, `${scenario.id} speed floor`);
        assert.ok(
          acceleration <= (state.config.maxForce * 1.6) + 0.1,
          `${scenario.id} acceleration must remain fluid`,
        );
        assert.ok(headingChange <= 12 * (Math.PI / 180), `${scenario.id} heading must turn smoothly`);
      });
      previousAgents = state.agents;

      if (windowSteps === 60) {
        assert.ok(twoSecondPath / 2 >= 0.75, `${scenario.id} centroid must not pause`);
        twoSecondPath = 0;
        windowSteps = 0;
      }
    }
  }
});

test("shelter schools use looser refuge tuning while contour schools remain in cruise", () => {
  const cover = [{ x: 30, y: 40 }];
  let shelter = createSchool({
    behaviorKind: "shelter-school",
    coverPoints: cover,
    refuge: { firstDartSeconds: 0, cadenceSeconds: 8, dartSeconds: 1, holdSeconds: 1 },
  });
  let contour = createSchool();
  const shelterPhases = new Set();
  for (let step = 0; step < 120; step += 1) {
    shelter = stepAquariumBoids(shelter);
    contour = stepAquariumBoids(contour);
    shelterPhases.add(shelter.phase);
    assert.equal(contour.phase, "cruise");
  }
  assert.ok(shelterPhases.has("dart"));
  assert.ok(shelterPhases.has("hide"));
});

test("every enabled refuge configuration requires valid cover geometry", () => {
  assert.throws(
    () => createSchool({ refuge: { enabled: true } }),
    /enabled refuge behavior but no aquarium cover point/,
  );
  assert.doesNotThrow(() => createSchool({ refuge: { enabled: false } }));
  assert.doesNotThrow(() => createSchool({
    coverPoints: [{ x: 48, y: 34 }],
    refuge: { enabled: true },
  }));
});

test("agents stay bounded, finite, and expose velocity-derived native-right facing", () => {
  let state = createSchool({
    routeSpeed: 30,
    maxSpeed: 16,
    initialAgents: [
      { x: 0.1, y: 0.1, vx: -12, vy: -7 },
      { x: 99.9, y: 0.1, vx: 12, vy: -7 },
      { x: 0.1, y: 59.9, vx: -12, vy: 7 },
      { x: 99.9, y: 59.9, vx: 12, vy: 7 },
      { x: 50, y: 30, vx: 3, vy: 1 },
    ],
  });
  for (let step = 0; step < 2400; step += 1) {
    state = stepAquariumBoids(state);
    for (const agent of state.agents) {
      for (const value of [
        agent.x,
        agent.y,
        agent.vx,
        agent.vy,
        agent.heading,
        agent.depth,
        agent.wanderPhase,
        agent.wanderRate,
      ]) {
        assert.ok(Number.isFinite(value));
      }
      assert.ok(agent.x >= BOUNDS.minX && agent.x <= BOUNDS.maxX);
      assert.ok(agent.y >= BOUNDS.minY && agent.y <= BOUNDS.maxY);
      assert.ok(agent.direction === 1 || agent.direction === -1);
      if (Math.abs(agent.vx) > 0.02) assert.equal(agent.direction, agent.vx > 0 ? 1 : -1);
      assert.ok(Math.abs(Math.atan2(agent.vy, agent.vx) - agent.heading) < 1e-10);
    }
  }
});

test("movement profiles and percent habitat geometry form a renderer-ready contract", () => {
  const movementProfile = {
    kind: "school",
    behaviorKind: "cover-school-ball",
    groupSize: 4,
    speed: 0.8,
    social: { visualCount: 4, spacingPercent: 3.2, cohesion: 0.94 },
    timing: {
      pauseSeconds: { min: 1, max: 2 },
      refugeCadenceSeconds: { min: 8, max: 10 },
      burstSeconds: { min: 0.6, max: 1 },
    },
    habitat: {
      contourPath: { points: ROUTE },
      coverPoints: [{ xPercent: 25, yPercent: 38 }],
    },
  };
  const state = createAquariumBoids({ seed: "profile", movementProfile, bounds: BOUNDS });
  assert.equal(state.agents.length, 4);
  assert.equal(state.config.behaviorKind, "cover-school-ball");
  assert.equal(state.config.route.length, ROUTE.length);
  assert.deepEqual(state.config.coverPoints, [{ x: 25, y: 38 }]);
  assert.equal(stepAquariumBoids(state, 0), state);
});

test("open-water schooling profiles receive a deterministic bounded lane route", () => {
  const movementProfile = {
    kind: "school",
    behaviorKind: "contour-school",
    groupSize: 4,
    habitat: {
      contourPath: null,
      openWaterLane: { yPercent: 24, verticalRangePercent: 18 },
    },
  };
  const first = createAquariumBoids({ seed: "oceanic-lane", movementProfile, bounds: BOUNDS });
  const second = createAquariumBoids({ seed: "oceanic-lane", movementProfile, bounds: BOUNDS });
  assert.deepEqual(first, second);
  assert.equal(first.config.route.length, 2);
  for (const point of first.config.route) {
    assert.ok(point.x >= BOUNDS.minX && point.x <= BOUNDS.maxX);
    assert.ok(point.y >= BOUNDS.minY && point.y <= BOUNDS.maxY);
  }
  assert.ok(first.config.route[0].x < first.config.route[1].x);
  assert.throws(
    () => createAquariumBoids({
      seed: "missing-habitat",
      movementProfile: { ...movementProfile, habitat: {} },
      bounds: BOUNDS,
    }),
    /habitat route or valid open-water lane/,
  );
});
