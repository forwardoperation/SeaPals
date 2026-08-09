import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./AdventureHandNetModal.jsx", import.meta.url), "utf8");
const gallery = readFileSync(new URL("./AdventureAquariumGallery.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
const residents = readFileSync(new URL("./adventureElversonResidents.mjs", import.meta.url), "utf8");
const exhibits = readFileSync(new URL("./adventureAquariumExhibits.mjs", import.meta.url), "utf8");

test("Elverson shore input, Wyeth's lesson, catch saving, and Easterling delivery use the hand-net flow", () => {
  assert.match(game, /getElversonHandNetInteraction\(sceneId, position, facing\)/);
  assert.match(game, /beginElversonHandNetTutorial\(current\)/);
  assert.match(game, /recordElversonHandNetTutorialCatch\(current, creatureId\)/);
  assert.match(game, /recordElversonHandNetCatch\(current, creatureId\)/);
  assert.match(game, /deliverElversonHandNetCatches\(current\)/);
  assert.match(game, /<AdventureHandNetModal[\s\S]*?onCatch=\{saveFishingCatch\}/);
  assert.match(residents, /good old-fashioned hand net/);
  assert.match(residents, /small reef fish under twelve inches long/);
  assert.doesNotMatch(modal, /fishing rod|cast a line|set the hook|reel/i);
});

test("the modal is a top-down shallow-water stealth-and-scoop game", () => {
  assert.match(modal, /createHandNetState/);
  assert.match(modal, /tickHandNetState/);
  assert.match(modal, /HAND_NET_ACTIONS\.MOVE/);
  assert.match(modal, /HAND_NET_ACTIONS\.SCOOP/);
  assert.match(modal, /handNetShallows/);
  assert.match(modal, /creature\.status === "fleeing"/);
  assert.match(modal, /creature\.alert > 0\.35/);
  assert.match(modal, /<span aria-hidden="true">A<\/span> Catch/);
  assert.match(modal, /Move slowly through the shallows/);
  assert.match(modal, /ELVERSON_HAND_NET_TIDEPOOL_PATH/);
  assert.match(modal, /ELVERSON_HAND_NET_PLAYER_ATLAS_PATH/);
  assert.match(modal, /player-hand-net-isometric-v2\.png/);
  assert.match(modal, /state\.presentation\.scoopFrameIndex/);
  assert.match(modal, /state\.presentation\.walkFrameIndex/);
  assert.doesNotMatch(modal, /state\.simulationTimeMs\s*\/\s*115/);
  assert.match(modal, /data-hand-net-scoop-frame=\{playerSpriteFrame\}/);
  assert.doesNotMatch(modal, /styles\.handNetHandle/);
  assert.doesNotMatch(modal, /styles\.handNetScoop\b/);
  assert.doesNotMatch(modal, /handNetObjective/);
  assert.doesNotMatch(modal, /handNetToolHud/);
  assert.doesNotMatch(modal, /handNetCatchTray/);
  assert.doesNotMatch(modal, /handNetGuidanceButton/);
  assert.doesNotMatch(modal, /handNetCollectionSummary/);
  assert.match(modal, /--hand-net-player-x/);
  assert.match(modal, /--hand-net-player-y/);
  assert.match(modal, /--hand-net-player-velocity-x/);
  assert.match(modal, /--hand-net-player-velocity-y/);
  assert.match(modal, /--hand-net-player-speed-ratio/);
  assert.match(modal, /handNetCaustics/);
  assert.match(modal, /handNetCausticWake/);
  assert.match(modal, /data-hand-net-effect="surface-caustics" aria-hidden="true"/);
  assert.match(modal, /data-hand-net-effect="surface-veil" aria-hidden="true"/);
  assert.match(modal, /data-hand-net-effect="wading-wake" aria-hidden="true"/);
  assert.match(modal, /state\.presentation\.netImpact/);
  assert.match(modal, /key=\{`\$\{seedRef\.current\}-\$\{netSplash\.sequence\}`\}/);
  assert.match(modal, /handNetNetSplashActive/);
  assert.match(modal, /data-hand-net-effect="net-splash"/);
  assert.match(modal, /styles\.handNetPlayerCelebrating/);
  assert.match(modal, /const playerSpriteFrame = celebrating[\s\S]*?\? 6/);
  assert.match(modal, /styles\.handNetCatchReveal/);
  assert.match(modal, /catchResult\.firstDiscovery/);
  assert.match(modal, /aria-expanded=\{catchDetailsOpen\}/);
  assert.match(modal, /import\("@\/data\/encyclopedia"\)/);
  assert.match(modal, /encyclopediaSlugByCardId\[caughtCardId\]/);
  assert.match(modal, /href=\{`\/encyclopedia\/\$\{encyclopediaSlug\}`\}/);
  assert.match(modal, /styles\.handNetDockExit/);
  assert.match(modal, /state\.phase !== HAND_NET_PHASES\.CAUGHT/);
  assert.match(game, /preloadAdventureAsset\(ELVERSON_HAND_NET_TIDEPOOL_PATH\)/);
  assert.match(styles, /\.handNetShallows[\s\S]*?aspect-ratio:\s*3 \/ 2/);
  assert.match(styles, /var\(--hand-net-tidepool-image\)/);
  assert.match(styles, /\.handNetCreature[\s\S]*?background-size:\s*500% 200%/);
  assert.match(styles, /@keyframes handNetWaveDrift/);
  assert.match(styles, /@keyframes handNetScoop/);
  assert.match(styles, /\.handNetCaustics[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.handNetSurfaceVeil[\s\S]*?z-index:\s*8/);
  assert.match(styles, /\.handNetSurfaceVeil[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.handNetPlayer[\s\S]*?background-size:\s*700% 400%/);
  assert.match(styles, /\.handNetControlDock[\s\S]*?justify-content:\s*space-between/);
  assert.match(styles, /\.handNetCausticWake[\s\S]*?var\(--hand-net-player-motion-angle\)/);
  assert.match(styles, /\.handNetNetSplash[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /@keyframes handNetCausticsDrift/);
  assert.match(styles, /@keyframes handNetSplashFlash/);
  assert.match(styles, /@keyframes handNetVictoryPose/);
  assert.match(styles, /@keyframes handNetCatchBannerEnter/);
  assert.match(styles, /@keyframes handNetCatchCreatureEnter/);
  assert.match(styles, /\.handNetControlDock[\s\S]*?grid-template-columns/);
});

test("the required tutorial stays with the player until a catch is recorded", () => {
  assert.match(game, /fishingSession\.required[\s\S]*?Complete Wyeth's practice catch before leaving the lesson/);
  assert.match(modal, /if \(required && !catchResult\) return/);
  assert.match(modal, /!required && state\.phase !== HAND_NET_PHASES\.CAUGHT/);
  assert.match(modal, /tutorial \? "tutorial-complete" : "caught"/);
  assert.match(modal, /Retry catch/);
  assert.match(modal, /Try again/);
});

test("Wyeth visibly leads a locked-input predetermined walk to the sandy cove", () => {
  assert.match(game, /createGuidedWalkPlan\(\{[\s\S]*?path: ELVERSON_WYETH_HAND_NET_PATH\.leader/);
  assert.match(game, /followerPath: ELVERSON_WYETH_HAND_NET_PATH\.follower/);
  assert.match(game, /advanceGuidedWalkClock\(/);
  assert.match(game, /completionFallbackMs/);
  assert.doesNotMatch(game, /startedAt: performance\.now\(\)/);
  assert.match(game, /sampleGuidedWalk\(/);
  assert.match(game, /FISHERMAN_WYETH_INTERACTION_ID/);
  assert.match(game, /position: \{ \.\.\.sample\.leader\.position \}/);
  assert.match(game, /position: \{ \.\.\.sample\.follower\.position \}/);
  assert.match(game, /\|\| Boolean\(guidedWalk\)[\s\S]*?starterSelectionOpen/);
  assert.match(game, /setFishingSession\(\{ \.\.\.ELVERSON_FISHING_TUTORIAL_SESSION \}\)/);
});

test("keyboard, touch, focus, live status, and reduced-motion affordances are explicit", () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /role="application"/);
  assert.match(modal, /aria-keyshortcuts="Enter Space"/);
  assert.match(modal, /window\.addEventListener\("keyup", releaseMovementKey\)/);
  assert.match(modal, /setPointerCapture/);
  assert.match(modal, /onPointerDown=\{\(event\) =>/);
  assert.match(modal, /onClick=\{handleWaterScoop\}/);
  assert.match(modal, /target\.closest\("button, a, input, select, textarea, \[data-hand-net-ui\]"\)/);
  assert.match(modal, /tabIndex=\{0\}/);
  assert.match(modal, /styles\.controlDock/);
  assert.match(modal, /styles\.dpad/);
  assert.match(modal, /styles\.actionButton/);
  assert.match(modal, /modalStack\.at\(-1\) !== dialog/);
  assert.match(modal, /previousFocusRef\.current\?\.focus/);
  assert.match(modal, /role="status" aria-live="polite"/);
  assert.doesNotMatch(modal, /Gentle guidance|assistedMode/);
  assert.match(styles, /\.reducedMotionMode \.handNetWave,[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.handNetCreature/);
  assert.match(styles, /\.reducedMotionMode \.handNetCaustics[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /\.reducedMotionMode \.handNetSurfaceVeil[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.handNetNetSplash::before/);
  assert.match(styles, /\.reducedMotionMode \.handNetPlayerCelebrating,[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.handNetCard/);
});

test("delivered creatures populate six scenic tanks directly inside the scrolling Aquarium galleries", () => {
  assert.match(game, /getElversonAquariumExhibitModel\(gameSave\)/);
  assert.match(game, /import AdventureAquariumGallery from "\.\/AdventureAquariumGallery"/);
  assert.match(
    game,
    /styles\.mapWorld[\s\S]*?<AdventureAquariumGallery[\s\S]*?scene=\{scene\}[\s\S]*?aquariumModel=\{aquariumExhibitModel\}[\s\S]*?reducedMotion=\{effectiveReducedMotion\}/,
  );
  assert.match(game, /getAdventureCameraLayout\(\{[\s\S]*?\}, scene\.camera \?\? \{\}\)/);
  assert.match(
    game,
    /const idleFacing = scene\.movement\?\.idleFacing;[\s\S]*?world: \{ \.\.\.current\.world, facing: idleFacing \}/,
  );
  assert.match(
    game,
    /isAdventureMovementDirectionAllowed\(direction, currentScene\?\.movement\?\.axis\)/,
  );
  assert.match(game, /aquariumGalleryMode \? "Aquarium promenade movement controls"/);
  assert.match(game, /!aquariumGalleryMode \? <DirectionButton direction="up"/);
  assert.doesNotMatch(game, /AdventureAquariumSpectator|activeAquariumTank|interaction\.type === "aquarium-view"/);
  assert.match(exhibits, /AQUARIUM_ECOSYSTEM_IDS = Object\.freeze\(\["reef", "oceanic", "deep"\]\)/);
  assert.match(exhibits, /AQUARIUM_TANK_KINDS = Object\.freeze\(\["community", "apex"\]\)/);
  assert.match(exhibits, /save\.inventory\.storyItems/);
  assert.doesNotMatch(exhibits, /inventory\.cards/);

  assert.match(gallery, /const gallery = scene\?\.aquariumGallery/);
  assert.match(gallery, /if \(!gallery\) return null/);
  assert.match(gallery, /const galleryTankSlots = gallery\?\.tankSlots/);
  assert.match(gallery, /aquariumModel\?\.tanks/);
  assert.match(
    gallery,
    /tankSlotStyle\(slot\?\.bounds, \{ width: sceneWidth, height: sceneHeight \}\)/,
  );
  assert.match(gallery, /backgroundImage: cssUrl\(tank\.backgroundPath\)/);
  assert.match(gallery, /Array\.isArray\(tank\.occupants\)/);
  assert.match(gallery, /sprite\.path \?\? atlasPath/);
  assert.match(gallery, /sprite\.columns/);
  assert.match(gallery, /sprite\.rows/);
  assert.match(gallery, /--aquarium-gallery-resident-brightness/);
  assert.match(gallery, /--aquarium-gallery-resident-saturation/);
  assert.match(gallery, /visual\.biologicalScale/);
  assert.match(gallery, /visual\.depthScale/);
  assert.match(gallery, /legacyCombinedScale/);
  assert.match(gallery, /--aquarium-gallery-resident-biological-scale/);
  assert.match(gallery, /--aquarium-gallery-resident-depth-scale/);
  assert.match(gallery, /occupant\?\.movementProfile \?\? occupant\?\.movement/);
  assert.match(gallery, /data-movement-profile=\{movementProfile\.kind\}/);
  assert.match(gallery, /data-aquarium-behavior=\{movementProfile\.behaviorKind\}/);
  assert.match(gallery, /data-habitat-feature=\{residentHabitatFeatureId\(movementProfile\)\}/);
  assert.match(gallery, /data-social-formation=\{movementProfile\.social\?\.formation\}/);
  assert.match(gallery, /movementProfile\?\.social\?\.visualCount/);
  assert.match(gallery, /movementProfile\.groupSize/);
  assert.match(gallery, /movementProfile\?\.social\?\.cohesion/);
  assert.match(gallery, /movementProfile\?\.social\?\.spacingPercent/);
  assert.match(gallery, /movementProfile\?\.habitat\?\.contourPath\?\.points/);
  assert.match(gallery, /habitat\.station/);
  assert.match(gallery, /habitat\.openWaterLane/);
  assert.match(gallery, /habitat\.coverPoints/);
  assert.match(gallery, /midpointSeconds\(timing\.pauseSeconds/);
  assert.match(gallery, /midpointSeconds\(timing\.refugeCadenceSeconds/);
  assert.match(gallery, /midpointSeconds\(timing\.burstSeconds/);
  assert.match(gallery, /Array\.from\(\{ length: memberCount \}/);
  assert.match(gallery, /data-school-member=\{memberCount > 1/);
  assert.match(gallery, /AQUARIUM_BOIDS_FIXED_STEP_SECONDS/);
  assert.match(gallery, /aquariumFishPitchDegrees/);
  assert.match(gallery, /createAquariumBoids/);
  assert.match(gallery, /createAquariumBoidsSimulationKey/);
  assert.match(gallery, /trackIdentity: trackKey/);
  assert.match(gallery, /stepAquariumBoids/);
  assert.match(gallery, /const galleryRenderModel = useMemo\(/);
  assert.doesNotMatch(gallery, /initialBoidsConfigsRef/);
  assert.match(
    gallery,
    /const \[initialBoids\] = useState\(\(\) => \([\s\S]*?liveBoids \? createAquariumBoids\(boidsOptions\) : null/,
  );
  assert.match(gallery, /<AquariumGalleryResident[\s\S]*?key=\{simulationKey\}/);
  assert.equal(
    gallery.match(/createAquariumBoids\(boidsOptions\)/g)?.length,
    1,
    "seeded boids should initialize only in the signature-keyed resident lifecycle",
  );
  assert.match(
    gallery,
    /const registerTrack = useCallback[\s\S]*?!element[\s\S]*?residentTracksRef\.current\.delete\(trackKey\)[\s\S]*?residentTrackConfigsRef\.current\.delete\(trackKey\)[\s\S]*?residentBoidsRef\.current\.delete\(trackKey\)/,
  );
  assert.match(gallery, /residentBoidsRef\.current\.delete\(trackKey\)/);
  assert.match(gallery, /residentUsesLiveBoids\(movementProfile, memberCount\)/);
  assert.match(gallery, /data-live-boids=\{liveBoids \? "true" : undefined\}/);
  assert.match(gallery, /data-boids-phase=\{initialBoids\?\.phase\}/);
  assert.match(gallery, /data-boid-member=\{liveBoids \? memberIndex \+ 1 : undefined\}/);
  assert.match(gallery, /data-facing=\{facingLabel\(initialFacing\)\}/);
  assert.match(gallery, /document\.visibilityState !== "visible"/);
  assert.match(gallery, /Math\.floor\(accumulatorSeconds \/ AQUARIUM_BOIDS_FIXED_STEP_SECONDS\)/);
  assert.match(gallery, /trackRect\.left - stageRect\.left/);
  assert.match(gallery, /trackRect\.top - stageRect\.top/);
  assert.match(gallery, /FACING_WRAP_STAGE_FRACTION/);
  assert.match(gallery, /setElementMotion\(body, renderDirection, pitch\)/);
  assert.match(gallery, /setElementMotion\(track, direction, pitch\)/);
  assert.match(gallery, /Math\.exp\(-PITCH_SMOOTHING_RATE_PER_SECOND \* elapsed\)/);
  assert.match(gallery, /data-max-pitch-degrees=\{maxPitchDegrees\}/);
  assert.match(gallery, /data-pitch-degrees="0\.00"/);
  assert.match(gallery, /previousState: config\.initialBoids/);
  assert.match(gallery, /state: stepAquariumBoids\(config\.initialBoids\)/);
  assert.match(
    gallery,
    /interpolationAlpha: clamp\([\s\S]*?accumulatorSeconds \/ AQUARIUM_BOIDS_FIXED_STEP_SECONDS/,
  );
  assert.match(gallery, /previousAgent\.x[\s\S]*?agent\.x - previousAgent\.x[\s\S]*?interpolationAlpha/);
  assert.match(gallery, /previousAgent\.y[\s\S]*?agent\.y - previousAgent\.y[\s\S]*?interpolationAlpha/);
  assert.doesNotMatch(gallery, /agent\.x \+ \(agent\.vx \* renderLeadSeconds\)/);
  assert.match(gallery, /renderVelocityX \* \(stageWidth \/ 100\)/);
  assert.match(gallery, /renderVelocityY \* \(stageHeight \/ 100\)/);
  assert.match(gallery, /maxPitchDegrees: config\.maxPitchDegrees/);
  assert.match(
    gallery,
    /aquariumFishPitchDegrees\([\s\S]*?pixelVelocityX,[\s\S]*?pixelVelocityY,[\s\S]*?renderDirection,[\s\S]*?maxPitchDegrees/,
  );
  assert.doesNotMatch(gallery, /track\.dataset\.maxPitchDegrees/);
  assert.match(
    gallery,
    /renderDirection = Math\.abs\(renderVelocityX\)[\s\S]*?: previousAgent\.direction[\s\S]*?body\.dataset\.facing/,
  );
  assert.doesNotMatch(
    gallery,
    /renderDirection = Math\.abs\(renderVelocityX\)[\s\S]*?: agent\.direction;/,
  );
  assert.match(gallery, /window\.requestAnimationFrame\(animateResidents\)/);
  assert.match(gallery, /window\.cancelAnimationFrame\(animationFrame\)/);
  assert.doesNotMatch(gallery, /Math\.random/);
  const memberCountSource = gallery.slice(
    gallery.indexOf("function residentMemberCount"),
    gallery.indexOf("function residentMemberStyle"),
  );
  assert.doesNotMatch(memberCountSource, /occupant|quantity/);
  assert.match(gallery, /styles\.aquariumGalleryResidentBenthic/);
  assert.match(gallery, /aria-hidden="true"/);
  assert.match(gallery, /className=\{styles\.srOnly\}/);
  assert.match(gallery, /tankCountSummary\(tank\)/);
  assert.doesNotMatch(
    gallery,
    /aquariumGalleryTankPlaque|aquariumGalleryEmptyPlaque|tank\.subtitle|tank\.emptyMessage/,
  );
  assert.doesNotMatch(
    gallery,
    /role="dialog"|aria-modal|onClick|handleEscape|focus\(|caustic|lightShaft|particle|aquariumSpectator/i,
  );

  assert.match(styles, /\.aquariumGalleryScenery/);
  assert.match(styles, /\.aquariumGalleryTankWindow/);
  assert.match(styles, /@keyframes aquariumGalleryResidentSwim/);
  assert.match(styles, /@keyframes aquariumGalleryResidentShelterRoute/);
  assert.match(styles, /@keyframes aquariumGalleryResidentContourRoute/);
  assert.match(styles, /@keyframes aquariumGalleryResidentCoverBall/);
  assert.match(styles, /@keyframes aquariumGalleryResidentCleaningStation/);
  assert.match(styles, /@keyframes aquariumGalleryResidentCrypticGrazer/);
  assert.match(styles, /@keyframes aquariumGalleryResidentBottomScuttle/);
  assert.match(styles, /@keyframes aquariumGalleryResidentForagerRoute/);
  assert.match(styles, /@keyframes aquariumGalleryResidentCreviceRoute/);
  assert.match(styles, /@keyframes aquariumGalleryResidentTerritorialRoute/);
  assert.match(styles, /@keyframes aquariumGalleryResidentCoralHome/);
  assert.match(styles, /@keyframes aquariumGalleryResidentLocalizedCrawl/);
  assert.match(styles, /@keyframes aquariumGalleryResidentCoralTurn[\s\S]*?--aquarium-gallery-resident-reverse-direction/);
  assert.match(styles, /@keyframes aquariumGalleryResidentBenthicTurn[\s\S]*?--aquarium-gallery-resident-reverse-direction/);
  assert.match(styles, /\.aquariumGalleryMovementSchool[\s\S]*?animation-name:\s*aquariumGalleryResidentSwim/);
  assert.match(styles, /\.aquariumGalleryMovementCoralHome[\s\S]*?animation-name:\s*aquariumGalleryResidentCoralHome/);
  assert.match(styles, /\.aquariumGalleryMovementLocalizedBenthic[\s\S]*?animation-name:\s*aquariumGalleryResidentLocalizedCrawl/);
  assert.match(styles, /\.aquariumGalleryMovementAnchored[\s\S]*?animation:\s*none/);
  for (const behaviorKind of [
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
  ]) assert.match(gallery, new RegExp(`"${behaviorKind}"`));
  for (const movementClass of [
    "aquariumGalleryMovementCoralHome",
    "aquariumGalleryMovementLocalizedBenthic",
    "aquariumGalleryMovementAnchored",
  ]) {
    const rule = styles.match(new RegExp(`\\.${movementClass}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(rule, `${movementClass} should have an explicit motion rule`);
    assert.doesNotMatch(rule, /aquariumGalleryResidentSwim|resident-start-x|resident-end-x/);
  }
  assert.match(
    styles,
    /\.aquariumGalleryResidentBody[\s\S]*?background-size:[\s\S]*?var\(--aquarium-gallery-atlas-width[\s\S]*?var\(--aquarium-gallery-atlas-height/,
  );
  assert.match(
    styles,
    /\.aquariumGalleryResidentBody[\s\S]*?scale\(var\(--aquarium-gallery-resident-biological-scale[\s\S]*?scale\(var\(--aquarium-gallery-resident-depth-scale/,
  );
  assert.match(
    styles,
    /\.aquariumGalleryResidentBody[\s\S]*?transform:[\s\S]*?rotate\(var\(--aquarium-gallery-resident-pitch, 0deg\)\)[\s\S]*?scale\(var\(--aquarium-gallery-resident-biological-scale[\s\S]*?scale\(var\(--aquarium-gallery-resident-depth-scale[\s\S]*?scaleX\(var\(--aquarium-gallery-resident-direction/,
  );
  assert.match(styles, /\.aquariumGalleryResidentTrack[\s\S]*?width:\s*var\(--resident-size, 6%\)/);
  assert.match(styles, /--aquarium-gallery-member-x/);
  assert.match(gallery, /--aquarium-gallery-member-return-x/);
  assert.match(styles, /--aquarium-gallery-member-scale/);
  assert.match(styles, /\.aquariumGalleryLiveSchool\s*\{[\s\S]*?animation:\s*none !important/);
  assert.match(
    styles,
    /\.aquariumGalleryLiveSchool \.aquariumGalleryResidentBody[\s\S]*?--aquarium-gallery-boid-y[\s\S]*?--aquarium-gallery-boid-x[\s\S]*?--aquarium-gallery-resident-biological-scale[\s\S]*?--aquarium-gallery-resident-depth-scale[\s\S]*?--aquarium-gallery-resident-direction/,
  );
  assert.match(
    styles,
    /\.aquariumGalleryVelocityFacing:not\(\.aquariumGalleryLiveSchool\) \.aquariumGalleryResidentBody[\s\S]*?aquariumGalleryResidentFloat/,
  );
  assert.match(styles, /\.aquariumGalleryVelocityFacing\[data-facing="right"\][\s\S]*?--aquarium-gallery-member-right-x/);
  assert.match(styles, /\.aquariumGalleryVelocityFacing\[data-facing="left"\][\s\S]*?--aquarium-gallery-member-left-x/);
  assert.match(gallery, /--aquarium-gallery-member-world-x/);
  assert.match(
    styles,
    /\.aquariumGalleryVelocityFacing\[data-social-formation="pair"\]:not\(\.aquariumGalleryLiveSchool\)[\s\S]*?--aquarium-gallery-member-world-x/,
  );
  assert.match(styles, /\.aquariumGalleryLiveSchool\[data-boids-phase="hide"\][\s\S]*?opacity:\s*0\.42/);
  assert.match(
    styles,
    /\.aquariumGalleryBehaviorTerritorialPair\s*\{[\s\S]*?animation-name:\s*aquariumGalleryResidentTerritorialRoute;[\s\S]*?animation-timing-function:\s*linear/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentTerritorialRoute[\s\S]*?0%, 100%[\s\S]*?route-0-x[\s\S]*?16\.67%[\s\S]*?route-1-x[\s\S]*?33\.33%[\s\S]*?route-2-x[\s\S]*?50%[\s\S]*?route-3-x[\s\S]*?66\.67%[\s\S]*?route-4-x[\s\S]*?83\.33%[\s\S]*?route-5-x/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentRouteTurn[\s\S]*?left:\s*var\(--aquarium-gallery-member-x[\s\S]*?left:\s*var\(--aquarium-gallery-member-return-x/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentLateRouteTurn[\s\S]*?left:\s*var\(--aquarium-gallery-member-x[\s\S]*?left:\s*var\(--aquarium-gallery-member-return-x/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentCoralTurn[\s\S]*?left:\s*var\(--aquarium-gallery-member-x[\s\S]*?left:\s*var\(--aquarium-gallery-member-return-x/,
  );
  assert.match(styles, /--aquarium-gallery-route-0-x/);
  assert.match(styles, /--aquarium-gallery-route-5-x/);
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentContourRoute[\s\S]*?0%, 6%, 100%[\s\S]*?route-0-x[\s\S]*?15%, 88%[\s\S]*?route-1-x[\s\S]*?24%, 78%[\s\S]*?route-2-x[\s\S]*?34%, 68%[\s\S]*?route-3-x[\s\S]*?43%, 59%[\s\S]*?route-4-x[\s\S]*?49%, 53%[\s\S]*?route-5-x/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentShelterRoute[\s\S]*?resident-cover-opacity[\s\S]*?scale\(0\.72\)/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentCrypticGrazer[\s\S]*?resident-cover-opacity[\s\S]*?scale\(0\.76\)/,
  );
  assert.match(
    styles,
    /@keyframes aquariumGalleryResidentCreviceRoute[\s\S]*?resident-cover-opacity[\s\S]*?scale\(0\.72\)/,
  );
  assert.doesNotMatch(
    styles,
    /aquariumGalleryResident(?:Track|Predator|Benthic|Coral)?[^}]*width:\s*var\(--resident-size,\s*clamp\(/,
  );
  assert.match(styles, /\.aquariumGalleryReducedMotion[\s\S]*?\.aquariumGalleryResidentTrack[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /\.aquariumGalleryReducedMotion[\s\S]*?\.aquariumGalleryResidentBody[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /\.aquariumGalleryReducedMotion \.aquariumGalleryResidentBody[\s\S]*?--aquarium-gallery-resident-pitch:\s*0deg !important/);
  assert.match(styles, /\.aquariumGalleryReducedMotion \.aquariumGalleryLiveSchool[\s\S]*?inset:\s*0 !important/);
  assert.doesNotMatch(styles, /\.aquariumGalleryTankPlaque|\.aquariumGalleryEmptyPlaque/);
  assert.doesNotMatch(styles, /\.aquariumSpectator/);
  assert.doesNotMatch(game, /function AdventureAquariumExhibits/);
  assert.doesNotMatch(styles, /\.aquariumExhibitLayer/);
});

test("Aquarium deliveries still award matching cards without granting the campaign title early", () => {
  assert.match(game, /const matchingCardSummary = delivered\.awardedCards/);
  assert.match(game, /delivered\.awardedCardCount/);
  assert.match(game, /Your Sea Realm reward:/);
  assert.doesNotMatch(game, /titleAwardedNow/);
});
