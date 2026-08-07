import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ADVENTURE_ACTOR_DEFAULTS } from "./adventureActors.mjs";
import { getAdventureCameraLayout } from "./adventureCamera.mjs";
import {
  ADVENTURE_ACTOR_VISUAL_EXTENTS,
  ADVENTURE_RENDER_OVERSCAN_TILES,
  adventureRenderBoundsIntersect,
  getAdventureActorVisualBounds,
  getAdventureCameraRenderBounds,
  isAdventureActorInRenderBounds,
  isAdventureLayeredObjectInRenderBounds,
} from "./adventureRenderCulling.mjs";
import { SCENES } from "./adventureWorld.mjs";

test("camera render bounds translate the visible crop into centered tile coordinates", () => {
  const northwestCamera = getAdventureCameraLayout({
    worldWidth: 30,
    worldHeight: 20,
    playerX: 0.5,
    playerY: 0.5,
  });
  assert.deepEqual(getAdventureCameraRenderBounds(northwestCamera), {
    left: -3,
    top: -3,
    right: 13,
    bottom: northwestCamera.viewHeight + 2,
  });

  const southeastCamera = getAdventureCameraLayout({
    worldWidth: 30,
    worldHeight: 20,
    playerX: 29.5,
    playerY: 19.5,
  });
  const southeastBounds = getAdventureCameraRenderBounds(southeastCamera);
  assert.equal(southeastBounds.left, southeastCamera.originX - 3);
  assert.equal(southeastBounds.top, southeastCamera.originY - 3);
  assert.equal(southeastBounds.right, southeastCamera.originX + southeastCamera.viewWidth + 2);
  assert.equal(southeastBounds.bottom, southeastCamera.originY + southeastCamera.viewHeight + 2);
  assert.equal(Object.isFrozen(southeastBounds), true);
});

test("render bounds support zero overscan and reject invalid camera geometry", () => {
  assert.deepEqual(getAdventureCameraRenderBounds({
    originX: 4,
    originY: 3,
    viewWidth: 11,
    viewHeight: 6,
  }, { overscanTiles: 0 }), {
    left: 3.5,
    top: 2.5,
    right: 14.5,
    bottom: 8.5,
  });
  assert.throws(
    () => getAdventureCameraRenderBounds({ originX: 0, originY: 0, viewWidth: 0, viewHeight: 6 }),
    /viewWidth must be positive/,
  );
  assert.throws(
    () => getAdventureCameraRenderBounds(
      { originX: 0, originY: 0, viewWidth: 11, viewHeight: 6 },
      { overscanTiles: -1 },
    ),
    /must not be negative/,
  );
});

test("intersection keeps edge-touching and rounding-adjacent visuals mounted", () => {
  const viewport = { left: 0, top: 0, right: 10, bottom: 10 };
  assert.equal(adventureRenderBoundsIntersect(
    viewport,
    { left: 10, top: 3, right: 12, bottom: 4 },
  ), true);
  assert.equal(adventureRenderBoundsIntersect(
    viewport,
    { left: 10 + 5e-10, top: 3, right: 12, bottom: 4 },
  ), true);
  assert.equal(adventureRenderBoundsIntersect(
    viewport,
    { left: 10 + 2e-9, top: 3, right: 12, bottom: 4 },
  ), false);
});

test("layered objects are culled by full visual bounds rather than their anchor", () => {
  const aquarium = SCENES.town.layeredObjects.find(({ id }) => id === "aquarium-workshop");
  assert.ok(aquarium);
  const roofCornerCrop = {
    left: aquarium.visualBounds.left,
    top: aquarium.visualBounds.top,
    right: aquarium.visualBounds.left + 0.5,
    bottom: aquarium.visualBounds.top + 0.5,
  };
  assert.ok(aquarium.at.x > roofCornerCrop.right, "the object's anchor should be east of this test crop");
  assert.ok(aquarium.at.y > roofCornerCrop.bottom, "the object's anchor should be south of this test crop");
  assert.equal(isAdventureLayeredObjectInRenderBounds(
    aquarium,
    roofCornerCrop,
  ), true, "the visible building overhang must keep the object mounted");
  assert.equal(isAdventureLayeredObjectInRenderBounds(
    aquarium,
    { left: 0, top: 0, right: 4, bottom: 4 },
  ), false);
});

test("actor bounds cover sprites and markers beyond the one-tile actor cell", () => {
  assert.deepEqual(ADVENTURE_ACTOR_VISUAL_EXTENTS, {
    left: 0.75,
    top: 1.25,
    right: 0.75,
    bottom: 0.75,
  });
  assert.deepEqual(getAdventureActorVisualBounds({ x: 10, y: 10 }), {
    left: 9.25,
    top: 8.75,
    right: 10.75,
    bottom: 10.75,
  });
  assert.equal(isAdventureActorInRenderBounds(
    { x: 10, y: 10 },
    { left: 8, top: 8, right: 9.25, bottom: 9 },
  ), true);
  assert.equal(isAdventureActorInRenderBounds(
    { x: 10, y: 10 },
    { left: 0, top: 0, right: 8, bottom: 8 },
  ), false);
});

test("every actually visible Elverson object and resident survives culling at each camera extreme", () => {
  const residentInteractions = SCENES.town.interactions.filter(({ type }) => (
    type === "trainer" || type === "npc"
  ));
  for (const [playerX, playerY] of [
    [0.5, 0.5],
    [SCENES.town.width / 2, SCENES.town.height / 2],
    [SCENES.town.width - 0.5, SCENES.town.height - 0.5],
  ]) {
    const camera = getAdventureCameraLayout({
      worldWidth: SCENES.town.width,
      worldHeight: SCENES.town.height,
      playerX,
      playerY,
    });
    const visibleBounds = getAdventureCameraRenderBounds(camera, { overscanTiles: 0 });
    const renderBounds = getAdventureCameraRenderBounds(camera);
    const renderedObjects = SCENES.town.layeredObjects.filter((object) => (
      isAdventureLayeredObjectInRenderBounds(object, renderBounds)
    ));
    const renderedResidents = residentInteractions.filter((interaction) => (
      isAdventureActorInRenderBounds(interaction.at, renderBounds)
    ));

    for (const visibleObject of SCENES.town.layeredObjects.filter((object) => (
      isAdventureLayeredObjectInRenderBounds(object, visibleBounds)
    ))) {
      assert.ok(renderedObjects.includes(visibleObject), `${visibleObject.id} must not pop in`);
    }
    for (const visibleResident of residentInteractions.filter((interaction) => (
      isAdventureActorInRenderBounds(interaction.at, visibleBounds)
    ))) {
      assert.ok(renderedResidents.includes(visibleResident), `${visibleResident.id} must not pop in`);
    }
    assert.ok(renderedObjects.length < SCENES.town.layeredObjects.length);
    assert.ok(renderedResidents.length < residentInteractions.length);
  }
});

test("the overscan margin provides more than half a second of invisible lead time", () => {
  const fastestExpectedCombinedMotionTilesPerSecond = SCENES.town.movement.speed
    + ADVENTURE_ACTOR_DEFAULTS.speed;
  assert.ok(
    (ADVENTURE_RENDER_OVERSCAN_TILES / fastestExpectedCombinedMotionTilesPerSecond) * 1000 >= 500,
  );
});

test("AdventureGame filters only mounted layered visuals using live actor positions", () => {
  const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
  assert.match(component, /const renderBounds = scene\.layeredObjects\.length[\s\S]*getAdventureCameraRenderBounds\(cameraLayout\)/);
  assert.match(component, /const renderedLayeredObjects = renderBounds[\s\S]*isAdventureLayeredObjectInRenderBounds\(object, renderBounds\)/);
  assert.match(component, /const renderedCharacterInteractions = renderBounds[\s\S]*characterInteraction\.id === activeConversationInteractionId/);
  assert.match(component, /actorStates\[characterInteraction\.id\]\?\.position \?\? characterInteraction\.at/);
  assert.match(component, /renderedLayeredObjects\.map\(\(object\) => \(/);
  assert.match(component, /renderedCharacterInteractions\.map\(\(characterInteraction\) => \{/);
  assert.match(component, /createAdventureActorStates\(sceneCharacterInteractions/);
  assert.doesNotMatch(component, /createAdventureActorStates\(renderedCharacterInteractions/);
});
