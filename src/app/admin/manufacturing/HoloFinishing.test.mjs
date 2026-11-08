import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createJiti } from "jiti";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const jiti = createJiti(import.meta.url, { fsCache: false, tryNative: false, jsx: { runtime: "automatic" } });
const componentUrl = new URL("./HoloFinishing.jsx", import.meta.url);
const compiled = jiti.transform({ source: await readFile(componentUrl, "utf8"), filename: fileURLToPath(componentUrl), jsx: { runtime: "automatic" } });
const componentModule = { exports: {} };
new Function("require", "module", "exports", compiled)(createRequire(import.meta.url), componentModule, componentModule.exports);
const HoloFinishing = componentModule.exports.default;
const holo = { id: "pack:9", name: "Oysters", set: "reef", collectorNumber: "12", setTotal: 102, row: 3, column: 3, printingId: "reef-012" };
const markup = (props) => renderToStaticMarkup(createElement(HoloFinishing, { holo, buttonClassName: "print-button", onConfirmSticker() { throw new Error("Rendering cannot record progress"); }, ...props }));

test("finished-holo packing instructions retain the named card and slot with no confirmation input", () => {
  const before = JSON.stringify(holo);
  for (const confirmed of [undefined, false, true]) for (const disabled of [false, true]) {
    const html = markup({ holoHandling: "pull-finished", confirmed, disabled });
    assert.match(html, /Pull finished holo.*Oysters/);
    assert.match(html, /reef 12\/102/);
    assert.match(html, /Row 3, column 3/);
    assert.match(html, /Include this finished holo in the matching pack and discard the printed placeholder/);
    assert.doesNotMatch(html, /<button|<input|confirm|pulled/i);
  }
  assert.equal(JSON.stringify(holo), before);
  assert.match(markup({ holo: { ...holo, set: "ocean" }, holoHandling: "pull-finished" }), /Oceanic 12\/102/);
});

test("legacy sticker jobs keep their confirmation button, disabled guards and recorded status", () => {
  const open = markup({ confirmed: false, disabled: false });
  assert.match(open, /Holo sticker.*Oysters/); assert.match(open, /reef-012/);
  assert.match(open, /<button[^>]*>Confirm sticker applied<\/button>/);
  assert.doesNotMatch(open, /disabled=|printed placeholder/);
  assert.match(markup({ confirmed: false, disabled: true }), /<button[^>]*disabled=""/);
  assert.match(markup({ confirmed: true, disabled: false }), /<button[^>]*disabled=""[^>]*>Sticker applied/);
});
