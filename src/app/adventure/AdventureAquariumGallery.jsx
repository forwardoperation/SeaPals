"use client";

import styles from "./adventure.module.css";

const FALLBACK_ATLAS_COLUMNS = 5;
const FALLBACK_ATLAS_ROWS = 2;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cssUrl(path) {
  return path ? `url(${JSON.stringify(String(path))})` : "none";
}

function withUnit(value, unit, fallback) {
  if (typeof value === "string" && value.trim()) return value;
  return `${finiteNumber(value, fallback)}${unit}`;
}

function tankSlotStyle(bounds, scene) {
  const sceneWidth = finiteNumber(scene?.width, 0);
  const sceneHeight = finiteNumber(scene?.height, 0);
  const left = finiteNumber(bounds?.left, Number.NaN);
  const top = finiteNumber(bounds?.top, Number.NaN);
  const right = finiteNumber(bounds?.right, Number.NaN);
  const bottom = finiteNumber(bounds?.bottom, Number.NaN);

  if (
    sceneWidth <= 0
    || sceneHeight <= 0
    || ![left, top, right, bottom].every(Number.isFinite)
    || right <= left
    || bottom <= top
  ) return null;

  // Aquarium gallery slots are scene-edge rectangles: (0, 0) is the
  // northwest corner and (scene.width, scene.height) is the southeast corner.
  return {
    left: `${(left / sceneWidth) * 100}%`,
    top: `${(top / sceneHeight) * 100}%`,
    width: `${((right - left) / sceneWidth) * 100}%`,
    height: `${((bottom - top) / sceneHeight) * 100}%`,
  };
}

function residentCategoryClass(category) {
  if (
    category === "apex"
    || category === "predator"
    || category === "filter-feeder"
    || category === "filter_feeder"
  ) return styles.aquariumGalleryResidentPredator;
  if (category === "coral") return styles.aquariumGalleryResidentCoral;
  if (category === "invertebrate") return styles.aquariumGalleryResidentBenthic;
  return "";
}

function residentStyle(occupant, index, atlasPath) {
  const animation = occupant?.animation ?? {};
  const visual = occupant?.visual ?? {};
  const sprite = occupant?.sprite ?? {};
  const atlasPosition = occupant?.atlasPosition ?? sprite.position ?? {};
  const atlasColumns = Math.max(
    1,
    Math.round(finiteNumber(sprite.columns, FALLBACK_ATLAS_COLUMNS)),
  );
  const atlasRows = Math.max(
    1,
    Math.round(finiteNumber(sprite.rows, FALLBACK_ATLAS_ROWS)),
  );
  const depth = clamp(finiteNumber(occupant?.depth, 0.35), 0, 1);
  const hasBiologicalScale = Number.isFinite(Number(visual.biologicalScale));
  const hasDepthScale = Number.isFinite(Number(visual.depthScale));
  const legacyCombinedScale = clamp(finiteNumber(visual.scale, 1), 0.08, 4);
  const biologicalScale = hasBiologicalScale
    ? clamp(finiteNumber(visual.biologicalScale, 1), 0.08, 4)
    : 1;
  const depthScale = hasDepthScale
    ? clamp(finiteNumber(visual.depthScale, 1), 0.28, 1.35)
    : hasBiologicalScale
      ? 1
      : legacyCombinedScale;
  const lane = clamp(Math.round(finiteNumber(animation.lane, index % 3)), 0, 4);
  const direction = finiteNumber(animation.direction, index % 2 === 0 ? 1 : -1) < 0 ? -1 : 1;
  const benthic = occupant?.category === "invertebrate";
  const coral = occupant?.category === "coral";
  const staticX = clamp(finiteNumber(animation.startX, 12 + ((index * 23) % 76)), 6, 94);
  const authoredY = finiteNumber(animation.startY, 24 + (lane * 18));
  const staticY = coral
    ? clamp(authoredY, 72, 91)
    : benthic
      ? clamp(81 + (lane * 2.2), 81, 90)
      : clamp(authoredY, 12, 88);

  return {
    "--aquarium-gallery-atlas": cssUrl(sprite.path ?? atlasPath),
    "--aquarium-gallery-atlas-width": `${atlasColumns * 100}%`,
    "--aquarium-gallery-atlas-height": `${atlasRows * 100}%`,
    "--aquarium-gallery-atlas-x": `${finiteNumber(atlasPosition.x, 0)}%`,
    "--aquarium-gallery-atlas-y": `${finiteNumber(atlasPosition.y, 0)}%`,
    "--aquarium-gallery-resident-static-x": `${staticX}%`,
    "--aquarium-gallery-resident-start-x": `${direction > 0 ? -14 : 114}%`,
    "--aquarium-gallery-resident-end-x": `${direction > 0 ? 114 : -14}%`,
    "--aquarium-gallery-resident-y": `${staticY}%`,
    "--aquarium-gallery-resident-direction": direction,
    "--aquarium-gallery-resident-delay": `${finiteNumber(animation.delaySeconds, -(index * 1.7))}s`,
    "--aquarium-gallery-resident-duration": `${clamp(
      finiteNumber(animation.durationSeconds, 18 + ((index % 5) * 2.7)),
      6,
      80,
    )}s`,
    "--aquarium-gallery-resident-drift": `${clamp(
      finiteNumber(animation.verticalDriftPercent, 1.2),
      -8,
      8,
    )}%`,
    // Species size and distance are independent. A cleaner wrasse should stay
    // tiny even when it happens to swim in the foreground, while a large fish
    // should still shrink as it crosses a far-depth lane. Older occupant models
    // only expose `visual.scale`; keep that as the combined compatibility value.
    "--aquarium-gallery-resident-biological-scale": biologicalScale,
    "--aquarium-gallery-resident-depth-scale": depthScale,
    "--aquarium-gallery-resident-opacity": clamp(finiteNumber(visual.opacity, 1), 0.12, 1),
    "--aquarium-gallery-resident-brightness": clamp(
      finiteNumber(visual.brightness, 1),
      0.35,
      1.5,
    ),
    "--aquarium-gallery-resident-saturation": clamp(
      finiteNumber(visual.saturation, 1),
      0.2,
      2,
    ),
    "--aquarium-gallery-resident-hue": withUnit(visual.hueRotate, "deg", depth * 10),
    "--aquarium-gallery-resident-blur": withUnit(visual.blur, "px", depth * 0.7),
    zIndex: Math.round(finiteNumber(visual.zIndex, 8 + ((1 - depth) * 20))),
  };
}

function tankCountSummary(tank) {
  const speciesCount = Math.max(
    0,
    Math.round(finiteNumber(tank?.representedSpeciesCount, tank?.occupants?.length ?? 0)),
  );
  const residentCount = Math.max(
    0,
    Math.round(finiteNumber(
      tank?.deliveredCreatureCount,
      tank?.occupants?.reduce(
        (total, occupant) => total + Math.max(0, finiteNumber(occupant?.quantity, 0)),
        0,
      ) ?? 0,
    )),
  );
  if (speciesCount === 0) return `${tank?.name ?? "Habitat"}: no delivered residents.`;
  return `${tank?.name ?? "Habitat"}: ${speciesCount} species, ${residentCount} ${residentCount === 1 ? "resident" : "residents"}.`;
}

export default function AdventureAquariumGallery({
  scene,
  aquariumModel,
  reducedMotion = false,
}) {
  const gallery = scene?.aquariumGallery;
  if (!gallery) return null;

  const tanks = Array.isArray(aquariumModel?.tanks) ? aquariumModel.tanks : [];
  const tankById = new Map(tanks.map((tank) => [tank.id, tank]));
  const tankSlots = (Array.isArray(gallery.tankSlots) ? gallery.tankSlots : [])
    .map((slot) => ({
      slot,
      tank: tankById.get(slot?.tankId),
      style: tankSlotStyle(slot?.bounds, scene),
    }))
    .filter(({ tank, style }) => tank && style);
  const ecosystemName = tankSlots[0]?.tank?.ecosystemName
    ?? gallery.name
    ?? gallery.ecosystemId
    ?? "Aquarium";

  return (
    <div
      className={[
        styles.aquariumGalleryScenery,
        reducedMotion ? styles.aquariumGalleryReducedMotion : "",
      ].filter(Boolean).join(" ")}
      data-aquarium-ecosystem={gallery.ecosystemId}
      style={{ pointerEvents: "none" }}
    >
      {tankSlots.map(({ slot, tank, style }) => {
        const occupants = Array.isArray(tank.occupants) ? tank.occupants.filter(Boolean) : [];
        const isApex = tank.tankKind === "apex";
        return (
          <section
            key={slot.tankId}
            className={[
              styles.aquariumGalleryTankWindow,
              isApex
                ? styles.aquariumGalleryApexTank
                : styles.aquariumGalleryCommunityTank,
            ].filter(Boolean).join(" ")}
            style={style}
            data-aquarium-tank={tank.id}
            data-tank-kind={tank.tankKind}
            aria-hidden="true"
          >
            <span
              className={styles.aquariumGalleryTankBackground}
              style={{ backgroundImage: cssUrl(tank.backgroundPath) }}
            />
            <span className={styles.aquariumGalleryResidentStage}>
              {occupants.map((occupant, index) => (
                <span
                  key={occupant.id ?? `${occupant.cardId ?? "resident"}-${index}`}
                  className={[
                    styles.aquariumGalleryResidentTrack,
                    residentCategoryClass(occupant.category),
                  ].filter(Boolean).join(" ")}
                  style={residentStyle(occupant, index, aquariumModel?.atlasPath)}
                  data-aquarium-species={occupant.speciesId ?? occupant.id}
                  data-category={occupant.category}
                  title={`${occupant.name ?? occupant.id ?? "Aquarium resident"}${
                    finiteNumber(occupant.quantity, 1) > 1 ? ` x${occupant.quantity}` : ""
                  }`}
                >
                  <span className={styles.aquariumGalleryResidentBody} />
                </span>
              ))}
            </span>
          </section>
        );
      })}
      <p className={styles.srOnly}>
        {ecosystemName} aquarium gallery. {tankSlots.map(({ tank }) => tankCountSummary(tank)).join(" ")}
      </p>
    </div>
  );
}
