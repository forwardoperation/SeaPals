import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("compiled scene objects render as decorative sprites over the ground layer", () => {
  assert.match(component, /function AdventureLayeredMapObject\(\{ object, scene \}\)/);
  assert.match(component, /style=\{getLayeredSceneObjectStyle\(object, scene\)\}/);
  assert.match(component, /renderedLayeredObjects\.map\(\(object\) => \(/);
  assert.match(component, /key=\{object\.renderId \?\? object\.id\}/);
  assert.match(component, /className=\{styles\.layeredMapObject\}/);
  assert.match(component, /alt=""[\s\S]*aria-hidden="true"/);
  assert.match(styles, /\.layeredMapObject\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?image-rendering:\s*pixelated;[\s\S]*?pointer-events:\s*none;/);
});

test("layered scenes give players and residents the same feet-based depth scale", () => {
  assert.match(component, /scene\.layeredObjects\?\.length[\s\S]*getLayeredSceneZIndex\(createLayeredActorRenderable\(\{ id: actorId, position \}\)\)/);
  assert.match(component, /actorPosition\(position, scene, trainer\.id\)/);
  assert.match(component, /actorPosition\(position, scene, "player"\)/);
  assert.match(component, /zIndex:\s*layeredZIndex \?\? 20 \+ Math\.round\(position\.y \* 10\)/);
});
