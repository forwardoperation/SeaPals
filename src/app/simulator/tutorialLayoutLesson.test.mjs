import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GUIDED_ACADEMY_LAYOUT_ACTIONS,
  completeGuidedAcademyLayoutAction,
  createGuidedAcademyLayoutProgress,
  getGuidedAcademyFoundationPlacementTarget,
  getPreparedTutorialFoundationPlacement,
  getTutorialFoundationFootprint,
  getGuidedAcademyOpenWaterPlacementTarget,
  TUTORIAL_OPEN_WATER_FOOTPRINT,
  getGuidedAcademyLayoutLessonStep,
} from "./tutorialLayoutLesson.mjs";

test("the Academy layout lesson requires every real view and arrangement control in order", () => {
  let progress = createGuidedAcademyLayoutProgress();
  const observed = [];

  while (true) {
    const step = getGuidedAcademyLayoutLessonStep(progress, { foundationName: "Mustard Hill Coral" });
    if (!step) break;
    observed.push({ actionId: step.actionId, target: step.target });
    progress = completeGuidedAcademyLayoutAction(progress, step.actionId);
  }

  assert.deepEqual(observed, [
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN, target: "player-zoom-in" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT, target: "player-zoom-out" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_FOUNDATION, target: "foundation-drag" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_SLOT, target: "slot-drag" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.FIT, target: "player-zoom-fit" },
  ]);
  assert.equal(getGuidedAcademyLayoutLessonStep(progress), null);
});

test("layout copy explains that controls organize the view without changing game rules", () => {
  const zoom = getGuidedAcademyLayoutLessonStep({});
  assert.match(zoom.message, /changes only your view/i);

  const foundation = getGuidedAcademyLayoutLessonStep({
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN]: true,
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT]: true,
  }, { foundationName: "Mustard Hill Coral" });
  assert.match(foundation.message, /Mustard Hill Coral/i);
  assert.match(foundation.message, /only the visual arrangement/i);

  const slot = getGuidedAcademyLayoutLessonStep({
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN]: true,
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT]: true,
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_FOUNDATION]: true,
  });
  assert.match(slot.message, /does not change which card class it accepts/i);
});

test("guided foundation targets spread early tutorial cards across distinct open areas", () => {
  const positions = Array.from({ length: 5 }, (_, index) => (
    getGuidedAcademyFoundationPlacementTarget(index)
  ));
  assert.deepEqual(
    positions[0],
    { x: 50, y: 24 },
    "the first foundation marker must stay above the mobile Professor card",
  );
  assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, positions.length);
  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      assert.ok(
        Math.hypot(
          positions[left].x - positions[right].x,
          positions[left].y - positions[right].y,
        ) >= 30,
      );
      const horizontalSeparation = Math.abs(positions[left].x - positions[right].x) / 100 * 1040;
      const verticalSeparation = Math.abs(positions[left].y - positions[right].y) / 100 * 585;
      assert.ok(
        horizontalSeparation >= 220 || verticalSeparation >= 260,
        `planned foundation ${left + 1} must not cover foundation ${right + 1}`,
      );
    }
  }
  assert.throws(() => getGuidedAcademyFoundationPlacementTarget(-1), /non-negative/);
});

test("prepared lesson foundations open in centered rows with room for their slot networks", () => {
  const expected = new Map([
    [1, [{ x: 50, y: 50 }]],
    [2, [{ x: -20, y: 50 }, { x: 120, y: 50 }]],
    [3, [{ x: -20, y: -70 }, { x: 120, y: -70 }, { x: 50, y: 170 }]],
    [4, [{ x: -20, y: -70 }, { x: 120, y: -70 }, { x: -20, y: 170 }, { x: 120, y: 170 }]],
    [5, [{ x: -90, y: -70 }, { x: 50, y: -70 }, { x: 190, y: -70 }, { x: -20, y: 170 }, { x: 120, y: 170 }]],
    [6, [{ x: -90, y: -70 }, { x: 50, y: -70 }, { x: 190, y: -70 }, { x: -90, y: 170 }, { x: 50, y: 170 }, { x: 190, y: 170 }]],
  ]);

  for (const [total, expectedPositions] of expected) {
    const positions = Array.from({ length: total }, (_, index) => (
      getPreparedTutorialFoundationPlacement(index, total)
    ));
    assert.deepEqual(positions, expectedPositions, `${total} prepared Foundations use the intended centered grid`);
    assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, total);
  }

  assert.throws(() => getPreparedTutorialFoundationPlacement(2, 2), /valid index/);
  assert.throws(() => getPreparedTutorialFoundationPlacement(0, 0), /positive total/);
});

test("guided foundation targets avoid Coral cards already on the live board", () => {
  const target = getGuidedAcademyFoundationPlacementTarget([
    { cardId: "mustard-hill-coral-base", x: 50, y: 50 },
  ]);

  assert.deepEqual(target, { x: 18, y: 72 });
  assert.ok(
    Math.abs(target.x - 50) >= 30 || Math.abs(target.y - 50) >= 38,
    "the drop target must clear the existing Coral card",
  );

  const crowdedTarget = getGuidedAcademyFoundationPlacementTarget([
    { x: 20, y: 50 },
    { x: 50, y: 50 },
    { x: 80, y: 50 },
  ]);
  assert.ok(crowdedTarget.y <= 24, "a crowded middle row should send the player to open water above it");
});

test("live Foundation placement clears complete moved branches on phone and desktop boards", () => {
  const anchors = [{ left: "50%", top: "-100%" }, { left: "50%", top: "200%" }];
  const incomingFootprint = getTutorialFoundationFootprint([{}, {}], anchors);
  for (const [boardWidth, boardHeight] of [[375, 530], [390, 650], [1040, 585]]) {
    for (const movedX of [18, 48, 76, 150]) {
      const foundations = [{
        id: "brain", x: movedX, y: 24,
        slots: [{ position: { left: "220%", top: "-100%" }, cardId: "sea-urchin" }, {}],
      }];
      const original = structuredClone(foundations);
      const existingFootprints = foundations.map((foundation) => getTutorialFoundationFootprint(foundation.slots, anchors));
      const target = getGuidedAcademyFoundationPlacementTarget(foundations, { boardWidth, boardHeight, incomingFootprint, existingFootprints });
      const existing = existingFootprints[0];
      const oldX = movedX / 100 * boardWidth;
      const oldY = 24 / 100 * boardHeight;
      const newX = target.x / 100 * boardWidth;
      const newY = target.y / 100 * boardHeight;
      assert.ok(
        newX + incomingFootprint.minX >= oldX + existing.maxX + 23.999
          || newX + incomingFootprint.maxX <= oldX + existing.minX - 23.999
          || newY + incomingFootprint.minY >= oldY + existing.maxY + 23.999
          || newY + incomingFootprint.maxY <= oldY + existing.minY - 23.999,
        `${boardWidth}px board must clear the moved Coral, its moved slot, and future occupied slots`,
      );
      assert.deepEqual(foundations, original, "safe placement never resets the player's moved branch");
    }
  }
});

test("crowded live tutorial boards expand into open water instead of settling for overlapping targets", () => {
  const boardWidth = 360;
  const boardHeight = 480;
  const footprint = getTutorialFoundationFootprint([], []);
  const foundations = [];
  for (let index = 0; index < 10; index += 1) {
    const target = getGuidedAcademyFoundationPlacementTarget(foundations, {
      boardWidth, boardHeight,
      incomingFootprint: footprint,
      existingFootprints: foundations.map(() => footprint),
    });
    for (const placed of foundations) {
      const horizontal = Math.abs(target.x - placed.x) / 100 * boardWidth;
      const vertical = Math.abs(target.y - placed.y) / 100 * boardHeight;
      assert.ok(horizontal >= 263.999 || vertical >= 363.999, "every new School clears the existing cards and HP rails");
    }
    foundations.push({ ...target, slots: [] });
  }
  assert.ok(foundations.some(({ x, y }) => x < 0 || x > 100 || y < 0 || y > 100), "Fit can reveal safe placement outside the initial viewport");
});

test("empty and occupied slot footprints reserve the same space and honor dragged offsets", () => {
  const anchors = [{ left: "50%", top: "-100%" }, { left: "50%", top: "200%" }];
  const empty = getTutorialFoundationFootprint([{}, {}], anchors);
  const occupied = getTutorialFoundationFootprint([{ cardId: "clownfish" }, { cardId: "sea-urchin" }], anchors);
  assert.deepEqual(empty, { minX: -120, maxX: 120, minY: -530, maxY: 530 });
  assert.deepEqual(occupied, empty);
  const moved = getTutorialFoundationFootprint([{ position: { left: "250%", top: "50%" } }, {}], anchors);
  assert.equal(moved.maxX, 570, "slot coordinates are relative to the 240px Foundation anchor, not to the viewport");
});

test("the live placement adapter preserves moved slots and reserves later lesson upgrade slots", () => {
  const simulator = readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
  const source = simulator.slice(simulator.indexOf("  function getLessonFoundationFootprint("), simulator.indexOf("  function getLessonFoundationPlacement("));
  const fixtureCards = {
    base: { slots: [{}, {}], upgrade: { nextCardId: "stage1" } },
    stage1: { slots: [{}, {}, {}, {}], upgrade: { nextCardId: "stage2" } },
    stage2: { slots: [{}, {}, {}, {}, {}, {}] },
  };
  const getAnchors = (count) => Array.from({ length: count }, (_, index) => ({
    left: `${50 + Math.cos(index / count * Math.PI * 2 - Math.PI / 2) * 150}%`,
    top: `${50 + Math.sin(index / count * Math.PI * 2 - Math.PI / 2) * 150}%`,
  }));
  const measure = new Function("embeddedLesson", "cardsById", "createCoralSlots", "getTutorialFoundationFootprint", "getBracketSlotPositions", `${source}; return getLessonFoundationFootprint;`)(
    { buildCards: { laterUpgrade: ["stage1"] } }, fixtureCards, (card) => card.slots, getTutorialFoundationFootprint, getAnchors,
  );
  const movedSlots = [{ position: { left: "250%", top: "50%" } }, {}];
  const footprint = measure(movedSlots, "base");
  assert.equal(footprint.maxX, 570, "a dragged existing slot is never replaced by the upgrade's default position");
  assert.equal(footprint.minX, -450, "the future Stage 1 left slot is reserved before its neighbor is placed");
  assert.deepEqual(movedSlots, [{ position: { left: "250%", top: "50%" } }, {}]);
});

test("the final lesson gives every open-water creature a distinct space clear of its four Schools", () => {
  for (const [boardWidth, boardHeight] of [[375, 530], [390, 650], [1040, 585]]) {
    const cards = [];
    const footprints = [];
    const schoolFootprint = getTutorialFoundationFootprint();
    for (let index = 0; index < 4; index += 1) {
      cards.push(getGuidedAcademyFoundationPlacementTarget(cards, {
        boardWidth, boardHeight, incomingFootprint: schoolFootprint, existingFootprints: footprints,
      }));
      footprints.push(schoolFootprint);
    }
    const schoolPositions = structuredClone(cards);
    for (const cardId of ["halfbeak", "bonito-tuna", "blue-sea-dragon", "market-squid", "open-ocean", "ocean-sunfish"]) {
      const incomingFootprint = cardId === "open-ocean" ? { ...TUTORIAL_OPEN_WATER_FOOTPRINT, minY: -170 } : TUTORIAL_OPEN_WATER_FOOTPRINT;
      const target = getGuidedAcademyOpenWaterPlacementTarget(cards, { boardWidth, boardHeight, existingFootprints: footprints, incomingFootprint });
      const x = target.x / 100 * boardWidth;
      const y = target.y / 100 * boardHeight;
      cards.forEach((card, index) => {
        const previousX = card.x / 100 * boardWidth;
        const previousY = card.y / 100 * boardHeight;
        const previous = footprints[index];
        assert.ok(
          x - 90 >= previousX + previous.maxX + 23.999
            || x + 90 <= previousX + previous.minX - 23.999
            || y + incomingFootprint.minY >= previousY + previous.maxY + 23.999
            || y + 110 <= previousY + previous.minY - 23.999,
          `${cardId} must clear prior cards at ${boardWidth}px`,
        );
      });
      cards.push(target);
      footprints.push(incomingFootprint);
    }
    assert.deepEqual(cards.slice(0, 4), schoolPositions, "adding creatures does not reset Foundation layout");
    assert.equal(new Set(cards.map(({ x, y }) => `${x},${y}`)).size, 10);
  }
});

test("the live open-water adapter respects dragged cards and measures legacy floating cards through the camera", () => {
  const simulator = readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
  const source = simulator.slice(simulator.indexOf("  function getLessonOpenWaterPlacement("), simulator.indexOf("  const embeddedLessonEcosystemDropPosition"));
  const pointSource = simulator.slice(simulator.indexOf("function getPlacementCoordinatesFromPoint("), simulator.indexOf("function getPlacementCoordinates("));
  const getPoint = new Function(`${pointSource}; return getPlacementCoordinatesFromPoint;`)();
  const schools = [{ x: 50, y: 24, slots: [], cardId: "school" }];
  const creatures = [{ instanceId: "fish-1", cardId: "halfbeak", position: { x: 50, y: 24 } }];
  const habitats = [{ instanceId: "habitat-1", cardId: "open-ocean" }];
  const original = structuredClone({ schools, creatures, habitats });
  let measured;
  const context = {
    ecosystemRef: { current: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 530 }),
      querySelectorAll: () => [{
        getAttribute: () => "habitat:habitat-1",
        getBoundingClientRect: () => ({ left: 171.25, top: 256.5, width: 90, height: 110 }),
      }],
    } },
    playerCorals: schools,
    playerReefCreatureInstances: creatures,
    playerHabitatInstances: habitats,
    getLessonFoundationFootprint: () => getTutorialFoundationFootprint(),
    getLessonFloatingCardFootprint: () => TUTORIAL_OPEN_WATER_FOOTPRINT,
    normalizeOpenWaterPlacementPosition: (position) => position ?? null,
    floatingCardOffsets: { "player-reef-fish-1": { x: 75, y: -53 } },
    playerCameraRef: { current: { zoom: 0.5, offset: { x: 10, y: 20 } } },
    getPlacementCoordinatesFromPoint: getPoint,
    getGuidedAcademyOpenWaterPlacementTarget: (cards, layout) => { measured = { cards, layout }; return { x: 120, y: 130 }; },
  };
  const choose = new Function(...Object.keys(context), `${source}; return getLessonOpenWaterPlacement;`)(...Object.values(context));
  assert.deepEqual(choose("ocean-sunfish"), { x: 120, y: 130 });
  assert.deepEqual(measured.cards.slice(1), [{ x: 70, y: 14 }, { x: 60, y: 60 }]);
  assert.equal(measured.layout.existingFootprints.length, 3);
  assert.deepEqual({ schools, creatures, habitats }, original, "allocation only measures the current layout");
});

test("the live simulator wires each lesson to its real control and a precise placement marker", () => {
  const simulator = readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
  assert.match(simulator, /data-tutorial-target="player-zoom-in"[\s\S]{0,700}GUIDED_ACADEMY_LAYOUT_ACTIONS\.ZOOM_IN/);
  assert.match(simulator, /data-tutorial-target="player-zoom-out"[\s\S]{0,700}GUIDED_ACADEMY_LAYOUT_ACTIONS\.ZOOM_OUT/);
  assert.match(simulator, /data-tutorial-target="player-zoom-fit"[\s\S]{0,700}GUIDED_ACADEMY_LAYOUT_ACTIONS\.FIT/);
  assert.match(simulator, /data-tutorial-target=\{[\s\S]{0,220}"foundation-drag"/);
  assert.match(simulator, /data-tutorial-target=\{[\s\S]{0,220}"slot-drag"/);
  assert.match(simulator, /guidedFoundationPlacementTarget[\s\S]{0,200}\?\? getPlacementCoordinates/);
  assert.match(simulator, /getGuidedAcademyFoundationPlacementTarget\(playerCorals, \{[\s\S]*?boardWidth: rect\?\.width[\s\S]*?existingFootprints:/);
  assert.match(simulator, /const tutorialPendingFoundationPlacement[\s\S]*?requestAnimationFrame\(\(\) => zoomEcosystemToFit\("player"\)\)/);
  assert.match(simulator, /if \(pendingFoundation && tutorialPendingFoundationCardId\)[\s\S]*?bounds\.push/);
  assert.match(simulator, /tutorialHelp\?\.target === "placement" \|\| embeddedLessonEcosystemDropCardIds\.includes\(cardId\)/, "drag placement must use the same safe target as click placement");
  assert.match(simulator, /normalizeOpenWaterPlacementPosition\(embeddedLesson \? getLessonOpenWaterPlacement\(cardId\) : placementPosition\)/, "both click and drag flow through the safe tutorial oceanic play path");
  assert.match(simulator, /if \(embeddedLesson\) habitatInstance\.position = normalizeOpenWaterPlacementPosition\(getLessonOpenWaterPlacement\(cardId\)\)/, "Open Ocean must not later cover the Schools or their creatures");
  assert.match(simulator, /if \(pendingOpenWater && tutorialPendingOpenWaterCardId\)[\s\S]*?bounds\.push/, "Fit includes the next free open-water destination");
  assert.match(simulator, /data-tutorial-target="placement"[\s\S]{0,700}Place here/);
  assert.match(simulator, /const safeZoom = Math\.max\(0\.01, ecosystemZoom\)/);
  assert.match(simulator, /dx \/ safeZoom/);
  assert.match(simulator, /dy \/ safeZoom/);
});
