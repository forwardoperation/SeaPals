"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AQUARIUM_BOIDS_FIXED_STEP_SECONDS,
  aquariumFishPitchDegrees,
  createAquariumBoids,
  createAquariumBoidsSimulationKey,
  stepAquariumBoids,
} from "./adventureAquariumBoids.mjs";
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
const AQUARIUM_BOIDS_BOUNDS = Object.freeze({
  minX: 3,
  maxX: 97,
  minY: 5,
  maxY: 94,
});
const MAX_BOIDS_STEPS_PER_FRAME = 5;
const FACING_DEAD_ZONE_PIXELS_PER_SECOND = 2;
const FACING_WRAP_STAGE_FRACTION = 0.36;
const DEFAULT_FISH_MAX_PITCH_DEGREES = 20;
const ABSOLUTE_FISH_MAX_PITCH_DEGREES = 25;
const PITCH_SMOOTHING_RATE_PER_SECOND = 9;
const BOID_PITCH_DEAD_ZONE = 0.08;
const TRACK_PITCH_DEAD_ZONE_PIXELS_PER_SECOND = 1.5;
const LIVE_BOIDS_BEHAVIOR_KINDS = new Set([
  "cover-school-ball",
  "shelter-school",
  "contour-school",
]);
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

function facingDirection(value, fallback = 1) {
  const direction = finiteNumber(value, fallback);
  return direction < 0 ? -1 : 1;
}

function facingLabel(direction) {
  return facingDirection(direction) < 0 ? "left" : "right";
}

function setElementFacing(element, direction) {
  if (!element) return;
  const normalizedDirection = facingDirection(direction);
  const label = facingLabel(normalizedDirection);
  if (element.dataset.facing !== label) element.dataset.facing = label;
  element.style.setProperty(
    "--aquarium-gallery-resident-direction",
    String(normalizedDirection),
  );
}

function smoothPitchDegrees(currentPitch, targetPitch, elapsedSeconds) {
  const elapsed = clamp(finiteNumber(elapsedSeconds, 0), 0, 0.1);
  const blend = 1 - Math.exp(-PITCH_SMOOTHING_RATE_PER_SECOND * elapsed);
  return finiteNumber(currentPitch, 0)
    + ((finiteNumber(targetPitch, 0) - finiteNumber(currentPitch, 0)) * blend);
}

function setElementPitch(element, pitchDegrees) {
  if (!element) return;
  const pitch = clamp(
    finiteNumber(pitchDegrees, 0),
    -ABSOLUTE_FISH_MAX_PITCH_DEGREES,
    ABSOLUTE_FISH_MAX_PITCH_DEGREES,
  );
  const serializedPitch = pitch.toFixed(2);
  element.dataset.pitchDegrees = serializedPitch;
  element.style.setProperty("--aquarium-gallery-resident-pitch", `${serializedPitch}deg`);
}

function setElementMotion(element, direction, pitchDegrees) {
  setElementFacing(element, direction);
  setElementPitch(element, pitchDegrees);
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

function residentUsesLiveBoids(movementProfile, memberCount) {
  return movementProfile?.kind === "school"
    && LIVE_BOIDS_BEHAVIOR_KINDS.has(movementProfile?.behaviorKind)
    && memberCount > 1;
}

function residentUsesVelocityFacing(occupant, movementProfile) {
  return movementProfile?.kind !== "anchored"
    && occupant?.category !== "coral"
    && occupant?.category !== "invertebrate";
}

function residentMaxPitchDegrees(movementProfile) {
  const behaviorKind = movementProfile?.behaviorKind;
  const fallback = behaviorKind === "pelagic-apex-glide"
    || behaviorKind === "filter-feeder-glide"
    ? 9
    : movementProfile?.kind === "school"
      ? DEFAULT_FISH_MAX_PITCH_DEGREES
      : 16;
  return clamp(
    finiteNumber(
      movementProfile?.presentation?.maxPitchDegrees
        ?? movementProfile?.maxPitchDegrees,
      fallback,
    ),
    0,
    ABSOLUTE_FISH_MAX_PITCH_DEGREES,
  );
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

function residentMemberStyle(memberIndex, direction, movementProfile, boidAgent = null) {
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
  const rightFacingX = formation.x * spacingScale;
  const memberX = rightFacingX * direction;
  const style = {
    "--aquarium-gallery-member-x": `${memberX}%`,
    // Pairs keep this world-space offset when the group reverses. Mirroring it
    // with the sprite facing made the companion teleport through its partner.
    "--aquarium-gallery-member-world-x": `${memberX}%`,
    "--aquarium-gallery-member-return-x": `${-memberX}%`,
    "--aquarium-gallery-member-right-x": `${rightFacingX}%`,
    "--aquarium-gallery-member-left-x": `${-rightFacingX}%`,
    "--aquarium-gallery-member-y": `${formation.y * spacingScale}%`,
    "--aquarium-gallery-member-scale": formation.scale,
    "--aquarium-gallery-member-float-delay": `${-(memberIndex * 0.53)}s`,
    "--aquarium-gallery-school-cohesion": cohesion,
    "--aquarium-gallery-school-spacing": `${spacingPercent}%`,
  };
  if (!boidAgent) return style;
  return {
    ...style,
    "--aquarium-gallery-boid-x": `${finiteNumber(boidAgent.x, 50).toFixed(3)}%`,
    "--aquarium-gallery-boid-y": `${finiteNumber(boidAgent.y, 50).toFixed(3)}%`,
    "--aquarium-gallery-resident-direction": facingDirection(boidAgent.direction),
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

function residentInitialDirection(movementProfile, fallbackDirection) {
  if (!ROUTE_BEHAVIOR_KINDS.has(movementProfile?.behaviorKind)) {
    return facingDirection(fallbackDirection);
  }
  const points = movementProfile?.habitat?.contourPath?.points;
  if (!Array.isArray(points)) return 1;
  for (let index = 1; index < points.length; index += 1) {
    const deltaX = finiteNumber(points[index]?.xPercent, 0)
      - finiteNumber(points[index - 1]?.xPercent, 0);
    if (Math.abs(deltaX) > 0.001) return deltaX > 0 ? 1 : -1;
  }
  return facingDirection(fallbackDirection);
}

function residentBoidsOptions(tankId, occupant, index, movementProfile, memberCount) {
  return {
    seed: `${tankId}:${occupant?.speciesId ?? occupant?.id ?? index}`,
    memberCount,
    movementProfile,
    bounds: AQUARIUM_BOIDS_BOUNDS,
  };
}

function residentTrackKey(tankId, occupant, index) {
  return `${tankId}:${occupant?.speciesId ?? occupant?.id ?? index}`;
}

function residentHabitatFeatureId(movementProfile) {
  const habitat = movementProfile?.habitat ?? {};
  return habitat.contourPath?.id
    ?? habitat.station?.id
    ?? habitat.openWaterLane?.id
    ?? habitat.coverPoints?.[0]?.id;
}

function residentStyle(occupant, index, atlasPath, movementProfile, initialDirection) {
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
  const direction = facingDirection(
    initialDirection,
    finiteNumber(animation.direction, index % 2 === 0 ? 1 : -1),
  );
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

function AquariumGalleryResident({
  atlasPath,
  boidsOptions,
  direction,
  index,
  liveBoids,
  maxPitchDegrees,
  memberCount,
  movementProfile,
  occupant,
  residentBoidsRef,
  residentTrackConfigsRef,
  residentTracksRef,
  simulationKey,
  trackKey,
  velocityFacing,
}) {
  const [initialBoids] = useState(() => (
    liveBoids ? createAquariumBoids(boidsOptions) : null
  ));
  const initialFacing = initialBoids?.agents[0]?.direction ?? direction;
  const registerTrack = useCallback((element) => {
    if (!element) {
      residentTracksRef.current.delete(trackKey);
      residentTrackConfigsRef.current.delete(trackKey);
      residentBoidsRef.current.delete(trackKey);
      return;
    }
    const currentSimulation = residentBoidsRef.current.get(trackKey);
    if (
      !liveBoids
      || (currentSimulation && currentSimulation.simulationKey !== simulationKey)
    ) {
      residentBoidsRef.current.delete(trackKey);
    }
    residentTracksRef.current.set(trackKey, element);
    residentTrackConfigsRef.current.set(trackKey, {
      initialBoids,
      liveBoids,
      maxPitchDegrees,
      simulationKey,
      velocityFacing,
    });
  }, [
    initialBoids,
    liveBoids,
    maxPitchDegrees,
    residentBoidsRef,
    residentTrackConfigsRef,
    residentTracksRef,
    simulationKey,
    trackKey,
    velocityFacing,
  ]);

  return (
    <span
      ref={registerTrack}
      className={[
        styles.aquariumGalleryResidentTrack,
        residentCategoryClass(occupant.category),
        residentMovementClass(movementProfile.kind),
        residentBehaviorClass(movementProfile.behaviorKind),
        liveBoids ? styles.aquariumGalleryLiveSchool : "",
        velocityFacing ? styles.aquariumGalleryVelocityFacing : "",
      ].filter(Boolean).join(" ")}
      style={residentStyle(occupant, index, atlasPath, movementProfile, direction)}
      data-aquarium-species={occupant.speciesId ?? occupant.id}
      data-category={occupant.category}
      data-movement-profile={movementProfile.kind}
      data-aquarium-behavior={movementProfile.behaviorKind}
      data-habitat-feature={residentHabitatFeatureId(movementProfile)}
      data-social-formation={movementProfile.social?.formation}
      data-live-boids={liveBoids ? "true" : undefined}
      data-boids-phase={initialBoids?.phase}
      data-facing={facingLabel(initialFacing)}
      data-max-pitch-degrees={maxPitchDegrees}
      data-pitch-degrees="0.00"
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
          style={residentMemberStyle(
            memberIndex,
            direction,
            movementProfile,
            initialBoids?.agents[memberIndex],
          )}
          data-school-member={memberCount > 1 ? memberIndex + 1 : undefined}
          data-boid-member={liveBoids ? memberIndex + 1 : undefined}
          data-boid-depth={initialBoids?.agents[memberIndex]?.depth.toFixed(3)}
          data-facing={facingLabel(
            initialBoids?.agents[memberIndex]?.direction ?? direction,
          )}
          data-pitch-degrees="0.00"
        />
      ))}
    </span>
  );
}

export default function AdventureAquariumGallery({
  scene,
  aquariumModel,
  reducedMotion = false,
}) {
  const gallery = scene?.aquariumGallery;
  const hasGallery = Boolean(gallery);
  const galleryEcosystemId = gallery?.ecosystemId;
  const galleryName = gallery?.name;
  const galleryTankSlots = gallery?.tankSlots;
  const sceneWidth = scene?.width;
  const sceneHeight = scene?.height;
  const galleryRenderModel = useMemo(() => {
    const tanks = Array.isArray(aquariumModel?.tanks) ? aquariumModel.tanks : [];
    const tankById = new Map(tanks.map((tank) => [tank.id, tank]));
    const tankSlots = (Array.isArray(galleryTankSlots) ? galleryTankSlots : [])
      .map((slot) => ({
        slot,
        tank: tankById.get(slot?.tankId),
        style: tankSlotStyle(slot?.bounds, { width: sceneWidth, height: sceneHeight }),
      }))
      .filter(({ tank, style }) => tank && style);
    const residentConfigs = new Map();

    tankSlots.forEach(({ tank }) => {
      const occupants = Array.isArray(tank.occupants) ? tank.occupants.filter(Boolean) : [];
      occupants.forEach((occupant, index) => {
        const movementProfile = residentMovementProfile(occupant);
        const authoredDirection = finiteNumber(
          occupant?.animation?.direction,
          index % 2 === 0 ? 1 : -1,
        ) < 0 ? -1 : 1;
        const direction = residentInitialDirection(movementProfile, authoredDirection);
        const memberCount = residentMemberCount(movementProfile);
        const liveBoids = residentUsesLiveBoids(movementProfile, memberCount);
        const maxPitchDegrees = residentMaxPitchDegrees(movementProfile);
        const velocityFacing = residentUsesVelocityFacing(occupant, movementProfile);
        const trackKey = residentTrackKey(tank.id, occupant, index);
        const boidsOptions = residentBoidsOptions(
          tank.id,
          occupant,
          index,
          movementProfile,
          memberCount,
        );
        const simulationKey = createAquariumBoidsSimulationKey({
          trackIdentity: trackKey,
          ...boidsOptions,
        });
        residentConfigs.set(trackKey, {
          boidsOptions,
          direction,
          liveBoids,
          maxPitchDegrees,
          memberCount,
          movementProfile,
          simulationKey,
          velocityFacing,
        });
      });
    });

    return {
      ecosystemName: tankSlots[0]?.tank?.ecosystemName
        ?? galleryName
        ?? galleryEcosystemId
        ?? "Aquarium",
      residentConfigs,
      tankSlots,
    };
  }, [
    aquariumModel,
    galleryEcosystemId,
    galleryName,
    galleryTankSlots,
    sceneHeight,
    sceneWidth,
  ]);
  const residentTracksRef = useRef(new Map());
  const residentTrackConfigsRef = useRef(new Map());
  const residentBoidsRef = useRef(new Map());

  useEffect(() => {
    if (!hasGallery) {
      residentBoidsRef.current.clear();
      return undefined;
    }
    if (reducedMotion) {
      residentTracksRef.current.forEach((track) => {
        setElementPitch(track, 0);
        track.querySelectorAll("[data-school-member]").forEach((body) => {
          setElementPitch(body, 0);
        });
      });
      residentBoidsRef.current.clear();
      return undefined;
    }

    let animationFrame = 0;
    let previousTimestamp;
    let accumulatorSeconds = 0;
    const previousTrackPositions = new Map();
    const previousDirections = new Map();
    const previousPitches = new Map();
    const resetFrameClock = () => {
      previousTimestamp = undefined;
      accumulatorSeconds = 0;
      previousTrackPositions.clear();
    };

    const animateResidents = (timestamp) => {
      animationFrame = window.requestAnimationFrame(animateResidents);
      if (document.visibilityState !== "visible") {
        resetFrameClock();
        return;
      }

      const elapsedSeconds = previousTimestamp == null
        ? 0
        : clamp((timestamp - previousTimestamp) / 1000, 0, 0.1);
      previousTimestamp = timestamp;
      accumulatorSeconds += elapsedSeconds;
      const stepCount = Math.min(
        MAX_BOIDS_STEPS_PER_FRAME,
        Math.floor(accumulatorSeconds / AQUARIUM_BOIDS_FIXED_STEP_SECONDS),
      );
      if (stepCount > 0) {
        accumulatorSeconds -= stepCount * AQUARIUM_BOIDS_FIXED_STEP_SECONDS;
      }

      const activeTrackKeys = new Set();
      const stageRects = new Map();
      const boidsUpdates = [];
      const motionUpdates = [];
      for (const [trackKey, config] of residentTrackConfigsRef.current) {
        const track = residentTracksRef.current.get(trackKey);
        if (!track?.isConnected) continue;
        activeTrackKeys.add(trackKey);

        if (config.liveBoids) {
          let simulation = residentBoidsRef.current.get(trackKey);
          if (
            !simulation
            || simulation.simulationKey !== config.simulationKey
            || !simulation.previousState
          ) {
            simulation = {
              simulationKey: config.simulationKey,
              previousState: config.initialBoids,
              state: stepAquariumBoids(config.initialBoids),
            };
          }
          if (stepCount > 0) {
            for (let step = 0; step < stepCount; step += 1) {
              simulation.previousState = simulation.state;
              simulation.state = stepAquariumBoids(simulation.state);
            }
          }
          const stage = track.parentElement;
          let stageRect = stage ? stageRects.get(stage) : null;
          if (stage && !stageRect) {
            stageRect = stage.getBoundingClientRect();
            stageRects.set(stage, stageRect);
          }
          boidsUpdates.push({
            interpolationAlpha: clamp(
              accumulatorSeconds / AQUARIUM_BOIDS_FIXED_STEP_SECONDS,
              0,
              1,
            ),
            maxPitchDegrees: config.maxPitchDegrees,
            previousState: simulation.previousState,
            stageHeight: stageRect?.height ?? 100,
            stageWidth: stageRect?.width ?? 100,
            track,
            trackKey,
            state: simulation.state,
          });
          residentBoidsRef.current.set(trackKey, simulation);
          continue;
        }

        residentBoidsRef.current.delete(trackKey);
        if (!config.velocityFacing || elapsedSeconds <= 0) continue;
        const stage = track.parentElement;
        if (!stage) continue;
        let stageRect = stageRects.get(stage);
        if (!stageRect) {
          stageRect = stage.getBoundingClientRect();
          stageRects.set(stage, stageRect);
        }
        const trackRect = track.getBoundingClientRect();
        const relativeX = trackRect.left - stageRect.left;
        const relativeY = trackRect.top - stageRect.top;
        const previousPosition = previousTrackPositions.get(trackKey);
        previousTrackPositions.set(trackKey, { x: relativeX, y: relativeY });
        if (!previousPosition || stageRect.width <= 0 || stageRect.height <= 0) continue;
        const deltaX = relativeX - previousPosition.x;
        const deltaY = relativeY - previousPosition.y;
        if (
          Math.abs(deltaX) >= stageRect.width * FACING_WRAP_STAGE_FRACTION
          || Math.abs(deltaY) >= stageRect.height * FACING_WRAP_STAGE_FRACTION
        ) continue;
        const velocityX = deltaX / elapsedSeconds;
        const velocityY = deltaY / elapsedSeconds;
        let direction = previousDirections.get(trackKey)
          ?? (track.dataset.facing === "left" ? -1 : 1);
        if (Math.abs(velocityX) > FACING_DEAD_ZONE_PIXELS_PER_SECOND) {
          direction = velocityX > 0 ? 1 : -1;
          previousDirections.set(trackKey, direction);
        }
        const targetPitch = Math.hypot(velocityX, velocityY)
          <= TRACK_PITCH_DEAD_ZONE_PIXELS_PER_SECOND
          ? 0
          : aquariumFishPitchDegrees(
            velocityX,
            velocityY,
            direction,
            config.maxPitchDegrees,
          );
        const pitch = smoothPitchDegrees(
          previousPitches.get(trackKey),
          targetPitch,
          elapsedSeconds,
        );
        previousPitches.set(trackKey, pitch);
        motionUpdates.push({ direction, pitch, track });
      }

      // Apply writes after every stage-relative layout read so camera panning
      // cannot contaminate facing and the loop does not thrash layout.
      boidsUpdates.forEach(({
        interpolationAlpha,
        maxPitchDegrees,
        previousState,
        stageHeight,
        stageWidth,
        track,
        trackKey,
        state,
      }) => {
        const bodies = track.querySelectorAll("[data-boid-member]");
        state.agents.forEach((agent, memberIndex) => {
          const body = bodies[memberIndex];
          if (!body) return;
          const previousAgent = previousState.agents[memberIndex] ?? agent;
          const renderX = previousAgent.x
            + ((agent.x - previousAgent.x) * interpolationAlpha);
          const renderY = previousAgent.y
            + ((agent.y - previousAgent.y) * interpolationAlpha);
          const renderVelocityX = previousAgent.vx
            + ((agent.vx - previousAgent.vx) * interpolationAlpha);
          const renderVelocityY = previousAgent.vy
            + ((agent.vy - previousAgent.vy) * interpolationAlpha);
          const renderDirection = Math.abs(renderVelocityX) > BOID_PITCH_DEAD_ZONE
            ? (renderVelocityX > 0 ? 1 : -1)
            : previousAgent.direction
              ?? (body.dataset.facing === "left" ? -1 : 1);
          body.style.setProperty("--aquarium-gallery-boid-x", `${renderX.toFixed(3)}%`);
          body.style.setProperty("--aquarium-gallery-boid-y", `${renderY.toFixed(3)}%`);
          body.dataset.boidDepth = agent.depth.toFixed(3);
          const pitchKey = `${trackKey}:${agent.id ?? memberIndex}`;
          const pixelVelocityX = renderVelocityX * (stageWidth / 100);
          const pixelVelocityY = renderVelocityY * (stageHeight / 100);
          const targetPitch = Math.hypot(pixelVelocityX, pixelVelocityY)
            <= BOID_PITCH_DEAD_ZONE
            ? 0
            : aquariumFishPitchDegrees(
              pixelVelocityX,
              pixelVelocityY,
              renderDirection,
              maxPitchDegrees,
            );
          const pitch = smoothPitchDegrees(
            previousPitches.get(pitchKey),
            targetPitch,
            elapsedSeconds,
          );
          previousPitches.set(pitchKey, pitch);
          setElementMotion(body, renderDirection, pitch);
        });
        track.dataset.boidsPhase = state.phase;
        setElementFacing(track, state.agents[0]?.direction ?? 1);
      });
      motionUpdates.forEach(({ track, direction, pitch }) => {
        setElementMotion(track, direction, pitch);
      });
      for (const trackKey of residentBoidsRef.current.keys()) {
        if (!activeTrackKeys.has(trackKey)) residentBoidsRef.current.delete(trackKey);
      }
    };

    document.addEventListener("visibilitychange", resetFrameClock);
    animationFrame = window.requestAnimationFrame(animateResidents);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", resetFrameClock);
      previousTrackPositions.clear();
    };
  }, [galleryEcosystemId, hasGallery, reducedMotion]);

  if (!gallery) return null;

  const { ecosystemName, residentConfigs, tankSlots } = galleryRenderModel;

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
                const trackKey = residentTrackKey(tank.id, occupant, index);
                const residentConfig = residentConfigs.get(trackKey);
                if (!residentConfig) return null;
                const {
                  boidsOptions,
                  direction,
                  liveBoids,
                  maxPitchDegrees,
                  memberCount,
                  movementProfile,
                  simulationKey,
                  velocityFacing,
                } = residentConfig;
                return (
                  <AquariumGalleryResident
                    key={simulationKey}
                    atlasPath={aquariumModel?.atlasPath}
                    boidsOptions={boidsOptions}
                    direction={direction}
                    index={index}
                    liveBoids={liveBoids}
                    maxPitchDegrees={maxPitchDegrees}
                    memberCount={memberCount}
                    movementProfile={movementProfile}
                    occupant={occupant}
                    residentBoidsRef={residentBoidsRef}
                    residentTrackConfigsRef={residentTrackConfigsRef}
                    residentTracksRef={residentTracksRef}
                    simulationKey={simulationKey}
                    trackKey={trackKey}
                    velocityFacing={velocityFacing}
                  />
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
