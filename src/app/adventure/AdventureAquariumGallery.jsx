"use client";

import styles from "./adventure.module.css";

const FALLBACK_ATLAS_COLUMNS = 5;
const FALLBACK_ATLAS_ROWS = 2;
const AQUARIUM_MOVEMENT_KINDS = new Set([
  "school",
  "coral-home",
  "localized-benthic",
  "anchored",
  "cruiser",
]);
const AQUARIUM_BEHAVIOR_KINDS = new Set([
  "shelter-school",
  "cleaning-station",
  "host-bound-pair",
  "cryptic-grazer",
  "contour-school",
  "substrate-grazer",
  "reef-grazer-solo",
  "bottom-scuttler",
  "crevice-hunter",
  "territorial-pair",
  "cover-school-ball",
  "pelagic-apex-glide",
  "reef-ambush-patrol",
  "benthic-predator",
  "filter-feeder-glide",
]);
const SCHOOL_TRAIL_FORMATION = Object.freeze([
  Object.freeze({ x: 0, y: 0, scale: 1 }),
  Object.freeze({ x: -78, y: -48, scale: 0.92 }),
  Object.freeze({ x: -86, y: 48, scale: 0.84 }),
  Object.freeze({ x: -158, y: 5, scale: 0.78 }),
  Object.freeze({ x: -162, y: -74, scale: 0.72 }),
]);
const SCHOOL_BALL_FORMATION = Object.freeze([
  Object.freeze({ x: 0, y: 0, scale: 1 }),
  Object.freeze({ x: -58, y: -52, scale: 0.91 }),
  Object.freeze({ x: 54, y: -46, scale: 0.87 }),
  Object.freeze({ x: -50, y: 52, scale: 0.82 }),
  Object.freeze({ x: 56, y: 45, scale: 0.76 }),
]);
const PAIR_FORMATION = Object.freeze([
  Object.freeze({ x: 0, y: 0, scale: 1 }),
  Object.freeze({ x: -82, y: 36, scale: 0.84 }),
]);
const ROUTE_POINT_COUNT = 6;
const FALLBACK_BEHAVIOR_BY_SPECIES = Object.freeze({
  "white-grunt": "shelter-school",
  "cleaner-wrasse": "cleaning-station",
  clownfish: "host-bound-pair",
  "emerald-crab": "cryptic-grazer",
  "blue-tang": "contour-school",
  "sea-urchin": "substrate-grazer",
  "fairy-parrotfish": "reef-grazer-solo",
  "blue-crab": "bottom-scuttler",
  "spanish-hogfish": "crevice-hunter",
  "french-angelfish": "territorial-pair",
});
const ROUTE_BEHAVIOR_KINDS = new Set([
  "cover-school-ball",
  "shelter-school",
  "contour-school",
  "cryptic-grazer",
  "reef-grazer-solo",
  "bottom-scuttler",
  "crevice-hunter",
  "territorial-pair",
  "reef-ambush-patrol",
  "benthic-predator",
]);

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

function residentMovementProfile(occupant) {
  const authored = occupant?.movementProfile ?? occupant?.movement ?? {};
  const speciesId = String(occupant?.speciesId ?? occupant?.id ?? "");
  const fallbackKind = occupant?.category === "coral" || speciesId.includes("urchin")
    ? "anchored"
    : occupant?.category === "invertebrate"
      ? "localized-benthic"
      : "cruiser";
  const kind = AQUARIUM_MOVEMENT_KINDS.has(authored.kind) ? authored.kind : fallbackKind;
  const fallbackBehaviorKind = kind === "school"
    ? "shelter-school"
    : kind === "coral-home"
      ? "host-bound-pair"
      : kind === "localized-benthic"
        ? "bottom-scuttler"
        : kind === "anchored"
          ? "substrate-grazer"
          : "reef-grazer-solo";
  const behaviorKind = AQUARIUM_BEHAVIOR_KINDS.has(authored.behaviorKind)
    ? authored.behaviorKind
    : FALLBACK_BEHAVIOR_BY_SPECIES[speciesId] ?? fallbackBehaviorKind;
  return { ...authored, kind, behaviorKind };
}

function residentMovementClass(kind) {
  if (kind === "school") return styles.aquariumGalleryMovementSchool;
  if (kind === "coral-home") return styles.aquariumGalleryMovementCoralHome;
  if (kind === "localized-benthic") return styles.aquariumGalleryMovementLocalizedBenthic;
  if (kind === "anchored") return styles.aquariumGalleryMovementAnchored;
  return styles.aquariumGalleryMovementCruiser;
}

function residentBehaviorClass(behaviorKind) {
  if (behaviorKind === "cover-school-ball") {
    return styles.aquariumGalleryBehaviorBallSchool;
  }
  if (behaviorKind === "shelter-school") return styles.aquariumGalleryBehaviorShelterSchool;
  if (behaviorKind === "contour-school") return styles.aquariumGalleryBehaviorContourSchool;
  if (behaviorKind === "cleaning-station") {
    return styles.aquariumGalleryBehaviorCleaningStation;
  }
  if (behaviorKind === "host-bound-pair") return styles.aquariumGalleryBehaviorHostBoundPair;
  if (behaviorKind === "cryptic-grazer") return styles.aquariumGalleryBehaviorCrypticGrazer;
  if (behaviorKind === "substrate-grazer") return styles.aquariumGalleryBehaviorSubstrateGrazer;
  if (behaviorKind === "reef-grazer-solo") return styles.aquariumGalleryBehaviorReefGrazer;
  if (behaviorKind === "bottom-scuttler") return styles.aquariumGalleryBehaviorBottomScuttler;
  if (behaviorKind === "crevice-hunter") return styles.aquariumGalleryBehaviorCreviceHunter;
  if (behaviorKind === "pelagic-apex-glide") return styles.aquariumGalleryBehaviorPelagicGlide;
  if (behaviorKind === "reef-ambush-patrol") return styles.aquariumGalleryBehaviorReefAmbush;
  if (behaviorKind === "benthic-predator") return styles.aquariumGalleryBehaviorBenthicPredator;
  if (behaviorKind === "filter-feeder-glide") {
    return styles.aquariumGalleryBehaviorFilterFeederGlide;
  }
  return styles.aquariumGalleryBehaviorTerritorialPair;
}

function residentMemberCount(movementProfile) {
  const behaviorKind = movementProfile?.behaviorKind;
  const formation = movementProfile?.social?.formation;
  const grouped = formation === "pair"
    || formation === "loose-school"
    || formation === "staggered-school"
    || formation === "compact-ball"
    || movementProfile?.kind === "school"
    || behaviorKind === "cover-school-ball"
    || behaviorKind === "shelter-school"
    || behaviorKind === "contour-school"
    || behaviorKind === "host-bound-pair"
    || behaviorKind === "territorial-pair";
  if (!grouped) return 1;
  const formationLimit = formation === "pair" ? PAIR_FORMATION.length : SCHOOL_TRAIL_FORMATION.length;
  return clamp(
    Math.round(finiteNumber(
      movementProfile?.social?.visualCount,
      finiteNumber(movementProfile.groupSize, formation === "pair" ? 2 : 3),
    )),
    2,
    formationLimit,
  );
}

function residentMemberStyle(memberIndex, direction, movementProfile) {
  const behaviorKind = movementProfile?.behaviorKind;
  const authoredFormation = movementProfile?.social?.formation;
  const formationSet = authoredFormation === "pair"
    || behaviorKind === "host-bound-pair"
    || behaviorKind === "territorial-pair"
    ? PAIR_FORMATION
    : authoredFormation === "compact-ball"
      || behaviorKind === "cover-school-ball"
      ? SCHOOL_BALL_FORMATION
      : SCHOOL_TRAIL_FORMATION;
  const formation = formationSet[memberIndex] ?? formationSet[0];
  const cohesion = clamp(finiteNumber(movementProfile?.social?.cohesion, 0.8), 0, 1);
  const spacingPercent = clamp(
    finiteNumber(movementProfile?.social?.spacingPercent, authoredFormation === "pair" ? 4 : 4.5),
    0.5,
    12,
  );
  const spacingScale = clamp((spacingPercent / 4.5) * (1.12 - (cohesion * 0.12)), 0.35, 2);
  const memberX = formation.x * direction * spacingScale;
  return {
    "--aquarium-gallery-member-x": `${memberX}%`,
    "--aquarium-gallery-member-return-x": `${-memberX}%`,
    "--aquarium-gallery-member-y": `${formation.y * spacingScale}%`,
    "--aquarium-gallery-member-scale": formation.scale,
    "--aquarium-gallery-member-float-delay": `${-(memberIndex * 0.53)}s`,
    "--aquarium-gallery-school-cohesion": cohesion,
    "--aquarium-gallery-school-spacing": `${spacingPercent}%`,
  };
}

function midpointSeconds(range, fallback) {
  const minimum = finiteNumber(range?.min, Number.NaN);
  const maximum = finiteNumber(range?.max, Number.NaN);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
    return fallback;
  }
  return (minimum + maximum) * 0.5;
}

function percentPoint(value, fallbackX, fallbackY) {
  return {
    xPercent: clamp(finiteNumber(value?.xPercent, fallbackX), 3, 97),
    yPercent: clamp(finiteNumber(value?.yPercent, fallbackY), 5, 94),
  };
}

function residentRoutePoints(movementProfile, fallbackX, fallbackY) {
  const authored = movementProfile?.habitat?.contourPath?.points;
  const roam = movementProfile?.roam ?? {};
  const halfX = clamp(finiteNumber(roam.xPercent, 24) * 0.5, 2, 46);
  const halfY = clamp(finiteNumber(roam.yPercent, 12) * 0.5, 1, 28);
  const fallback = [
    { xPercent: fallbackX - halfX, yPercent: fallbackY },
    { xPercent: fallbackX, yPercent: fallbackY - halfY },
    { xPercent: fallbackX + halfX, yPercent: fallbackY },
    { xPercent: fallbackX, yPercent: fallbackY + halfY },
  ].map((point) => percentPoint(point, fallbackX, fallbackY));
  const source = Array.isArray(authored) && authored.length >= 2
    ? authored.map((point) => percentPoint(point, fallbackX, fallbackY))
    : fallback;

  // Sample every authored polyline into a fixed number of CSS destinations.
  // This keeps the DOM stable as future tanks add more or fewer contour points.
  return Array.from({ length: ROUTE_POINT_COUNT }, (_, index) => {
    const position = (index / (ROUTE_POINT_COUNT - 1)) * (source.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(source.length - 1, Math.ceil(position));
    const blend = position - leftIndex;
    return {
      xPercent: source[leftIndex].xPercent
        + ((source[rightIndex].xPercent - source[leftIndex].xPercent) * blend),
      yPercent: source[leftIndex].yPercent
        + ((source[rightIndex].yPercent - source[leftIndex].yPercent) * blend),
    };
  });
}

function residentHabitatFeatureId(movementProfile) {
  const habitat = movementProfile?.habitat ?? {};
  return habitat.contourPath?.id
    ?? habitat.station?.id
    ?? habitat.openWaterLane?.id
    ?? habitat.coverPoints?.[0]?.id;
}

function residentStyle(occupant, index, atlasPath, movementProfile) {
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
  const behaviorKind = movementProfile?.behaviorKind;
  const habitat = movementProfile?.habitat ?? {};
  const station = habitat.station ?? {};
  const openWaterLane = habitat.openWaterLane ?? {};
  const coverPoints = Array.isArray(habitat.coverPoints) ? habitat.coverPoints : [];
  const anchor = movementProfile?.anchor ?? {};
  const roam = movementProfile?.roam ?? {};
  const amplitude = movementProfile?.amplitude ?? {};
  const authoredStaticX = finiteNumber(animation.startX, 12 + ((index * 23) % 76));
  const featureX = finiteNumber(station.xPercent, finiteNumber(anchor.xPercent, authoredStaticX));
  const authoredY = finiteNumber(animation.startY, 24 + (lane * 18));
  const categoryY = coral
    ? clamp(authoredY, 72, 91)
    : benthic
      ? clamp(81 + (lane * 2.2), 81, 90)
      : clamp(authoredY, 12, 88);
  const featureY = finiteNumber(
    station.yPercent,
    finiteNumber(openWaterLane.yPercent, finiteNumber(anchor.yPercent, categoryY)),
  );
  const routePoints = residentRoutePoints(movementProfile, featureX, featureY);
  const usesAuthoredRoute = ROUTE_BEHAVIOR_KINDS.has(behaviorKind);
  const staticX = clamp(usesAuthoredRoute ? routePoints[0].xPercent : featureX, 6, 94);
  const staticY = clamp(usesAuthoredRoute ? routePoints[0].yPercent : featureY, 8, 92);
  const coverPoint = percentPoint(
    coverPoints[index % Math.max(coverPoints.length, 1)],
    staticX,
    staticY,
  );
  const stationRadius = clamp(finiteNumber(station.radiusPercent, 4), 0, 18);
  const usesLocalEnvelope = behaviorKind === "cleaning-station"
    || behaviorKind === "host-bound-pair";
  const localX = clamp(
    finiteNumber(
      usesLocalEnvelope ? roam.xPercent : amplitude.xPercent,
      usesLocalEnvelope ? stationRadius * 2 : 2.5,
    )
      * (usesLocalEnvelope ? 0.5 : 1),
    0,
    28,
  );
  const localY = clamp(
    finiteNumber(
      usesLocalEnvelope ? roam.yPercent : amplitude.yPercent,
      usesLocalEnvelope ? stationRadius * 2 : 2,
    )
      * (usesLocalEnvelope ? 0.5 : 1),
    0,
    10,
  );
  const weaveX = clamp(finiteNumber(amplitude.xPercent, 1.2), 0, 8);
  const weaveY = clamp(finiteNumber(amplitude.yPercent, 0.8), 0, 6);
  const speed = clamp(finiteNumber(movementProfile?.speed, 1), 0.05, 3);
  const timing = movementProfile?.timing ?? {};
  const pauseSeconds = clamp(midpointSeconds(timing.pauseSeconds, 1.2), 0, 12);
  const refugeCadenceSeconds = midpointSeconds(timing.refugeCadenceSeconds, Number.NaN);
  const burstSeconds = midpointSeconds(timing.burstSeconds, Number.NaN);
  const behaviorDuration = {
    "cover-school-ball": 13,
    "shelter-school": 17,
    "contour-school": 20,
    "cleaning-station": 7.5,
    "host-bound-pair": 9,
    "cryptic-grazer": 30,
    "substrate-grazer": 80,
    "reef-grazer-solo": 24,
    "bottom-scuttler": 25,
    "crevice-hunter": 20,
    "territorial-pair": 25,
    "pelagic-apex-glide": 28,
    "reef-ambush-patrol": 30,
    "benthic-predator": 32,
    "filter-feeder-glide": 40,
  }[behaviorKind];
  const baseDuration = finiteNumber(
    refugeCadenceSeconds,
    finiteNumber(
      behaviorDuration,
      finiteNumber(animation.durationSeconds, 18 + ((index % 5) * 2.7)),
    ),
  );
  const timingDrivenDuration = Math.max(
    baseDuration,
    pauseSeconds * 4,
    Number.isFinite(burstSeconds) ? (pauseSeconds + burstSeconds) * 3 : 0,
  );
  const defaultDuration = finiteNumber(
    timingDrivenDuration,
    finiteNumber(animation.durationSeconds, 18 + ((index % 5) * 2.7)),
  ) + ((index % 3) * 0.8);
  const duration = clamp(defaultDuration / speed, 3.8, 80);
  const laneHalfRange = finiteNumber(openWaterLane.verticalRangePercent, 4) * 0.5;
  const schoolWeave = clamp(
    Math.min(
      laneHalfRange,
      finiteNumber(amplitude.yPercent, finiteNumber(animation.verticalDriftPercent, 1.2)),
    ),
    0,
    6,
  );
  const localLeft = clamp(staticX - localX, 3, 97);
  const localRight = clamp(staticX + localX, 3, 97);
  const weaveLeft = clamp(staticX - weaveX, 3, 97);
  const weaveRight = clamp(staticX + weaveX, 3, 97);
  const routeStyle = Object.fromEntries(routePoints.flatMap((point, pointIndex) => [
    [`--aquarium-gallery-route-${pointIndex}-x`, `${point.xPercent.toFixed(2)}%`],
    [`--aquarium-gallery-route-${pointIndex}-y`, `${point.yPercent.toFixed(2)}%`],
  ]));

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
    "--aquarium-gallery-resident-local-left": `${localLeft}%`,
    "--aquarium-gallery-resident-local-right": `${localRight}%`,
    "--aquarium-gallery-resident-local-forward": `${direction > 0 ? localRight : localLeft}%`,
    "--aquarium-gallery-resident-local-return": `${direction > 0 ? localLeft : localRight}%`,
    "--aquarium-gallery-resident-local-top": `${clamp(staticY - localY, 5, 94)}%`,
    "--aquarium-gallery-resident-local-bottom": `${clamp(staticY + localY, 5, 94)}%`,
    "--aquarium-gallery-resident-weave-left": `${weaveLeft}%`,
    "--aquarium-gallery-resident-weave-right": `${weaveRight}%`,
    "--aquarium-gallery-resident-weave-forward": `${direction > 0 ? weaveRight : weaveLeft}%`,
    "--aquarium-gallery-resident-weave-return": `${direction > 0 ? weaveLeft : weaveRight}%`,
    "--aquarium-gallery-resident-weave-top": `${clamp(staticY - weaveY, 5, 94)}%`,
    "--aquarium-gallery-resident-weave-bottom": `${clamp(staticY + weaveY, 5, 94)}%`,
    "--aquarium-gallery-resident-cover-x": `${coverPoint.xPercent}%`,
    "--aquarium-gallery-resident-cover-y": `${coverPoint.yPercent}%`,
    "--aquarium-gallery-resident-cover-radius": `${clamp(
      finiteNumber(coverPoints[index % Math.max(coverPoints.length, 1)]?.radiusPercent, 4),
      0,
      18,
    )}%`,
    "--aquarium-gallery-resident-cover-opacity": clamp(
      finiteNumber(visual.opacity, 1) * 0.46,
      0.12,
      0.52,
    ),
    "--aquarium-gallery-resident-direction": direction,
    "--aquarium-gallery-resident-reverse-direction": -direction,
    "--aquarium-gallery-resident-delay": `${finiteNumber(animation.delaySeconds, -(index * 1.7))}s`,
    "--aquarium-gallery-resident-duration": `${duration}s`,
    "--aquarium-gallery-resident-pause": `${pauseSeconds}s`,
    "--aquarium-gallery-resident-refuge-cadence": `${finiteNumber(
      refugeCadenceSeconds,
      duration,
    )}s`,
    "--aquarium-gallery-resident-burst": `${finiteNumber(burstSeconds, 1)}s`,
    "--aquarium-gallery-resident-drift": `${schoolWeave}%`,
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
    ...routeStyle,
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
              {occupants.map((occupant, index) => {
                const movementProfile = residentMovementProfile(occupant);
                const direction = finiteNumber(
                  occupant?.animation?.direction,
                  index % 2 === 0 ? 1 : -1,
                ) < 0 ? -1 : 1;
                const memberCount = residentMemberCount(movementProfile);
                return (
                  <span
                    key={occupant.id ?? `${occupant.cardId ?? "resident"}-${index}`}
                    className={[
                      styles.aquariumGalleryResidentTrack,
                      residentCategoryClass(occupant.category),
                      residentMovementClass(movementProfile.kind),
                      residentBehaviorClass(movementProfile.behaviorKind),
                    ].filter(Boolean).join(" ")}
                    style={residentStyle(
                      occupant,
                      index,
                      aquariumModel?.atlasPath,
                      movementProfile,
                    )}
                    data-aquarium-species={occupant.speciesId ?? occupant.id}
                    data-category={occupant.category}
                    data-movement-profile={movementProfile.kind}
                    data-aquarium-behavior={movementProfile.behaviorKind}
                    data-habitat-feature={residentHabitatFeatureId(movementProfile)}
                    data-social-formation={movementProfile.social?.formation}
                    title={`${occupant.name ?? occupant.id ?? "Aquarium resident"}${
                      finiteNumber(occupant.quantity, 1) > 1 ? ` x${occupant.quantity}` : ""
                    }`}
                  >
                    {Array.from({ length: memberCount }, (_, memberIndex) => (
                      <span
                        key={memberIndex}
                        className={[
                          styles.aquariumGalleryResidentBody,
                          memberCount > 1 ? styles.aquariumGallerySchoolMember : "",
                        ].filter(Boolean).join(" ")}
                        style={residentMemberStyle(memberIndex, direction, movementProfile)}
                        data-school-member={memberCount > 1 ? memberIndex + 1 : undefined}
                      />
                    ))}
                  </span>
                );
              })}
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
