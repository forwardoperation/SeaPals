import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertFigmaCacheSnapshot,
  canReuseFigmaSnapshot,
  parseFigmaSnapshot,
  readFigmaSnapshot,
  sameFigmaSnapshot,
  snapshotReleaseId,
  withVerifiedFigmaSnapshot,
} from "../../../scripts/manufacturing/sync-figma.mjs";
import { V3_BACK_TEMPLATE, V3_PRINT_LAYOUT } from "./printPlan.mjs";
import { buildPrintingCatalog } from "./boosters.mjs";
import { validateRelease } from "./integration.mjs";

const snapshot = {
  version: "2412156090472208619",
  lastModified: "2026-10-20T12:34:56Z",
};
const changedSnapshot = { ...snapshot, lastModified: "2026-10-20T12:35:00Z" };
const sourceHash = "a".repeat(64);
const source = {
  fileKey: "xeol2YE0jCE0N5vAD6tjzx",
  templates: {
    version: "figma-cutter-nine-up-v3",
    fronts: V3_PRINT_LAYOUT,
    backs: V3_BACK_TEMPLATE,
  },
};

// Geometry validation is covered separately by cutterSync. This small saved V3
// fixture lets snapshot tests exercise real template validation and call order.
function templateNode(template) {
  const origin = { x: -5700, y: 18125, width: 2550, height: 3300 };
  return {
    id: template.nodeId,
    name: template.name,
    type: "FRAME",
    absoluteBoundingBox: origin,
    children: [
      {
        id: template.background.nodeId,
        type: "RECTANGLE",
        name: "Ocean backdrop",
        absoluteBoundingBox: {
          ...template.background,
          x: origin.x + template.background.x,
          y: origin.y + template.background.y,
        },
        fills: [{ type: "IMAGE", imageRef: "private-ocean-art", scaleMode: "FILL" }],
      },
      {
        name: "card_backs",
        type: "FRAME",
        children: template.positions.map((position, index) => ({
          id: `slot-${index}`,
          type: "GROUP",
          absoluteBoundingBox: {
            ...position,
            x: origin.x + position.x,
            y: origin.y + position.y,
          },
          children: [{
            type: "TEXT",
            characters: `${Math.floor(index / 3) + 1}:${index % 3 + 1}`,
          }],
        })),
      },
    ],
  };
}

function figmaFixture({
  file = snapshot,
  templates = file,
  mutateTemplates = () => {},
  fail = null,
} = {}) {
  const calls = [];
  return {
    calls,
    async figma(route) {
      calls.push(route);
      if (fail) throw fail;
      const url = new URL(`https://api.figma.com/v1/${route}`);
      if (url.pathname.endsWith("/nodes")) {
        const response = {
          ...templates,
          nodes: {
            [V3_PRINT_LAYOUT.nodeId]: { document: templateNode(V3_PRINT_LAYOUT) },
            [V3_BACK_TEMPLATE.nodeId]: { document: templateNode(V3_BACK_TEMPLATE) },
          },
        };
        mutateTemplates(response);
        return response;
      }
      assert.equal(url.pathname, `/v1/files/${source.fileKey}`);
      return { ...file };
    },
  };
}

const cached = (overrides = {}) => ({
  version: snapshot.version,
  sourceHash,
  figmaSnapshot: { ...snapshot },
  assets: { "reef-017": { sha256: "b".repeat(64) } },
  ...overrides,
});

test("snapshot metadata must identify the requested version and a valid modification time", () => {
  assert.deepEqual(parseFigmaSnapshot({ ...snapshot, name: "Ignored metadata" }, snapshot.version), snapshot);
  const malformed = [
    undefined,
    null,
    {},
    { version: snapshot.version },
    { ...snapshot, version: "" },
    { ...snapshot, version: 2412156090472208619 },
    { ...snapshot, version: "different-version" },
    ...[undefined, null, "", "not-a-date", 0, Infinity].map((lastModified) => ({
      ...snapshot, lastModified,
    })),
  ];
  for (const metadata of malformed) {
    assert.throws(() => parseFigmaSnapshot(metadata, snapshot.version), /snapshot|version|modified|timestamp/i);
  }
});

test("snapshot reads pin and encode the requested version for metadata and both templates", async () => {
  const requested = { ...snapshot, version: "saved/version+123" };
  const f = figmaFixture({ file: requested });
  assert.deepEqual(await readFigmaSnapshot(f.figma, source, requested.version), requested);
  assert.equal(f.calls.length, 2);
  const [metadata, templates] = f.calls.map((route) => new URL(`https://api.figma.com/v1/${route}`));
  assert.equal(metadata.searchParams.get("depth"), "1");
  assert.equal(metadata.searchParams.get("version"), requested.version);
  assert.ok(!metadata.pathname.endsWith("/nodes"));
  assert.ok(templates.pathname.endsWith("/nodes"));
  assert.equal(templates.searchParams.get("version"), requested.version);
  assert.equal(templates.searchParams.get("geometry"), "paths");
  assert.equal(templates.searchParams.get("ids"), "4099:61637,4099:61666");
});

test("metadata and template responses must describe the same remote snapshot", async () => {
  for (const templates of [
    changedSnapshot,
    { ...snapshot, version: "changed-version" },
    { version: snapshot.version },
    {},
  ]) {
    const f = figmaFixture({ templates });
    await assert.rejects(readFigmaSnapshot(f.figma, source, snapshot.version), /snapshot|version|modified|changed/i);
  }
});

test("template responses without the pinned version fail closed despite a matching timestamp", async () => {
  const f = figmaFixture({ templates: { lastModified: snapshot.lastModified } });
  await assert.rejects(readFigmaSnapshot(f.figma, source, snapshot.version), /snapshot|version/i);
});

test("template validation runs before a matching snapshot may authorize an unchanged skip", async () => {
  const f = figmaFixture({
    mutateTemplates(response) {
      response.nodes[V3_PRINT_LAYOUT.nodeId].document.children[0].visible = false;
    },
  });
  let skipReached = false;
  await assert.rejects(async () => {
    const current = await readFigmaSnapshot(f.figma, source, snapshot.version);
    skipReached = canReuseFigmaSnapshot(cached(), current, sourceHash);
  }, /Cutter template|ocean backdrop/);
  assert.equal(skipReached, false);
  assert.equal(f.calls.length, 2);
});

test("snapshot comparison rejects changed or absent provenance even when the Figma version is unchanged", () => {
  assert.equal(sameFigmaSnapshot(snapshot, { ...snapshot }), true);
  for (const other of [
    changedSnapshot,
    { ...snapshot, version: "other-version" },
    { version: snapshot.version },
    {},
    null,
    undefined,
  ]) {
    assert.equal(sameFigmaSnapshot(snapshot, other), false);
    assert.equal(sameFigmaSnapshot(other, snapshot), false);
  }
});

test("resume and unchanged checks require matching version, source mappings, and remote marker", () => {
  assert.equal(canReuseFigmaSnapshot(cached(), snapshot, sourceHash), true);
  const releaseRecord = cached();
  delete releaseRecord.version;
  releaseRecord.figmaVersion = snapshot.version;
  assert.equal(canReuseFigmaSnapshot(releaseRecord, snapshot, sourceHash), true);
  const legacy = cached();
  delete legacy.figmaSnapshot;
  const wrongVersion = cached({ version: "old-version" });
  const wrongMappings = cached({ sourceHash: "c".repeat(64) });
  for (const record of [legacy, wrongVersion, wrongMappings, cached({ figmaSnapshot: changedSnapshot }), {}, null]) {
    assert.equal(canReuseFigmaSnapshot(record, snapshot, sourceHash), false);
  }
  assert.equal(canReuseFigmaSnapshot(cached(), changedSnapshot, sourceHash), false);
});

test("explicit release IDs cannot overwrite legacy or changed-snapshot cache records", () => {
  const matching = cached();
  assert.doesNotThrow(() => assertFigmaCacheSnapshot(matching, snapshot, sourceHash, "progress"));
  const legacy = cached();
  delete legacy.figmaSnapshot;
  for (const record of [legacy, cached({ figmaSnapshot: changedSnapshot }), cached({ sourceHash: "c".repeat(64) })]) {
    const before = structuredClone(record);
    assert.throws(
      () => assertFigmaCacheSnapshot(record, snapshot, sourceHash, "progress"),
      /new.*release|release.*ID|choose/i,
    );
    assert.deepEqual(record, before, "Rejection must preserve historical cache metadata.");
  }
});

test("default release identity changes with a same-version edit and remains deterministic", () => {
  const original = snapshotReleaseId(snapshot, sourceHash);
  assert.equal(snapshotReleaseId({ ...snapshot }, sourceHash), original);
  assert.match(original, /^[A-Za-z0-9._-]{1,100}$/);
  assert.ok(original.includes(snapshot.version));
  assert.notEqual(snapshotReleaseId(changedSnapshot, sourceHash), original);
  assert.notEqual(snapshotReleaseId(snapshot, "c".repeat(64)), original);
});

for (const stage of ["post-export release write", "pre-publication activation"]) {
  test(`${stage} is gated by a fresh remote snapshot and templates`, async () => {
    const f = figmaFixture();
    const output = { stage };
    let actions = 0;
    const result = await withVerifiedFigmaSnapshot(f.figma, source, snapshot, async () => {
      actions += 1;
      assert.equal(f.calls.length, 2, "The action must wait for both remote checks.");
      return output;
    });
    assert.equal(result, output);
    assert.equal(actions, 1);
  });

  test(`${stage} never executes after same-version edits or template drift`, async () => {
    const cases = [
      figmaFixture({ file: changedSnapshot }),
      figmaFixture({ templates: changedSnapshot }),
      figmaFixture({
        mutateTemplates(response) {
          response.nodes[V3_BACK_TEMPLATE.nodeId].document.children[0].visible = false;
        },
      }),
      figmaFixture({ fail: new Error("Figma temporarily unavailable") }),
    ];
    for (const f of cases) {
      let actions = 0;
      await assert.rejects(
        withVerifiedFigmaSnapshot(f.figma, source, snapshot, async () => { actions += 1; }),
        /snapshot|changed|Cutter template|ocean backdrop|unavailable/i,
      );
      assert.equal(actions, 0, "No release write or publication may occur after a failed source check.");
    }
  });
}

test("the final source guard preserves an operation failure", async () => {
  const f = figmaFixture();
  const failure = new Error("Private upload failed");
  await assert.rejects(
    withVerifiedFigmaSnapshot(f.figma, source, snapshot, async () => { throw failure; }),
    (error) => error === failure,
  );
});

test("published legacy releases remain valid without new snapshot metadata", async () => {
  const read = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8"));
  const catalog = buildPrintingCatalog(await read("gallery-set-list.json"), await read("gallery-images.json"));
  const legacy = { releaseId: "legacy-release", figmaVersion: "old-version", catalog, assets: {} };
  const before = structuredClone(legacy);
  assert.equal(validateRelease(legacy), legacy);
  assert.deepEqual(legacy, before, "Loading an old immutable release must not rewrite its metadata.");
});

