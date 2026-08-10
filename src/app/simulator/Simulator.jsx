"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RulesChat from "@/components/rules/RulesChat";
import { cardsById } from "@/data/cards";
import { CardCategory, CardKind, CreatureZone, EffectType, canCardOccupySlot } from "@/data/cards/types";
import { conditionCards } from "@/data/cards/conditions";
import { getPlayableDeckById, prebuiltDecks } from "@/data/tournaments/prebuiltDecks";
import { DAMAGE_COUNTER_HP, addResourceWithinCap, applyDamage, calculateAttachedCardRpBonus, calculateAttachedCreatureDefenseBonus, calculateAttachedHostHealthBonus, calculateRpBankCap, calculateVictoryPoints, conditionPreventsCardPlay, createSeededRandom, determineVictoryResult, drawWithHandLimit, getDrawCountFromActions, getRequiredDrawShortfall, getResourceGainFromActions, halfCostRoundedUp, healMostDamagedCoral, isEcosystemConditionMet, moveFoundationDamageCounter, parseLegacyAttackText, parseLegacyUtilityText, preserveDamageOnUpgrade, reconcileContinuousHealth, redistributeOrphans, resolveBlueCrabRecycle, resolveConditionalDiceDamage, resolveOpposedRoll, rollDie } from "./gameRules.mjs";
import { createHabitatInstance, evaluateHabitatComposition, getHabitatRequirementError, resolveEndOfTurnHabitatMaintenance } from "./habitatRules.mjs";
import { createHandLimitChoice, resolveHandLimitChoice, selectAutomatedHandLimitDiscards } from "./handLimitRules.mjs";
import { addCardsToHandWithLimit, canHostSpecialPlacement, createCreatureInstance, getOceanicApexSacrificeChoices, getPersonalDeckType, getSpecialPlacementHostTags, moveSlottedCreatureBetweenFoundations, placeCardInSpecialHost, removeCreatureInstances, resolveDestructionRecoveryWaves } from "./zoneRules.mjs";
import { attackCanTargetCard, attackerHasDisadvantageFromMassive, beginFlashingAlarmTurn, canTargetInAttackSequence, createAttackSequence, createRegenerateDecision, endFlashingAlarmTurn, getCloakDefenseBonus, getDarknessShroudDefenseBonus, getFlashingAlarmAttackBonus, getRemainingAttackTargets, getRovLightsAttackBonus, hasDefenseAdvantage, recordAttackResolution, resolveRegenerateDecision, resolveToxicConsumption, shouldSelfDiscardAfterConsume, triggerFlashingAlarm } from "./combatRules.mjs";
import { consumeSchoolDensityConditionDiscount, getEffectiveSchoolDensityRequirement } from "./conditionRules.mjs";
import { createSchoolDensityBucketState, getEcosystemSchoolDensityCommitted } from "./schoolDensityRules.mjs";
import { getOpponentActionUseKey, markOpponentActionUsed, supportLocksFurtherPlays, wasOpponentActionUsedThisTurn } from "./opponentActionRules.mjs";
import { OPPONENT_DIFFICULTY_OPTIONS, OpponentDifficulty, chooseOpponentPreferredDeck, getOpponentDifficultyProfile, limitOpponentOptionalActions, normalizeOpponentDifficulty, orderOpponentChoices, scaleOpponentThinkingDelay, selectOpponentChoice } from "./opponentDifficultyRules.mjs";
import {
  OpponentThreatLevel,
  filterOpponentAttackersWithLegalTargets,
  getOpponentNormalAttackLimit,
  getOpponentThreatProfile,
  preferOpponentPlaysWithResolvableOnPlayAttacks,
  scoreHardOpponentPermanentPlay,
  shouldOpponentAttackBeforeUtility,
} from "./opponentPlayRules.mjs";
import {
  OpeningCoinPhase,
  OpeningPlayer,
  chooseOpeningPlayer,
  createOpeningCoinCallOverlay,
  createOpeningCoinFlippingOverlay,
  createOpeningCoinReadyOverlay,
  createOpeningCoinResultOverlay,
  formatOpeningCoinSide,
  getOpeningCoinFlipRevealDelay,
  resolveOpeningCoinFlip,
} from "./openingCoinFlip.mjs";
import { createStoryDuelResult } from "./storyModeContract.mjs";
import { expandResolvedStoryDeckCards, resolveStoryPlayerDeckSnapshot } from "./storyDeckRuntime.mjs";
import {
  SIMULATOR_TUTORIAL_ACTION_TYPES,
  SIMULATOR_TUTORIAL_LIFECYCLE_TYPES,
  createSimulatorTutorialContract,
  createSimulatorTutorialEvent,
  createSimulatorTutorialProgress,
  getSimulatorTutorialCurrentCheckpoint,
  observeSimulatorTutorialEvent,
  restartSimulatorTutorialProgress,
} from "./tutorialContract.mjs";
import { getSimulatorTutorialConditionHelp, getSimulatorTutorialHelp } from "./tutorialHelp.mjs";
import {
  createTutorialFinalRoundMilestone,
  isTutorialLessonVictory,
  shouldConfirmTutorialExit,
} from "./tutorialLessonUx.mjs";
import {
  createScriptedTutorialScenario,
  getScriptedTutorialDiscardEntries,
  getScriptedTutorialFoundationDrawCardId,
  getScriptedTutorialSearchTargetCardId,
  getScriptedTutorialTurnDraw,
  shouldForceScriptedTutorialToxicSurvival,
} from "./tutorialScenario.mjs";
import { getGuidedAcademyBoardTourStep, getNextGuidedAcademyBoardTourStep } from "./tutorialBoardTour.mjs";
import {
  getTutorialBeaconAnchor,
  getTutorialCoachPlacement,
} from "./tutorialCoachPlacement.mjs";
import {
  GUIDED_ACADEMY_LAYOUT_ACTIONS,
  completeGuidedAcademyLayoutAction,
  createGuidedAcademyLayoutProgress,
  getGuidedAcademyFoundationPlacementTarget,
} from "./tutorialLayoutLesson.mjs";
import { createProfessorAnnouncement, createProfessorSpeechKey, createProfessorSpokenMessage, getProfessorSpeechDuration, getProfessorVisibleGraphemeCount, segmentProfessorMessage } from "./tutorialDialogue.mjs";
import {
  getAcademyActionBlock,
  getAcademyCardPlayBlock,
  getAcademyEndTurnBlock,
  getAcademyPlacementBlock,
  isAcademyPlacementAllowed,
} from "./tutorialInteractionGate.mjs";
import {
  clearStunnedFromFoundationsAtControllerTurnEnd,
  canSpearfishReefCard,
  coralCanUseOwnAbilities,
  coralIsStunned,
  createStunnedStatus,
  getInvasiveCreatureTargets,
  getInvasiveOrphanTargets,
  getLocallyControlledOrphans,
  getReefCardOwner,
  placeInvasiveCreature,
  removeInvasiveCreature,
  removeInvasiveOrphan,
  resolveEnsnareForAttack,
  resolveParasiteCollection,
  resolveSpearfishingInvaderRemoval,
  resolveStunnedAtControllerTurnBoundary,
  resolveTargetedCoinFlip,
} from "./specialCardRules.mjs";
import foundationDeckImg from "./images/foundation-deck.png";
import palsDeckImg from "./images/pals-deck.png";
import {
  DEFAULT_SIMULATOR_DECK_ID,
  resolveSimulatorDeckId,
} from "./simulatorDeckRoute.mjs";

function shuffle(arr, random = Math.random) {
  const result = arr.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

const defaultDeckId = DEFAULT_SIMULATOR_DECK_ID;
const CARD_ART_FALLBACK = "/images/brand/SeaPalsTCGLogoWhite.svg";
const TUTORIAL_HISTORY_GUARD_STATE_KEY = "__reefboundTutorialGuard";
let tutorialHistoryGuardSequence = 0;

function createTutorialHistoryGuardState(state, token) {
  const preservedState = state && typeof state === "object" && !Array.isArray(state)
    ? state
    : {};
  return { ...preservedState, [TUTORIAL_HISTORY_GUARD_STATE_KEY]: token };
}

const SPEARFISHING_FOREIGN_TARGET_CARD_IDS = (cardsById.spearfishing?.effects ?? [])
  .flatMap((effect) => effect.target?.includesOpponentOwnedInvasiveCardIds ?? []);

function cardCanBeSpearfished(card, reefEntry, hostController) {
  return Boolean(
    card
    && [CardCategory.FISH, CardCategory.PREDATOR].includes(card.category)
    && canSpearfishReefCard(reefEntry, hostController, SPEARFISHING_FOREIGN_TARGET_CARD_IDS),
  );
}

function ProfessorGuidePortrait({ guide, compact = false }) {
  return (
    <span className={`seapals-professor-portrait${compact ? " seapals-professor-portrait-compact" : ""}`} aria-hidden="true">
      <span
        style={{
          position: "absolute",
          inset: "2%",
          display: "block",
          backgroundImage: `url(${guide.portraitSrc})`,
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          imageRendering: "pixelated",
        }}
      />
    </span>
  );
}

function ProfessorTypewriter({ guide, message }) {
  const graphemes = useMemo(() => segmentProfessorMessage(message), [message]);
  const textSpeed = guide.textSpeed ?? "normal";
  const reducedMotion = guide.reducedMotion === true;
  const speedMultiplier = {
    slow: 1.5,
    normal: 1,
    fast: 0.55,
    instant: 0,
  }[textSpeed] ?? 1;
  const duration = useMemo(
    () => getProfessorSpeechDuration(graphemes.length) * speedMultiplier,
    [graphemes.length, speedMultiplier],
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const animationRef = useRef({ frameId: null, generation: 0 });
  const isComplete = visibleCount >= graphemes.length;
  const visibleMessage = graphemes.slice(0, visibleCount).join("");

  const showFullMessage = () => {
    const animation = animationRef.current;
    animation.generation += 1;
    if (animation.frameId != null) window.cancelAnimationFrame(animation.frameId);
    animation.frameId = null;
    setVisibleCount(graphemes.length);
  };

  useEffect(() => {
    const animation = animationRef.current;
    const generation = animation.generation + 1;
    animation.generation = generation;
    if (animation.frameId != null) window.cancelAnimationFrame(animation.frameId);
    animation.frameId = null;

    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    const finish = () => {
      if (animationRef.current.generation !== generation) return;
      if (animationRef.current.frameId != null) window.cancelAnimationFrame(animationRef.current.frameId);
      animationRef.current.frameId = null;
      setVisibleCount(graphemes.length);
    };
    const handleMotionPreference = (event) => {
      if (event.matches) finish();
    };

    if (!graphemes.length || reducedMotion || textSpeed === "instant" || motionPreference?.matches) {
      setVisibleCount(graphemes.length);
    } else {
      setVisibleCount(0);
      const startsAt = window.performance.now() + 120;
      const tick = (now) => {
        if (animationRef.current.generation !== generation) return;
        const nextCount = getProfessorVisibleGraphemeCount({
          graphemeCount: graphemes.length,
          elapsedMs: Math.max(0, now - startsAt),
          durationMs: duration,
        });
        setVisibleCount(nextCount);
        if (nextCount >= graphemes.length) {
          animationRef.current.frameId = null;
          return;
        }
        animationRef.current.frameId = window.requestAnimationFrame(tick);
      };
      animation.frameId = window.requestAnimationFrame(tick);
    }

    if (motionPreference?.addEventListener) motionPreference.addEventListener("change", handleMotionPreference);
    else motionPreference?.addListener?.(handleMotionPreference);
    return () => {
      if (animationRef.current.generation === generation) animationRef.current.generation += 1;
      if (animationRef.current.frameId != null) window.cancelAnimationFrame(animationRef.current.frameId);
      animationRef.current.frameId = null;
      if (motionPreference?.removeEventListener) motionPreference.removeEventListener("change", handleMotionPreference);
      else motionPreference?.removeListener?.(handleMotionPreference);
    };
  }, [duration, graphemes.length, message, reducedMotion, textSpeed]);

  return (
    <div className="seapals-professor-dialogue mt-2" aria-label={`${guide.name} guidance`}>
      <div className="seapals-professor-turn seapals-professor-turn-left">
        <div className="seapals-professor-turn-header">
          <span className="seapals-professor-speaker">{guide.name}</span>
          {!isComplete ? (
            <button
              type="button"
              onClick={showFullMessage}
              className="seapals-professor-show-all"
              aria-label={`Show all of ${guide.name}'s message`}
            >
              Show all
            </button>
          ) : null}
        </div>
        <p className="seapals-professor-typewriter">
          <span className="seapals-professor-message-measure" aria-hidden="true">{message}</span>
          <span className="seapals-professor-message-visible" aria-hidden="true">
            {visibleMessage}
            {!isComplete ? <span className="seapals-professor-type-cursor" /> : null}
          </span>
          <span className="sr-only">{message}</span>
        </p>
      </div>
    </div>
  );
}

function ProfessorGuideCard({
  guide,
  help,
  step,
  total,
  inline = false,
  onDismiss,
  dismissLabel = "Hide",
  onAdvance = null,
  advanceLabel = "Next",
  onBack = null,
}) {
  const professorMessage = createProfessorSpokenMessage(help);
  const speechKey = createProfessorSpeechKey(help.cueId ?? help.id, professorMessage);
  return (
    <aside
      className={`seapals-professor-card${inline ? " seapals-professor-card-inline" : ""}`}
      role="note"
      aria-label={`${guide.name} tutorial help`}
    >
      <ProfessorGuidePortrait guide={guide} compact={inline} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pr-9">
          <strong className="text-sm font-black text-cyan-800">{guide.name}</strong>
          <span className="rounded-full bg-cyan-900 px-2 py-0.5 text-[9px] font-black text-cyan-50">
            {help.progressLabel ?? `Step ${step} of ${total}`}
          </span>
        </div>
        <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{guide.role}</span>
        <strong className="mt-1 block text-sm font-black text-slate-900 sm:text-base">{help.title}</strong>
        <ProfessorTypewriter key={speechKey} guide={guide} message={professorMessage} />
        <p className="seapals-professor-next mt-2 rounded-xl border border-amber-300/70 bg-amber-100 px-3 py-2 text-xs font-black leading-snug text-amber-950" style={{ animationDelay: "180ms" }}>
          Next: {help.action}
        </p>
        <span className="seapals-professor-next mt-1.5 block text-[10px] font-bold uppercase tracking-wide text-cyan-800" style={{ animationDelay: "260ms" }}>Look for {help.targetLabel}</span>
        {onAdvance ? (
          <div className="seapals-professor-next mt-3 flex flex-wrap justify-end gap-2" style={{ animationDelay: "320ms" }} data-tutorial-board-tour-control>
            {onBack ? <button type="button" onClick={onBack} className="rounded-full border border-cyan-700/30 bg-white/70 px-4 py-2 text-xs font-black text-cyan-900 hover:bg-white">Back</button> : null}
            <button type="button" onClick={onAdvance} className="rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2 text-xs font-black text-slate-950 shadow-lg hover:brightness-105">{advanceLabel}</button>
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="seapals-professor-hide"
          aria-label={`${dismissLabel} ${guide.name}'s guidance`}
          title={`${dismissLabel} this guidance`}
          data-tutorial-board-tour-control={onAdvance ? "true" : undefined}
        >
          {dismissLabel}
        </button>
      ) : null}
    </aside>
  );
}

const TUTORIAL_POINTER_TARGETS = new Set([
  "hand",
  "play-card",
  "placement",
  "turn-button",
  "draw-controls",
  "confirm-draw",
  "continue-actions",
  "close-modal",
  "player-board",
  "opponent-board",
  "attack-button",
  "utility-action-button",
  "condition-continue",
  "script-discard-cards",
  "script-discard-confirm",
  "script-search-card",
  "search-card",
  "coin-coral-target",
  "impact-target",
  "faceoff-action",
  "vp-score",
  "condition-panel",
  "rp-bank",
  "zones",
  "event-feed",
  "player-zoom-in",
  "player-zoom-out",
  "player-zoom-fit",
  "foundation-drag",
  "slot-drag",
]);

function getTutorialPointerPrompt(help) {
  const pointerPrompt = String(help?.pointerPrompt ?? "").trim();
  if (pointerPrompt) return pointerPrompt;
  const action = String(help?.action ?? "").trim();
  if (action) return action;
  return `Click ${String(help?.targetLabel ?? "the highlighted control").trim()}.`;
}

function escapeTutorialSelectorValue(value) {
  const normalized = String(value ?? "");
  return window.CSS?.escape
    ? window.CSS.escape(normalized)
    : normalized.replace(/["\\]/g, "\\$&");
}

function getVisibleTutorialTargets(selector) {
  return [...document.querySelectorAll(selector)]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ element, rect }) => {
      if (rect.width < 4 || rect.height < 4) return false;
      if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;
      if (element.closest("[inert], [aria-hidden=\"true\"]")) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
    });
}

function chooseTutorialTarget(entries, help) {
  if (!entries.length) return null;
  if (help.target === "turn-button") {
    return [...entries].sort((left, right) => right.rect.bottom - left.rect.bottom)[0];
  }
  return [...entries].sort((left, right) => (
    (left.rect.width * left.rect.height) - (right.rect.width * right.rect.height)
  ))[0];
}

function findTutorialTarget(help) {
  if (!help?.target) return null;
  const selectors = [];
  if (help.targetCardId) {
    selectors.push(`[data-tutorial-hand-card-id="${escapeTutorialSelectorValue(help.targetCardId)}"]`);
  }
  if (help.targetSearchCardId) {
    selectors.push(`[data-tutorial-search-card-id="${escapeTutorialSelectorValue(help.targetSearchCardId)}"]`);
  }
  if (help.target === "draw-controls" && help.targetDeck) {
    const drawAction = help.targetDrawAction === "remove" ? "remove" : "add";
    selectors.push(`[data-tutorial-draw-${drawAction}="${escapeTutorialSelectorValue(help.targetDeck)}"]:not(:disabled)`);
    if (drawAction === "add") selectors.push("[data-tutorial-draw-remove]:not(:disabled)");
    selectors.push(`[data-tutorial-draw-deck="${escapeTutorialSelectorValue(help.targetDeck)}"]`);
  }
  if (["player-board", "opponent-board"].includes(help.target) && help.targetActionKey) {
    selectors.push(`[data-tutorial-action-key="${escapeTutorialSelectorValue(help.targetActionKey)}"]`);
  }
  selectors.push(`[data-tutorial-target="${escapeTutorialSelectorValue(help.target)}"]`);
  if (help.targetActionKey) {
    selectors.push(`[data-tutorial-action-key="${escapeTutorialSelectorValue(help.targetActionKey)}"]`);
  }
  for (const selector of selectors) {
    const target = chooseTutorialTarget(getVisibleTutorialTargets(selector), help);
    if (target) return target;
  }
  return null;
}

function ProfessorTargetBeacon({ guide, help, active }) {
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    if (!active || !help?.target || !TUTORIAL_POINTER_TARGETS.has(help.target)) {
      setAnchor(null);
      return undefined;
    }

    let animationFrame = null;
    let delayedUpdate = null;
    let resizeObserver = null;
    let observedElement = null;
    const updateAnchor = () => {
      const target = findTutorialTarget(help);
      if (!target) {
        setAnchor(null);
        return;
      }
      const { rect } = target;
      const broadPlacementTarget = help.target === "placement" && rect.width > 360 && rect.height > 240;
      setAnchor(getTutorialBeaconAnchor({
        targetRect: rect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        broadPlacementTarget,
      }));
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver ??= new ResizeObserver(requestUpdate);
        if (observedElement !== target.element) {
          resizeObserver.disconnect();
          resizeObserver.observe(target.element);
          observedElement = target.element;
        }
      }
    };
    const requestUpdate = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateAnchor);
    };

    requestUpdate();
    delayedUpdate = window.setTimeout(requestUpdate, 240);
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("scroll", requestUpdate, true);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (delayedUpdate) window.clearTimeout(delayedUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("scroll", requestUpdate, true);
    };
  }, [active, help?.cueId, help?.target, help?.targetActionKey, help?.targetCardId, help?.targetSearchCardId, help?.targetDeck, help?.targetDrawAction]);

  if (!active || !anchor || !help) return null;
  return (
    <div
      className={`seapals-target-beacon seapals-target-beacon-${anchor.direction}`}
      style={{
        left: `${anchor.left}px`,
        top: `${anchor.top}px`,
        "--seapals-target-arrow-shift": `${anchor.arrowShift}px`,
        "--seapals-target-arrow-length": `${anchor.arrowLength}px`,
      }}
      aria-hidden="true"
    >
      <ProfessorGuidePortrait guide={guide} compact />
      <div className="min-w-0 flex-1">
        <strong>{guide.name}</strong>
        <span>{getTutorialPointerPrompt(help)}</span>
      </div>
      <span className="seapals-target-beacon-arrow" aria-hidden="true" />
    </div>
  );
}

const PROFESSOR_COACH_ARROW = Object.freeze({
  above: "↓",
  below: "↑",
  left: "→",
  right: "←",
});

function sameProfessorCoachPlacement(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.side === right.side
    && Math.abs(left.left - right.left) < 1
    && Math.abs(left.top - right.top) < 1
    && Math.abs(left.arrowOffset - right.arrowOffset) < 1
    && left.constrained === right.constrained;
}

function ProfessorCoachOverlay({ help, children }) {
  const coachRef = useRef(null);
  const [placement, setPlacement] = useState(null);

  useEffect(() => {
    if (!help?.target || !TUTORIAL_POINTER_TARGETS.has(help.target)) {
      setPlacement(null);
      return undefined;
    }

    let animationFrame = null;
    let delayedUpdate = null;
    let resizeObserver = null;
    let observedTarget = null;
    const requestUpdate = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updatePlacement);
    };
    const updatePlacement = () => {
      animationFrame = null;
      const target = findTutorialTarget(help);
      const coachElement = coachRef.current;
      if (!target || !coachElement) {
        setPlacement((current) => current == null ? current : null);
        return;
      }
      const coachRect = coachElement.getBoundingClientRect();
      if (coachRect.width < 4 || coachRect.height < 4) {
        setPlacement((current) => current == null ? current : null);
        return;
      }
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const relativeTargetRect = {
        left: target.rect.left - viewportLeft,
        top: target.rect.top - viewportTop,
        right: target.rect.right - viewportLeft,
        bottom: target.rect.bottom - viewportTop,
      };
      const nextPlacement = getTutorialCoachPlacement({
        targetRect: relativeTargetRect,
        coachRect,
        viewportWidth,
        viewportHeight,
      });
      const viewportPlacement = nextPlacement
        ? {
            ...nextPlacement,
            left: nextPlacement.left + viewportLeft,
            top: nextPlacement.top + viewportTop,
          }
        : null;
      setPlacement((current) => (
        sameProfessorCoachPlacement(current, viewportPlacement) ? current : viewportPlacement
      ));

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver ??= new ResizeObserver(requestUpdate);
        if (observedTarget !== target.element) {
          resizeObserver.disconnect();
          resizeObserver.observe(coachElement);
          resizeObserver.observe(target.element);
          observedTarget = target.element;
        }
      }
    };

    requestUpdate();
    delayedUpdate = window.setTimeout(requestUpdate, 240);
    window.addEventListener("resize", requestUpdate);
    window.visualViewport?.addEventListener("resize", requestUpdate);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (delayedUpdate) window.clearTimeout(delayedUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", requestUpdate);
      window.visualViewport?.removeEventListener("resize", requestUpdate);
    };
  }, [
    help?.cueId,
    help?.target,
    help?.targetActionKey,
    help?.targetCardId,
    help?.targetSearchCardId,
    help?.targetDeck,
    help?.targetDrawAction,
  ]);

  return (
    <div
      ref={coachRef}
      className={`seapals-professor-coach-wrap${placement ? ` seapals-professor-coach-wrap-anchored seapals-professor-coach-side-${placement.side}` : ""}`}
      style={placement ? {
        left: `${placement.left}px`,
        top: `${placement.top}px`,
        "--seapals-coach-arrow-offset": `${placement.arrowOffset}px`,
      } : undefined}
      data-tutorial-coach-side={placement?.side}
      data-tutorial-coach-constrained={placement?.constrained ? "true" : undefined}
    >
      {children}
      {placement ? (
        <span className="seapals-professor-coach-arrow" aria-hidden="true">
          {PROFESSOR_COACH_ARROW[placement.side]}
        </span>
      ) : null}
    </div>
  );
}

function destroyedCardGoesToLostZone(card) {
  return card?.destroyedDestination === "lost-zone";
}

function createDeck(deckType, deckId = defaultDeckId, random = Math.random, playerDeckSnapshot = null) {
  if (playerDeckSnapshot) {
    return shuffle(
      expandResolvedStoryDeckCards(playerDeckSnapshot, deckType, cardsById, isFoundationCard),
      random,
    );
  }
  const selectedDeck = getPlayableDeckById(deckId) ?? prebuiltDecks[0];
  const ids = (selectedDeck?.cards ?? []).flatMap((entry) => {
    const card = cardsById[entry.cardId];
    if (!card) return [];
    const belongsInDeck = deckType === "foundation" ? isFoundationCard(card) : !isFoundationCard(card);
    return belongsInDeck ? Array.from({ length: entry.quantity }, () => entry.cardId) : [];
  });
  return shuffle(ids, random);
}

function getUnavailableDeckEntries(deckId, playerDeckSnapshot = null) {
  if (playerDeckSnapshot) return [];
  const selectedDeck = getPlayableDeckById(deckId);
  return (selectedDeck?.cards ?? []).filter((entry) => !cardsById[entry.cardId]);
}

function splitTurnActionLines(summary) {
  if (!summary) return [];
  const protectedSummary = String(summary)
    .replaceAll("Dr. ", "Dr.__SPACE__")
    .replaceAll("Capt. ", "Capt.__SPACE__");
  return protectedSummary
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.replaceAll(".__SPACE__", ". ").trim())
    .filter(Boolean);
}

function hasBaseCoral(cardIds) {
  return cardIds.some((cardId) => {
    const card = cardsById[cardId];
    return isFoundationCard(card) && Number(card.stage ?? 0) === 0;
  });
}

function createFoundationOpening(deckId, random = Math.random, playerDeckSnapshot = null) {
  let foundationCards = createDeck("foundation", deckId, random, playerDeckSnapshot);
  let attempts = 0;

  while (!hasBaseCoral(foundationCards.slice(0, 4)) && attempts < 100) {
    foundationCards = shuffle(foundationCards, random);
    attempts += 1;
  }

  if (!hasBaseCoral(foundationCards.slice(0, 4))) {
    const baseCoralIndex = foundationCards.findIndex((cardId) => hasBaseCoral([cardId]));
    if (baseCoralIndex >= 4) {
      [foundationCards[0], foundationCards[baseCoralIndex]] = [foundationCards[baseCoralIndex], foundationCards[0]];
    }
  }

  return foundationCards;
}

function createInitialGameState(deckId = defaultDeckId, opponentDeckId = deckId, random = Math.random, { scriptedTutorial = false, playerDeckSnapshot = null } = {}) {
  let foundationCards = createFoundationOpening(deckId, random, playerDeckSnapshot);
  let palsCards = createDeck("pals", deckId, random, playerDeckSnapshot);
  const opponentFoundationCards = createFoundationOpening(opponentDeckId, random);
  const opponentPalsCards = createDeck("pals", opponentDeckId, random);
  let conditionCardIds = shuffle(conditionCards.map((card) => card.id), random);
  const scriptedScenario = scriptedTutorial
    ? createScriptedTutorialScenario({
        playerDeckId: deckId,
        foundationCards,
        palsCards,
        conditionCards: conditionCardIds,
      })
    : null;
  if (scriptedScenario) {
    foundationCards = [...scriptedScenario.foundationCards];
    palsCards = [...scriptedScenario.palsCards];
    conditionCardIds = [...scriptedScenario.conditionCards];
  }
  const opponentOpeningHand = shuffle([...opponentFoundationCards.slice(0, 4), ...opponentPalsCards.slice(0, 4)], random);
  const opponentBaseCoralId = opponentOpeningHand.find((cardId) => isFoundationCard(cardsById[cardId]) && Number(cardsById[cardId]?.stage ?? 0) === 0);
  const opponentCorals = scriptedScenario?.opponentStartingTableau
    ? createScriptedTutorialOpponentCorals(scriptedScenario.opponentStartingTableau)
    : createOpponentStartingCorals(opponentBaseCoralId);
  const opponentSetupCost = Number(cardsById[opponentBaseCoralId]?.cost?.rp ?? 0);
  return {
    scriptedTutorialScenario: scriptedScenario,
    foundationDeck: foundationCards.slice(4),
    palsDeck: palsCards.slice(4),
    hand: shuffle([...foundationCards.slice(0, 4), ...palsCards.slice(0, 4)], random),
    conditionDeck: conditionCardIds,
    opponent: {
      foundationDeck: opponentFoundationCards.slice(4),
      palsDeck: opponentPalsCards.slice(4),
      hand: removeOneCard(opponentOpeningHand, opponentBaseCoralId),
      corals: opponentCorals,
      habitats: [],
      habitatInstances: [],
      reefCreatures: [],
      reefCreatureInstances: [],
      orphanCreatures: [],
      discardPile: [],
      lostZone: [],
      blueCrabRecycleUsedTurn: null,
      supportBlockedUntilRound: 0,
      resilienceUsedCardIds: [],
      actionCooldowns: {},
      actionUses: {},
      creatureStatuses: {},
      flashingAlarmAttackBonus: null,
      conditionDensityUses: {},
      schoolDensityCommitmentsByInstanceId: {},
      rp: Math.max(0, 3 - opponentSetupCost),
    },
  };
}

function createOpponentStartingCorals(baseCoralId) {
  const card = cardsById[baseCoralId];
  if (!card) return [];
  const instanceId = `opponent-${baseCoralId}`;
  return [{
    id: instanceId,
    cardId: baseCoralId,
    health: Number(card.health ?? 0),
    maxHealth: Number(card.health ?? 0),
    slots: createCoralSlots(card, instanceId),
    playedTurn: 1,
    stageEnteredTurn: 1,
  }];
}

function createScriptedTutorialOpponentCorals(tableau = []) {
  return tableau.map((definition, foundationIndex) => {
    const foundationCardId = String(definition?.foundationCardId ?? "").trim();
    const foundation = cardsById[foundationCardId];
    if (!foundation || !isFoundationCard(foundation)) {
      throw new RangeError(`Unknown Academy opponent foundation: ${foundationCardId || "missing"}.`);
    }
    const instanceId = `tutorial-opponent-foundation-${foundationIndex + 1}-${foundationCardId}`;
    const slots = createCoralSlots(foundation, instanceId);
    for (const [placementIndex, placement] of (definition.placements ?? []).entries()) {
      const cardId = String(placement?.cardId ?? "").trim();
      const creature = cardsById[cardId];
      const slotIndex = slots.findIndex((slot) => (
        !slot.cardId
        && slot.slotClass === placement?.slotClass
        && canCardOccupySlot(creature, slot)
      ));
      if (slotIndex < 0) {
        throw new RangeError(`Academy opponent cannot place ${cardId || "a missing card"} in ${foundationCardId}'s ${placement?.slotClass ?? "requested"} slot.`);
      }
      slots[slotIndex] = {
        ...slots[slotIndex],
        cardId,
        cardInstanceId: `tutorial-opponent-${cardId}-${foundationIndex + 1}-${placementIndex + 1}`,
      };
    }
    return {
      id: instanceId,
      cardId: foundationCardId,
      health: Number(foundation.health ?? 0),
      maxHealth: Number(foundation.health ?? 0),
      slots,
      playedTurn: 0,
      stageEnteredTurn: 0,
    };
  });
}

function getOnPlayCoralDamage(card, controllerCardIds = []) {
  const visitEffects = (effects = [], allowConditionalDice = true, inferredCoralTarget = false) => effects.reduce((total, effect) => {
    const targetsCoral = effect.type === EffectType.DAMAGE && (effect.target?.kind === CardKind.CORAL || inferredCoralTarget);
    let amount = typeof effect.amount === "number" ? effect.amount : Number(effect.amount?.value ?? 0);
    if (effect.amount?.type === "dice") {
      amount = resolveConditionalDiceDamage({ dice: effect.amount.dice, multiplier: effect.amount.multiplier, fallbackAmount: effect.amount.fallbackAmount, conditionMet: allowConditionalDice }).damage;
    }
    return total + (targetsCoral ? amount : 0) + visitEffects(effect.effects, allowConditionalDice, inferredCoralTarget) + visitEffects(effect.then ? [effect.then] : [], allowConditionalDice, inferredCoralTarget);
  }, 0);
  return (card?.onPlay ?? []).reduce((total, action) => {
    const diceCondition = (action.conditionalModifiers ?? []).find((modifier) => modifier.modifier?.type === "useDiceDamage")?.condition;
    const conditionMet = !diceCondition?.cardId || controllerCardIds.includes(diceCondition.cardId);
    return total + visitEffects(action.effects, conditionMet, /damage[^.]*coral/i.test(action.text ?? ""));
  }, 0);
}

function getOnPlayFoundationDamage(card, controllerCardIds = []) {
  const coralDamage = getOnPlayCoralDamage(card, controllerCardIds);
  if (coralDamage) return { amount: coralDamage, targetType: "coral", actionName: getOnPlayAbilityName(card) };
  for (const action of card?.onPlay ?? []) {
    const legacyEffect = parseLegacyUtilityText(typeof action === "string" ? action : action?.text);
    if (legacyEffect?.type === "damageFoundation") {
      return { amount: legacyEffect.amount, targetType: legacyEffect.targetType, actionName: getActionName(action) };
    }
  }
  return null;
}

function getOnPlayCoralHeal(card) {
  for (const action of card?.onPlay ?? []) {
    for (const effect of action.effects ?? []) {
      if ((effect.type === "heal" || effect.type === EffectType.MODIFY_HEALTH) && effect.target?.kind === CardKind.CORAL && effect.target?.controller === "you") {
        const roll = effect.amount?.type === "dice" ? rollDie(effect.amount.dice) : null;
        const amount = roll ? roll.total * Number(effect.amount.multiplier ?? 1) : Number(effect.amount?.value ?? effect.amount ?? 0);
        return { amount, actionName: action.name ?? "Coral Heal", roll: roll?.total ?? null };
      }
    }
  }
  return null;
}

function getOnPlayDrawCount(card) {
  return getDrawCountFromActions(card?.onPlay);
}

function getOnPlayAbilityName(card) {
  const hasCoralDamage = (effects = []) => effects.some((effect) =>
    (effect.type === EffectType.DAMAGE && effect.target?.kind === CardKind.CORAL) || hasCoralDamage(effect.effects) || (effect.then ? hasCoralDamage([effect.then]) : false),
  );
  const action = (card?.onPlay ?? []).find((candidate) => hasCoralDamage(candidate.effects));
  return action?.name ?? getActionName(card?.onPlay?.[0]) ?? "On Play";
}

function getOnPlayRandomDiscard(card) {
  for (const action of card?.onPlay ?? []) {
    const effect = (action.effects ?? []).find((candidate) => candidate.type === EffectType.DISCARD_RANDOM_CARD && candidate.targetPlayer === "opponent");
    if (effect) return { actionName: action.name ?? "On Play", amount: Math.max(1, Number(effect.amount ?? 1)) };
  }
  return null;
}

function getOnPlayOpponentDeckDiscard(card) {
  const numberWords = { one: 1, two: 2, three: 3, four: 4 };
  for (const ability of card?.onPlay ?? []) {
    const text = typeof ability === "string" ? ability : ability?.text ?? "";
    if (!/opponent(?:'s|’s)? deck|their deck/i.test(text) || !/discard/i.test(text) || !/top|next/i.test(text)) continue;
    const amountToken = text.match(/discards?\s+(?:(?:the\s+)?next\s+)?(\d+|one|two|three|four)\s+cards?/i)?.[1];
    const amount = Number(amountToken) || numberWords[amountToken?.toLowerCase()] || 0;
    if (amount) return { actionName: text.split(":")[0]?.trim() || "On Play", amount };
  }
  return null;
}

function getOnPlaySupportBlock(card) {
  const text = (card?.onPlay ?? []).map((ability) => typeof ability === "string" ? ability : ability?.text ?? "").find((ability) => /opponent cannot play support cards (?:on (?:their|its) )?next turn/i.test(ability));
  return text ? { actionName: text.split(":")[0]?.trim() || "On Play" } : null;
}

function getOnPlayEnsnare(card) {
  const text = (card?.onPlay ?? []).map((ability) => typeof ability === "string" ? ability : ability?.text ?? "").find((ability) => /ensnare:.*flip a coin.*if heads.*gets\s*-\d+\s*defense/i.test(ability));
  const penalty = text?.match(/gets\s*-(\d+)\s*defense/i)?.[1];
  return penalty ? { actionName: "Ensnare", penalty: Number(penalty) } : null;
}

function getOnPlayUtilitySearch(card) {
  for (const action of card?.onPlay ?? []) {
    const effect = typeof action === "object" ? (action.effects ?? []).find((candidate) => candidate.type === EffectType.SEARCH_DECK) : parseLegacyUtilityAction(action);
    if (effect?.type === EffectType.SEARCH_DECK) return { action, effect, actionName: getActionName(action) };
  }
  return null;
}

function getOnPlayReorder(card) {
  for (const action of card?.onPlay ?? []) {
    const effect = getSupportedUtilityEffect(action);
    if (effect?.type === "reorderTopDeck") return { action, effect, actionName: getActionName(action) };
  }
  return null;
}

function cardHasSchoolMomentum(card) {
  return (card?.onPlay ?? []).some((ability) => /momentum:.*creature school/i.test(typeof ability === "string" ? ability : ability?.text ?? ""));
}

function cardHasPlenteous(card) {
  return (card?.passives ?? []).some((passive) => /plenteous:.*base krill bloom/i.test(typeof passive === "string" ? passive : passive?.text ?? ""));
}

function cardHasAncientResilience(card) {
  return (card?.passives ?? []).some((passive) => /ancient resilience:.*once per game.*would be removed.*keep it instead/i.test(typeof passive === "string" ? passive : passive?.text ?? ""));
}

function getPassiveCoralHeal(passive) {
  const text = typeof passive === "string" ? passive : passive?.text ?? "";
  const match = text.match(/once per turn.*heal\s+(\d+)\s*hp.*coral/i);
  return match ? { amount: Number(match[1]), actionName: typeof passive === "object" ? passive.name ?? "Recovery" : text.split(":")[0] } : null;
}

function getJointedStructureMove(passive) {
  const text = typeof passive === "string" ? passive : passive?.text ?? "";
  return /jointed structure:.*once per turn.*move a creature between your corals/i.test(text)
    ? { actionName: typeof passive === "object" ? passive.name ?? "Jointed Structure" : text.split(":")[0] }
    : null;
}

function getDamageCounterMove(passive) {
  const effect = typeof passive === "object" ? passive?.effect : null;
  if (effect?.type !== "moveDamageCounter") return null;
  const counterCount = Math.max(1, Number(effect.amount) || 1);
  const hpPerCounter = Math.max(1, Number(effect.hpPerCounter) || DAMAGE_COUNTER_HP);
  return {
    actionName: passive.name ?? "Move Damage Counter",
    counterHp: counterCount * hpPerCounter,
    effect,
  };
}

function cardHasSymbiosis(card) {
  return (card?.onPlay ?? []).some((ability) => typeof ability === "object" && /symbiosis/i.test(ability.name ?? "") && (ability.effects ?? []).some((effect) => effect.type === EffectType.ATTACH_TO_CARD));
}

function cardUsesOpponentReef(card) {
  return card?.kind === CardKind.CREATURE
    && card?.specialPlacement?.controller === "opponent"
    && card?.specialPlacement?.acceptsAnyCoralSlot === true;
}

function getSlotCardIds(slot) {
  return [slot?.cardId, ...(slot?.hostedCardIds ?? [])].filter(Boolean);
}

function getOrphanEntriesFromFoundation(foundation) {
  return (foundation?.slots ?? []).filter((slot) => slot.cardId).map((slot) => ({
    cardId: slot.cardId,
    instanceId: slot.cardInstanceId ?? createStableInstanceId(`orphan-${slot.cardId}`),
    hostedCardIds: (slot.hostedCardIds ?? []).filter(Boolean),
    hostedSchoolDensityRequirements: (slot.hostedSchoolDensityRequirements ?? []).filter((_, index) => Boolean(slot.hostedCardIds?.[index])),
    ...(Object.prototype.hasOwnProperty.call(slot, "controller") ? { controller: slot.controller } : {}),
    ...(Object.prototype.hasOwnProperty.call(slot, "invasiveOwner") ? { invasiveOwner: slot.invasiveOwner } : {}),
  }));
}

function redistributeOrphanCreatures(foundations, orphanEntries = []) {
  return redistributeOrphans(foundations, orphanEntries, (cardId, slot, entry) => (
    entry?.invasiveOwner && cardUsesOpponentReef(cardsById[cardId])
      ? true
      : canCardOccupySlot(cardsById[cardId], slot)
  ));
}

function getHostedTargetSlotId(slotId, hostedIndex) {
  return `hosted:${slotId}:${hostedIndex}`;
}

function getOrphanHostedTargetSlotId(orphanInstanceId, hostedIndex) {
  return `orphan-hosted:${orphanInstanceId}:${hostedIndex}`;
}

function parseOrphanHostedTargetSlotId(targetSlotId) {
  const match = String(targetSlotId ?? "").match(/^orphan-hosted:(.+):(\d+)$/);
  return match ? { orphanInstanceId: match[1], hostedIndex: Number(match[2]) } : null;
}

function parseHostedTargetSlotId(targetSlotId) {
  const match = String(targetSlotId ?? "").match(/^hosted:(.+):(\d+)$/);
  return match ? { slotId: match[1], hostedIndex: Number(match[2]) } : null;
}

// Hosted creatures keep their original position as their stable combat identity.
// Compacting this array after a defeat makes a sibling inherit the defeated
// creature's target ID and can incorrectly skip or repeat an attack.
function removeHostedCardAtIndex(hostedCardIds, hostedIndex) {
  return (hostedCardIds ?? []).map((cardId, index) => index === hostedIndex ? null : cardId);
}

function getSlotCardInstanceId(slot) {
  return slot?.cardInstanceId ?? (slot?.cardId ? `legacy-${slot.id}-${slot.cardId}` : null);
}

function getSlotActionKey(slot) {
  return getSlotCardInstanceId(slot) ? `slot-${getSlotCardInstanceId(slot)}` : slot?.id;
}

function getSlotTargetInstanceId(slot) {
  return getSlotCardInstanceId(slot) ? `slot-card:${getSlotCardInstanceId(slot)}` : `slot:${slot?.id}`;
}

function getHostedDefenseBonusDice(hostCard, hostedCard) {
  for (const passive of hostCard?.passives ?? []) {
    const effect = typeof passive === "object" ? passive.effect : null;
    if (effect?.type !== EffectType.MODIFY_DEFENSE_ROLL && effect?.type !== "modifyDefenseRoll") continue;
    if (effect.target?.tags?.length && !effect.target.tags.some((tag) => hostedCard?.tags?.includes(tag))) continue;
    if (effect.amount?.type === "dice" && effect.amount.dice) return effect.amount.dice;
  }
  return null;
}

function cardIsHiddenByAbyss(card, habitatIds) {
  return habitatIds?.includes("abyss") && (card?.passives ?? []).some((passive) => /darkness shroud:.*cannot be targeted/i.test(typeof passive === "string" ? passive : passive?.text ?? ""));
}

function cardCanTargetHiddenByAbyss(card, attack = null) {
  const rules = [...(card?.passives ?? []), ...(card?.specialRules ?? []), ...(card?.actions ?? []), ...(card?.onPlay ?? [])].map((rule) => typeof rule === "string" ? rule : rule?.text ?? "");
  return rules.some((rule) => /can target .*hidden by the abyss/i.test(rule)) || /can target .*hidden by the abyss/i.test(attack?.text ?? "");
}

function getBiteBackAttack(card) {
  const text = [...(card?.actions ?? []), ...(card?.passives ?? [])].find((action) => typeof action === "string" && /bite back:.*if targeted unsuccessfully/i.test(action));
  if (!text) return null;
  const dice = text.match(/\b(D\d+(?:[+-]\d+)?)\b/i)?.[1];
  return dice ? { attackDice: dice.toUpperCase(), actionName: "Bite Back" } : null;
}

function getTargetAvoidance(card) {
  for (const passive of card?.passives ?? []) {
    const text = typeof passive === "string" ? passive : passive?.text ?? "";
    if (!/if targeted|if being targeted/i.test(text) || !/flip a coin/i.test(text) || !/attack fails/i.test(text)) continue;
    const failureResult = /if heads[^.]*attack fails/i.test(text) ? "heads" : /if tails[^.]*attack fails/i.test(text) ? "tails" : null;
    if (failureResult) return { abilityName: text.split(":")[0]?.trim() || "Evasion", failureResult };
  }
  return null;
}

function cardHasScatter(card) {
  return (card?.passives ?? []).some((passive) => /opponent rerolls successful attacks/i.test(typeof passive === "string" ? passive : passive?.text ?? ""));
}

function getDynamicAttackRepeat(card, attack, friendlyCorals, friendlyOpenWater, habitats = []) {
  const baseRepeat = Math.max(1, Number(attack?.repeat ?? 1));
  const text = attack?.text ?? "";
  const friendlyCards = [
    ...(friendlyCorals ?? []).flatMap((foundation) => [cardsById[foundation.cardId], ...(foundation.slots ?? []).map((slot) => cardsById[slot.cardId])]),
    ...(friendlyOpenWater ?? []).map((cardId) => cardsById[cardId]),
  ].filter(Boolean);
  const bonusRepeats = attack?.bonusRepeats;
  if (bonusRepeats?.type === "countCardsOnReef" && (!bonusRepeats.requires || (bonusRepeats.requires.type === "kindInPlay" ? habitats.length > 0 : habitats.includes(bonusRepeats.requires.cardId)))) {
    const matchingCount = friendlyCards.filter((candidate) => candidate.id === bonusRepeats.cardId).length;
    return Math.min(Number(bonusRepeats.maxBonus ?? Infinity), baseRepeat + matchingCount);
  }
  if (bonusRepeats?.type === "cardInPlay" && habitats.includes(bonusRepeats.cardId)) return baseRepeat + Number(bonusRepeats.amount ?? 1);
  if (/group hunt:/i.test(text)) {
    const tunaCount = friendlyCards.filter((candidate) => /\btuna\b/i.test(candidate.name ?? "")).length;
    return baseRepeat + Math.min(2, tunaCount);
  }
  if (/frenzied attack:/i.test(text) && habitats.includes("open-ocean")) {
    const sharkCount = friendlyCards.filter((candidate) => /\bshark\b/i.test(candidate.name ?? "")).length;
    return baseRepeat + sharkCount;
  }
  return baseRepeat;
}

function getDefenseAdjustment(attack, targetCard, habitats = []) {
  const text = attack?.text ?? "";
  const fishPenalty = targetCard?.category === CardCategory.FISH ? text.match(/defending fish have\s*-(\d+)\s*defense/i) : null;
  const conditionalPenalty = attack?.conditionalDefensePenalty && (!attack.conditionalDefensePenalty.requiredCardId || habitats.includes(attack.conditionalDefensePenalty.requiredCardId)) ? Number(attack.conditionalDefensePenalty.amount ?? 0) : 0;
  return {
    flat: (fishPenalty ? -Number(fishPenalty[1]) : 0) - Number(attack?.ensnarePenalty ?? 0) - conditionalPenalty,
    ignoresBonuses: /ignore defensive bonuses/i.test(text),
  };
}

function getRolledAttackBonus(attack, rawRoll, habitats = []) {
  const text = attack?.text ?? "";
  const conditionalMatch = text.match(/if you roll a?\s*(\d+)\s*or higher(?:\s+and\s+open ocean[^.]*)?[^.]*add\s*\+?(\d+)/i);
  if (!conditionalMatch || Number(rawRoll) < Number(conditionalMatch[1])) return { flat: 0, detail: "" };
  const requiresOpenOcean = /and\s+open ocean/i.test(conditionalMatch[0]);
  if (requiresOpenOcean && !habitats.includes("open-ocean")) return { flat: 0, detail: "" };
  return {
    flat: Number(conditionalMatch[2]),
    detail: `+${conditionalMatch[2]} ${requiresOpenOcean ? "Open Ocean " : ""}roll bonus`,
  };
}

function parseLegacyAttackAction(action) {
  return parseLegacyAttackText(action);
}

function parseLegacyUtilityAction(action) {
  return parseLegacyUtilityText(action);
}

function getActionName(action) {
  return typeof action === "string" ? action.split(":")[0]?.trim() || "Action" : action?.name ?? "Action";
}

function getActionCost(action) {
  const text = typeof action === "string" ? action : action?.text ?? "";
  return Number(action?.cost?.rp ?? text.match(/cost:\s*(\d+)\s*rp/i)?.[1] ?? 0);
}

function getBasicAttackEffect(card) {
  for (const action of card?.actions ?? []) {
    const legacyAttack = parseLegacyAttackAction(action);
    if (legacyAttack) return legacyAttack;
    const actionEffects = [...(action.effects ?? []), ...(action.effect ? [action.effect] : [])];
    const effect = actionEffects.find((candidate) => candidate.type === EffectType.ATTACK && candidate.attackDice);
    if (effect) {
      const hasCompanionEffects = actionEffects.some((candidate) => candidate !== effect);
      return {
        ...effect,
        actionName: action.name ?? effect.attackName ?? "Attack",
        text: action.text ?? effect.text ?? "",
        actionCost: Number(action.cost?.rp ?? 0),
        skipNextTurn: /cannot (?:use|be performed).*next turn/i.test(action.text ?? ""),
        targetTags: effect.targetTags ?? action.targetTags ?? [],
        unsupportedDetails: hasCompanionEffects
          ? "This action has additional effects that are not implemented; only its opposed attack resolved."
          : "",
      };
    }
  }
  return null;
}

function getOnPlayAttackEffect(card) {
  const defenseModifier = (card?.onPlay ?? []).flatMap((ability) => typeof ability === "object" ? ability.effects ?? [] : []).find((effect) => (effect.type === EffectType.MODIFY_DEFENSE_ROLL || effect.type === "modifyDefenseRoll") && Number(effect.amount ?? 0) < 0);
  for (const ability of card?.onPlay ?? []) {
    const legacyAttack = parseLegacyAttackAction(ability);
    if (legacyAttack) return legacyAttack;
    if (typeof ability !== "object") continue;
    const effect = (ability.effects ?? []).find((candidate) => candidate.type === EffectType.ATTACK && candidate.attackDice);
    if (effect) {
      const supportedCompanionTypes = new Set([EffectType.DAMAGE, EffectType.MODIFY_DEFENSE_ROLL, "grantAdvantage"]);
      return { ...effect, actionName: ability.name ?? effect.attackName ?? "On Play Attack", actionCost: 0, text: ability.text ?? effect.text ?? "", targetTags: effect.targetTags ?? ability.targetTags ?? [], conditionalModifiers: effect.conditionalModifiers ?? ability.conditionalModifiers ?? [], conditionalDefensePenalty: defenseModifier ? { amount: Math.abs(Number(defenseModifier.amount)), requiredCardId: defenseModifier.requires?.cardId ?? null } : null, unsupportedDetails: (ability.effects ?? []).some((candidate) => candidate !== effect && !supportedCompanionTypes.has(candidate.type)) ? "This On Play ability has additional effects that are not implemented; its attack resolved." : "" };
    }
  }
  return null;
}

function getActionEffects(action) {
  return [...(action?.effects ?? []), ...(action?.effect ? [action.effect] : [])];
}

function actionIsOncePerTurn(action) {
  return action?.oncePerTurn !== false && !/as often as you like/i.test(action?.text ?? "");
}

function cardMatchesAttackTarget(card, attack) {
  return attackCanTargetCard(card, attack);
}

function formatAttackTargetFamilies(attack) {
  const labels = {
    [CardCategory.APEX]: "an Apex creature",
    [CardCategory.PREDATOR]: "a Predator",
    [CardCategory.FISH]: "a Fish",
    [CardCategory.INVERTEBRATE]: "an Invertebrate",
    [CardCategory.FILTER_FEEDER]: "a Filter Feeder",
  };
  const targetLabels = [...new Set((attack?.targetCategories ?? []).map((category) => labels[category]).filter(Boolean))];
  if (!targetLabels.length) return "";
  if (targetLabels.length === 1) return targetLabels[0];
  if (targetLabels.length === 2) return `${targetLabels[0]} or ${targetLabels[1]}`;
  return `${targetLabels.slice(0, -1).join(", ")}, or ${targetLabels.at(-1)}`;
}

function cardMatchesSearchCriteria(card, effect) {
  if (!card) return false;
  if (effect.targetCardId && effect.targetCardId !== card.id) return false;
  if (effect.targetKind && effect.targetKind !== card.kind) return false;
  if (effect.targetCategories?.length && !effect.targetCategories.includes(card.category)) return false;
  if (effect.targetTags?.length && !effect.targetTags.every((tag) => card.tags?.includes(tag))) return false;
  if (effect.excludeTags?.some((tag) => card.tags?.includes(tag))) return false;
  if (effect.targetNameIncludes && !card.name?.toLowerCase().includes(effect.targetNameIncludes.toLowerCase())) return false;
  return true;
}

function cardHasAttackAdvantage(card, targetCard, habitats = [], attack = null) {
  if (attack?.advantage === true) return true;
  return (card?.onPlay ?? []).some((ability) => {
    if (typeof ability === "string") return /(?:attacks? have|gain) advantage/i.test(ability) && (!/abyss/i.test(ability) || habitats.includes("abyss"));
    return (ability.effects ?? []).some((effect) => {
      if (effect.type !== "grantAdvantage") return false;
      if (effect.targetCategories?.length && !effect.targetCategories.includes(targetCard?.category)) return false;
      const requiredCardId = effect.requires?.cardId;
      return !requiredCardId || habitats.includes(requiredCardId);
    });
  });
}

function getAttackConditionalModifier(attacker, targetCard, habitats, friendlyCorals, friendlyOpenWater, attack, friendlyOrphans = []) {
  const text = attack?.text ?? "";
  let flat = Number(attack?.flatBonus ?? 0);
  const details = attack?.flatBonus ? [`+${attack.flatBonus} ${attack.flatBonusSource ?? "attack bonus"}`] : [];
  (targetCard?.passives ?? []).forEach((passive) => {
    const passiveText = typeof passive === "string" ? passive : passive?.text ?? "";
    const penalty = passiveText.match(/all attacks against this creature have\s*-(\d+)\s*on their attack rolls/i);
    if (penalty) {
      flat -= Number(penalty[1]);
      details.push(`-${penalty[1]} ${targetCard.name}`);
    }
  });
  (attacker?.passives ?? []).forEach((passive) => {
    const passiveText = typeof passive === "string" ? passive : passive?.text ?? "";
    const openPursuit = passiveText.match(/gain\s*\+(\d+)\s+on attacks when open ocean/i);
    if (openPursuit && habitats.includes("open-ocean")) {
      flat += Number(openPursuit[1]);
      details.push(`+${openPursuit[1]} Open Pursuit`);
    }
    const titanBonus = passiveText.match(/attacking a giant or colossal squid, gain\s*\+(\d+)/i);
    if (titanBonus && /giant squid|colossal squid/i.test(targetCard?.name ?? "")) {
      flat += Number(titanBonus[1]);
      details.push(`+${titanBonus[1]} Battle of the Titans`);
    }
  });
  const habitatBonus = (habitatId, pattern) => {
    const match = text.match(pattern);
    if (habitats.includes(habitatId) && match) {
      flat += Number(match[1]);
      details.push(`+${match[1]} ${habitatId === "abyss" ? "Abyss" : "Open Ocean"}`);
    }
  };
  habitatBonus("abyss", /if abyss[^.]*add\s*\+?(\d+)/i);
  habitatBonus("open-ocean", /if open ocean[^.]*add\s*\+?(\d+)/i);
  const schoolBonus = text.match(/if targeting (?:a damaged )?creature school[^.]*add\s*\+?(\d+)/i) ?? text.match(/add\s*\+?(\d+)\s+if targeting a creature school/i);
  if (isCreatureSchool(targetCard) && schoolBonus && (!/damaged creature school/i.test(text) || Number(targetCard.health ?? 0) < Number(targetCard.maxHealth ?? Infinity))) {
    flat += Number(schoolBonus[1]);
    details.push(`+${schoolBonus[1]} Creature School`);
  }
  const namedTargetBonus = text.match(/add\s*\+?(\d+)\s+if targeting man o['’]? war/i);
  if (namedTargetBonus && /man o['’]? war/i.test(targetCard?.name ?? "")) {
    flat += Number(namedTargetBonus[1]);
    details.push(`+${namedTargetBonus[1]} Man O' War target`);
  }
  const friendlyCards = [...friendlyCorals.flatMap((foundation) => [cardsById[foundation.cardId], ...foundation.slots.flatMap((slot) => getSlotCardIds(slot).map((cardId) => cardsById[cardId]))]), ...(friendlyOpenWater ?? []).map((cardId) => cardsById[cardId]), ...(friendlyOrphans ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])].map((cardId) => cardsById[cardId]))].filter(Boolean);
  friendlyCards.forEach((card) => (card.passives ?? []).forEach((passive) => {
    const passiveText = typeof passive === "string" ? passive : passive?.text ?? "";
    const boost = passiveText.match(/all of your attacks have \+(\d+)/i);
    if (boost) { flat += Number(boost[1]); details.push(`+${boost[1]} ${card.name}`); }
  }));
  if (isCreatureSchool(targetCard)) {
    const corralCount = Math.min(2, friendlyCards.filter((card) => (card.passives ?? []).some((passive) => /attacks against creature schools gain \+1/i.test(typeof passive === "string" ? passive : passive?.text ?? ""))).length);
    if (corralCount) { flat += corralCount; details.push(`+${corralCount} Corral`); }
  }
  const extraDieMatch = text.match(/if open ocean[^.]*add\s*(D\d+)/i);
  const hasStructuredExtraDie = (attack?.conditionalModifiers ?? []).some((entry) => entry.modifier?.type === "addDiceToAttackRoll");
  const extraRoll = !hasStructuredExtraDie && habitats.includes("open-ocean") && extraDieMatch ? rollDie(extraDieMatch[1]) : null;
  if (extraRoll) { flat += extraRoll.total; details.push(`+${extraRoll.total} ${extraDieMatch[1]}`); }
  const ecosystemCards = friendlyCards;
  (attack?.conditionalModifiers ?? []).forEach((entry) => {
    if (!isEcosystemConditionMet(entry.condition, habitats, ecosystemCards)) return;
    const modifier = entry.modifier ?? {};
    if (modifier.type === "addDiceToAttackRoll") {
      const bonusRoll = rollDie(modifier.dice);
      if (bonusRoll) {
        flat += bonusRoll.total;
        details.push(`+${bonusRoll.total} ${modifier.dice} conditional bonus`);
      }
    } else if (modifier.type === "fixed") {
      const amount = Number(modifier.amount ?? 0);
      flat += amount;
      details.push(`${amount >= 0 ? "+" : ""}${amount} conditional bonus`);
    }
  });
  return { flat, details };
}

function getSupportedUtilityEffect(action) {
  const actionText = typeof action === "string" ? action : action?.text ?? "";
  const cloakEffect = /cloak in darkness:.*choose one of your opponent'?s corals?.*stunn?ed/i.test(actionText)
    ? { type: EffectType.STUN_CORAL, target: { controller: "opponent", kind: CardKind.CORAL } }
    : null;
  return parseLegacyUtilityAction(action) ?? cloakEffect ?? getActionEffects(action).find((effect) => effect.type === EffectType.DRAW_CARDS || effect.type === EffectType.SEARCH_DECK || effect.type === "reorderTopDeck" || effect.type === "grantNextOnPlayAttackBonus" || effect.type === "rollDiceForResource" || effect.type === EffectType.RECOVER_CARD_FROM_DISCARD || effect.type === "recoverCardFromDiscard" || effect.type === "discardThenSearchDeck" || effect.type === "discardThenDraw" || effect.type === "modifyDefenseRoll" || effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE || effect.type === EffectType.STUN_CORAL || (effect.type === EffectType.FLIP_COIN && [EffectType.STUN_CORAL, EffectType.DAMAGE, EffectType.MODIFY_RP_GENERATION, "modifyRpGeneration"].includes(effect.onSuccess?.type))) ?? null;
}

function supportExplicitlyLocksFurtherSupports(card) {
  return supportLocksFurtherPlays(card);
}

function cardIsBlockedFromPlayThisTurn(state, cardId) {
  return (state?.cardsBlockedFromPlayThisTurn ?? []).includes(cardId);
}

function isCreatureSchool(card) {
  return card?.kind === CardKind.CREATURE && card.tags?.includes("creature-school");
}

function getCardClassLabel(card) {
  if (!card) return "Unknown Card";
  const zoneLabel = card.zone === CreatureZone.OCEAN ? "Oceanic" : card.zone === CreatureZone.DEEP ? "Deep" : "Reef";
  const classLabel = String(card.class ?? card.category ?? card.kind ?? "card")
    .split(/[-_]/)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : "")
    .join(" ");

  if (card.kind === CardKind.CORAL) return `${card.stageLabel ?? "Base"} - ${zoneLabel} Coral`;
  if (isCreatureSchool(card)) return `${zoneLabel} Creature School`;
  if (card.kind === CardKind.CREATURE) return `${zoneLabel} ${classLabel}`;
  if (card.kind === CardKind.HABITAT) return `${zoneLabel} Habitat`;
  if (card.kind === CardKind.SUPPORT) return "Support Action";
  return classLabel;
}

function DeckSearchChoice({
  card,
  onInspect,
  onChoose,
  chooseLabel = "Add to Hand",
  chooseDisabled = false,
  chosen,
  meta = null,
  tutorialTarget,
  tutorialSearchCardId,
  className = "",
}) {
  if (!card) return null;
  const selectionState = chosen === true
    ? "border-emerald-400 bg-emerald-400/20"
    : "border-cyan-300/25 bg-white/5";

  return (
    <div
      data-tutorial-search-card-id={tutorialSearchCardId}
      data-tutorial-target={tutorialTarget}
      className={`flex flex-col gap-3 rounded-2xl border p-3 transition sm:flex-row sm:items-center sm:justify-between ${selectionState} ${className}`}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Inspect ${card.name} details`}
        onClick={(event) => onInspect(card.id, event)}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left outline-none transition hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <img src={card.image} alt="" className="h-24 w-16 shrink-0 rounded-lg bg-white object-contain" />
        <span className="min-w-0">
          <strong className="block truncate text-white">{card.name}</strong>
          {meta ? <span className="mt-1 block text-sm text-cyan-100/70">{meta}</span> : null}
          <span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-cyan-300 group-hover:text-cyan-200">View card details</span>
        </span>
      </button>
      <button
        type="button"
        disabled={chooseDisabled}
        aria-pressed={typeof chosen === "boolean" ? chosen : undefined}
        aria-label={`${chooseLabel} ${card.name}`}
        onClick={onChoose}
        className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-45 ${chosen ? "bg-emerald-600 hover:bg-emerald-500" : "bg-cyan-600 hover:bg-cyan-500"}`}
      >
        {chooseLabel}
      </button>
    </div>
  );
}

function isFoundationCard(card) {
  return getPersonalDeckType(card) === "foundation";
}

function getInPlayStageLabel(card) {
  if (!card || (card.kind !== CardKind.CORAL && !isCreatureSchool(card))) return null;
  if (card.stageLabel) return card.stageLabel;
  const stage = String(card.stage ?? "").toLowerCase();
  if (!stage || stage === "base" || stage === "0") return "Base";
  if (stage === "stage1" || stage === "stage-1" || stage === "1") return "Stage 1";
  if (stage === "stage2" || stage === "stage-2" || stage === "2") return "Stage 2";
  return String(card.stage);
}

function InPlayHoverLabel({ card, zoom = 1 }) {
  if (!card) return null;
  const stageLabel = getInPlayStageLabel(card);
  const inverseZoom = Math.min(2.5, Math.max(0.7, 1 / Math.max(0.2, Number(zoom) || 1)));

  return (
    <span
      className="seapals-in-play-hover-label"
      style={{ "--seapals-hover-label-scale": inverseZoom }}
      aria-hidden="true"
    >
      <span className="seapals-in-play-hover-name">{card.name}</span>
      {stageLabel ? <span className="seapals-in-play-hover-stage">{stageLabel}</span> : null}
    </span>
  );
}

function FoundationVitals({ foundation, densityBucket = null, owner = "player", compact = false }) {
  const health = Number(foundation?.health ?? foundation?.maxHealth ?? 0);
  const maxHealth = Number(foundation?.maxHealth ?? 0);
  const healthPercent = maxHealth ? Math.min(100, Math.max(0, (health / maxHealth) * 100)) : 0;
  const densityUsed = Number(densityBucket?.used ?? 0);
  const densityCapacity = Number(densityBucket?.capacity ?? 0);
  const densityPercent = densityCapacity
    ? Math.min(100, Math.max(0, (densityUsed / densityCapacity) * 100))
    : 0;
  const healthFillClass = owner === "opponent" ? "bg-rose-500" : "bg-emerald-500";
  const densityFillClass = densityUsed >= densityCapacity && densityCapacity
    ? "bg-amber-400"
    : "bg-cyan-400";
  const labelSize = compact ? "text-[8px]" : "text-[10px]";
  const barHeight = compact ? "h-1.5" : "h-2";

  return (
    <span className={`block rounded-lg bg-slate-950/90 ${compact ? "px-2 py-1" : "px-3 py-2"} text-white shadow-lg backdrop-blur-sm`}>
      <span
        className={`block ${barHeight} overflow-hidden rounded-full bg-slate-500/45`}
        role="progressbar"
        aria-label={`${health} of ${maxHealth} health`}
        aria-valuemin={0}
        aria-valuemax={maxHealth}
        aria-valuenow={health}
      >
        <span className={`block h-full ${healthFillClass} transition-all`} style={{ width: `${healthPercent}%` }} />
      </span>
      <span className={`mt-0.5 block text-center ${labelSize} font-black leading-none`}>{health}/{maxHealth} HP</span>
      {densityBucket ? (
        <>
          <span
            className={`mt-1 block ${barHeight} overflow-hidden rounded-full bg-slate-500/45`}
            role="progressbar"
            aria-label={`${densityUsed} of ${densityCapacity} School Density committed`}
            aria-valuemin={0}
            aria-valuemax={densityCapacity}
            aria-valuenow={Math.min(densityUsed, densityCapacity)}
            aria-valuetext={`${densityUsed} of ${densityCapacity} School Density used; ${Math.max(0, densityCapacity - densityUsed)} available`}
          >
            <span className={`block h-full ${densityFillClass} transition-all`} style={{ width: `${densityPercent}%` }} />
          </span>
          <span className={`mt-0.5 block text-center ${labelSize} font-black leading-none ${densityUsed >= densityCapacity ? "text-amber-200" : "text-cyan-100"}`}>
            {densityUsed}/{densityCapacity} SD used
          </span>
        </>
      ) : null}
    </span>
  );
}

function getCreatureSlotLabel(slot) {
  if (!slot) return "Creature";
  const rawZone = String(slot.zone ?? "reef")
    .replace(/^your_/, "")
    .replace(/^opponent_/, "")
    .toLowerCase();
  const zoneLabel = rawZone === "ocean"
    ? "Oceanic"
    : rawZone.charAt(0).toUpperCase() + rawZone.slice(1);
  const rawClass = String(slot.slotClass ?? slot.slotType ?? slot.class ?? "any");
  const classLabel = rawClass === "any"
    ? "Creature"
    : rawClass
        .split(/[-_]/)
        .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : "")
        .join(" ");
  return `${zoneLabel} ${classLabel}`;
}

function EmptySlotHoverLabel({ slot, zoom = 1, position }) {
  const inverseZoom = Math.min(2.5, Math.max(0.7, 1 / Math.max(0.2, Number(zoom) || 1)));
  const placeBelow = Number.parseFloat(position?.top) < 20;
  return (
    <span
      className={`seapals-in-play-hover-label ${placeBelow ? "seapals-in-play-hover-label--below" : ""}`}
      style={{ "--seapals-hover-label-scale": inverseZoom }}
      aria-hidden="true"
    >
      <span className="seapals-in-play-hover-name">{getCreatureSlotLabel(slot)}</span>
      <span className="seapals-in-play-hover-stage">Empty Slot</span>
    </span>
  );
}

const BUBBLE_PARTICLES = [
  { drift: -72, rise: 150, size: 26, delay: 0, duration: 1750 },
  { drift: -46, rise: 210, size: 42, delay: 80, duration: 1900 },
  { drift: -24, rise: 132, size: 18, delay: 180, duration: 1450 },
  { drift: -8, rise: 245, size: 34, delay: 20, duration: 2050 },
  { drift: 14, rise: 178, size: 54, delay: 130, duration: 1800 },
  { drift: 34, rise: 226, size: 24, delay: 230, duration: 1700 },
  { drift: 58, rise: 148, size: 38, delay: 40, duration: 1600 },
  { drift: 82, rise: 202, size: 20, delay: 160, duration: 1850 },
  { drift: -92, rise: 188, size: 16, delay: 260, duration: 1550 },
  { drift: 96, rise: 164, size: 30, delay: 280, duration: 1650 },
  { drift: -36, rise: 270, size: 22, delay: 300, duration: 1900 },
  { drift: 44, rise: 282, size: 16, delay: 340, duration: 1800 },
];

function BubbleBurst({ x, y }) {
  return (
    <span className="seapals-bubble-burst" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
      {BUBBLE_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="seapals-bubble-particle"
          style={{
            "--seapals-bubble-drift": `${particle.drift}px`,
            "--seapals-bubble-rise": `${particle.rise}px`,
            "--seapals-bubble-size": `${particle.size}px`,
            "--seapals-bubble-delay": `${particle.delay}ms`,
            "--seapals-bubble-duration": `${particle.duration}ms`,
          }}
        />
      ))}
    </span>
  );
}

function getCardStartTurnRp(card) {
  if (!card || (card.kind !== CardKind.CORAL && !card.tags?.includes("creature-school"))) return 0;

  return (card.passives ?? []).reduce((total, passive) => {
    const effect = typeof passive === "object" ? passive.effect : null;
    if (effect?.type === "gainResource" && effect.resource === "rp" && Number.isFinite(Number(effect.amount))) {
      return total + Number(effect.amount);
    }

    const text = typeof passive === "string" ? passive : passive?.text;
    const match = text?.match(/collect\s+(\d+)\s*rp\s+at the start of your turn/i);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
}

function conditionPreventsCoralIncome(card, activeCondition) {
  if (!card || !activeCondition) return false;
  return (activeCondition.effects ?? []).some(
    (effect) =>
      effect.type === EffectType.PREVENT_RP_GENERATION &&
      effect.targetKind === CardKind.CORAL &&
      effect.targetWeaknesses?.some((weakness) => card.weaknesses?.includes(weakness)),
  );
}

function getEcosystemStartTurnRp(playerCorals, activeCondition = null) {
  return playerCorals.reduce((total, coral) => {
    const coralCard = cardsById[coral.cardId];
    const baseCoralRp = coralIsStunned(coral) || conditionPreventsCoralIncome(coralCard, activeCondition) ? 0 : getCardStartTurnRp(coralCard);
    const coralRp = Math.max(0, baseCoralRp - Number(coral.rpPenaltyNextTurn ?? 0));
    const slottedRp = (coral.slots ?? []).reduce(
      (slotTotal, slot) => slotTotal + (slot.invasiveOwner ? 0 : getCardStartTurnRp(cardsById[slot.cardId])),
      0,
    );
    const attachedCardBonus = coralIsStunned(coral) ? 0 : calculateAttachedCardRpBonus(coral, cardsById);
    return total + coralRp + slottedRp + attachedCardBonus;
  }, 0);
}

function getEcosystemCreatureCardIds(foundations = [], openWaterCreatures = [], orphanCreatures = []) {
  return [
    ...foundations.flatMap((foundation) => (foundation.slots ?? []).flatMap((slot) => slot.invasiveOwner ? [] : getSlotCardIds(slot))),
    ...openWaterCreatures.map((entry) => typeof entry === "string" ? entry : entry?.cardId).filter(Boolean),
    ...orphanCreatures.flatMap((entry) => entry?.invasiveOwner ? [] : [entry?.cardId, ...(entry?.hostedCardIds ?? [])]).filter(Boolean),
  ];
}

function getParasiteRequestedRp(controllerFoundations, controllerOpenWater, controllerOrphans, opposingFoundations, opposingOpenWater, opposingOrphans) {
  const controllerCardIds = getEcosystemCreatureCardIds(controllerFoundations, controllerOpenWater, controllerOrphans);
  if (!controllerCardIds.includes("cookie-cutter-shark")) return 0;
  return getEcosystemCreatureCardIds(opposingFoundations, opposingOpenWater, opposingOrphans)
    .map((cardId) => cardsById[cardId])
    .filter((card) => [CardCategory.PREDATOR, CardCategory.APEX].includes(card?.category))
    .length;
}

function describeParasiteTransfer(actorLabel, transfer) {
  if (!transfer?.requested) return "";
  const collected = transfer.transferredFromOpponent
    ? `${actorLabel} transferred ${transfer.transferredFromOpponent} RP from the opposing RP bank.`
    : `${actorLabel} could not collect RP from the opposing RP bank.`;
  const supply = transfer.collectedFromSupply
    ? ` It collected the remaining ${transfer.collectedFromSupply} RP from the shared board supply.`
    : "";
  const remainder = transfer.uncollected
    ? ` ${transfer.uncollected} additional RP could not fit under the receiving bank cap.`
    : "";
  return `${collected}${supply}${remainder}`;
}

function getEcosystemRpCap(corals, habitats = [], activeCondition = null) {
  const coralCards = corals.flatMap((coral) => [
    ...(coralIsStunned(coral) ? [] : [cardsById[coral.cardId]]),
    ...(coral.slots ?? []).flatMap((slot) => slot.invasiveOwner ? [] : [
      cardsById[slot.cardId],
      ...(slot.hostedCardIds ?? []).map((cardId) => cardsById[cardId]),
    ]),
  ]);
  const otherCards = habitats.map((cardId) => cardsById[cardId]);
  return calculateRpBankCap([...coralCards, ...otherCards].filter(Boolean), activeCondition);
}

function getCardPlayCost(card, activeCondition = null) {
  const baseCost = Number(card?.cost?.rp ?? 0);
  const modifier = (activeCondition?.effects ?? []).reduce((total, effect) => {
    const matchesKind = !effect.targetKind || effect.targetKind === card?.kind;
    const matchesCategory = !effect.targetCategories?.length || effect.targetCategories.includes(card?.category);
    return effect.type === EffectType.MODIFY_PLAY_COST && matchesKind && matchesCategory
      ? total + Number(effect.amount ?? 0)
      : total;
  }, 0);
  return Math.max(0, baseCost + modifier);
}

function getAutomatedHandKeepScore(cardId, { rp = 0, round = 0 } = {}) {
  const card = cardsById[cardId];
  if (!card) return -100;
  const victoryPoints = Number(card.victoryPoints?.value ?? card.victoryPoints ?? card.vp ?? 0);
  const playCost = Number(card.cost?.rp ?? 0);
  const economyValue = getCardStartTurnRp(card);
  const isBaseFoundation = isFoundationCard(card) && Number(card.stage ?? 0) === 0;
  return victoryPoints * 8
    + economyValue * 12
    + Number(card.actions?.length ?? 0) * 4
    + Number(card.passives?.length ?? 0) * 2
    + (playCost <= Number(rp) ? 9 : 0)
    + (isBaseFoundation ? (Number(round) <= 3 ? 30 : 14) : 0)
    - playCost * 0.5;
}

function applyAutomatedHandLimitToState(state, handLimit, context = {}, incomingCards = []) {
  const choice = createHandLimitChoice({ hand: state.hand, incomingCards, handLimit });
  const selectedKeys = selectAutomatedHandLimitDiscards(
    choice,
    (cardId) => getAutomatedHandKeepScore(cardId, { ...context, rp: state.rp }),
  );
  const result = resolveHandLimitChoice(choice, selectedKeys, state.discardPile);
  return {
    state: { ...state, hand: result.hand, discardPile: result.discardPile },
    cardsToDiscard: result.cardsToDiscard,
    incomingCardsToHand: result.incomingCardsToHand,
    incomingCardsToDiscard: result.incomingCardsToDiscard,
    choice,
  };
}

function getOpposingPlayCostModifier(card, opposingCorals = [], opposingReefCreatures = [], opposingOrphans = []) {
  const opposingCards = [
    ...opposingReefCreatures.map((cardId) => cardsById[cardId]),
    ...opposingOrphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])].map((cardId) => cardsById[cardId])),
    ...opposingCorals.flatMap((foundation) => [cardsById[foundation.cardId], ...foundation.slots.flatMap((slot) => getSlotCardIds(slot).map((cardId) => cardsById[cardId]))]),
  ].filter(Boolean);
  return opposingCards.reduce((total, opposingCard) => total + (opposingCard.passives ?? []).reduce((passiveTotal, passive) => {
    const effect = typeof passive === "object" ? passive.effect : null;
    if (effect?.type !== EffectType.MODIFY_PLAY_COST || effect.targetPlayer !== "opponent") return passiveTotal;
    if (effect.targetKind && effect.targetKind !== card?.kind) return passiveTotal;
    if (effect.targetCategories?.length && !effect.targetCategories.includes(card?.category)) return passiveTotal;
    return passiveTotal + Number(effect.amount ?? 0);
  }, 0), 0);
}

function getConditionPlayRestriction(card, activeCondition = null) {
  return conditionPreventsCardPlay(card, activeCondition) ? `${activeCondition.name}: ${activeCondition.text}` : "";
}

function getConditionExtraDraws(activeCondition = null) {
  return (activeCondition?.effects ?? []).reduce(
    (total, effect) => total + (effect.type === EffectType.MODIFY_TURN_DRAW ? Number(effect.amount ?? 0) : 0),
    0,
  );
}

function getUnsupportedConditionEffects(activeCondition = null) {
  const supported = new Set([
    EffectType.PREVENT_CARD_PLAY,
    EffectType.PREVENT_RP_GENERATION,
    EffectType.MODIFY_PLAY_COST,
    EffectType.MODIFY_TURN_DRAW,
    EffectType.MODIFY_RP_BANK_CAP,
    EffectType.MODIFY_SCHOOL_DENSITY_REQUIREMENT,
    "setHandLimit",
  ]);
  return (activeCondition?.effects ?? []).filter((effect) => !supported.has(effect.type));
}

function getEcosystemVictoryPoints(corals, habitats = [], reefCreatures = [], ownership = null) {
  const controller = ownership?.controller ?? null;
  const ownedSlotCardIds = corals.flatMap((coral) => (coral.slots ?? []).flatMap((slot) => {
    if (controller && slot.invasiveOwner && slot.invasiveOwner !== controller) return [];
    return getSlotCardIds(slot);
  }));
  const remotelyOwnedInvaderIds = controller
    ? getInvasiveCreatureTargets(ownership?.rivalCorals ?? [], controller).map((target) => target.cardId)
    : [];
  const locallyOwnedOrphanIds = controller
    ? getLocallyControlledOrphans(ownership?.localOrphans ?? [], controller).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])
    : [];
  const remotelyOwnedOrphanIds = controller
    ? getInvasiveOrphanTargets(ownership?.rivalOrphans ?? [], controller).map((target) => target.cardId)
    : [];
  const cardIds = [
    ...habitats,
    ...reefCreatures,
    ...corals.map((coral) => coral.cardId),
    ...ownedSlotCardIds,
    ...remotelyOwnedInvaderIds,
    ...locallyOwnedOrphanIds,
    ...remotelyOwnedOrphanIds,
  ];
  return calculateVictoryPoints(cardIds.map((cardId) => cardsById[cardId]), cardIds);
}

function ecosystemHasCard(corals, reefCreatures, cardId, orphanCreatures = []) {
  return (reefCreatures ?? []).includes(cardId)
    || orphanCreatures.some((entry) => entry.cardId === cardId || (entry.hostedCardIds ?? []).includes(cardId))
    || corals.some((coral) => coral.cardId === cardId || coral.slots.some((slot) => slot.cardId === cardId || (slot.hostedCardIds ?? []).includes(cardId)));
}

function getGlobalCoralHealthBonus(foundations) {
  return foundations.reduce((total, foundation) => total + (coralIsStunned(foundation) ? [] : cardsById[foundation.cardId]?.passives ?? []).reduce((passiveTotal, passive) => {
    const effect = typeof passive === "object" ? passive.effect : null;
    return passiveTotal + (effect?.type === EffectType.MODIFY_HEALTH && effect.targetKind === CardKind.CORAL && effect.controller === "you" ? Number(effect.amount ?? 0) : 0);
  }, 0), 0);
}

function reconcileGlobalCoralHealth(foundations, ecosystemCreatures = []) {
  const bonus = getGlobalCoralHealthBonus(foundations);
  const creatureSchools = foundations.filter((foundation) => isCreatureSchool(cardsById[foundation.cardId]));
  const territorialSources = [
    ...ecosystemCreatures.map((entry) => typeof entry === "string" ? { cardId: entry } : entry),
    ...foundations.flatMap((foundation) => foundation.slots.map((slot) => ({
      cardId: slot.cardId,
      ...(Object.prototype.hasOwnProperty.call(slot, "territorialTargetFoundationId")
        ? { territorialTargetFoundationId: slot.territorialTargetFoundationId }
        : {}),
    }))),
  ].filter((entry) => entry.cardId === "ocean-triggerfish");
  const territorialBonuses = territorialSources.reduce((bonuses, source) => {
    const hasPersistedTarget = Object.prototype.hasOwnProperty.call(source, "territorialTargetFoundationId");
    const target = hasPersistedTarget
      ? creatureSchools.find((foundation) => foundation.id === source.territorialTargetFoundationId)
      : creatureSchools[0];
    if (target) bonuses.set(target.id, Number(bonuses.get(target.id) ?? 0) + 30);
    return bonuses;
  }, new Map());
  let changed = false;
  const destroyed = [];
  const corals = foundations.map((foundation) => {
    const card = cardsById[foundation.cardId];
    if (card?.kind !== CardKind.CORAL && !isCreatureSchool(card)) return foundation;
    const attachedBonus = calculateAttachedHostHealthBonus(foundation.slots.map((slot) => cardsById[slot.cardId]).filter(Boolean));
    const totalBonus = (card.kind === CardKind.CORAL ? bonus : 0) + attachedBonus + Number(territorialBonuses.get(foundation.id) ?? 0);
    const desiredMax = Math.max(0, Number(card.health ?? 0) + totalBonus);
    const currentMax = Number(foundation.maxHealth ?? card.health ?? 0);
    if (desiredMax === currentMax) return foundation;
    changed = true;
    const reconciled = reconcileContinuousHealth(foundation.health ?? currentMax, currentMax, card.health, totalBonus);
    const next = { ...foundation, maxHealth: reconciled.maxHealth, health: reconciled.health };
    if (reconciled.destroyed) destroyed.push(next);
    return next;
  });
  return { changed, destroyed, corals: corals.filter((foundation) => !destroyed.some((entry) => entry.id === foundation.id)) };
}

function reconcileFoundationHealthToFixedPoint(foundations = [], reefCreatures = [], orphanCreatures = []) {
  let corals = foundations;
  let orphans = orphanCreatures;
  const destroyed = [];
  const destructionWaves = [];
  let changed = false;
  const maximumPasses = Math.max(2, foundations.length + 2);

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    const allUnslottedCreatures = [
      ...reefCreatures,
      ...orphans,
      ...orphans.flatMap((entry) => (entry.hostedCardIds ?? []).map((cardId) => ({ cardId }))),
    ];
    const result = reconcileGlobalCoralHealth(corals, allUnslottedCreatures);
    if (!result.changed) break;
    changed = true;
    corals = result.corals;
    if (result.destroyed.length) {
      destroyed.push(...result.destroyed);
      destructionWaves.push(result.destroyed);
      const redistributed = redistributeOrphanCreatures(corals, [...orphans, ...result.destroyed.flatMap(getOrphanEntriesFromFoundation)]);
      corals = redistributed.corals;
      orphans = redistributed.orphans;
    }
  }

  return { changed, corals, orphans, destroyed, destructionWaves };
}

function getFragmentRecoveryEffect(card) {
  return (card?.passives ?? [])
    .map((passive) => typeof passive === "object" ? passive.effect : null)
    .find((candidate) => candidate?.type === EffectType.RECOVER_CARD_FROM_DISCARD && candidate.targetCardId && candidate.destination === "hand") ?? null;
}

function getFragmentRecoveryIds(card, discard) {
  const effect = getFragmentRecoveryEffect(card);
  if (!effect) return [];
  return discard.filter((cardId) => cardId === effect.targetCardId).slice(0, Math.max(1, Number(effect.amount ?? 1)));
}

function resolveFoundationDestructionTriggers(destructionWaves = [], initialHand = [], initialDiscard = [], handLimit = Infinity) {
  return resolveDestructionRecoveryWaves(
    destructionWaves,
    initialHand,
    initialDiscard,
    handLimit,
    (foundation, discardPile) => {
      if (!coralCanUseOwnAbilities(foundation)) return null;
      const effect = getFragmentRecoveryEffect(cardsById[foundation.cardId]);
      if (!effect) return null;
      const recoveredIds = getFragmentRecoveryIds(cardsById[foundation.cardId], discardPile);
      return {
        targetCardId: effect.targetCardId,
        recoveredIds,
      };
    },
  );
}

function getSchoolDensity(foundations) {
  return foundations.reduce((total, foundation) => total + Number(cardsById[foundation.cardId]?.schoolDensity ?? 0), 0);
}

function getCompositionRequirementError(card, corals, reefCreatures = []) {
  const rules = [...(card?.playRequirements ?? []), ...(card?.specialRules ?? [])].map((rule) => typeof rule === "string" ? rule : rule?.text ?? "");
  const ecosystemCardIds = [
    ...(corals ?? []).flatMap((foundation) => [
      foundation.cardId,
      ...(foundation.slots ?? []).flatMap((slot) => getSlotCardIds(slot)),
    ]),
    ...(reefCreatures ?? []),
  ].filter(Boolean);
  const ecosystemCards = [
    ...(corals ?? []).flatMap((foundation) => (foundation.slots ?? []).flatMap((slot) => getSlotCardIds(slot).map((cardId) => cardsById[cardId]))),
    ...(reefCreatures ?? []).map((cardId) => cardsById[cardId]),
  ].filter(Boolean);
  const compositionRequirement = (card?.playRequirements ?? []).find((requirement) => requirement?.type === "ecosystemComposition");
  if (compositionRequirement) {
    const composition = evaluateHabitatComposition(card, ecosystemCardIds, cardsById);
    const labels = card.id === "open-ocean"
      ? { creatureSchools: "Creature Schools", fish: "Oceanic Fish", invertebrates: "Oceanic Invertebrates" }
      : card.id === "abyss"
        ? { corals: "Deep Corals", fish: "Deep Fish", invertebrates: "Deep Invertebrates" }
        : { corals: "Reef Corals", fish: "Reef Fish", invertebrates: "Reef Invertebrates" };
    const missing = Object.entries(composition.required)
      .filter(([key, required]) => Number(composition.counts[key] ?? 0) < Number(required))
      .map(([key, required]) => `${required} ${labels[key] ?? key} (you have ${composition.counts[key] ?? 0})`);
    if (missing.length) return `${card.name} requires ${missing.join(", ")}.`;
  }
  const oceanicFishCount = ecosystemCards.filter((candidate) => candidate.category === CardCategory.FISH && candidate.tags?.includes("oceanic")).length;
  const oceanicPredatorCount = ecosystemCards.filter((candidate) => candidate.category === CardCategory.PREDATOR && candidate.tags?.includes("oceanic")).length;
  const oceanicApexCount = ecosystemCards.filter((candidate) => candidate.category === CardCategory.APEX && candidate.tags?.includes("oceanic")).length;
  const fishRequirement = rules.map((rule) => rule.match(/requires?\s+(\d+)\s+oceanic fish/i)).find(Boolean);
  if (fishRequirement && oceanicFishCount < Number(fishRequirement[1])) return `${card.name} requires ${fishRequirement[1]} Oceanic Fish in your ecosystem; you have ${oceanicFishCount}.`;
  if (rules.some((rule) => /requires? an oceanic predator or oceanic apex/i.test(rule)) && oceanicPredatorCount + oceanicApexCount < 1) return `${card.name} requires an Oceanic Predator or Oceanic Apex in your ecosystem.`;
  if (rules.some((rule) => /discard one oceanic predator or two oceanic fish/i.test(rule)) && oceanicPredatorCount < 1 && oceanicFishCount < 2) return `${card.name} requires an Oceanic Predator or two Oceanic Fish in your ecosystem to discard as its additional play cost.`;
  return "";
}

function getOceanicPlaySacrifices(card, corals, reefCreatures = [], orphanCreatures = []) {
  const requiresSacrifice = (card?.specialRules ?? []).some((rule) => /discard one oceanic predator or two oceanic fish/i.test(typeof rule === "string" ? rule : rule?.text ?? ""));
  if (!requiresSacrifice) return [];
  const entries = [
    ...(corals ?? []).flatMap((coral) => (coral.slots ?? []).filter((slot) => slot.cardId && !slot.invasiveOwner).map((slot) => ({ card: cardsById[slot.cardId], cardId: slot.cardId, coralId: coral.id, slotId: slot.id, reefIndex: -1 }))),
    ...(reefCreatures ?? []).map((cardId, reefIndex) => ({ card: cardsById[cardId], cardId, coralId: null, slotId: null, reefIndex })),
    ...(orphanCreatures ?? []).flatMap((entry, orphanIndex) => entry.invasiveOwner ? [] : [{ card: cardsById[entry.cardId], cardId: entry.cardId, coralId: null, slotId: null, reefIndex: -1, orphanIndex }]),
  ].filter((entry) => entry.card?.tags?.includes("oceanic"));
  const predator = entries.find((entry) => entry.card.category === CardCategory.PREDATOR);
  if (predator) return [predator];
  return entries.filter((entry) => entry.card.category === CardCategory.FISH).slice(0, 2);
}

function createCoralId(cardId) {
  return `${cardId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createStableInstanceId(prefix) {
  return createCoralId(prefix);
}

function reconcileHabitatZone(currentInstances = [], nextEntries = []) {
  const used = new Set();
  return nextEntries.map((entry) => {
    const cardId = typeof entry === "string" ? entry : entry.cardId;
    if (entry?.instanceId) {
      if (used.has(entry.instanceId)) throw new Error(`Duplicate habitat instanceId: ${entry.instanceId}`);
      used.add(entry.instanceId);
      return entry;
    }
    const existing = currentInstances.find((candidate) => candidate.cardId === cardId && !used.has(candidate.instanceId));
    if (existing) {
      used.add(existing.instanceId);
      return existing;
    }
    return createHabitatInstance(cardId, createStableInstanceId(`habitat-${cardId}`), cardsById);
  });
}

function reconcileCreatureZone(currentInstances = [], nextEntries = [], prefix = "creature") {
  const used = new Set();
  return nextEntries.map((entry) => {
    const cardId = typeof entry === "string" ? entry : entry.cardId;
    if (entry?.instanceId) {
      if (used.has(entry.instanceId)) throw new Error(`Duplicate creature instanceId: ${entry.instanceId}`);
      used.add(entry.instanceId);
      return entry;
    }
    const existing = currentInstances.find((candidate) => candidate.cardId === cardId && !used.has(candidate.instanceId));
    if (existing) {
      used.add(existing.instanceId);
      return existing;
    }
    return createCreatureInstance(cardId, createStableInstanceId(`${prefix}-${cardId}`), typeof entry === "object" ? entry : {});
  });
}

function reconcileOpponentInstances(current, next) {
  const habitatInstanceIds = (next?.habitatInstances ?? []).map((instance) => instance.cardId);
  const habitatIds = next?.habitats ?? habitatInstanceIds;
  const reefInstanceIds = (next?.reefCreatureInstances ?? []).map((instance) => instance.cardId);
  const reefIds = next?.reefCreatures ?? reefInstanceIds;
  const sameCardOrder = (left, right) => left.length === right.length && left.every((cardId, index) => cardId === right[index]);
  const habitatSource = next?.habitatInstances?.length && sameCardOrder(habitatInstanceIds, habitatIds) ? next.habitatInstances : habitatIds;
  const reefSource = next?.reefCreatureInstances?.length && sameCardOrder(reefInstanceIds, reefIds) ? next.reefCreatureInstances : reefIds;
  const habitatInstances = reconcileHabitatZone(current?.habitatInstances ?? [], habitatSource);
  const reefCreatureInstances = reconcileCreatureZone(current?.reefCreatureInstances ?? [], reefSource, "opponent-reef");
  const orphanCreatures = reconcileCreatureZone(current?.orphanCreatures ?? [], next?.orphanCreatures ?? [], "opponent-orphan");
  return {
    ...next,
    habitats: habitatInstances.map((instance) => instance.cardId),
    habitatInstances,
    reefCreatures: reefCreatureInstances.map((instance) => instance.cardId),
    reefCreatureInstances,
    orphanCreatures,
  };
}

function createCoralSlots(card, coralId, idPrefix = coralId) {
  return (card.slots ?? []).flatMap((slot, index) => {
    const count = slot.count ?? 1;
    return Array.from({ length: count }).map((_, slotIndex) => ({
      ...slot,
      count: 1,
      id: `${idPrefix}-${index}-${slotIndex}`,
      cardId: null,
      cardInstanceId: null,
      hostedCardIds: [],
      position: null,
    }));
  });
}

function getSlotIdentity(slot) {
  const zone = slot.zone ?? "reef";
  const slotClass = slot.slotClass ?? slot.slotType ?? slot.class ?? "any";
  return `${zone}:${slotClass}`;
}

function mergeUpgradedCoralSlots(existingSlots, nextCard, coralId) {
  const nextSlots = createCoralSlots(nextCard, coralId, `${coralId}-${nextCard.id}`);
  const unusedExistingSlots = [...existingSlots];

  const mergedSlots = nextSlots.map((nextSlot) => {
    const matchingIndex = unusedExistingSlots.findIndex(
      (existingSlot) => getSlotIdentity(existingSlot) === getSlotIdentity(nextSlot),
    );
    if (matchingIndex === -1) return nextSlot;

    const [existingSlot] = unusedExistingSlots.splice(matchingIndex, 1);
    return {
      ...nextSlot,
      id: existingSlot.id,
      cardId: existingSlot.cardId,
      cardInstanceId: existingSlot.cardInstanceId ?? null,
      hostedCardIds: existingSlot.hostedCardIds ?? [],
      position: existingSlot.position,
      ...(Object.prototype.hasOwnProperty.call(existingSlot, "controller") ? { controller: existingSlot.controller } : {}),
      ...(Object.prototype.hasOwnProperty.call(existingSlot, "invasiveOwner") ? { invasiveOwner: existingSlot.invasiveOwner } : {}),
    };
  });

  return [...mergedSlots, ...unusedExistingSlots.filter((slot) => slot.cardId)];
}

function removeOneCard(cards, cardId) {
  const index = cards.indexOf(cardId);
  if (index === -1) return cards;
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
}

function removeLastCard(cards, cardId) {
  const index = cards.lastIndexOf(cardId);
  if (index === -1) return cards;
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
}

function getPlacementCoordinates(event, zoom, offset) {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const worldX = centerX + (screenX - centerX - offset.x) / zoom;
  const worldY = centerY + (screenY - centerY - offset.y) / zoom;
  return {
    x: (worldX / rect.width) * 100,
    y: (worldY / rect.height) * 100,
  };
}

function getBracketSlotPositions(count) {
  // place anchors evenly around the coral in a circle to avoid overlap
  const positions = [];
  const radiusBase = 150; // percent of the coral box, larger to keep anchors outside the card frame
  const radius = radiusBase + Math.max(0, count - 4) * 10;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // start at top
    const left = 50 + Math.cos(angle) * radius;
    const top = 50 + Math.sin(angle) * radius;
    positions.push({ top: `${top}%`, left: `${left}%` });
  }
  return positions;
}

function getOpponentSlotPositions(count) {
  const positions = [];
  const radius = 105 + Math.max(0, count - 4) * 8;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      top: `${50 + Math.sin(angle) * radius}%`,
      left: `${50 + Math.cos(angle) * radius}%`,
    });
  }
  return positions;
}

function getOpponentCoralGridOffset(index, total) {
  if (total <= 1) return { x: 0, y: 0 };
  const columns = Math.min(3, total);
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const firstIndexInRow = row * columns;
  const itemsInRow = Math.min(columns, total - firstIndexInRow);
  const column = index - firstIndexInRow;
  return {
    x: (column - (itemsInRow - 1) / 2) * 700,
    y: (row - (rows - 1) / 2) * 780,
  };
}

function getSlotIconPath(slot) {
  if (!slot) return "/images/icons/any-creature.png";
  const rawZone = slot.zone ? slot.zone.replace("your_", "").replace("opponent_", "") : "reef";
  const zone = rawZone === "ocean" ? "oceanic" : rawZone;
  const cls = slot.slotClass || slot.slotType || slot.class || "any";

  if (cls === "any") return "/images/icons/any-creature.png";
  if (cls === "filter-feeder") return "/images/icons/filter-feeder-any.png";

  if (zone && cls) {
    if (zone === "reef" && cls === "apex") {
      return "/images/icons/reef-apex_icon.png";
    }
    return `/images/icons/${zone}-${cls}-icon.png`;
  }

  if (cls) {
    if (cls === "apex") return "/images/icons/apex-any.png";
    return `/images/icons/${cls}-icon.png`;
  }

  return "/images/icons/any-creature.png";
}

function getSlotConnectorStyle(position) {
  const dx = Number(position.left.replace("%", "")) - 50;
  const dy = Number(position.top.replace("%", "")) - 50;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  return {
    width: `${distance}%`,
    height: "2px",
    top: `${50 + dy / 2}%`,
    left: `${50 + dx / 2}%`,
    transform: `translateX(-50%) rotate(${angle}rad)`,
  };
}

function OpeningCoinVisual({ mode = "landed", side = "heads", onAnimationEnd = null, label = "" }) {
  const normalizedSide = side === "tails" ? "tails" : "heads";
  const motionClass = mode === "flipping"
    ? `seapals-opening-coin-flipping-${normalizedSide}`
    : mode === "ready"
      ? `seapals-opening-coin-ready-${normalizedSide}`
      : `seapals-opening-coin-landed-${normalizedSide}`;
  return (
    <div
      className="seapals-opening-coin-stage"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <div className={`seapals-opening-coin ${motionClass}`} onAnimationEnd={onAnimationEnd ?? undefined}>
        <span className="seapals-opening-coin-face seapals-opening-coin-heads"><strong>H</strong><span>Heads</span></span>
        <span className="seapals-opening-coin-face seapals-opening-coin-tails"><strong>T</strong><span>Tails</span></span>
      </div>
      <span className={`seapals-opening-coin-shadow${mode === "flipping" ? " seapals-opening-coin-shadow-flipping" : ""}`} />
    </div>
  );
}

export default function Simulator({
  storyMode = null,
  initialDeckId = null,
  accessibilitySettings = null,
  onOpenAccessibilitySettings = null,
} = {}) {
  const isStoryMode = Boolean(storyMode);
  const tutorialRuntime = storyMode?.tutorial ?? null;
  const accessibilityTextSpeed = ["slow", "normal", "fast", "instant"].includes(accessibilitySettings?.textSpeed)
    ? accessibilitySettings.textSpeed
    : "normal";
  const accessibilityReducedMotion = accessibilitySettings?.reducedMotion === true;
  const accessibilityHighContrast = accessibilitySettings?.highContrast === true;
  const [storyPlayerDeckSnapshot] = useState(() => (
    storyMode?.playerDeckSnapshot
      ? resolveStoryPlayerDeckSnapshot(
          storyMode.playerDeckSnapshot,
          cardsById,
          storyMode.playerDeckId,
        )
      : null
  ));
  const storyPlayerDeckId = storyPlayerDeckSnapshot?.id ?? storyMode?.playerDeckId ?? defaultDeckId;
  const storyOpponentDeckId = storyMode?.opponentDeckId ?? defaultDeckId;
  const storyVictoryTarget = Math.max(1, Number(storyMode?.victoryTarget) || 10);
  const storyDifficulty = normalizeOpponentDifficulty(storyMode?.difficulty ?? OpponentDifficulty.MEDIUM);
  const storyOpponentName = String(storyMode?.opponentName ?? "Rival").trim() || "Rival";
  const storyReturnLabel = String(storyMode?.returnLabel ?? "Town").trim() || "Town";
  const normalInitialDeckId = resolveSimulatorDeckId(initialDeckId);
  const initialPlayerDeckId = isStoryMode ? storyPlayerDeckId : normalInitialDeckId;
  const initialOpponentDeckId = isStoryMode ? storyOpponentDeckId : defaultDeckId;
  const initialPlayerDeckName =
    getPlayableDeckById(initialPlayerDeckId)?.name ??
    initialPlayerDeckId;
  const initialVictoryTarget = isStoryMode ? storyVictoryTarget : 30;
  const initialOpponentDifficulty = isStoryMode ? storyDifficulty : OpponentDifficulty.MEDIUM;
  const opponentHudLabel = isStoryMode ? storyOpponentName : "Rival Reef";
  const [tutorialContract] = useState(() => tutorialRuntime
    ? createSimulatorTutorialContract(tutorialRuntime.contract ?? tutorialRuntime)
    : null);
  const tutorialUsesScriptedScenario = Boolean(tutorialRuntime && tutorialRuntime.scriptedDecks !== false);
  const scriptedFoundationLessonCardId = tutorialUsesScriptedScenario
    ? getScriptedTutorialFoundationDrawCardId(storyPlayerDeckId)
    : null;
  const [tutorialProgress, setTutorialProgress] = useState(() => tutorialContract
    ? createSimulatorTutorialProgress(tutorialContract, tutorialRuntime?.initialProgress ?? {})
    : null);
  const tutorialGuide = {
    name: String(tutorialRuntime?.guide?.name ?? "").trim() || "Mr. Easterling",
    role: String(tutorialRuntime?.guide?.role ?? "").trim() || "Aquarium Project Lead",
    portraitSrc: String(tutorialRuntime?.guide?.portraitSrc ?? "").trim() || "/images/adventure/mr-easterling-portrait-v2.webp",
    textSpeed: accessibilityTextSpeed,
    reducedMotion: accessibilityReducedMotion,
  };
  const [tutorialHelpDismissedId, setTutorialHelpDismissedId] = useState(null);
  const [tutorialBoardTourStep, setTutorialBoardTourStep] = useState(null);
  const [tutorialLayoutProgress, setTutorialLayoutProgress] = useState(
    createGuidedAcademyLayoutProgress,
  );
  const tutorialProgressRef = useRef(tutorialProgress);
  const tutorialEventIdRef = useRef(0);
  const tutorialCallbacksRef = useRef(tutorialRuntime);
  tutorialCallbacksRef.current = tutorialRuntime;
  const [initialGame] = useState(() => createInitialGameState(
    initialPlayerDeckId,
    initialOpponentDeckId,
    createSeededRandom(0x5ea9a15),
    {
      scriptedTutorial: tutorialUsesScriptedScenario,
      playerDeckSnapshot: isStoryMode ? storyPlayerDeckSnapshot : null,
    },
  ));
  const [scriptedTutorialScenario, setScriptedTutorialScenario] = useState(
    initialGame.scriptedTutorialScenario,
  );
  const tutorialVpRef = useRef({
    player: 0,
    opponent: getEcosystemVictoryPoints(
      initialGame.opponent.corals,
      initialGame.opponent.habitats,
      [
        ...initialGame.opponent.reefCreatures,
        ...(initialGame.opponent.orphanCreatures ?? []).flatMap((entry) => [
          entry.cardId,
          ...(entry.hostedCardIds ?? []),
        ]),
      ],
    ),
  });
  const [selectedDeckId, setSelectedDeckId] = useState(initialPlayerDeckId);
  const [selectedOpponentDeckId, setSelectedOpponentDeckId] = useState(initialOpponentDeckId);
  const [opponentDifficulty, setOpponentDifficulty] = useState(initialOpponentDifficulty);
  const [pendingOpponentDifficulty, setPendingOpponentDifficulty] = useState(initialOpponentDifficulty);
  const [victoryTarget, setVictoryTarget] = useState(initialVictoryTarget);
  const [pendingVictoryTarget, setPendingVictoryTarget] = useState(initialVictoryTarget);
  const [foundationDeck, setFoundationDeck] = useState(initialGame.foundationDeck);
  const [palsDeck, setPalsDeck] = useState(initialGame.palsDeck);
  const [hand, setHand] = useState(initialGame.hand);
  const [playerCorals, setPlayerCorals] = useState([]);
  const [playerHabitatInstances, setPlayerHabitatInstances] = useState([]);
  const [playerReefCreatureInstances, setPlayerReefCreatureInstances] = useState([]);
  const [playerOrphanCreatureInstances, setPlayerOrphanCreatureInstances] = useState([]);
  const [bubbleBursts, setBubbleBursts] = useState([]);
  const [opponent, setOpponentState] = useState(() => reconcileOpponentInstances(initialGame.opponent, initialGame.opponent));
  const [opponentThinking, setOpponentThinking] = useState(false);
  const opponentThinkingTimerRef = useRef(null);
  const resolveOpponentTurnRef = useRef(null);
  const [draggingCoralId, setDraggingCoralId] = useState(null);
  const [slotDragStart, setSlotDragStart] = useState(null);
  const [coralDragStart, setCoralDragStart] = useState(null);
  const [floatingCardOffsets, setFloatingCardOffsets] = useState({});
  const [floatingCardDrag, setFloatingCardDrag] = useState(null);
  const floatingCardWasDraggedRef = useRef(false);
  const [ecosystemZoom, setEcosystemZoom] = useState(1);
  const [ecosystemOffset, setEcosystemOffset] = useState({ x: 0, y: 0 });
  const [opponentEcosystemZoom, setOpponentEcosystemZoom] = useState(1);
  const [opponentEcosystemOffset, setOpponentEcosystemOffset] = useState({ x: 0, y: 0 });
  const [opponentViewportTouched, setOpponentViewportTouched] = useState(false);
  const [mobileBoardView, setMobileBoardView] = useState("player");
  const [mobileHudPanel, setMobileHudPanel] = useState(null);
  const ecosystemRef = useRef(null);
  const opponentEcosystemRef = useRef(null);
  const coralWasDraggedRef = useRef(false);
  const slotWasDraggedRef = useRef(false);
  const slotDragStartRef = useRef(null);
  const bubbleBurstIdRef = useRef(0);
  const bubbleBurstTimersRef = useRef(new Set());
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [isOpponentPanning, setIsOpponentPanning] = useState(false);
  const [opponentPanStart, setOpponentPanStart] = useState(null);
  const [discardPile, setDiscardPile] = useState([]);
  const [lostZone, setLostZone] = useState([]);
  const [conditionDeck, setConditionDeck] = useState(initialGame.conditionDeck);
  const [activeConditionId, setActiveConditionId] = useState(null);
  const [persistentConditionIds, setPersistentConditionIds] = useState([]);
  const [conditionDensityUses, setConditionDensityUses] = useState({});
  const [schoolDensityCommitmentsByInstanceId, setSchoolDensityCommitmentsByInstanceId] = useState({});
  const [blueCrabRecycleUsedTurn, setBlueCrabRecycleUsedTurn] = useState(null);
  const [resilienceUsedCardIds, setResilienceUsedCardIds] = useState([]);
  const [round, setRound] = useState(0);
  const [gamePhase, setGamePhase] = useState("setup");
  const [startingPlayer, setStartingPlayer] = useState(null);
  const [openingOpponentTurn, setOpeningOpponentTurn] = useState(false);
  const [roundFlash, setRoundFlash] = useState(false);
  const [turn, setTurn] = useState(1);
  const [rp, setRp] = useState(3);
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState(false);
  const [turnDrawSelection, setTurnDrawSelection] = useState(null);
  const [turnDrawResult, setTurnDrawResult] = useState(null);
  const [actionBlinkOn, setActionBlinkOn] = useState(true);
  const [modal, setModal] = useState(null);
  const [selectedHandCard, setSelectedHandCard] = useState(null);
  const [handPopoverCardId, setHandPopoverCardId] = useState(null);
  const [playingCardId, setPlayingCardId] = useState(null);
  const [playError, setPlayError] = useState("");
  const [usedAttackers, setUsedAttackers] = useState([]);
  const [actionCooldowns, setActionCooldowns] = useState({});
  const [usedCreatureActions, setUsedCreatureActions] = useState([]);
  const [pendingCreatureAction, setPendingCreatureAction] = useState(null);
  const [creatureStatuses, setCreatureStatuses] = useState({});
  const [poisonImmunityNextPredatorAttack, setPoisonImmunityNextPredatorAttack] = useState(false);
  const [rovLightsActive, setRovLightsActive] = useState(false);
  const [nextOnPlayAttackBonus, setNextOnPlayAttackBonus] = useState(null);
  const [flashingAlarmAttackBonus, setFlashingAlarmAttackBonus] = useState(null);
  const [supportLockSourceId, setSupportLockSourceId] = useState(null);
  const [supportBlockedUntilRound, setSupportBlockedUntilRound] = useState(0);
  const [cardsBlockedFromPlayThisTurn, setCardsBlockedFromPlayThisTurn] = useState([]);
  const [attackContext, setAttackContext] = useState(null);
  const [searchContext, setSearchContext] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [tutorialExitConfirmationOpen, setTutorialExitConfirmationOpen] = useState(false);
  const tutorialHistoryGuardRef = useRef(null);
  const storyResultRecordedRef = useRef(false);
  const openingCoinFlipIdRef = useRef(0);
  const openingCoinFlipActiveRef = useRef(false);
  const inspectorReturnFocusRef = useRef(null);
  const [inspectedCard, setInspectedCard] = useState(null);
  const handLimitChoiceIdRef = useRef(0);
  const [handLimitDiscardSelection, setHandLimitDiscardSelection] = useState([]);
  const [eventOverlay, setEventOverlay] = useState(() => ({
    type: "new-game-setup",
    initial: true,
    title: isStoryMode ? `${storyOpponentName} challenges you!` : "Welcome to the SeaPals Simulator",
    message: isStoryMode
      ? `${storyOpponentName} is ready for a SeaPals duel. Build your ecosystem and be the first to reach ${storyVictoryTarget} VP.`
      : `Your ${initialPlayerDeckName} is selected. Choose an opponent deck and victory target, then begin the setup round with four Foundation and four Pals cards.`,
  }));
  useEffect(() => {
    if (eventOverlay?.type !== OpeningCoinPhase.FLIPPING) return undefined;
    const flipId = eventOverlay.flipId;
    const systemReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const revealTimer = window.setTimeout(() => {
      if (openingCoinFlipIdRef.current !== flipId) return;
      openingCoinFlipActiveRef.current = false;
      setEventOverlay((currentOverlay) => {
        if (currentOverlay?.type !== OpeningCoinPhase.FLIPPING || currentOverlay.flipId !== flipId) {
          return currentOverlay;
        }
        return createOpeningCoinResultOverlay({
          result: {
            call: currentOverlay.coinCall,
            landed: currentOverlay.coinLanded,
            winner: currentOverlay.coinWinner,
          },
          opponentName: isStoryMode ? storyOpponentName : "The opponent",
        });
      });
    }, getOpeningCoinFlipRevealDelay({
      reducedMotion: accessibilityReducedMotion || systemReducedMotion,
    }));
    return () => window.clearTimeout(revealTimer);
  }, [accessibilityReducedMotion, eventOverlay?.flipId, eventOverlay?.type, isStoryMode, storyOpponentName]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [faceoffRolling, setFaceoffRolling] = useState(false);
  const [faceoffPreview, setFaceoffPreview] = useState(null);
  const [log, setLog] = useState([
    `New ${initialPlayerDeckName} game started. Setup: play a base Coral or Creature School using your 3 RP.`,
  ]);
  const [turnLog, setTurnLog] = useState(["Setup began with 3 RP and an eight-card hand."]);
  const opponentDifficultyProfile = getOpponentDifficultyProfile(opponentDifficulty);
  const storyPlayerDeckName = storyPlayerDeckSnapshot?.name
    ?? getPlayableDeckById(storyPlayerDeckId)?.name
    ?? storyPlayerDeckId;
  const storyOpponentDeckName = getPlayableDeckById(storyOpponentDeckId)?.name ?? storyOpponentDeckId;
  const selectedPlayerDeck = prebuiltDecks.find(
    (deck) => deck.id === selectedDeckId,
  );

  const playerHabitats = playerHabitatInstances.map((instance) => instance.cardId);
  const playerReefCreatures = playerReefCreatureInstances.map((instance) => instance.cardId);
  const playerOrphanCreatures = playerOrphanCreatureInstances;

  const getPlayerReefSlotId = (index) => `reef-${playerReefCreatureInstances[index]?.instanceId ?? index}`;
  const getOpponentReefSlotId = (index) => `reef-${opponent.reefCreatureInstances?.[index]?.instanceId ?? index}`;
  const getPlayerOrphanSlotId = (index) => `orphan-${playerOrphanCreatures[index]?.instanceId ?? index}`;
  const getOpponentOrphanSlotId = (index) => `orphan-${opponent.orphanCreatures?.[index]?.instanceId ?? index}`;
  const findZoneIndexBySlotId = (instances, slotId, prefix) => {
    const identity = String(slotId).slice(prefix.length);
    const stableIndex = (instances ?? []).findIndex((instance) => instance?.instanceId === identity);
    if (stableIndex >= 0) return stableIndex;
    const legacyIndex = Number(identity);
    return Number.isInteger(legacyIndex) ? legacyIndex : -1;
  };

  function setPlayerHabitats(update) {
    setPlayerHabitatInstances((current) => {
      const currentIds = current.map((instance) => instance.cardId);
      const nextEntries = typeof update === "function" ? update(currentIds) : update;
      return reconcileHabitatZone(current, nextEntries ?? []);
    });
  }

  function setPlayerReefCreatures(update) {
    setPlayerReefCreatureInstances((current) => {
      const currentIds = current.map((instance) => instance.cardId);
      const nextEntries = typeof update === "function" ? update(currentIds) : update;
      return reconcileCreatureZone(current, nextEntries ?? [], "player-reef");
    });
  }

  function setPlayerOrphanCreatures(update) {
    setPlayerOrphanCreatureInstances((current) => {
      const nextEntries = typeof update === "function" ? update(current) : update;
      return reconcileCreatureZone(current, nextEntries ?? [], "player-orphan");
    });
  }

  function queueBubbleBurst(x, y) {
    const id = ++bubbleBurstIdRef.current;
    const burst = {
      id,
      x: Math.min(96, Math.max(4, Number(x) || 50)),
      y: Math.min(92, Math.max(8, Number(y) || 50)),
    };
    setBubbleBursts((current) => [...current, burst]);
    const timer = window.setTimeout(() => {
      setBubbleBursts((current) => current.filter((entry) => entry.id !== id));
      bubbleBurstTimersRef.current.delete(timer);
    }, 2300);
    bubbleBurstTimersRef.current.add(timer);
  }

  function queueBubbleBurstAtClientPoint(clientX, clientY) {
    const ecosystem = ecosystemRef.current;
    if (!ecosystem) return;
    const rect = ecosystem.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    queueBubbleBurst(
      ((clientX - rect.left) / rect.width) * 100,
      ((clientY - rect.top) / rect.height) * 100,
    );
  }

  function queueBubbleBurstForSlot(slotId) {
    const ecosystem = ecosystemRef.current;
    if (!ecosystem) return;
    const slotElement = [...ecosystem.querySelectorAll("[data-slot-id]")]
      .find((element) => element.dataset.slotId === slotId);
    if (!slotElement) return;
    const ecosystemRect = ecosystem.getBoundingClientRect();
    const slotRect = slotElement.getBoundingClientRect();
    queueBubbleBurst(
      ((slotRect.left + slotRect.width / 2 - ecosystemRect.left) / ecosystemRect.width) * 100,
      ((slotRect.top + slotRect.height / 2 - ecosystemRect.top) / ecosystemRect.height) * 100,
    );
  }

  useEffect(() => () => {
    bubbleBurstTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    bubbleBurstTimersRef.current.clear();
  }, []);

  function projectNormalizedPlayerState(projectedState) {
    const projectedCorals = projectedState.corals ?? playerCorals;
    const projectedReefInstances = projectedState.reefCreatureInstances ?? playerReefCreatureInstances;
    const projectedOrphans = projectedState.orphanCreatureInstances ?? playerOrphanCreatureInstances;
    const healthResult = reconcileFoundationHealthToFixedPoint(projectedCorals, projectedReefInstances, projectedOrphans);
    const projectedHabitatCardIds = projectedState.habitatInstances?.map((instance) => instance.cardId)
      ?? projectedState.habitats
      ?? playerHabitats;
    const projectedOtherCards = [
      ...projectedHabitatCardIds,
      ...projectedReefInstances.map((instance) => instance.cardId),
      ...healthResult.orphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ];
    const projectedRp = Number(projectedState.rp ?? rp);
    const nextRp = Math.min(projectedRp, getEcosystemRpCap(healthResult.corals, projectedOtherCards, activeCondition));
    if (!healthResult.changed && nextRp === projectedRp) return { state: projectedState, collateral: null };
    if (!healthResult.destroyed.length) return { state: { ...projectedState, corals: healthResult.corals, rp: nextRp }, collateral: null };
    const projectedHand = projectedState.hand ?? hand;
    const triggerResult = resolveFoundationDestructionTriggers(healthResult.destructionWaves, projectedHand, projectedState.discardPile ?? discardPile, Infinity);
    return {
      state: {
        ...projectedState,
        corals: healthResult.corals,
        orphanCreatureInstances: healthResult.orphans,
        hand: triggerResult.hand,
        discardPile: triggerResult.discardPile,
        rp: nextRp,
      },
      collateral: {
        owner: "player",
        destroyed: healthResult.destroyed.map(({ id, cardId }) => ({ id, cardId })),
        orphanCount: healthResult.orphans.length,
        fragmentTriggers: triggerResult.triggers,
        rpLost: Math.max(0, projectedRp - nextRp),
      },
    };
  }

  function normalizeProjectedPlayerState(projectedState) {
    return projectNormalizedPlayerState(projectedState).state;
  }

  function projectNormalizedOpponentState(projectedState) {
    const healthResult = reconcileFoundationHealthToFixedPoint(projectedState.corals ?? [], projectedState.reefCreatureInstances ?? projectedState.reefCreatures ?? [], projectedState.orphanCreatures ?? []);
    const opponentHabitatCardIds = projectedState.habitatInstances?.map((instance) => instance.cardId)
      ?? projectedState.habitats
      ?? [];
    const opponentOtherCards = [
      ...opponentHabitatCardIds,
      ...(projectedState.reefCreatures ?? []),
      ...healthResult.orphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ];
    const projectedRp = Number(projectedState.rp ?? 0);
    const nextRp = Math.min(projectedRp, getEcosystemRpCap(healthResult.corals, opponentOtherCards, activeCondition));
    if (!healthResult.changed && nextRp === projectedRp) return { state: projectedState, collateral: null };
    if (!healthResult.destroyed.length) return { state: { ...projectedState, corals: healthResult.corals, rp: nextRp }, collateral: null };
    const handLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
    const triggerResult = resolveFoundationDestructionTriggers(healthResult.destructionWaves, projectedState.hand ?? [], projectedState.discardPile ?? [], handLimit);
    return {
      state: {
        ...projectedState,
        corals: healthResult.corals,
        orphanCreatures: healthResult.orphans,
        hand: triggerResult.hand,
        discardPile: triggerResult.discardPile,
        rp: nextRp,
      },
      collateral: {
        owner: "opponent",
        destroyed: healthResult.destroyed.map(({ id, cardId }) => ({ id, cardId })),
        orphanCount: healthResult.orphans.length,
        fragmentTriggers: triggerResult.triggers,
        rpLost: Math.max(0, projectedRp - nextRp),
      },
    };
  }

  function normalizeProjectedOpponentState(projectedState) {
    return projectNormalizedOpponentState(projectedState).state;
  }

  function getContinuousHealthCollapseMessage(collateral) {
    if (!collateral?.destroyed?.length) return "";
    const ownerLabel = collateral.owner === "player" ? "Your" : "The opponent's";
    const names = collateral.destroyed.map((entry) => cardsById[entry.cardId]?.name ?? "foundation card");
    const destroyedNames = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    const foundationLabel = names.length === 1 ? "foundation" : "foundations";
    const fragmentMessages = (collateral.fragmentTriggers ?? []).map((trigger) => {
      const recoveredName = cardsById[trigger.targetCardId]?.name ?? "matching card";
      if (trigger.cardsToHand.length) return `Fragment returned ${trigger.cardsToHand.length} ${recoveredName}${trigger.cardsToHand.length === 1 ? "" : " cards"} to hand.`;
      if (trigger.cardsToDiscard.length) return `Fragment found ${recoveredName}, but the active hand limit kept it in discard.`;
      return `Fragment triggered but found no ${recoveredName} in discard.`;
    });
    const orphanMessage = collateral.orphanCount
      ? `${collateral.orphanCount} creature${collateral.orphanCount === 1 ? "" : "s"} now remain orphaned on ${collateral.owner === "player" ? "your" : "the opponent's"} reef.`
      : "All attached creatures found another legal space.";
    const rpMessage = collateral.rpLost ? ` The RP bank cap also fell, returning ${collateral.rpLost} excess RP.` : "";
    return `${ownerLabel} ${foundationLabel} ${destroyedNames} collapsed because a continuous health bonus ended. ${orphanMessage}${rpMessage}${fragmentMessages.length ? ` ${fragmentMessages.join(" ")}` : ""}`;
  }

  function buildContinuousHealthCollapseEvent(collateral, { sourceCardId = null, playerStateAfter = null, opponentStateAfter = null, opponentSequence = false } = {}) {
    if (!collateral?.destroyed?.length) return null;
    const isPlayer = collateral.owner === "player";
    const message = getContinuousHealthCollapseMessage(collateral);
    return {
      type: "opponent-impact",
      sourceCardId: sourceCardId ?? collateral.destroyed[0].cardId,
      defenderCardId: sourceCardId ? collateral.destroyed[0].cardId : null,
      title: isPlayer ? "Your Foundation Collapsed" : "Opponent Foundation Collapsed",
      message,
      success: !isPlayer,
      playerStateAfter,
      opponentStateAfter,
      logMessage: message,
      opponentSequence,
    };
  }

  function setOpponent(update) {
    setOpponentState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      return normalizeProjectedOpponentState(reconcileOpponentInstances(current, next));
    });
  }

  useEffect(() => () => {
    if (opponentThinkingTimerRef.current) clearTimeout(opponentThinkingTimerRef.current);
  }, []);

  useEffect(() => {
    const replaceCardArt = (image) => {
      if (!(image instanceof HTMLImageElement) || !image.closest(".seapals-game-shell") || image.dataset.cardArtFallback === "true") return;
      image.dataset.cardArtFallback = "true";
      image.src = CARD_ART_FALLBACK;
    };
    const replaceMissingCardArt = (event) => replaceCardArt(event.target);
    const watchImage = (image) => {
      if (!(image instanceof HTMLImageElement) || image.dataset.cardArtWatched === "true") return;
      image.dataset.cardArtWatched = "true";
      image.addEventListener("error", replaceMissingCardArt, { once: true });
      if (image.complete && image.naturalWidth === 0) replaceCardArt(image);
    };
    const replaceAlreadyBrokenCardArt = () => document.querySelectorAll(".seapals-game-shell img").forEach((image) => {
      watchImage(image);
    });
    document.addEventListener("error", replaceMissingCardArt, true);
    const imageObserver = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches("img")) watchImage(node);
      node.querySelectorAll?.("img").forEach(watchImage);
    })));
    const shell = document.querySelector(".seapals-game-shell");
    if (shell) imageObserver.observe(shell, { childList: true, subtree: true });
    const scanTimer = window.setTimeout(replaceAlreadyBrokenCardArt, 300);
    return () => {
      document.removeEventListener("error", replaceMissingCardArt, true);
      imageObserver.disconnect();
      window.clearTimeout(scanTimer);
    };
  }, []);

  useEffect(() => {
    resolveOpponentTurnRef.current = resolveOpponentTurn;
  });

  const activeCondition = activeConditionId ? cardsById[activeConditionId] : null;
  const activeHandLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
  const persistentConditions = persistentConditionIds.map((conditionId) => cardsById[conditionId]).filter(Boolean);
  const unsupportedConditionEffects = getUnsupportedConditionEffects(activeCondition);
  const isSetup = gamePhase === "setup";
  const isStartOfTurn = gamePhase === "draw" && !hasDrawnThisTurn;
  const hasCoralInPlay = playerCorals.length > 0;
  const startTurnRp = getEcosystemStartTurnRp(playerCorals, activeCondition);
  const playerRpCap = getEcosystemRpCap(playerCorals, [...playerHabitats, ...playerReefCreatures, ...getLocallyControlledOrphans(playerOrphanCreatures, "player").flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
  const opponentRpCap = getEcosystemRpCap(opponent.corals, [...opponent.habitats, ...opponent.reefCreatures, ...getLocallyControlledOrphans(opponent.orphanCreatures, "opponent").flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
  const playerVp = getEcosystemVictoryPoints(playerCorals, playerHabitats, playerReefCreatures, {
    controller: "player",
    localOrphans: playerOrphanCreatures,
    rivalCorals: opponent.corals,
    rivalOrphans: opponent.orphanCreatures,
  });
  const opponentCorals = opponent.corals;
  const playerCoralCards = playerCorals.filter((foundation) => cardsById[foundation.cardId]?.kind === CardKind.CORAL);
  const opponentCoralCards = opponentCorals.filter((foundation) => cardsById[foundation.cardId]?.kind === CardKind.CORAL);
  const opponentLayoutSignature = [
    ...opponentCorals.map((coral) => `${coral.id}:${coral.slots.map((slot) => `${slot.cardId ?? "_"}:${(slot.hostedCardIds ?? []).filter(Boolean).join(",")}`).join(";")}`),
    ...opponent.habitatInstances.map((instance) => `habitat:${instance.instanceId}`),
    ...(opponent.reefCreatureInstances ?? []).map((instance) => `reef:${instance.instanceId}`),
    ...(opponent.orphanCreatures ?? []).map((instance) => `orphan:${instance.instanceId}:${(instance.hostedCardIds ?? []).filter(Boolean).join(",")}`),
  ].join("|");
  const opponentVp = getEcosystemVictoryPoints(opponentCorals, opponent.habitats, opponent.reefCreatures, {
    controller: "opponent",
    localOrphans: opponent.orphanCreatures,
    rivalCorals: playerCorals,
    rivalOrphans: playerOrphanCreatures,
  });
  const tutorialCurrentCheckpoint = tutorialContract && tutorialProgress
    ? getSimulatorTutorialCurrentCheckpoint(tutorialContract, tutorialProgress)
    : null;
  const tutorialStepNumber = tutorialProgress ? tutorialProgress.completedCheckpointIds.length + 1 : 0;
  const tutorialVictoryPending = Boolean(
    tutorialContract
    && tutorialProgress
    && tutorialCurrentCheckpoint === null
    && !gameResult
    && playerVp < victoryTarget
  );
  const tutorialBoardTourHelp = tutorialContract && tutorialUsesScriptedScenario
    ? getGuidedAcademyBoardTourStep(tutorialBoardTourStep, { guideName: tutorialGuide.name })
    : null;
  const tutorialBoardTourOpen = Boolean(tutorialBoardTourHelp && !eventOverlay && !gameResult);

  useEffect(() => {
    if (!["draw", "main"].includes(gamePhase) || !Number.isFinite(activeHandLimit)) return;
    const choice = createHandLimitChoice({ hand, handLimit: activeHandLimit });
    if (!choice.requiredDiscardCount) return;
    if (eventOverlay?.type === "choose-hand-limit-discard" || pendingEvents.some((event) => event.type === "choose-hand-limit-discard")) return;

    const choiceId = `hand-limit-${++handLimitChoiceIdRef.current}`;
    const choiceEvent = {
      type: "choose-hand-limit-discard",
      choiceId,
      sourceCardId: activeCondition?.id ?? null,
      title: `Choose ${choice.requiredDiscardCount} Card${choice.requiredDiscardCount === 1 ? "" : "s"} to Discard`,
      message: `${activeCondition?.name ?? "The active Condition"} limits each hand to ${choice.handLimit} cards. Choose from your entire hand; the simulator will not choose for you.`,
      handLimitChoice: choice,
    };
    setHandLimitDiscardSelection([]);
    if (eventOverlay) {
      setPendingEvents((current) => current.some((event) => event.type === "choose-hand-limit-discard")
        ? current
        : [...current, choiceEvent]);
    } else {
      setEventOverlay(choiceEvent);
    }
  }, [activeCondition?.id, activeHandLimit, eventOverlay, gamePhase, hand, pendingEvents]);

  function notifyTutorialCallback(name, ...args) {
    const callback = tutorialCallbacksRef.current?.[name];
    if (typeof callback !== "function") return;
    try {
      callback(...args);
    } catch (error) {
      console.error(`SeaPals tutorial callback ${name} failed.`, error);
    }
  }

  function emitTutorialEvent(actionType, details = {}, context = {}) {
    if (!tutorialContract || !tutorialProgressRef.current) return null;
    const event = createSimulatorTutorialEvent({
      eventId: `${tutorialContract.id}:${tutorialProgressRef.current.attempt}:${++tutorialEventIdRef.current}`,
      tutorialId: tutorialContract.id,
      actionType,
      actor: context.actor ?? "player",
      phase: context.phase ?? gamePhase,
      round: context.round ?? round,
      turn: context.turn ?? turn,
      details,
    });
    const observation = observeSimulatorTutorialEvent(tutorialContract, tutorialProgressRef.current, event);
    tutorialProgressRef.current = observation.progress;
    setTutorialProgress(observation.progress);
    notifyTutorialCallback("onEvent", event, observation.progress);
    observation.checkpointEvents.forEach((checkpointEvent) => {
      notifyTutorialCallback("onCheckpoint", checkpointEvent, observation.progress);
    });
    notifyTutorialCallback("onProgress", observation.progress, event);
    return { event, observation };
  }

  function emitPlayerBuild(card, cost, placement) {
    return emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_BUILT, {
      cardId: card.id,
      cardName: card.name,
      cardKind: card.kind,
      placement,
      cost: Number(cost ?? 0),
      accepted: true,
    });
  }
  const playerSchoolDensityCommitted = getEcosystemSchoolDensityCommitted({
    foundations: playerCorals,
    invasiveFoundations: opponentCorals,
    reefCreatureInstances: playerReefCreatureInstances,
    orphanCreatureInstances: playerOrphanCreatureInstances,
    invasiveOrphanCreatureInstances: opponent.orphanCreatures,
    commitmentsByInstanceId: schoolDensityCommitmentsByInstanceId,
  }, cardsById, "player");
  const opponentSchoolDensityCommitted = getEcosystemSchoolDensityCommitted({
    foundations: opponentCorals,
    invasiveFoundations: playerCorals,
    reefCreatureInstances: opponent.reefCreatureInstances,
    orphanCreatureInstances: opponent.orphanCreatures,
    invasiveOrphanCreatureInstances: playerOrphanCreatureInstances,
    commitmentsByInstanceId: opponent.schoolDensityCommitmentsByInstanceId ?? {},
  }, cardsById, "opponent");
  const playerSchoolDensityState = createSchoolDensityBucketState(
    playerCorals,
    playerSchoolDensityCommitted,
    cardsById,
  );
  const opponentSchoolDensityState = createSchoolDensityBucketState(
    opponentCorals,
    opponentSchoolDensityCommitted,
    cardsById,
  );
  const playerSchoolDensity = playerSchoolDensityState.capacity;
  const opponentSchoolDensity = opponentSchoolDensityState.capacity;
  const schoolDensityConditionIds = [...new Set([activeConditionId, ...persistentConditionIds].filter(Boolean))];
  const playingCard = playingCardId ? cardsById[playingCardId] : null;
  const inspectedCardData = inspectedCard ? cardsById[inspectedCard.cardId] : null;
  const tutorialLessonWon = isTutorialLessonVictory({
    tutorialActive: Boolean(tutorialContract && scriptedTutorialScenario),
    gameResult,
    playerVp,
    victoryTarget,
  });
  const tutorialCompletionDialogOpen = Boolean(
    tutorialLessonWon
    && !eventOverlay
    && !modal
    && !inspectedCardData
    && !attackContext
    && !searchContext
    && !pendingCreatureAction
  );
  const tutorialExitRequiresConfirmation = shouldConfirmTutorialExit({
    isStoryMode,
    tutorialActive: Boolean(tutorialContract && scriptedTutorialScenario),
    gameResult,
    initialOverlay: eventOverlay?.initial === true,
  });
  useEffect(() => {
    if (!tutorialExitRequiresConfirmation) return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    let disposed = false;
    let historyGuard = null;
    const installHistoryGuard = () => {
      if (disposed) return;
      const token = `reefbound-tutorial-${++tutorialHistoryGuardSequence}`;
      historyGuard = {
        token,
        allowNavigation: false,
        handlePopState: null,
      };
      historyGuard.handlePopState = () => {
        if (historyGuard.allowNavigation) return;
        window.history.pushState(
          createTutorialHistoryGuardState(window.history.state, token),
          "",
          window.location.href,
        );
        setTutorialExitConfirmationOpen(true);
      };
      tutorialHistoryGuardRef.current = historyGuard;
      window.history.pushState(
        createTutorialHistoryGuardState(window.history.state, token),
        "",
        window.location.href,
      );
      window.addEventListener("popstate", historyGuard.handlePopState);
    };
    // Deferring the sentinel avoids inserting duplicate entries during React's
    // development-only effect rehearsal while still guarding the live board.
    const installTimer = window.setTimeout(installHistoryGuard, 0);
    return () => {
      disposed = true;
      window.clearTimeout(installTimer);
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      if (!historyGuard) return;
      window.removeEventListener("popstate", historyGuard.handlePopState);
      if (tutorialHistoryGuardRef.current === historyGuard) {
        tutorialHistoryGuardRef.current = null;
      }
      if (
        !historyGuard.allowNavigation
        && window.history.state?.[TUTORIAL_HISTORY_GUARD_STATE_KEY] === historyGuard.token
      ) {
        historyGuard.allowNavigation = true;
        window.history.back();
      }
    };
  }, [tutorialExitRequiresConfirmation]);
  const selectedTutorialCard = selectedHandCard ? cardsById[selectedHandCard] : null;
  const inspectedCreatureSlot = inspectedCard?.owner === "player" && inspectedCard.coralId
    ? playerCorals.find((coral) => coral.id === inspectedCard.coralId)?.slots.find((slot) => slot.id === inspectedCard.slotId)
    : null;
  const inspectedFoundation = inspectedCard?.foundation
    ? (inspectedCard.owner === "player" ? playerCorals : opponentCorals)
        .find((foundation) => foundation.id === inspectedCard.coralId)
    : null;
  const inspectedFoundationDensityBucket = inspectedFoundation
    ? (inspectedCard.owner === "player"
        ? playerSchoolDensityState.byFoundationId[inspectedFoundation.id]
        : opponentSchoolDensityState.byFoundationId[inspectedFoundation.id]) ?? null
    : null;
  const inspectedFoundationIsStunned = Boolean(inspectedFoundation && !coralCanUseOwnAbilities(inspectedFoundation));
  const inspectedActionKey = inspectedCreatureSlot ? getSlotActionKey(inspectedCreatureSlot) : inspectedCard?.slotId;

  useEffect(() => {
    if (!inspectedCardData) return undefined;
    const handleInspectorKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeCardInspector();
    };
    window.addEventListener("keydown", handleInspectorKeyDown);
    return () => window.removeEventListener("keydown", handleInspectorKeyDown);
  }, [inspectedCardData]);

  const playerTutorialActionCards = tutorialContract ? [
    ...playerCorals.flatMap((coral) => coral.slots.flatMap((slot) => slot.cardId && slot.invasiveOwner !== "opponent" ? [{
      cardId: slot.cardId,
      coralId: coral.id,
      slotId: slot.id,
      actionKey: getSlotActionKey(slot),
    }] : [])),
    ...playerReefCreatureInstances.map((instance, index) => ({
      cardId: instance.cardId,
      coralId: null,
      slotId: getPlayerReefSlotId(index),
      actionKey: getPlayerReefSlotId(index),
    })),
    ...playerOrphanCreatureInstances.flatMap((instance, index) => instance.invasiveOwner === "opponent" ? [] : [{
      cardId: instance.cardId,
      coralId: null,
      slotId: getPlayerOrphanSlotId(index),
      actionKey: getPlayerOrphanSlotId(index),
    }]),
  ] : [];
  const playerAttackOptions = playerTutorialActionCards.flatMap((entry) => {
    const card = cardsById[entry.cardId];
    const attack = getBasicAttackEffect(card);
    if (!card || !attack) return [];
    const targetCount = getPlayerAttackTargets(card, attack).length;
    const usedThisTurn = usedAttackers.includes(entry.actionKey);
    let blockReason = "";
    let blockType = null;
    if (gameResult) {
      blockType = "game-over";
      blockReason = "The duel has already ended.";
    } else if (playingCardId || searchContext || pendingCreatureAction) {
      blockType = "interaction";
      blockReason = "Finish the current card action first.";
    } else if (usedThisTurn) {
      blockType = "used";
      blockReason = `${card.name} has already used its action this turn.`;
    } else if (turn < Number(actionCooldowns[entry.actionKey] ?? 0)) {
      blockType = "cooldown";
      blockReason = `${card.name} is unavailable this turn.`;
    } else if (rp < Number(attack.actionCost ?? 0)) {
      blockType = "rp";
      blockReason = `${card.name}'s ${attack.actionName} costs ${Number(attack.actionCost ?? 0)} RP, but you have ${rp} RP.`;
    } else if (!targetCount) {
      blockType = "targets";
      blockReason = `${card.name}'s ${attack.actionName} has no compatible target on ${tutorialGuide.name}'s board.`;
    } else if (gamePhase !== "main") {
      blockType = "phase";
      blockReason = `${card.name} can only attack during your action phase.`;
    }
    return [{
      ...entry,
      cardName: card.name,
      attackName: attack.actionName,
      attackCost: Number(attack.actionCost ?? 0),
      attackDice: attack.attackDice ?? null,
      targetCount,
      usedThisTurn,
      blockType,
      blockReason,
      ready: !blockReason,
      readyAfterDraw: blockType === "phase",
    }];
  });
  const readyAttack = playerAttackOptions.find((entry) => entry.ready) ?? null;
  const plannedAttack = playerAttackOptions.find((entry) => entry.ready || entry.readyAfterDraw) ?? null;
  const inspectedAttack = inspectedCard?.owner === "player"
    ? playerAttackOptions.find((entry) => entry.actionKey === inspectedActionKey) ?? null
    : null;
  const playerUtilityActionOptions = playerTutorialActionCards.flatMap((entry) => {
    const card = cardsById[entry.cardId];
    if (!card) return [];
    return (card.actions ?? []).flatMap((action) => {
      const effect = getSupportedUtilityEffect(action);
      if (!effect) return [];
      const actionName = getActionName(action);
      const actionCost = getActionCost(action);
      const utilityActionKey = `${entry.actionKey}:${action.id ?? actionName}`;
      const usedThisTurn = usedCreatureActions.includes(utilityActionKey);
      let blockType = null;
      let blockReason = "";
      if (gameResult) {
        blockType = "game-over";
        blockReason = "The duel has already ended.";
      } else if (playingCardId || attackContext || searchContext || pendingCreatureAction) {
        blockType = "interaction";
        blockReason = "Finish the current card action first.";
      } else if (gamePhase !== "main") {
        blockType = "phase";
        blockReason = `${actionName} can only be used during your action phase.`;
      } else if (rp < actionCost) {
        blockType = "rp";
        blockReason = `${card.name}'s ${actionName} costs ${actionCost} RP, but you have ${rp} RP.`;
      } else if (actionIsOncePerTurn(action) && usedThisTurn) {
        blockType = "used";
        blockReason = `${card.name} has already used ${actionName} this turn.`;
      } else if ((effect.type === EffectType.STUN_CORAL || effect.type === EffectType.FLIP_COIN) && !opponentCoralCards.length) {
        blockType = "targets";
        blockReason = `${actionName} has no opponent coral to target.`;
      } else if (effect.type === "reorderTopDeck" && !foundationDeck.length && !palsDeck.length) {
        blockType = "cards";
        blockReason = `${actionName} needs at least one card in a personal deck.`;
      } else if (effect.type === EffectType.DRAW_CARDS && !foundationDeck.length && !palsDeck.length) {
        blockType = "cards";
        blockReason = `${actionName} cannot draw from empty personal decks.`;
      } else if (effect.type === EffectType.SEARCH_DECK) {
        const hasMatchingCard = [...foundationDeck, ...palsDeck].some((cardId) => {
          const candidate = cardsById[cardId];
          if (!candidate || candidate.kind !== effect.targetKind) return false;
          if (effect.targetCardId && candidate.id !== effect.targetCardId) return false;
          if (effect.targetCategories?.length && !effect.targetCategories.includes(candidate.category)) return false;
          if (effect.targetNameIncludes && !candidate.name?.toLowerCase().includes(effect.targetNameIncludes.toLowerCase())) return false;
          return !effect.targetZone || candidate.zone === effect.targetZone;
        });
        if (!hasMatchingCard) {
          blockType = "cards";
          blockReason = `${actionName} has no matching card remaining in your personal decks.`;
        }
      } else if ((effect.type === EffectType.RECOVER_CARD_FROM_DISCARD || effect.type === "recoverCardFromDiscard") && !discardPile.length) {
        blockType = "cards";
        blockReason = `${actionName} needs at least one card in your discard pile.`;
      } else if (effect.type === "discardThenSearchDeck" || effect.type === "discardThenDraw") {
        const discardCount = Math.max(0, Number(effect.discard?.amount ?? effect.discard?.min ?? 0));
        if (hand.length < discardCount || (!foundationDeck.length && !palsDeck.length)) {
          blockType = "cards";
          blockReason = `${actionName} needs ${discardCount} card(s) in your hand and at least one card in a personal deck.`;
        }
      } else if (effect.type === "modifyDefenseRoll" || effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE) {
        const categories = action.target?.categories ?? [];
        const matchesTarget = (cardId) => cardId && (!categories.length || categories.includes(cardsById[cardId]?.category));
        const hasFriendlyTarget = playerCorals.some((coral) => coral.slots.some((slot) => (
          matchesTarget(slot.cardId) || (slot.hostedCardIds ?? []).some(matchesTarget)
        ))) || playerReefCreatures.some(matchesTarget) || getLocallyControlledOrphans(playerOrphanCreatures, "player").some((candidate) => matchesTarget(candidate.cardId));
        if (!hasFriendlyTarget) {
          blockType = "targets";
          blockReason = `${actionName} has no legal friendly target.`;
        }
      }
      return [{
        ...entry,
        cardName: card.name,
        actionName,
        actionText: typeof action === "string" ? action.slice(action.indexOf(":") + 1).trim() : action.text ?? "",
        actionCost,
        utilityActionKey,
        usedThisTurn,
        effectType: effect.type,
        blockType,
        blockReason,
        ready: !blockReason,
      }];
    });
  });
  const readyUtilityAction = playerUtilityActionOptions.find((entry) => entry.ready) ?? null;
  const inspectedUtilityAction = inspectedCard?.owner === "player"
    ? playerUtilityActionOptions.find((entry) => entry.actionKey === inspectedActionKey && entry.ready) ?? null
    : null;
  const attackSetupCards = tutorialContract ? hand.flatMap((cardId) => {
    const card = cardsById[cardId];
    const attack = getBasicAttackEffect(card);
    if (!card || !attack) return [];
    const planningForMainPhase = gamePhase === "draw";
    const playErrorMessage = getPlayError(card, { allowUpcomingMain: planningForMainPhase });
    const targetCount = getPlayerAttackTargets(card, attack).length;
    const playCost = getPlayerCardPlayCost(card);
    const totalCost = playCost + Number(attack.actionCost ?? 0);
    let blockType = null;
    let blockReason = "";
    if (playErrorMessage) {
      blockType = "play";
      blockReason = playErrorMessage;
    } else if (!targetCount) {
      blockType = "targets";
      blockReason = `${attack.actionName} has no compatible target on ${tutorialGuide.name}'s board.`;
    } else if (totalCost > rp) {
      blockType = "rp";
      blockReason = `Playing ${card.name} and using ${attack.actionName} requires ${totalCost} RP, but you have ${rp} RP.`;
    }
    return [{
      cardId,
      cardName: card.name,
      kindLabel: getCardClassLabel(card),
      cost: playCost,
      victoryPoints: Number(card.victoryPoints ?? 0),
      attackName: attack.actionName,
      attackCost: Number(attack.actionCost ?? 0),
      targetCount,
      playError: playErrorMessage,
      ready: gamePhase === "main" && !playErrorMessage && targetCount > 0 && totalCost <= rp,
      readyAfterDraw: planningForMainPhase && !playErrorMessage && targetCount > 0 && totalCost <= rp,
      blockType,
      blockReason,
    }];
  }) : [];
  const attackSetupCard = attackSetupCards.find((entry) => entry.ready) ?? null;
  const plannedAttackSetupCard = attackSetupCards.find((entry) => entry.ready || entry.readyAfterDraw) ?? null;
  const drawnCardIds = (turnDrawResult ?? []).filter((entry) => !entry.discarded).map((entry) => entry.cardId);
  const playableBuildCards = tutorialContract ? hand.flatMap((cardId) => {
    const card = cardsById[cardId];
    if (!card || card.kind === CardKind.SUPPORT) return [];
    const playErrorMessage = getPlayError(card);
    if (playErrorMessage) return [];
    return [{
      cardId,
      cardName: card.name,
      kindLabel: getCardClassLabel(card),
      cost: getPlayerCardPlayCost(card),
      victoryPoints: Number(card.victoryPoints ?? 0),
    }];
  }) : [];
  const recommendedBuildCard = playableBuildCards.find((entry) => drawnCardIds.includes(entry.cardId))
    ?? playableBuildCards[0]
    ?? null;
  const recommendedVpBuildCard = [...playableBuildCards]
    .filter((entry) => entry.victoryPoints > 0)
    .sort((left, right) => (
      right.victoryPoints - left.victoryPoints
      || left.cost - right.cost
      || left.cardName.localeCompare(right.cardName)
    ))[0] ?? null;
  const firstBlockedBuildCard = tutorialContract
    ? hand.map((cardId) => cardsById[cardId]).find((card) => card && card.kind !== CardKind.SUPPORT && getPlayError(card))
    : null;
  const buildBlockReason = firstBlockedBuildCard
    ? `${firstBlockedBuildCard.name}: ${getPlayError(firstBlockedBuildCard)}`
    : "";
  const drawnCards = tutorialContract ? (turnDrawResult ?? []).map((entry) => {
    const card = cardsById[entry.cardId];
    const attack = getBasicAttackEffect(card);
    const inHand = !entry.discarded && hand.includes(entry.cardId);
    return {
      cardId: entry.cardId,
      name: card?.name ?? entry.cardId,
      source: entry.source,
      discarded: Boolean(entry.discarded),
      inHand,
      kindLabel: card ? getCardClassLabel(card) : "Card",
      cost: card ? getPlayerCardPlayCost(card) : null,
      victoryPoints: Number(card?.victoryPoints ?? 0),
      playError: entry.discarded
        ? "Discarded by the hand limit."
        : !inHand
          ? "It is no longer in your hand."
          : getPlayError(card),
      attack: attack ? {
        name: attack.actionName,
        cost: Number(attack.actionCost ?? 0),
        dice: attack.attackDice ?? null,
        targetCount: getPlayerAttackTargets(card, attack).length,
      } : null,
    };
  }) : [];
  const recentAttackSetupCard = attackSetupCards.find((entry) => drawnCardIds.includes(entry.cardId));
  const attackBlock = playerAttackOptions.find((entry) => entry.blockReason)
    ?? (recentAttackSetupCard?.blockReason ? recentAttackSetupCard : null)
      ?? attackSetupCards.find((entry) => entry.blockReason)
      ?? { blockType: "missing", blockReason: "No creature in your ecosystem or hand can make a legal attack yet." };
  const attackBlockReason = attackBlock.blockReason;
  const activeAttack = attackContext ? (() => {
    const card = cardsById[attackContext.attackerCardId];
    const attack = attackContext.attackOverride ?? getBasicAttackEffect(card);
    return card && attack ? { cardId: card.id, cardName: card.name, attackName: attack.actionName } : null;
  })() : null;
  const scriptedFinishPlan = scriptedTutorialScenario?.finishPlan ?? null;
  const scriptedPlayerCardIdsInPlay = [
    ...playerCorals.map((coral) => coral.cardId),
    ...playerHabitats,
    ...playerTutorialActionCards.map((entry) => entry.cardId),
  ];
  const scriptedOpponentCardIdsInPlay = [
    ...opponentCorals.map((coral) => coral.cardId),
    ...opponentCorals.flatMap((coral) => coral.slots.flatMap((slot) => getSlotCardIds(slot))),
    ...opponent.reefCreatures,
    ...(opponent.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
  ];
  const getScriptedCardState = (cardId) => {
    if (!cardId) return null;
    const card = cardsById[cardId];
    if (!card) return null;
    const inHand = hand.includes(cardId);
    const playErrorMessage = inHand
      ? getPlayError(card, { allowUpcomingMain: gamePhase === "draw" })
      : "";
    return {
      cardId,
      cardName: card.name,
      printedCost: Math.max(0, Number(card.cost?.rp ?? 0)),
      cost: getPlayerCardPlayCost(card),
      victoryPoints: Math.max(0, Number(card.victoryPoints ?? 0)),
      inHand,
      inPlay: scriptedPlayerCardIdsInPlay.includes(cardId),
      inFoundationDeck: foundationDeck.includes(cardId),
      inPalsDeck: palsDeck.includes(cardId),
      inDiscard: discardPile.includes(cardId),
      isPlaying: playingCardId === cardId,
      playError: playErrorMessage,
      ready: inHand && !playErrorMessage,
    };
  };
  const scriptedFinishCards = scriptedFinishPlan ? {
    setup: getScriptedCardState(scriptedFinishPlan.setupCardId),
    economy: getScriptedCardState(scriptedFinishPlan.economyCardId),
    coralSupport: getScriptedCardState(scriptedFinishPlan.coralSearchSupportCardId),
    searchedCoral: getScriptedCardState(scriptedFinishPlan.searchedCoralCardId),
    coralBase: getScriptedCardState(scriptedFinishPlan.reefBuilderCardId),
    coralStageOne: getScriptedCardState(scriptedFinishPlan.reefBuilderStageOneCardId),
    coralStageTwo: getScriptedCardState(scriptedFinishPlan.reefBuilderStageTwoCardId),
    bankBoost: getScriptedCardState(scriptedFinishPlan.bankBoostCardId),
    utility: getScriptedCardState(scriptedFinishPlan.utilityCardId),
    firstFish: getScriptedCardState(scriptedFinishPlan.attackCardId),
    secondFish: getScriptedCardState(scriptedFinishPlan.reefFishCardId),
    habitat: getScriptedCardState(scriptedFinishPlan.habitatCardId),
    predator: getScriptedCardState(scriptedFinishPlan.predatorCardId),
    creatureSchool: getScriptedCardState(scriptedFinishPlan.creatureSchoolCardId),
    filterFeeder: getScriptedCardState(scriptedFinishPlan.filterFeederCardId),
    apexSupport: getScriptedCardState(scriptedFinishPlan.apexSearchSupportCardId),
    apex: getScriptedCardState(scriptedFinishPlan.apexCardId),
    // Legacy aliases keep restored tutorial fixtures and old free-practice
    // help compatible while the Academy uses the curriculum fields above.
    attack: getScriptedCardState(scriptedFinishPlan.attackCardId),
    heldFinish: getScriptedCardState(scriptedFinishPlan.heldFinishCardId),
    finishSearch: getScriptedCardState(scriptedFinishPlan.finishSearchCardId),
  } : null;
  const scriptedFinishRoute = scriptedFinishPlan && scriptedFinishCards ? (() => {
    const cardIsAvailable = (card) => Boolean(
      card && (
        card.inHand
        || card.inPlay
        || card.inFoundationDeck
        || card.inPalsDeck
        || card.isPlaying
      )
    );
    return {
      active: Number(scriptedFinishPlan.curriculumVersion ?? 0) >= 2
        ? Object.entries(scriptedFinishCards)
            .filter(([key]) => !["attack", "heldFinish", "finishSearch"].includes(key))
            .every(([, card]) => Boolean(card))
        : Object.values(scriptedFinishCards).every(cardIsAvailable),
      plan: scriptedFinishPlan,
      cards: scriptedFinishCards,
      activeConditionId,
      expectedDraw: getScriptedTutorialTurnDraw({ round }),
      nextFoundationCardId: foundationDeck[0] ?? null,
      nextPalsCardId: palsDeck[0] ?? null,
      utilityAction: playerUtilityActionOptions.find((entry) => (
        entry.cardId === scriptedFinishPlan.utilityCardId
      )) ?? null,
      attackAction: playerAttackOptions.find((entry) => (
        entry.cardId === scriptedFinishPlan.attackCardId
      )) ?? null,
      searchTargetCardId: searchContext?.mode === "deck"
        ? getScriptedTutorialSearchTargetCardId({
            cardsInPlay: scriptedPlayerCardIdsInPlay,
            cardsInHand: hand,
            searchCandidates: searchContext.candidates ?? [],
          })
        : null,
      attackTargetInPlay: scriptedOpponentCardIdsInPlay.includes(scriptedFinishPlan.attackTargetCardId),
      finishAttackTargetInPlay: scriptedOpponentCardIdsInPlay.includes(scriptedFinishPlan.finishAttackTargetCardId),
    };
  })() : null;
  const tutorialHelp = tutorialContract ? getSimulatorTutorialHelp(tutorialCurrentCheckpoint, {
    guideName: tutorialGuide.name,
    victoryPending: tutorialVictoryPending,
    playerVp,
    opponentVp,
    victoryTarget,
    gamePhase,
    hasCoralInPlay,
    scriptedSetupCardId: tutorialUsesScriptedScenario ? "mustard-hill-coral-base" : null,
    scriptedSetupCardName: tutorialUsesScriptedScenario ? cardsById["mustard-hill-coral-base"]?.name : null,
    scriptedBuildCardId: scriptedFoundationLessonCardId,
    scriptedBuildCardName: scriptedFoundationLessonCardId ? cardsById[scriptedFoundationLessonCardId]?.name : null,
    playingCardId,
    playingCardName: playingCard?.name,
    modal,
    selectedHandCard,
    selectedCardIsSupport: selectedTutorialCard?.kind === CardKind.SUPPORT,
    selectedCardPlayError: selectedTutorialCard ? getPlayError(selectedTutorialCard) : "",
    selectedCardIsSetupFoundation: Boolean(
      selectedTutorialCard
      && isFoundationCard(selectedTutorialCard)
      && Number(selectedTutorialCard.stage ?? 0) === 0
      && !getPlayError(selectedTutorialCard)
    ),
    selectedCardName: selectedTutorialCard?.name,
    selectedCardCost: selectedTutorialCard ? getPlayerCardPlayCost(selectedTutorialCard) : null,
    selectedCardVictoryPoints: Number(selectedTutorialCard?.victoryPoints ?? 0),
    selectedSupportLocksFurtherSupports: supportExplicitlyLocksFurtherSupports(selectedTutorialCard),
    handPopoverOpen: Boolean(handPopoverCardId),
    inspectedAttack,
    inspectedCardOpen: Boolean(inspectedCardData),
    inspectedPlayerCard: inspectedCard?.owner === "player",
    inspectedCardName: inspectedCardData?.name,
    inspectedUtilityAction,
    attackContext: Boolean(attackContext),
    activeAttack,
    readyAttack,
    readyUtilityAction,
    plannedAttack,
    attackSetupCard,
    plannedAttackSetupCard,
    attackBlock,
    attackBlockReason,
    recommendedBuildCard,
    recommendedVpBuildCard,
    buildBlockReason,
    drawnCards,
    round,
    turn,
    scriptedLesson: tutorialUsesScriptedScenario,
    scriptedFinishRoute,
    layoutLessonProgress: tutorialLayoutProgress,
    scriptedAttackCardInHand: tutorialUsesScriptedScenario && hand.includes("spanish-hogfish"),
    scriptedAttackCardCost: getPlayerCardPlayCost(cardsById["spanish-hogfish"]),
    scriptedAttackActionCost: Number(getBasicAttackEffect(cardsById["spanish-hogfish"])?.actionCost ?? 0),
    availableRp: rp,
    nextPalsCardName: cardsById[palsDeck[0]]?.name ?? null,
    drawSelected: Number(turnDrawSelection?.foundation ?? 0) + Number(turnDrawSelection?.pals ?? 0),
    drawFoundationSelected: Number(turnDrawSelection?.foundation ?? 0),
    drawPalsSelected: Number(turnDrawSelection?.pals ?? 0),
    drawTarget: Number(turnDrawSelection?.target ?? 0),
    foundationDeckCount: foundationDeck.length,
    palsDeckCount: palsDeck.length,
  }) : null;
  const tutorialFinalProgressLabel = tutorialCurrentCheckpoint === null && tutorialContract
    ? `Final goal • ${playerVp}/${victoryTarget} VP`
    : null;
  const tutorialConditionHelp = tutorialContract && eventOverlay?.type === "condition-reveal"
    ? {
        ...getSimulatorTutorialConditionHelp(cardsById[eventOverlay.sourceCardId], eventOverlay.round ?? round),
        ...(tutorialFinalProgressLabel ? { progressLabel: tutorialFinalProgressLabel } : {}),
      }
    : null;
  const tutorialFaceoffHelp = tutorialContract && ["faceoff-ready", "school-attack-ready"].includes(eventOverlay?.type)
      ? {
        id: "tutorial-faceoff",
        cueId: `tutorial-faceoff:${faceoffRolling ? "resolve" : "roll"}`,
        ...(tutorialFinalProgressLabel ? { progressLabel: tutorialFinalProgressLabel } : {}),
        title: faceoffRolling ? "Resolve the faceoff" : "Roll the faceoff dice",
        lead: faceoffRolling ? "" : "The faceoff control is ready. ",
        message: faceoffRolling
          ? "There we are! The changing numbers preview the attack and defense rolls. Stop them when you are ready; the simulator will compare the final results and explain the outcome."
          : eventOverlay.type === "faceoff-ready"
            ? "Now both creatures roll. Your attack total must beat the defender's total for the attack to succeed. Start the dice, then stop them to lock in one result for each creature."
            : "This Creature School attack uses its die roll to determine damage. Start the die, then stop it to lock in the result.",
        action: faceoffRolling ? "Press Stop & Resolve to lock in the rolls." : "Press Start Rolling to begin the faceoff.",
        target: "faceoff-action",
        targetLabel: faceoffRolling ? "the Stop & Resolve button" : "the Start Rolling button",
      }
    : null;
  const scriptedScavengeInteraction = tutorialUsesScriptedScenario
    && pendingCreatureAction?.sourceCardId === scriptedFinishPlan?.utilityCardId
    && ["choose-action-hand-discard", "choose-action-search-card"].includes(eventOverlay?.type);
  const scriptedSearchCandidates = eventOverlay?.type === "choose-action-search-card"
    ? pendingCreatureAction?.searchCandidates ?? []
    : [...foundationDeck, ...palsDeck];
  const scriptedSearchTargetCardId = scriptedScavengeInteraction
    ? getScriptedTutorialSearchTargetCardId({
        cardsInPlay: scriptedPlayerCardIdsInPlay,
        cardsInHand: hand,
        searchCandidates: scriptedSearchCandidates,
      })
    : null;
  const scriptedDiscardCandidates = scriptedScavengeInteraction
    && eventOverlay?.type === "choose-action-hand-discard"
    && scriptedSearchTargetCardId
    ? (() => {
        const required = Math.max(0, Number(pendingCreatureAction.minDiscard ?? 2));
        const candidates = getScriptedTutorialDiscardEntries(
          pendingCreatureAction.handEntries ?? [],
          { searchTargetCardId: scriptedSearchTargetCardId, amount: required },
        );
        return candidates.length === required ? candidates : [];
      })()
    : [];
  const scriptedSelectedDiscardIndexes = new Set(pendingCreatureAction?.selectedIndices ?? []);
  const scriptedDiscardReady = scriptedDiscardCandidates.length > 0
    && scriptedDiscardCandidates.every((entry) => scriptedSelectedDiscardIndexes.has(entry.index))
    && (pendingCreatureAction?.selectedIndices?.length ?? 0) >= (pendingCreatureAction?.minDiscard ?? 0)
    && (pendingCreatureAction?.selectedIndices?.length ?? 0) <= (pendingCreatureAction?.maxDiscard ?? Number.POSITIVE_INFINITY);
  const scriptedSearchTargetCard = scriptedSearchTargetCardId
    ? cardsById[scriptedSearchTargetCardId]
    : null;
  const scriptedSearchIsFinishCard = scriptedSearchTargetCardId === scriptedFinishPlan?.finishSearchCardId;
  const scriptedImpactTargetHelp = tutorialUsesScriptedScenario
    && Number(scriptedFinishPlan?.curriculumVersion ?? 0) >= 2
    && eventOverlay?.type === "choose-impact-target"
    && [scriptedFinishPlan.reefFishCardId, scriptedFinishPlan.apexCardId].includes(eventOverlay.sourceCardId)
    ? {
        id: "tutorial-script-impact-target",
        cueId: `tutorial-script-impact-target:${eventOverlay.sourceCardId}`,
        progressLabel: `Aquarium reef • ${playerVp}/${victoryTarget} VP`,
        title: eventOverlay.sourceCardId === scriptedFinishPlan.apexCardId
          ? "Begin Hammerhead's Ravage"
          : "Resolve Parrotfish's Eat ability",
        lead: "",
        message: eventOverlay.sourceCardId === scriptedFinishPlan.apexCardId
          ? "Ravage is an On Play sequence. First choose a Coral for the damage roll; after that resolves, Hammerhead must make its two attacks against the remaining compatible creatures."
          : `Eat is an On Play ability, so it resolves immediately after Parrotfish enters the reef. Choose one of ${tutorialGuide.name}'s durable practice Corals; the damage teaches the timing without removing the final Ravage lesson.`,
        action: "Choose one of the highlighted opposing Corals to resolve the On Play damage.",
        target: "impact-target",
        targetLabel: "a highlighted opposing Coral",
      }
    : null;
  const scriptedCoinActionHelp = tutorialUsesScriptedScenario
    && Number(scriptedFinishPlan?.curriculumVersion ?? 0) >= 2
    && eventOverlay?.type === "choose-coin-coral-target"
    && pendingCreatureAction?.sourceCardId === scriptedFinishPlan.utilityCardId
    ? {
        id: "tutorial-script-utility-target",
        cueId: `tutorial-script-utility-target:${pendingCreatureAction.sourceCardId}`,
        progressLabel: `Aquarium reef • ${playerVp}/${victoryTarget} VP`,
        title: "Choose Munch's target",
        lead: "",
        message: "Munch is a non-attack action that can reduce one Coral's next RP production. Choose the intended Coral first; then the coin flip decides whether the effect succeeds. This changes the opponent's economy without rolling attack and defense dice or removing a creature.",
        action: `Choose ${tutorialGuide.name}'s highlighted Coral, then resolve Munch's coin flip.`,
        target: "coin-coral-target",
        targetLabel: "the highlighted opposing Coral",
      }
    : null;
  const scriptedTutorialOverlayHelp = scriptedImpactTargetHelp ?? scriptedCoinActionHelp ?? (scriptedDiscardCandidates.length ? {
    id: "tutorial-script-scavenge-discard",
    cueId: `tutorial-script-scavenge-discard:${scriptedSearchTargetCardId}:${scriptedDiscardReady ? "confirm" : "choose"}:${scriptedDiscardCandidates.map((entry) => entry.index).join(",")}`,
    ...(tutorialFinalProgressLabel ? { progressLabel: tutorialFinalProgressLabel } : {}),
    title: scriptedDiscardReady ? "Commit the Scavenge trade" : "Choose what Arrow Crab will trade",
    lead: "",
    message: `Wonderful—Scavenge is a card action, not an attack. It trades exactly two cards from your hand for one card you deliberately choose from either personal deck. For this exercise, I have highlighted ${scriptedDiscardCandidates.map((entry) => cardsById[entry.cardId]?.name ?? entry.cardId).join(" and ")} as safe practice discards.`,
    playerThought: "The two discarded cards are the cost of improving my hand. I should choose cards that matter less to my current plan, not simply the first two I see.",
    encouragement: "Precisely. Card advantage is not only about quantity; choosing the right card at the right moment can be worth more than keeping several unfocused options.",
    action: scriptedDiscardReady
      ? "Press Discard & Continue to pay the card cost and choose what Arrow Crab finds."
      : "Select the two highlighted cards. I will point to the confirmation button when the choice is ready.",
    target: scriptedDiscardReady ? "script-discard-confirm" : "script-discard-cards",
    targetLabel: scriptedDiscardReady ? "the Discard & Continue button" : "the highlighted practice discards",
  } : scriptedSearchTargetCardId ? {
    id: "tutorial-script-scavenge-search",
    cueId: `tutorial-script-scavenge-search:${scriptedSearchTargetCardId}`,
    ...(tutorialFinalProgressLabel ? { progressLabel: tutorialFinalProgressLabel } : {}),
    title: scriptedSearchIsFinishCard ? "Search for the final-turn Predator" : "Search for a planned attacker",
    lead: "",
    message: scriptedSearchIsFinishCard
      ? `The discard and 2 RP cost are committed. Choose ${scriptedSearchTargetCard?.name ?? "Spinner Dolphins"} now, but keep it in your hand this round. Murky Water will reduce its Predator play cost next round, letting the RP you bank fund both final creatures.`
      : `The discard and 2 RP cost are committed, so Scavenge lets you choose any remaining card. ${scriptedSearchTargetCard?.name ?? "Spanish Hogfish"} is our lesson target because its Crunch action can attack the Sea Urchin I placed on my reef.`,
    playerThought: scriptedSearchIsFinishCard
      ? "This search is planning an entire future turn: find the discounted Predator now, preserve Giant Clam, and carry the remaining RP forward."
      : "Instead of hoping my next draw solves the problem, I can use Scavenge to choose Spanish Hogfish because I already know it has a legal target.",
    encouragement: scriptedSearchIsFinishCard
      ? "That is careful sequencing. The strongest search target is the one your board, hand, condition, and RP can use together."
      : "Exactly! That is the difference between searching with a plan and searching for a card that merely looks strong. We began with the board, identified a need, and selected the answer.",
    action: scriptedSearchIsFinishCard
      ? `Choose the highlighted ${scriptedSearchTargetCard?.name ?? "Spinner Dolphins"}, then end the turn with it and Giant Clam protected for Round ${scriptedFinishPlan?.finishRound ?? 4}.`
      : rp >= getPlayerCardPlayCost(scriptedSearchTargetCard) + Number(getBasicAttackEffect(scriptedSearchTargetCard)?.actionCost ?? 0)
        ? `Choose the highlighted ${scriptedSearchTargetCard?.name ?? "Spanish Hogfish"}, play it now, and keep 1 RP to use Crunch on Sea Urchin.`
        : `Choose the highlighted ${scriptedSearchTargetCard?.name ?? "Spanish Hogfish"}. Keep it in hand, end the turn, and bank enough RP to play it and use Crunch next round.`,
    target: "script-search-card",
    targetLabel: `the highlighted ${scriptedSearchTargetCard?.name ?? "search card"}`,
  } : null);
  const tutorialConditionHelpKey = tutorialConditionHelp?.cueId ?? tutorialConditionHelp?.id ?? null;
  const tutorialConditionHelpOpen = Boolean(
    tutorialConditionHelp && tutorialHelpDismissedId !== tutorialConditionHelpKey,
  );
  const scriptedTutorialOverlayHelpKey = scriptedTutorialOverlayHelp?.cueId ?? scriptedTutorialOverlayHelp?.id ?? null;
  const scriptedTutorialOverlayHelpOpen = Boolean(
    scriptedTutorialOverlayHelp && tutorialHelpDismissedId !== scriptedTutorialOverlayHelpKey,
  );
  const tutorialFaceoffHelpKey = tutorialFaceoffHelp?.cueId ?? tutorialFaceoffHelp?.id ?? null;
  const tutorialFaceoffHelpOpen = Boolean(
    tutorialFaceoffHelp && tutorialHelpDismissedId !== tutorialFaceoffHelpKey,
  );
  const tutorialHelpDismissalKey = tutorialHelp?.cueId ?? tutorialHelp?.id ?? null;
  const tutorialHelpOpen = Boolean(tutorialHelp && tutorialHelpDismissedId !== tutorialHelpDismissalKey);
  const keepAcademyPointer = Boolean(tutorialUsesScriptedScenario && scriptedFinishRoute?.active);
  const tutorialHelpTargetActive = Boolean(tutorialHelp && (tutorialHelpOpen || keepAcademyPointer));
  const tutorialConditionTargetActive = Boolean(
    tutorialConditionHelp && (tutorialConditionHelpOpen || keepAcademyPointer),
  );
  const tutorialFaceoffTargetActive = Boolean(
    tutorialFaceoffHelp && (tutorialFaceoffHelpOpen || keepAcademyPointer),
  );
  const scriptedOverlayTargetActive = Boolean(
    scriptedTutorialOverlayHelp && (scriptedTutorialOverlayHelpOpen || keepAcademyPointer),
  );
  const tutorialHelpInline = Boolean(
    tutorialHelpOpen
    && !eventOverlay
    && (
      ["turn-draw", "draw-result", "hand"].includes(modal)
      || (modal === "search" && tutorialHelp.target === "search-card")
      || (Boolean(modal) && tutorialHelp.target === "close-modal")
      || (inspectedCardData && ["attack-button", "utility-action-button", "close-modal"].includes(tutorialHelp.target))
      || (handPopoverCardId && ["play-card", "turn-button", "close-modal"].includes(tutorialHelp.target))
    ),
  );
  const tutorialHelpFloating = Boolean(
    tutorialHelpOpen
    && !tutorialBoardTourOpen
    && !tutorialHelpInline
    && !eventOverlay
    && !modal
    && !roundFlash
    && !opponentThinking
    && !mobileHudPanel
    && !inspectedCardData
    && !handPopoverCardId
    && !gameResult,
  );
  const tutorialTargetBeaconHelp = tutorialBoardTourOpen
    ? tutorialBoardTourHelp
    : eventOverlay
    ? tutorialConditionTargetActive
      ? tutorialConditionHelp
      : tutorialFaceoffTargetActive
        ? tutorialFaceoffHelp
        : scriptedOverlayTargetActive
          ? scriptedTutorialOverlayHelp
          : null
    : tutorialHelpTargetActive
      ? tutorialHelp
      : null;
  const tutorialTargetBeaconOpen = Boolean(
    tutorialTargetBeaconHelp
    && !roundFlash
    && !gameResult
    && !opponentThinking,
  );
  const tutorialAnnouncement = tutorialTargetBeaconHelp
    ? createProfessorAnnouncement({
        guideName: tutorialGuide.name,
        help: tutorialTargetBeaconHelp,
        step: Math.min(tutorialStepNumber, tutorialContract?.checkpoints.length ?? 1),
        total: tutorialContract?.checkpoints.length ?? 1,
        message: createProfessorSpokenMessage(tutorialTargetBeaconHelp),
      })
    : "";
  const tutorialVisualHelp = tutorialBoardTourOpen
    ? tutorialBoardTourHelp
    : tutorialHelpTargetActive
      ? tutorialHelp
      : null;
  const tutorialTargetClass = (target) => (
    tutorialVisualHelp
      && tutorialVisualHelp.target === target
      && !(target === "player-board" && tutorialVisualHelp.targetActionKey)
      ? " seapals-tutorial-target"
      : ""
  );
  const tutorialCardTargetClass = (cardId) => (
    tutorialHelpTargetActive && tutorialHelp?.targetCardId === cardId ? " seapals-tutorial-target" : ""
  );
  const tutorialActionTargetClass = (actionKey) => (
    tutorialHelpTargetActive && tutorialHelp?.targetActionKey === actionKey ? " seapals-tutorial-target" : ""
  );
  const isPlacingCoral = Boolean(isFoundationCard(playingCard) && Number(playingCard.stage ?? 0) === 0);
  const isUpgradingCoral = Boolean(isFoundationCard(playingCard) && Number(playingCard.stage ?? 0) > 0);
  const guidedFoundationPlacementTarget = tutorialUsesScriptedScenario
    && isPlacingCoral
    && tutorialHelp?.target === "placement"
      ? getGuidedAcademyFoundationPlacementTarget(playerCorals.length)
      : null;
  const upgradeableCoralIds = new Set(
    isUpgradingCoral
      ? playerCorals
          .filter((coral) => {
            const currentCard = cardsById[coral.cardId];
            const upgradeCost = Number(currentCard?.upgrade?.cost?.rp ?? playingCard?.cost?.rp ?? 0);
            return (
              currentCard?.upgrade?.canUpgrade &&
              currentCard.upgrade.nextCardId === playingCardId &&
              !coralIsStunned(coral) &&
              turn > (coral.stageEnteredTurn ?? coral.playedTurn ?? turn) &&
              rp >= upgradeCost
            );
          })
          .map((coral) => coral.id)
      : [],
  );

  useEffect(() => {
    if (!tutorialHelpTargetActive) return undefined;
    if (tutorialHelp.target === "opponent-board") setMobileBoardView("opponent");
    else if (tutorialHelp.target === "player-board" || tutorialHelp.targetActionKey) setMobileBoardView("player");

    if (!tutorialHelp.targetCardId && !tutorialHelp.targetActionKey) return undefined;
    const frame = requestAnimationFrame(() => {
      const attribute = tutorialHelp.targetCardId ? "data-tutorial-hand-card-id" : "data-tutorial-action-key";
      const value = tutorialHelp.targetCardId ?? tutorialHelp.targetActionKey;
      const candidates = [...document.querySelectorAll(`[${attribute}]`)];
      if (modal === "hand") candidates.reverse();
      const target = candidates
        .find((element) => element.getAttribute(attribute) === value && element.getClientRects().length > 0);
      target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [tutorialHelpDismissalKey, tutorialHelpTargetActive, tutorialHelp?.target, tutorialHelp?.targetCardId, tutorialHelp?.targetActionKey, modal, handPopoverCardId, mobileBoardView]);

  useEffect(() => {
    if (!tutorialBoardTourOpen) return;
    if (tutorialBoardTourHelp.target === "opponent-board") setMobileBoardView("opponent");
    else if (tutorialBoardTourHelp.target === "player-board") setMobileBoardView("player");
  }, [tutorialBoardTourHelp?.cueId, tutorialBoardTourHelp?.target, tutorialBoardTourOpen]);

  useEffect(() => {
    setHasDrawnThisTurn(false);
  }, [turn]);

  useEffect(() => {
    if (!tutorialContract) return;
    const previous = tutorialVpRef.current;
    if (playerVp > previous.player) {
      emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED, {
        from: previous.player,
        to: playerVp,
        delta: playerVp - previous.player,
      });
    }
    if (opponentVp > previous.opponent) {
      emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED, {
        from: previous.opponent,
        to: opponentVp,
        delta: opponentVp - previous.opponent,
      }, { actor: "opponent" });
    }
    tutorialVpRef.current = { player: playerVp, opponent: opponentVp };
  }, [playerVp, opponentVp, tutorialContract]);

  useEffect(() => {
    setRp((current) => Math.min(current, playerRpCap));
  }, [playerRpCap]);

  useEffect(() => {
    setOpponent((current) => current.rp > opponentRpCap ? { ...current, rp: opponentRpCap } : current);
  }, [opponentRpCap]);

  useEffect(() => {
    if (!opponentLayoutSignature || opponentViewportTouched) return undefined;
    const frame = requestAnimationFrame(() => zoomEcosystemToFit("opponent"));
    return () => cancelAnimationFrame(frame);
  }, [opponentLayoutSignature, opponentViewportTouched, mobileBoardView]);

  useEffect(() => {
    const result = reconcileFoundationHealthToFixedPoint(playerCorals, playerReefCreatureInstances, playerOrphanCreatures);
    if (!result.changed) return;
    setPlayerCorals(result.corals);
    if (result.destroyed.length) setPlayerOrphanCreatures(result.orphans);
    if (result.destroyed.length) {
      const triggerResult = resolveFoundationDestructionTriggers(result.destructionWaves, hand, discardPile, Infinity);
      setDiscardPile(triggerResult.discardPile);
      if (triggerResult.hand !== hand) setHand(triggerResult.hand);
      const fragmentMessage = triggerResult.triggers.map((trigger) => trigger.cardsToHand.length + trigger.cardsToDiscard.length
        ? ` Fragment found ${[...trigger.cardsToHand, ...trigger.cardsToDiscard].map((cardId) => cardsById[cardId]?.name).join(" and ")}.${trigger.cardsToHand.length ? ` ${trigger.cardsToHand.length} moved to your hand.` : ""}${trigger.cardsToDiscard.length ? ` Your hand is over its limit, so you will choose what to discard.` : ""}`
        : ` Fragment triggered but found no ${cardsById[trigger.targetCardId]?.name ?? "matching card"} to recover.`).join("");
      pushLog(`${result.destroyed.map((foundation) => cardsById[foundation.cardId]?.name).join(", ")} was destroyed when a continuous coral-health bonus ended. Its creatures filled compatible open slots; ${result.orphans.length} remain orphaned on your reef.${fragmentMessage}`);
    }
  }, [playerCorals, playerReefCreatures]);

  useEffect(() => {
    const result = reconcileFoundationHealthToFixedPoint(opponent.corals, opponent.reefCreatureInstances ?? opponent.reefCreatures, opponent.orphanCreatures);
    if (!result.changed) return;
    setOpponent((current) => {
      if (!result.destroyed.length) return { ...current, corals: result.corals };
      const handLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
      const triggerResult = resolveFoundationDestructionTriggers(result.destructionWaves, current.hand, current.discardPile, handLimit);
      return { ...current, corals: result.corals, orphanCreatures: result.orphans, hand: triggerResult.hand, discardPile: triggerResult.discardPile };
    });
    if (result.destroyed.length) pushLog(`Opponent lost ${result.destroyed.map((foundation) => cardsById[foundation.cardId]?.name).join(", ")} when a continuous coral-health bonus ended.`);
  }, [opponent.corals, opponent.reefCreatures]);

  useEffect(() => {
    if (["setup", "opponent", "transition"].includes(gamePhase) || opponentThinking || eventOverlay?.opponentSequence || pendingEvents.some((event) => event.opponentSequence)) return;
    if (eventOverlay?.type === "choose-regenerate" || pendingEvents.some((event) => event.type === "choose-regenerate")) return;
    const eventRequiresResolution = String(eventOverlay?.type ?? "").startsWith("choose-")
      || ["onplay-target-prompt", "faceoff-ready", "school-attack-ready"].includes(eventOverlay?.type);
    if (playingCardId || attackContext || searchContext || pendingCreatureAction || faceoffRolling || eventRequiresResolution) return;
    const result = determineVictoryResult(playerVp, opponentVp, victoryTarget);
    if (!result) return;
    setGameResult((current) => {
      if (current) return current;
      return result.message;
    });
  }, [gamePhase, playerVp, opponentVp, victoryTarget, opponentThinking, eventOverlay?.type, eventOverlay?.opponentSequence, pendingEvents, playingCardId, attackContext, searchContext, pendingCreatureAction, faceoffRolling]);

  useEffect(() => {
    if (!isStoryMode || storyResultRecordedRef.current || !gameResult) return;
    const result = createStoryDuelResult({
      encounterId: storyMode?.encounterId ?? `story:${storyOpponentDeckId}`,
      opponentId: storyMode?.opponentId ?? storyMode?.encounterId ?? storyOpponentDeckId,
      opponentName: storyOpponentName,
      playerDeckId: storyPlayerDeckId,
      playerDeckSnapshot: storyPlayerDeckSnapshot,
      opponentDeckId: storyOpponentDeckId,
      victoryTarget: storyVictoryTarget,
      difficulty: storyDifficulty,
      playerVp,
      opponentVp,
      round,
      turn,
      message: gameResult,
    });
    storyResultRecordedRef.current = true;
    emitTutorialEvent(SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_FINISHED, {
      outcome: result.outcome,
      completionReason: result.completionReason,
      scores: result.scores,
    }, { actor: "system", phase: "result" });
    storyMode?.onResult?.(result);
    if (result.outcome === "victory") storyMode?.onVictory?.(result);
    else storyMode?.onDefeat?.(result);
  }, [gameResult, isStoryMode, opponentVp, playerVp, round, storyDifficulty, storyMode, storyOpponentDeckId, storyOpponentName, storyPlayerDeckId, storyPlayerDeckSnapshot, storyVictoryTarget, turn]);

  useEffect(() => {
    if (!faceoffRolling || !["faceoff-ready", "school-attack-ready"].includes(eventOverlay?.type)) return;
    const updatePreview = () => {
      const attackRoll = rollDie(eventOverlay.attackDice);
      const defenseRoll = eventOverlay.type === "faceoff-ready" ? rollDie(eventOverlay.defenseDice) : null;
      if (attackRoll && (eventOverlay.type === "school-attack-ready" || defenseRoll)) setFaceoffPreview({ attack: attackRoll.total, defense: defenseRoll?.total ?? 0 });
    };
    updatePreview();
    const interval = setInterval(updatePreview, 90);
    return () => clearInterval(interval);
  }, [faceoffRolling, eventOverlay]);

  useEffect(() => {
    if (round === 0) return;
    setRoundFlash(true);
    const timeout = setTimeout(() => setRoundFlash(false), 1400);
    return () => clearTimeout(timeout);
  }, [round]);

  useEffect(() => {
    if (!isPlacingCoral && !isUpgradingCoral) {
      setActionBlinkOn(true);
      return;
    }

    const interval = setInterval(() => setActionBlinkOn((value) => !value), 500);
    return () => clearInterval(interval);
  }, [isPlacingCoral, isUpgradingCoral]);

  useEffect(() => {
    if (modal === "hand" && hand.length) {
      setSelectedHandCard((current) => {
        const next = current && hand.includes(current) ? current : hand[0];
        setPlayError("");
        return next;
      });
    }
    if (modal !== "hand") {
      setSelectedHandCard(null);
      setPlayError("");
    }
  }, [modal, hand]);

  useEffect(() => {
    if (modal) setMobileHudPanel(null);
  }, [modal]);

  function getPlayerCardPlayCost(card) {
    return Math.max(0, getCardPlayCost(card, activeCondition) + getOpposingPlayCostModifier(card, opponentCorals, opponent.reefCreatures, opponent.orphanCreatures));
  }

  function getPlayerSchoolDensityRequirement(card) {
    return getEffectiveSchoolDensityRequirement(card, schoolDensityConditionIds, conditionDensityUses);
  }

  function consumePlayerSchoolDensityDiscount(card) {
    const result = consumeSchoolDensityConditionDiscount(card, schoolDensityConditionIds, conditionDensityUses);
    if (!result.discount) return null;
    setConditionDensityUses(result.usedByCondition);
    pushLog(`${result.discount.label} reduced ${card.name}'s School Density requirement by ${result.discount.amount}. Your one-time reduction from this condition is now used.`);
    return result.discount;
  }

  function commitPlayerSchoolDensity(instanceId, effectiveRequirement) {
    if (!instanceId) return;
    setSchoolDensityCommitmentsByInstanceId((current) => ({
      ...current,
      [instanceId]: Math.max(0, Number(effectiveRequirement ?? 0)),
    }));
  }

  function getDensityFreedBySacrificeChoice(choice) {
    return (choice?.candidates ?? []).reduce((total, entry) => {
      const densityInstanceId = entry.densityInstanceId ?? entry.instanceId;
      return total + Number(
        schoolDensityCommitmentsByInstanceId[densityInstanceId]
        ?? entry.schoolDensityRequirementAtPlay
        ?? entry.card?.schoolDensityRequirement
        ?? 0,
      );
    }, 0);
  }

  function getPlayerSchoolDensityAvailableForPlay(card) {
    const requiresSacrifice = (card?.specialRules ?? []).some((rule) => (
      /discard one oceanic predator or two oceanic fish/i.test(
        typeof rule === "string" ? rule : rule?.text ?? "",
      )
    ));
    if (!requiresSacrifice) return playerSchoolDensityState.available;
    const mostFreed = getPlayerOceanicSacrificeChoices(card).reduce(
      (maximum, choice) => Math.max(maximum, getDensityFreedBySacrificeChoice(choice)),
      0,
    );
    return Math.max(
      0,
      playerSchoolDensityState.capacity - playerSchoolDensityState.committed + mostFreed,
    );
  }

  function getPlayError(card, { allowUpcomingMain = false } = {}) {
    if (!card) return "Select a card first.";
    if (gameResult) return "This game has ended. Start a new game to continue playing.";
    if (attackContext) return "Finish or cancel the current attack before playing another card.";
    if (!isSetup && gamePhase !== "main" && !allowUpcomingMain) return "Cards can only be played during your action phase.";
    const blockedCopies = cardsBlockedFromPlayThisTurn.filter((cardId) => cardId === card.id).length;
    const copiesInHand = hand.filter((cardId) => cardId === card.id).length;
    if (blockedCopies && blockedCopies >= copiesInHand) {
      return `${card.name} was recovered by Ocean Jake and cannot be played until your next turn.`;
    }
    if (isSetup && !(isFoundationCard(card) && Number(card.stage ?? 0) === 0)) {
      return "During setup, play a base Coral or Creature School before the first round begins.";
    }
    if (tutorialUsesScriptedScenario && isSetup && card.id !== "mustard-hill-coral-base") {
      return `${tutorialGuide.name} has prepared Mustard Hill Coral for this guided setup. Use it so the later RP lesson stays on course.`;
    }
    if (
      tutorialUsesScriptedScenario
      && !isSetup
      && tutorialCurrentCheckpoint?.id === "tutorial-build-card"
      && card.id !== scriptedFoundationLessonCardId
    ) {
      return `${tutorialGuide.name} has prepared ${cardsById[scriptedFoundationLessonCardId]?.name ?? "the highlighted Foundation card"} for this economy lesson.`;
    }
    const conditionRestriction = getConditionPlayRestriction(card, activeCondition);
    if (conditionRestriction) return conditionRestriction;
    if (card.kind === CardKind.CREATURE && !isCreatureSchool(card) && !cardUsesOpponentReef(card) && !hasCoralInPlay) {
      return "You need a coral in play before you can slot this creature.";
    }
    const unmetRequirement = (card.playRequirements ?? []).find((requirement) => {
      if (requirement.type === "kindInPlay" && requirement.requiredKind === CardKind.HABITAT) return !playerHabitats.length;
      if (requirement.type === "cardInPlay" && requirement.requiredKind === CardKind.HABITAT) {
        return !playerHabitats.includes(requirement.cardId);
      }
      return false;
    });
    if (unmetRequirement) return unmetRequirement.text ?? "You do not meet this card's play requirement.";
    const habitatRequirementError = getHabitatRequirementError(card, playerHabitats);
    if (habitatRequirementError) return habitatRequirementError;
    const compositionRequirementError = getCompositionRequirementError(card, playerCorals, [...playerReefCreatures, ...playerOrphanCreatures.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])]);
    if (compositionRequirementError) return compositionRequirementError;
    const densityRequirement = getPlayerSchoolDensityRequirement(card);
    const densityAvailableForPlay = getPlayerSchoolDensityAvailableForPlay(card);
    if (densityRequirement.effectiveRequirement > densityAvailableForPlay) {
      const discountMessage = densityRequirement.discount ? ` ${densityRequirement.discount.label} reduces its printed ${densityRequirement.printedRequirement} requirement to ${densityRequirement.effectiveRequirement}.` : "";
      const overflowMessage = playerSchoolDensityState.overCapacity
        ? ` Your ecosystem is already ${playerSchoolDensityState.overCapacity} over capacity.`
        : "";
      return `${card.name} needs ${densityRequirement.effectiveRequirement} available School Density, but only ${densityAvailableForPlay} of ${playerSchoolDensity} can be open for this play (${playerSchoolDensityState.committed} currently committed).${overflowMessage}${discountMessage}`;
    }
    if (cardUsesOpponentReef(card)) {
      const opponentCoralSlots = opponentCoralCards.flatMap((coral) => coral.slots ?? []);
      if (!opponentCoralSlots.length) return `${card.name} needs an opponent coral with a slot before it can invade.`;
      if (!opponentCoralSlots.some((slot) => !slot.cardId)) return `All opponent coral slots are occupied, so ${card.name} has nowhere to invade.`;
    } else if (card.kind === CardKind.CREATURE && card.zone !== CreatureZone.OCEAN && !isCreatureSchool(card)) {
      const compatibleSlots = playerCorals.flatMap((coral) =>
        coral.slots.filter((slot) => canCardOccupySlot(card, slot)),
      );
      const allowedHostTags = getSpecialPlacementHostTags(card);
      const compatibleHostSlots = allowedHostTags.length ? playerCorals.flatMap((coral) => coral.slots.filter((slot) => {
        const host = cardsById[slot.cardId];
        return host && allowedHostTags.some((tag) => host.tags?.includes(tag));
      })) : [];
      if (!compatibleSlots.length && !compatibleHostSlots.length) {
        return `None of your corals have a compatible slot for ${card.name}.`;
      }
      if (!compatibleSlots.some((slot) => !slot.cardId) && !compatibleHostSlots.some((slot) => canHostSpecialPlacement(cardsById[slot.cardId], card, slot.hostedCardIds))) {
        return compatibleHostSlots.length
          ? `All compatible slots and special host spaces for ${card.name} are occupied.`
          : `All compatible slots for ${card.name} are occupied.`;
      }
    }
    if (isFoundationCard(card) && Number(card.stage ?? 0) > 0) {
      const matchingCorals = playerCorals.filter((coral) => {
        const currentCard = cardsById[coral.cardId];
        return currentCard?.upgrade?.canUpgrade && currentCard.upgrade.nextCardId === card.id;
      });
      if (!matchingCorals.length) {
        return `You do not have the previous stage of ${card.name} in your ecosystem.`;
      }

      const conditionFreeCorals = matchingCorals.filter((coral) => !coralIsStunned(coral));
      if (!conditionFreeCorals.length) {
        return `A Stunned Coral cannot be upgraded until the end of its controller's next turn, unless Coral Heal clears Stunned first.`;
      }

      const matureCorals = conditionFreeCorals.filter(
        (coral) => turn > (coral.stageEnteredTurn ?? coral.playedTurn ?? turn),
      );
      if (!matureCorals.length) {
        return `${card.name} must remain in your ecosystem for a full turn before it can be upgraded.`;
      }

      const minimumUpgradeCost = Math.min(
        ...matureCorals.map((coral) => Number(cardsById[coral.cardId]?.upgrade?.cost?.rp ?? card.cost?.rp ?? 0)),
      );
      if (rp < minimumUpgradeCost) {
        return `Not enough RP — this upgrade costs ${minimumUpgradeCost} RP.`;
      }
      return "";
    }
    if (card.kind === CardKind.SUPPORT) {
      if (round <= supportBlockedUntilRound) return `Echo Disruption prevents you from playing Support cards this turn.`;
      if (supportLockSourceId) return `${cardsById[supportLockSourceId]?.name ?? "A Support card"} says you cannot play another Support card this turn.`;
      const supportCost = getPlayerCardPlayCost(card);
      if (rp < supportCost) return `Not enough RP — ${card.name} costs ${supportCost} RP.`;
      if (card.id === "spearfishing") {
        const hasTarget = playerCorals.some((coral) => coral.slots.some((slot) => {
          const target = cardsById[slot.cardId];
          return cardCanBeSpearfished(target, slot, "player");
        })) || playerReefCreatures.some((cardId) => [CardCategory.FISH, CardCategory.PREDATOR].includes(cardsById[cardId]?.category))
          || playerOrphanCreatures.some((entry) => cardCanBeSpearfished(cardsById[entry.cardId], entry, "player"));
        return hasTarget ? "" : "Spearfishing needs a Fish or Predator on your reef to discard.";
      }
      if (card.id === "whirlpool" || card.id === "super-whirlpool") return opponentCoralCards.length ? "" : `${card.name} needs an opponent coral to target.`;
      if (card.id === "coral-heal") return playerCoralCards.some((coral) => (coral.statuses ?? []).length || Number(coral.rpPenaltyNextTurn ?? 0) > 0) ? "" : "Coral Heal needs one of your corals to have a removable status effect.";
      if (card.id === "robotic-survey" || card.id === "explorer-jordan") return foundationDeck.length || palsDeck.length ? "" : `${card.name} cannot inspect a deck because both personal decks are empty.`;
      if (card.id === "poison-heal") return poisonImmunityNextPredatorAttack ? "Poison Heal is already protecting your next attack." : "";
      if (card.id === "rov-lights") {
        if (rovLightsActive) return "ROV Lights is already active for this turn.";
        const deepTargets = [...opponentCorals.flatMap((foundation) => foundation.slots.flatMap((slot) => getSlotCardIds(slot).map((cardId) => cardsById[cardId]))), ...(opponent.reefCreatures ?? []).map((cardId) => cardsById[cardId]), ...(opponent.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])].map((cardId) => cardsById[cardId]))].filter((target) => target?.zone === CreatureZone.DEEP);
        return deepTargets.length ? "" : "ROV Lights needs an opponent Deep creature to target this turn.";
      }
      if (card.id === "dr-evans") {
        return foundationDeck.length || palsDeck.length ? "" : "Dr. Evans cannot draw because both personal decks are empty.";
      }
      if (card.id === "coral-cement") {
        return playerCoralCards.some((coral) => (coral.health ?? coral.maxHealth) < coral.maxHealth)
          ? ""
          : "Coral Cement needs one of your corals to have damage before it can be played.";
      }
      if (card.id === "restocking") {
        const candidates = discardPile.filter((cardId) => {
          const candidate = cardsById[cardId];
          return candidate?.kind === CardKind.CREATURE && candidate.category === CardCategory.FISH;
        });
        return candidates.length ? "" : "Restocking needs a Fish in your discard pile.";
      }
      if (card.id === "recovery") return discardPile.length ? "" : "Recovery has no card to recover because your discard pile is empty.";
      if (card.id === "scientist-jes") {
        const searchEffect = (card.effects ?? []).find((effect) => effect.type === EffectType.SEARCH_DECK);
        const hasHabitatToSearch = [...foundationDeck, ...palsDeck].some((cardId) => cardMatchesSearchCriteria(cardsById[cardId], searchEffect));
        const hasCardToDraw = foundationDeck.length || palsDeck.length;
        return hasHabitatToSearch || hasCardToDraw
          ? ""
          : "Scientist Jes cannot be played because both personal decks are empty and no Habitat remains to search for.";
      }
      const searchEffect = (card.effects ?? []).find((effect) => effect.type === EffectType.SEARCH_DECK);
      if (!searchEffect) {
        return `${card.name} has a targeted or special effect that is not implemented yet.`;
      }
      const candidates = [...foundationDeck, ...palsDeck].filter((cardId) => {
        const candidate = cardsById[cardId];
        if (!candidate || candidate.kind !== searchEffect.targetKind) return false;
        if (searchEffect.targetCategories?.length && !searchEffect.targetCategories.includes(candidate.category)) return false;
        if (searchEffect.targetTags?.some((tag) => !candidate.tags?.includes(tag))) return false;
        if (searchEffect.excludeTags?.some((tag) => candidate.tags?.includes(tag))) return false;
        return true;
      });
      return candidates.length ? "" : `${card.name} has no matching card remaining in your decks.`;
    }
    const cost = getPlayerCardPlayCost(card);
    if (rp < cost) return `Not enough RP — need ${cost} RP.`;
    return "";
  }

  function clampZoom(zoom) {
    return Math.min(2.2, Math.max(0.12, zoom));
  }

  function zoomEcosystemToFit(owner) {
    const isOpponent = owner === "opponent";
    const element = isOpponent ? opponentEcosystemRef.current : ecosystemRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const corals = isOpponent ? opponentCorals : playerCorals;
    const floatingCardsPresent = isOpponent
      ? opponent.habitats.length || opponent.reefCreatures.length || (opponent.orphanCreatures?.length ?? 0)
      : playerHabitats.length || playerReefCreatures.length || playerOrphanCreatures.length;
    const positions = corals.map((coral, index) => {
      if (!isOpponent) return { x: coral.x, y: coral.y, absolute: false };
      const offset = getOpponentCoralGridOffset(index, corals.length);
      return { x: rect.width / 2 + offset.x, y: rect.height / 2 + offset.y + (floatingCardsPresent ? 360 : 0), absolute: true };
    });
    if (!positions.length && !floatingCardsPresent) {
      (isOpponent ? setOpponentEcosystemZoom : setEcosystemZoom)(1);
      (isOpponent ? setOpponentEcosystemOffset : setEcosystemOffset)({ x: 0, y: 0 });
      return;
    }
    const coralWidth = isOpponent ? 180 : 240;
    const coralHeight = isOpponent ? 210 : 280;
    const bounds = corals.flatMap((coral, coralIndex) => {
      const centerX = positions[coralIndex].absolute ? positions[coralIndex].x : (positions[coralIndex].x / 100) * rect.width;
      const centerY = positions[coralIndex].absolute ? positions[coralIndex].y : (positions[coralIndex].y / 100) * rect.height;
      const anchors = isOpponent ? getOpponentSlotPositions(coral.slots.length) : getBracketSlotPositions(coral.slots.length);
      const cardBounds = [{ minX: centerX - coralWidth / 2, maxX: centerX + coralWidth / 2, minY: centerY - coralHeight / 2, maxY: centerY + coralHeight / 2 }];
      coral.slots.forEach((slot, slotIndex) => {
        const position = slot.position ?? anchors[slotIndex];
        const slotX = centerX + (Number.parseFloat(position.left) - 50) / 100 * coralWidth;
        const slotY = centerY + (Number.parseFloat(position.top) - 50) / 100 * coralHeight;
        cardBounds.push({ minX: slotX - 70, maxX: slotX + 70, minY: slotY - 85, maxY: slotY + 85 });
      });
      return cardBounds;
    });
    if (floatingCardsPresent) bounds.push({ minX: 0, maxX: rect.width, minY: 0, maxY: 330 });
    const padding = 36;
    const minX = Math.min(...bounds.map((entry) => entry.minX)) - padding;
    const maxX = Math.max(...bounds.map((entry) => entry.maxX)) + padding;
    const minY = Math.min(...bounds.map((entry) => entry.minY)) - padding;
    const maxY = Math.max(...bounds.map((entry) => entry.maxY)) + padding;
    const nextZoom = clampZoom(Math.min((rect.width - 48) / Math.max(1, maxX - minX), (rect.height - 48) / Math.max(1, maxY - minY), 1.15));
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const nextOffset = {
      x: (rect.width / 2 - contentCenterX) * nextZoom,
      y: (rect.height / 2 - contentCenterY) * nextZoom,
    };
    (isOpponent ? setOpponentEcosystemZoom : setEcosystemZoom)(nextZoom);
    (isOpponent ? setOpponentEcosystemOffset : setEcosystemOffset)(nextOffset);
  }

  function canUseSlotWithCard(slot, cardId) {
    const card = cardsById[cardId];
    if (!slot || !card) return false;
    return canCardOccupySlot(card, slot) && !slot.cardId;
  }

  function canHostCardInSlot(slot, cardId) {
    const hostCard = cardsById[slot?.cardId];
    const candidateCard = cardsById[cardId];
    return Boolean(hostCard && candidateCard && canHostSpecialPlacement(hostCard, candidateCard, slot.hostedCardIds));
  }

  function findCoralBySlotId(slotId) {
    return playerCorals.find((coral) => coral.slots.some((slot) => slot.id === slotId));
  }

  function getPlayerAttackTargets(attacker, attack, opponentState = opponent, ownFoundations = playerCorals, ownOrphans = playerOrphanCreatures) {
    const canTargetHidden = cardCanTargetHiddenByAbyss(attacker, attack);
    const targets = (opponentState.corals ?? []).flatMap((coral) => coral.slots.flatMap((slot) => {
      const entries = [
        { cardId: slot.cardId, slotId: slot.id, instanceId: getSlotTargetInstanceId(slot), controller: slot.controller },
        ...(slot.hostedCardIds ?? []).map((cardId, hostedIndex) => ({ cardId, slotId: getHostedTargetSlotId(slot.id, hostedIndex), instanceId: `hosted:${getHostedTargetSlotId(slot.id, hostedIndex)}`, controller: slot.controller })),
      ];
      return entries.filter((entry) => {
        const targetCard = cardsById[entry.cardId];
        return entry.controller !== "player" && cardMatchesAttackTarget(targetCard, attack) && (!cardIsHiddenByAbyss(targetCard, opponentState.habitats) || canTargetHidden);
      }).map((entry) => ({ coralId: coral.id, slotId: entry.slotId, instanceId: entry.instanceId }));
    }));
    (opponentState.reefCreatureInstances ?? []).forEach((instance) => {
      const targetCard = cardsById[instance.cardId];
      if (cardMatchesAttackTarget(targetCard, attack) && (!cardIsHiddenByAbyss(targetCard, opponentState.habitats) || canTargetHidden)) {
        targets.push({ coralId: "__reef__", slotId: `reef-${instance.instanceId}`, instanceId: instance.instanceId });
      }
    });
    (opponentState.orphanCreatures ?? []).forEach((entry, orphanIndex) => {
      if (entry.invasiveOwner === "player") return;
      const orphanInstanceId = entry.instanceId ?? `legacy-${orphanIndex}`;
      const orphanTargets = [
        { cardId: entry.cardId, slotId: `orphan-${orphanInstanceId}`, instanceId: entry.instanceId ?? `orphan:${orphanInstanceId}` },
        ...(entry.hostedCardIds ?? []).flatMap((cardId, hostedIndex) => cardId ? [{
          cardId,
          slotId: getOrphanHostedTargetSlotId(orphanInstanceId, hostedIndex),
          instanceId: `hosted:${getOrphanHostedTargetSlotId(orphanInstanceId, hostedIndex)}`,
        }] : []),
      ];
      orphanTargets.forEach((entryTarget) => {
        const targetCard = cardsById[entryTarget.cardId];
        if (cardMatchesAttackTarget(targetCard, attack) && (!cardIsHiddenByAbyss(targetCard, opponentState.habitats) || canTargetHidden)) {
          targets.push({ coralId: "__orphan__", slotId: entryTarget.slotId, instanceId: entryTarget.instanceId });
        }
      });
    });
    (opponentState.corals ?? []).forEach((foundation) => {
      const targetCard = cardsById[foundation.cardId];
      if (isCreatureSchool(targetCard) && cardMatchesAttackTarget(targetCard, attack)) {
        targets.push({ coralId: foundation.id, slotId: "__foundation__", instanceId: `foundation:${foundation.id}` });
      }
    });
    getInvasiveCreatureTargets(ownFoundations, "opponent").forEach((target) => {
      const targetCard = cardsById[target.cardId];
      if (cardMatchesAttackTarget(targetCard, attack)) {
        targets.push({
          coralId: "__own_invader__",
          hostCoralId: target.coralId,
          slotId: target.slotId,
          instanceId: target.instanceId,
        });
      }
      if (card.id === "ocean-jake") return lostZone.length ? "" : "Ocean Jake needs a card in your Lost Zone to recover.";
    });
    getInvasiveOrphanTargets(ownOrphans, "opponent").forEach((target) => {
      const targetCard = cardsById[target.cardId];
      if (cardMatchesAttackTarget(targetCard, attack)) {
        targets.push({
          coralId: "__own_invader_orphan__",
          slotId: `orphan-${target.instanceId}`,
          instanceId: target.instanceId,
          ownOrphanIndex: target.orphanIndex,
        });
      }
    });
    return targets;
  }

  function createPlayerAttackContext(baseContext, attacker, attack, targets) {
    const repeatCount = getDynamicAttackRepeat(attacker, attack, playerCorals, playerReefCreatures, playerHabitats);
    const uniqueTargets = targets.filter((target, index, allTargets) => target.instanceId && allTargets.findIndex((candidate) => candidate.instanceId === target.instanceId) === index);
    return {
      ...baseContext,
      targets: uniqueTargets,
      allTargets: uniqueTargets,
      sequence: createAttackSequence(repeatCount),
      costCommitted: false,
    };
  }

  function commitPlayerAttackCost(context, attacker, attack) {
    if (context.costCommitted) return;
    const attackerActionKey = context.attackerActionKey ?? context.attackerSlotId;
    if (!context.onPlay) setUsedAttackers((current) => current.includes(attackerActionKey) ? current : [...current, attackerActionKey]);
    if (!context.onPlay && attack.skipNextTurn) setActionCooldowns((current) => ({ ...current, [attackerActionKey]: turn + 2 }));
    setRp((current) => Math.max(0, current - attack.actionCost));
    if (poisonImmunityNextPredatorAttack) setPoisonImmunityNextPredatorAttack(false);
  }

  function completePlayerAttackStep(targetInstanceId, resolution, { attackerSurvives = true, invalidTargetInstanceIds = [], nextTargets = null } = {}) {
    const recorded = recordAttackResolution(attackContext?.sequence ?? createAttackSequence(1), { targetInstanceId, resolution });
    if (!recorded.accepted) {
      pushLog(recorded.error);
      return { continues: false, complete: true, error: recorded.error };
    }
    const invalidTargets = new Set(invalidTargetInstanceIds);
    const targetPool = nextTargets ?? attackContext?.allTargets ?? attackContext?.targets ?? [];
    const remainingTargets = getRemainingAttackTargets(recorded.sequence, targetPool).filter((target) => !invalidTargets.has(target.instanceId));
    const continues = attackerSurvives && !recorded.sequence.complete && remainingTargets.length > 0;
    emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.ATTACK_RESOLVED, {
      accepted: true,
      attackerCardId: attackContext?.attackerCardId ?? null,
      targetInstanceId,
      resolution,
      resolvedCount: recorded.sequence.resolutions.length,
      requiredCount: recorded.sequence.requiredAttacks,
      onPlay: Boolean(attackContext?.onPlay),
    }, { phase: "main" });
    if (continues) {
      setAttackContext({ ...attackContext, sequence: recorded.sequence, targets: remainingTargets, allTargets: targetPool, costCommitted: true });
    } else {
      setAttackContext(null);
      setInspectedCard(null);
    }
    return {
      continues,
      complete: !continues,
      resolvedCount: recorded.sequence.resolutions.length,
      requiredCount: recorded.sequence.requiredAttacks,
      stoppedForNoTargets: attackerSurvives && !recorded.sequence.complete && remainingTargets.length === 0,
    };
  }

  function getAttackSequenceContinuationMessage(sequenceResult) {
    if (sequenceResult?.continues) return ` This was attack ${sequenceResult.resolvedCount} of ${sequenceResult.requiredCount}; close this result and choose a different highlighted target.`;
    if (sequenceResult?.stoppedForNoTargets) return " No different legal targets remain, so the repeated attack ends.";
    return "";
  }

  function damageOpponentFoundation(coralId, amount, sourceCard) {
    if (!amount || !opponentCorals.length) return;
    const target = opponentCorals.find((coral) => coral.id === coralId);
    const targetCard = cardsById[target?.cardId];
    if (!target || (targetCard?.kind !== CardKind.CORAL && !isCreatureSchool(targetCard))) return;
    const sourceName = sourceCard?.name ?? "Card effect";
    const abilityName = getOnPlayAbilityName(sourceCard);
    const followupOnPlayAttack = eventOverlay?.followupOnPlayAttack ?? null;
    const result = applyDamage(target.health, amount);
    let opponentStateAfterDamage = opponent;
    let message;
    if (result.destroyed) {
      const handLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
      const redistributed = redistributeOrphanCreatures(opponent.corals.filter((coral) => coral.id !== target.id), [...(opponent.orphanCreatures ?? []), ...getOrphanEntriesFromFoundation(target)]);
      const triggerResult = resolveFoundationDestructionTriggers([[target]], opponent.hand, opponent.discardPile, handLimit);
      const nextOpponentProjection = projectNormalizedOpponentState(reconcileOpponentInstances(opponent, {
        ...opponent,
        corals: redistributed.corals,
        orphanCreatures: redistributed.orphans,
        hand: triggerResult.hand,
        discardPile: triggerResult.discardPile,
      }));
      opponentStateAfterDamage = nextOpponentProjection.state;
      setOpponent(opponentStateAfterDamage);
      const fragmentTrigger = triggerResult.triggers[0];
      const fragmentMessage = fragmentTrigger
        ? fragmentTrigger.cardsToHand.length
          ? ` Fragment returned ${fragmentTrigger.cardsToHand.length} ${cardsById[fragmentTrigger.targetCardId]?.name ?? "matching card"}(s) to the opponent's hand.`
          : fragmentTrigger.cardsToDiscard.length
            ? " Fragment found its card, but the hand limit kept it in discard."
            : ` Fragment triggered but found no ${cardsById[fragmentTrigger.targetCardId]?.name ?? "matching card"}.`
        : "";
      const collapseMessage = getContinuousHealthCollapseMessage(nextOpponentProjection.collateral);
      message = `${sourceName} dealt ${result.appliedDamage} damage and destroyed the opponent's ${targetCard?.name ?? "foundation"}. The foundation was discarded; its creatures filled compatible slots or remained orphaned on the opponent's reef.${fragmentMessage}${collapseMessage ? ` ${collapseMessage}` : ""}`;
    } else {
      opponentStateAfterDamage = {
        ...opponent,
        corals: opponent.corals.map((coral) => coral.id === target.id ? { ...coral, health: result.remainingHealth } : coral),
      };
      setOpponent(opponentStateAfterDamage);
      message = `${sourceName} dealt ${result.appliedDamage} damage to the opponent's ${cardsById[target.cardId]?.name}. ${result.remainingHealth}/${target.maxHealth} HP remains.`;
    }
    pushLog(message);
    setEventOverlay({ type: "impact-result", sourceCardId: sourceCard?.id, title: `Player's ${sourceName} used ${abilityName}`, message, success: result.destroyed });
    if (followupOnPlayAttack) {
      beginOnPlayAttack(sourceCard, followupOnPlayAttack.coralId, followupOnPlayAttack.slotId, followupOnPlayAttack.reefIndex, true, opponentStateAfterDamage);
    }
  }

  function attackWithCreature(coralId, slotId) {
    const attackerSlot = playerCorals.find((coral) => coral.id === coralId)?.slots.find((slot) => slot.id === slotId);
    if (attackerSlot?.invasiveOwner === "opponent") {
      pushLog(`${cardsById[attackerSlot.cardId]?.name ?? "That invader"} belongs to the opponent, so you cannot use its actions.`);
      return;
    }
    const attackerActionKey = attackerSlot ? getSlotActionKey(attackerSlot) : slotId;
    if (gameResult || gamePhase !== "main" || playingCardId || searchContext || pendingCreatureAction || usedAttackers.includes(attackerActionKey) || turn < Number(actionCooldowns[attackerActionKey] ?? 0)) return;
    const attackerReefIndex = coralId == null && String(slotId).startsWith("reef-") ? findZoneIndexBySlotId(playerReefCreatureInstances, slotId, "reef-") : -1;
    const attackerOrphanIndex = coralId == null && String(slotId).startsWith("orphan-") ? findZoneIndexBySlotId(playerOrphanCreatures, slotId, "orphan-") : -1;
    if (attackerOrphanIndex >= 0 && !getLocallyControlledOrphans([playerOrphanCreatures[attackerOrphanIndex]], "player").length) {
      pushLog(`${cardsById[playerOrphanCreatures[attackerOrphanIndex]?.cardId]?.name ?? "That invader"} belongs to the opponent, so you cannot use its actions.`);
      return;
    }
    const attackerCardId = attackerReefIndex >= 0 ? playerReefCreatures[attackerReefIndex] : attackerOrphanIndex >= 0 ? playerOrphanCreatures[attackerOrphanIndex]?.cardId : attackerSlot?.cardId;
    const attacker = cardsById[attackerCardId];
    const academyBlock = getAcademyActionBlock({
      route: scriptedFinishRoute,
      help: tutorialHelp,
      actionKey: attackerActionKey,
      target: "attack-button",
      guideName: tutorialGuide.name,
    });
    if (academyBlock) {
      setTutorialHelpDismissedId(null);
      setPlayError(academyBlock);
      pushLog(academyBlock);
      return;
    }
    const attack = getBasicAttackEffect(attacker);
    if (!attack) {
      pushLog(`${attacker?.name ?? "This creature"} has no supported basic attack action.`);
      return;
    }
    if (rp < attack.actionCost) {
      pushLog(`${attacker.name}'s ${attack.actionName} costs ${attack.actionCost} RP, but you only have ${rp} RP.`);
      return;
    }
    const targets = getPlayerAttackTargets(attacker, attack);
    if (!targets.length) {
      pushLog(`${attacker.name} has no legal opponent creature target for ${attack.actionName}.`);
      return;
    }
    setAttackContext(createPlayerAttackContext({ attackerCoralId: coralId, attackerSlotId: slotId, attackerActionKey, attackerCardId, attackerReefIndex, attackerOrphanIndex }, attacker, attack, targets));
    pushLog(`Choose a highlighted opponent creature for ${attacker.name}'s ${attack.actionName}, or cancel the attack.`);
  }

  function beginOnPlayAttack(card, coralId, slotId, reefIndex = -1, forcePending = false, opponentState = opponent) {
    let attack = getOnPlayAttackEffect(card);
    if (!attack) return false;
    const ensnare = getOnPlayEnsnare(card);
    if (ensnare) {
      attack = { ...attack, ensnare: { actionName: ensnare.actionName, penalty: ensnare.penalty } };
    }
    if (nextOnPlayAttackBonus) {
      attack = { ...attack, flatBonus: Number(attack.flatBonus ?? 0) + Number(nextOnPlayAttackBonus.amount ?? 0), flatBonusSource: cardsById[nextOnPlayAttackBonus.sourceCardId]?.name ?? "Highlight" };
      setNextOnPlayAttackBonus(null);
    }
    const targets = getPlayerAttackTargets(card, attack, opponentState);
    if (!targets.length) {
      const message = `${card.name}'s ${attack.actionName} had no legal opponent target.`;
      pushLog(message);
      const noTargetEvent = { type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${attack.actionName}`, message, success: false };
      if (forcePending) setPendingEvents((events) => [...events, noTargetEvent]);
      else queueEvents([noTargetEvent]);
      return true;
    }
    setAttackContext(createPlayerAttackContext({ attackerCoralId: coralId, attackerSlotId: slotId, attackerCardId: card.id, attackerReefIndex: reefIndex, attackOverride: attack, onPlay: true }, card, attack, targets));
    const message = `${card.name}'s On Play ability ${attack.actionName} triggered automatically. Close this event, then choose one of the highlighted legal targets in the opponent's ecosystem. This mandatory On Play sequence must finish before your next main-phase action.`;
    pushLog(message);
    const targetPromptEvent = { type: "onplay-target-prompt", sourceCardId: card.id, title: `Player's ${card.name} used ${attack.actionName}`, message };
    if (forcePending) setPendingEvents((events) => [...events, targetPromptEvent]);
    else queueEvents([targetPromptEvent]);
    return true;
  }

  function resolvePlayerAttack(targetCoralId, targetSlotId, rollNow = false, stoppedRoll = null) {
    const selectedTarget = attackContext?.targets.find((target) => target.coralId === targetCoralId && target.slotId === targetSlotId);
    if (!selectedTarget || !canTargetInAttackSequence(attackContext.sequence, selectedTarget.instanceId)) return;
    const attackerSlot = playerCorals.find((coral) => coral.id === attackContext.attackerCoralId)?.slots.find((slot) => slot.id === attackContext.attackerSlotId);
    const attacker = cardsById[attackContext.attackerCardId ?? attackerSlot?.cardId];
    let attack = attackContext.attackOverride ?? getBasicAttackEffect(attacker);
    let ensnareSummary = "";
    if (rollNow && attack?.ensnare) {
      const ensnareResolution = resolveEnsnareForAttack(attack, Math.random);
      attack = ensnareResolution.attack;
      ensnareSummary = ` Ensnare flipped ${ensnareResolution.coinResult}.${ensnareResolution.applied ? ` The defender has -${ensnareResolution.penalty} defense for this attack.` : " No defense penalty was applied."}`;
    }
    const reefIndex = targetCoralId === "__reef__" ? findZoneIndexBySlotId(opponent.reefCreatureInstances, targetSlotId, "reef-") : -1;
    const orphanHostedTarget = targetCoralId === "__orphan__" ? parseOrphanHostedTargetSlotId(targetSlotId) : null;
    const orphanIndex = targetCoralId === "__orphan__"
      ? orphanHostedTarget
        ? (opponent.orphanCreatures ?? []).findIndex((entry) => entry.instanceId === orphanHostedTarget.orphanInstanceId)
        : findZoneIndexBySlotId(opponent.orphanCreatures, targetSlotId, "orphan-")
      : -1;
    const targetsOwnInvader = targetCoralId === "__own_invader__" || targetCoralId === "__own_invader_orphan__";
    const targetsOwnOrphanInvader = targetCoralId === "__own_invader_orphan__";
    const ownInvaderOrphanEntry = targetsOwnOrphanInvader ? playerOrphanCreatures[selectedTarget.ownOrphanIndex] : null;
    const hostedTarget = targetsOwnInvader ? null : parseHostedTargetSlotId(targetSlotId);
    const targetCoral = targetsOwnInvader
      ? targetsOwnOrphanInvader
        ? null
        : playerCorals.find((coral) => coral.id === selectedTarget.hostCoralId)
      : opponentCorals.find((coral) => coral.id === targetCoralId);
    const targetSlot = targetCoral?.slots.find((slot) => slot.id === (hostedTarget?.slotId ?? targetSlotId));
    const orphanEntry = orphanIndex >= 0 ? opponent.orphanCreatures?.[orphanIndex] : null;
    const hostedIndex = orphanHostedTarget?.hostedIndex ?? hostedTarget?.hostedIndex ?? -1;
    const targetCardId = targetSlotId === "__foundation__"
      ? targetCoral?.cardId
      : targetsOwnOrphanInvader
        ? ownInvaderOrphanEntry?.cardId
        : reefIndex >= 0
          ? opponent.reefCreatures?.[reefIndex]
          : orphanHostedTarget
            ? orphanEntry?.hostedCardIds?.[orphanHostedTarget.hostedIndex]
            : orphanIndex >= 0
              ? orphanEntry?.cardId
              : hostedTarget
                ? targetSlot?.hostedCardIds?.[hostedTarget.hostedIndex]
                : targetSlot?.cardId;
    const targetEntry = {
      coral: targetCoral,
      slot: targetSlot,
      reefIndex,
      orphanIndex,
      orphanInstanceId: orphanEntry?.instanceId ?? null,
      hostCardId: orphanHostedTarget ? orphanEntry?.cardId : targetSlot?.cardId,
      hostedIndex,
      card: cardsById[targetCardId],
      instanceId: selectedTarget.instanceId,
      targetsOwnInvader,
      targetsOwnOrphanInvader,
    };
    if (!attacker || !attack || !targetEntry.card) {
      setAttackContext(null);
      pushLog("The selected attack target is no longer valid.");
      return;
    }
    const flashingAlarmBonus = getFlashingAlarmAttackBonus(flashingAlarmAttackBonus);
    const opponentFlashingAlarmAfterAttack = rollNow
      ? triggerFlashingAlarm(opponent.flashingAlarmAttackBonus, targetEntry.card)
      : opponent.flashingAlarmAttackBonus;
    const flashingAlarmTriggered = opponentFlashingAlarmAfterAttack !== opponent.flashingAlarmAttackBonus;
    const flashingAlarmTriggerMessage = flashingAlarmTriggered
      ? ` ${targetEntry.card.name}'s Flashing Alarm will give the opponent +${opponentFlashingAlarmAfterAttack.amount} on every attack roll during its next turn.`
      : "";
    const targetAvoidance = getTargetAvoidance(targetEntry.card);
    if (rollNow && targetAvoidance) {
      const coinResult = Math.random() < 0.5 ? "heads" : "tails";
      if (coinResult === targetAvoidance.failureResult) {
        commitPlayerAttackCost(attackContext, attacker, attack);
        if (flashingAlarmTriggered) {
          setOpponent((current) => ({
            ...current,
            flashingAlarmAttackBonus: triggerFlashingAlarm(current.flashingAlarmAttackBonus, targetEntry.card),
          }));
        }
        const sequenceResult = completePlayerAttackStep(selectedTarget.instanceId, { outcome: "avoided", abilityName: targetAvoidance.abilityName });
        setFaceoffRolling(false);
        setFaceoffPreview(null);
        const message = `${targetEntry.card.name} used ${targetAvoidance.abilityName} and flipped ${coinResult}, so ${attacker.name}'s ${attack.actionName} failed before dice were rolled.${ensnareSummary}${flashingAlarmTriggerMessage}${getAttackSequenceContinuationMessage(sequenceResult)}`;
        pushLog(message);
        setEventOverlay({ type: "faceoff-result", sourceCardId: targetEntry.card.id, defenderCardId: attacker.id, title: `${targetAvoidance.abilityName} Evaded the Attack`, message, success: false, continueAttackSequence: sequenceResult.continues });
        return;
      }
    }
    if (targetSlotId === "__foundation__" && isCreatureSchool(targetEntry.card)) {
      if (!rollNow) {
        setEventOverlay({ type: "school-attack-ready", sourceCardId: attacker.id, defenderCardId: targetEntry.card.id, title: `${attacker.name} attacks ${targetEntry.card.name}`, message: `${targetEntry.card.name} has no defense roll. Stop the ${attack.attackDice} attack roll; its result deals ×10 damage.`, targetCoralId, targetSlotId, attackDice: attack.attackDice });
        setFaceoffPreview(null);
        return;
      }
      const hasDisadvantage = attackerHasDisadvantageFromMassive(targetEntry.card);
      const hasAdvantage = cardHasAttackAdvantage(attacker, targetEntry.card, playerHabitats, attack);
      const useAdvantage = hasAdvantage && !hasDisadvantage;
      const useDisadvantage = hasDisadvantage && !hasAdvantage;
      const attackRolls = [(() => {
        const first = stoppedRoll ? { total: stoppedRoll.attack } : rollDie(attack.attackDice);
        const second = useAdvantage || useDisadvantage ? rollDie(attack.attackDice) : null;
        const modifier = getAttackConditionalModifier(attacker, { ...targetEntry.card, health: targetCoral.health, maxHealth: targetCoral.maxHealth }, playerHabitats, playerCorals, playerReefCreatures, attack, playerOrphanCreatures);
        const baseTotal = second ? (useAdvantage ? Math.max(first.total, second.total) : Math.min(first.total, second.total)) : first?.total;
        const rolledBonus = getRolledAttackBonus(attack, baseTotal, playerHabitats);
        const rovLightsBonus = getRovLightsAttackBonus(rovLightsActive, targetEntry.card);
        return first ? { total: baseTotal + modifier.flat + rolledBonus.flat + rovLightsBonus + flashingAlarmBonus, detail: `${second ? `${first.total}/${second.total} ${useAdvantage ? "advantage" : "disadvantage"}` : `${first.total}${hasAdvantage && hasDisadvantage ? " (advantage and disadvantage canceled)" : ""}`}${modifier.details.length || rolledBonus.detail || rovLightsBonus || flashingAlarmBonus ? ` [${[...modifier.details, rolledBonus.detail, rovLightsBonus ? "+2 ROV Lights" : null, flashingAlarmBonus ? `+${flashingAlarmBonus} Flashing Alarm` : null].filter(Boolean).join(", ")}]` : ""}` } : null;
      })()].filter(Boolean);
      const rolledDamage = attackRolls.reduce((total, roll) => total + roll.total * 10, 0);
      const result = applyDamage(targetCoral.health ?? targetCoral.maxHealth, rolledDamage);
      commitPlayerAttackCost(attackContext, attacker, attack);
      setFaceoffRolling(false);
      setFaceoffPreview(null);
      const orphanEntries = result.destroyed ? getOrphanEntriesFromFoundation(targetCoral) : [];
      const recyclesKrill = result.destroyed && cardHasPlenteous(targetEntry.card);
      const availableKrill = targetEntry.card.id === "krill-bloom-base" ? "krill-bloom-base" : opponent.discardPile.includes("krill-bloom-base") ? "krill-bloom-base" : null;
      const recycleId = recyclesKrill ? availableKrill : null;
      const nextDiscard = result.destroyed ? [targetEntry.card.id, ...opponent.discardPile] : opponent.discardPile;
      const redistributed = result.destroyed
        ? redistributeOrphanCreatures(opponent.corals.filter((coral) => coral.id !== targetCoral.id), [...(opponent.orphanCreatures ?? []), ...orphanEntries])
        : { corals: opponent.corals.map((coral) => coral.id === targetCoral.id ? { ...coral, health: result.remainingHealth } : coral), orphans: opponent.orphanCreatures ?? [] };
      const nextOpponentProjection = projectNormalizedOpponentState(reconcileOpponentInstances(opponent, {
        ...opponent,
        flashingAlarmAttackBonus: opponentFlashingAlarmAfterAttack,
        corals: redistributed.corals,
        orphanCreatures: redistributed.orphans,
        discardPile: recycleId ? removeOneCard(nextDiscard, recycleId) : nextDiscard,
        foundationDeck: recycleId ? shuffle([...opponent.foundationDeck, recycleId]) : opponent.foundationDeck,
      }));
      const nextOpponentState = nextOpponentProjection.state;
      setOpponent(nextOpponentState);
      const sequenceResult = completePlayerAttackStep(selectedTarget.instanceId, { outcome: result.destroyed ? "destroyed" : "damaged", damage: result.appliedDamage }, { nextTargets: getPlayerAttackTargets(attacker, attack, nextOpponentState) });
      const collapseMessage = getContinuousHealthCollapseMessage(nextOpponentProjection.collateral);
      const message = `${attacker.name} rolled ${attackRolls.map((roll) => roll.detail).join(", ")} and dealt ${result.appliedDamage} damage to ${targetEntry.card.name}.${ensnareSummary}${result.destroyed ? " The Creature School was discarded and its creatures redistributed." : ` ${result.remainingHealth}/${targetCoral.maxHealth} HP remains.`}${recyclesKrill ? " Plenteous recycled a base Krill Bloom into the opponent's Foundation deck when available." : ""}${collapseMessage ? ` ${collapseMessage}` : ""}${flashingAlarmTriggerMessage}${getAttackSequenceContinuationMessage(sequenceResult)}`;
      pushLog(message);
      setEventOverlay({ type: "faceoff-result", sourceCardId: attacker.id, defenderCardId: targetEntry.card.id, title: result.destroyed ? "Creature School Destroyed" : "Creature School Damaged", message, success: result.destroyed, continueAttackSequence: sequenceResult.continues });
      return;
    }
    const defenseDice = targetEntry.card.defense?.dice ?? targetEntry.card.defense;
    if (!defenseDice) {
      const message = `${targetEntry.card.name} has no defense die in the current card data, so ${attacker.name}'s attack cannot be resolved without inventing a rule. No RP was spent and neither card moved.`;
      setAttackContext(null);
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: attacker.id, defenderCardId: targetEntry.card.id, title: "Attack Could Not Resolve", message, success: false });
      return;
    }
    const attackAdvantage = cardHasAttackAdvantage(attacker, targetEntry.card, playerHabitats, attack);
    const attackDisadvantage = attackerHasDisadvantageFromMassive(targetEntry.card);
    const useAttackAdvantage = attackAdvantage && !attackDisadvantage;
    const useAttackDisadvantage = attackDisadvantage && !attackAdvantage;
    const defenseAdjustment = getDefenseAdjustment(attack, targetEntry.card, playerHabitats);
    const opponentDefenseStatusKey = targetEntry.hostedIndex >= 0
      ? targetEntry.orphanIndex >= 0
        ? getOrphanHostedTargetSlotId(targetEntry.orphanInstanceId, targetEntry.hostedIndex)
        : getHostedTargetSlotId(targetEntry.slot?.id, targetEntry.hostedIndex)
      : targetEntry.slot
        ? getSlotActionKey(targetEntry.slot)
        : targetEntry.reefIndex >= 0
          ? `reef-${targetEntry.instanceId}`
          : targetEntry.orphanIndex >= 0
            ? `orphan-${targetEntry.orphanInstanceId}`
            : null;
    const activeOpponentDefenseStatuses = opponent.creatureStatuses?.[opponentDefenseStatusKey] ?? [];
    const defenseAdvantage = hasDefenseAdvantage({ targetCard: targetEntry.card, statuses: activeOpponentDefenseStatuses, ignoreDefensiveBonuses: defenseAdjustment.ignoresBonuses });
    const attachedDefenseBonus = !defenseAdjustment.ignoresBonuses && targetCoral && !coralIsStunned(targetCoral) ? calculateAttachedCreatureDefenseBonus(cardsById[targetCoral.cardId]) : 0;
    const hostedDefenseBonusDice = !defenseAdjustment.ignoresBonuses && targetEntry.hostedIndex >= 0 ? getHostedDefenseBonusDice(cardsById[targetEntry.hostCardId], targetEntry.card) : null;
    const cloakDefenseBonus = !defenseAdjustment.ignoresBonuses ? getCloakDefenseBonus(targetEntry.card) : 0;
    const darknessShroudDefenseBonus = !defenseAdjustment.ignoresBonuses ? getDarknessShroudDefenseBonus(targetEntry.card, opponent.habitats) : 0;
    const rovLightsBonus = getRovLightsAttackBonus(rovLightsActive, targetEntry.card);
    if (!rollNow) {
      setEventOverlay({
        type: "faceoff-ready",
        sourceCardId: attacker.id,
        defenderCardId: targetEntry.card.id,
        title: `${attacker.name} vs ${targetEntry.card.name}`,
        message: `${attacker.name} attacks with ${attack.attackDice}${useAttackAdvantage ? " and has advantage" : useAttackDisadvantage ? " and has disadvantage from Massive" : attackAdvantage && attackDisadvantage ? " (advantage and disadvantage cancel)" : ""}${rovLightsBonus ? " +2 from ROV Lights" : ""}${flashingAlarmBonus ? ` +${flashingAlarmBonus} from Flashing Alarm` : ""}. ${targetEntry.card.name} defends with ${defenseDice}${defenseAdvantage ? " and has defense advantage" : ""}${activeOpponentDefenseStatuses.some((status) => status.type === "defenseBonusDice") ? " plus its active defensive bonus die" : ""}${cloakDefenseBonus ? ` +${cloakDefenseBonus} Cloak` : ""}${darknessShroudDefenseBonus ? ` +${darknessShroudDefenseBonus} Darkness Shroud` : ""}${attachedDefenseBonus ? ` +${attachedDefenseBonus} Shelter` : ""}${hostedDefenseBonusDice ? ` +${hostedDefenseBonusDice} Stinging Fortress` : ""}.`,
        targetCoralId,
        targetSlotId,
        attackDice: attack.attackDice,
        defenseDice,
      });
      setFaceoffPreview(null);
      return;
    }
    const result = stoppedRoll
      ? { resolved: true, attack: { total: stoppedRoll.attack }, defense: { total: stoppedRoll.defense } }
      : resolveOpposedRoll(attack.attackDice, defenseDice);
    if (!result.resolved) {
      pushLog(`Could not parse the dice for ${attacker.name}'s attack.`);
      return;
    }
    const secondAttackRoll = useAttackAdvantage || useAttackDisadvantage ? rollDie(attack.attackDice) : null;
    const chosenAttackRoll = secondAttackRoll
      ? (useAttackAdvantage ? Math.max(result.attack.total, secondAttackRoll.total) : Math.min(result.attack.total, secondAttackRoll.total))
      : result.attack.total;
    const modifier = getAttackConditionalModifier(attacker, targetEntry.card, playerHabitats, playerCorals, playerReefCreatures, attack, playerOrphanCreatures);
    const rolledBonus = getRolledAttackBonus(attack, chosenAttackRoll, playerHabitats);
    let attackTotal = chosenAttackRoll + modifier.flat + rolledBonus.flat + rovLightsBonus + flashingAlarmBonus;
    const secondDefenseRoll = defenseAdvantage ? rollDie(defenseDice) : null;
    const chosenDefenseRoll = secondDefenseRoll ? Math.max(result.defense.total, secondDefenseRoll.total) : result.defense.total;
    const hostedDefenseRoll = hostedDefenseBonusDice ? rollDie(hostedDefenseBonusDice) : null;
    const statusDefenseRolls = (!defenseAdjustment.ignoresBonuses ? activeOpponentDefenseStatuses : []).filter((status) => status.type === "defenseBonusDice").map((status) => ({ status, roll: rollDie(status.dice) })).filter((entry) => entry.roll);
    const statusDefenseBonus = statusDefenseRolls.reduce((total, entry) => total + entry.roll.total, 0);
    const defenseTotal = Math.max(0, chosenDefenseRoll + defenseAdjustment.flat + cloakDefenseBonus + darknessShroudDefenseBonus + attachedDefenseBonus + Number(hostedDefenseRoll?.total ?? 0) + statusDefenseBonus);
    let scatterDetail = "";
    if (attackTotal > defenseTotal && cardHasScatter(targetEntry.card)) {
      const scatterFirst = rollDie(attack.attackDice);
      const scatterSecond = useAttackAdvantage || useAttackDisadvantage ? rollDie(attack.attackDice) : null;
      const scatterBase = scatterSecond ? (useAttackAdvantage ? Math.max(scatterFirst.total, scatterSecond.total) : Math.min(scatterFirst.total, scatterSecond.total)) : scatterFirst?.total ?? 0;
      const scatterModifier = getAttackConditionalModifier(attacker, targetEntry.card, playerHabitats, playerCorals, playerReefCreatures, attack, playerOrphanCreatures);
      const scatterRolledBonus = getRolledAttackBonus(attack, scatterBase, playerHabitats);
      attackTotal = scatterBase + scatterModifier.flat + scatterRolledBonus.flat + rovLightsBonus + flashingAlarmBonus;
      scatterDetail = `; Scatter reroll ${attackTotal}`;
    }
    const attackerWins = attackTotal > defenseTotal;
    const rolls = [`${attackTotal}${secondAttackRoll ? ` (${result.attack.total}/${secondAttackRoll.total} ${useAttackAdvantage ? "advantage" : "disadvantage"})` : attackAdvantage && attackDisadvantage ? " (advantage and disadvantage canceled)" : ""}${modifier.details.length || rolledBonus.detail || rovLightsBonus || flashingAlarmBonus ? ` [${[...modifier.details, rolledBonus.detail, rovLightsBonus ? "+2 ROV Lights" : null, flashingAlarmBonus ? `+${flashingAlarmBonus} Flashing Alarm` : null].filter(Boolean).join(", ")}]` : ""} vs ${defenseTotal}${secondDefenseRoll ? ` (${result.defense.total}/${secondDefenseRoll.total} defense advantage)` : ""}${defenseAdjustment.flat ? ` (${defenseAdjustment.flat} defense)` : ""}${cloakDefenseBonus ? ` (+${cloakDefenseBonus} Cloak)` : ""}${darknessShroudDefenseBonus ? ` (+${darknessShroudDefenseBonus} Darkness Shroud)` : ""}${attachedDefenseBonus ? ` (+${attachedDefenseBonus} Shelter)` : ""}${hostedDefenseRoll ? ` (+${hostedDefenseRoll.total} Stinging Fortress)` : ""}${statusDefenseRolls.length ? ` (${statusDefenseRolls.map((entry) => `+${entry.roll.total} ${entry.status.dice}`).join(", ")} action defense)` : ""}${scatterDetail}`];
    commitPlayerAttackCost(attackContext, attacker, attack);
    setFaceoffRolling(false);
    setFaceoffPreview(null);
    const attackerCoralId = attackContext.attackerCoralId;
    const attackerReefIndex = attackContext.attackerReefIndex;
    const attackerOrphanIndex = attackContext.attackerOrphanIndex;
    const poisonImmune = poisonImmunityNextPredatorAttack;
    const playerToxicRandom = tutorialUsesScriptedScenario && shouldForceScriptedTutorialToxicSurvival({
      attackerCardId: attacker.id,
      toxicSourceCardId: targetEntry.card.id,
    }) ? () => 0.75 : Math.random;
    if (attackerWins) {
      if (targetEntry.targetsOwnInvader) {
        const invasiveRemoval = targetEntry.targetsOwnOrphanInvader
          ? { foundations: playerCorals, removedCardId: null }
          : removeInvasiveCreature(playerCorals, {
              coralId: targetCoral.id,
              slotId: targetSlot.id,
              controller: "opponent",
            });
        const invasiveOrphanRemoval = targetEntry.targetsOwnOrphanInvader
          ? removeInvasiveOrphan(playerOrphanCreatures, {
              instanceId: targetEntry.instanceId,
              controller: "opponent",
            })
          : { orphans: playerOrphanCreatures, removedCardId: null };
        const toxicResult = resolveToxicConsumption({ attackerCard: attacker, toxicSourceCard: targetEntry.card, consumed: true, poisonHealActive: poisonImmune }, playerToxicRandom);
        const selfDiscardedAttacker = shouldSelfDiscardAfterConsume({ attackerCard: attacker, defenderCard: targetEntry.card, consumed: true });
        const attackerDiscardedAfterConsume = toxicResult.discardAttacker || selfDiscardedAttacker;
        let nextPlayerCorals = invasiveRemoval.foundations;
        let nextPlayerOrphans = invasiveOrphanRemoval.orphans;
        if (attackerDiscardedAfterConsume && attackerReefIndex < 0 && attackerOrphanIndex < 0) {
          nextPlayerCorals = nextPlayerCorals.map((coral) => coral.id === attackerCoralId ? {
            ...coral,
            slots: coral.slots.map((slot) => slot.id === attackerSlot?.id ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot),
          } : coral);
        }
        setPlayerCorals(nextPlayerCorals);
        if (attackerDiscardedAfterConsume && attackerReefIndex >= 0) {
          const attackerInstanceId = playerReefCreatureInstances[attackerReefIndex]?.instanceId;
          setPlayerReefCreatureInstances((current) => removeCreatureInstances(current, [attackerInstanceId]).instances);
        } else if (attackerDiscardedAfterConsume && attackerOrphanIndex >= 0) {
          const attackerInstanceId = playerOrphanCreatures[attackerOrphanIndex]?.instanceId;
          const removedEntry = nextPlayerOrphans.find((entry) => entry.instanceId === attackerInstanceId);
          nextPlayerOrphans = [
            ...nextPlayerOrphans.filter((entry) => entry.instanceId !== attackerInstanceId),
            ...(removedEntry?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`player-orphan-${cardId}`))),
          ];
        }
        setPlayerOrphanCreatureInstances(nextPlayerOrphans);
        if (attackerDiscardedAfterConsume) setDiscardPile((current) => [attacker.id, ...current]);
        const opponentOwnedOrphans = getLocallyControlledOrphans(opponent.orphanCreatures, "opponent");
        const nextOpponentCap = getEcosystemRpCap(opponent.corals, [
          ...opponent.habitats,
          ...opponent.reefCreatures,
          ...opponentOwnedOrphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
        ], activeCondition);
        const blueCrabRecycle = resolveBlueCrabRecycle({
          defeatedCardIsFish: targetEntry.card.category === CardCategory.FISH,
          defeatedCardIsCreatureSchool: isCreatureSchool(targetEntry.card),
          defeatedCardRpCost: targetEntry.card.cost?.rp,
          controllerHasBlueCrab: ecosystemHasCard(opponent.corals, opponent.reefCreatures, "blue-crab", opponentOwnedOrphans),
          recycleUsedTurn: opponent.blueCrabRecycleUsedTurn,
          currentTurn: turn,
          currentRp: opponent.rp,
          rpCap: nextOpponentCap,
        });
        const nextOpponentState = {
          ...opponent,
          flashingAlarmAttackBonus: opponentFlashingAlarmAfterAttack,
          discardPile: destroyedCardGoesToLostZone(targetEntry.card) ? opponent.discardPile : [targetEntry.card.id, ...opponent.discardPile],
          lostZone: destroyedCardGoesToLostZone(targetEntry.card) ? [targetEntry.card.id, ...(opponent.lostZone ?? [])] : opponent.lostZone,
          rp: blueCrabRecycle.rpAfter,
          blueCrabRecycleUsedTurn: blueCrabRecycle.recycleUsedTurnAfter,
        };
        setOpponent(nextOpponentState);
        const sequenceResult = completePlayerAttackStep(selectedTarget.instanceId, { outcome: "removed-invader" }, {
          attackerSurvives: !attackerDiscardedAfterConsume,
          nextTargets: getPlayerAttackTargets(attacker, attack, nextOpponentState, nextPlayerCorals, nextPlayerOrphans),
        });
        const toxicMessage = toxicResult.triggered
          ? toxicResult.protected
            ? ` ${toxicResult.protectionSource === "poisonHeal" ? "Poison Heal" : `${attacker.name}'s Toxic Immunity`} prevented Toxic.`
            : toxicResult.discardAttacker
              ? " Toxic coin flip: tails, so the consuming attacker was also discarded."
              : " Toxic coin flip: heads, so the attacker survived."
          : "";
        const selfDiscardMessage = selfDiscardedAttacker && !toxicResult.discardAttacker ? ` ${attacker.name} was discarded by its own consume rule.` : "";
        const recycleMessage = blueCrabRecycle.triggered
          ? blueCrabRecycle.recoveredRp > 0
            ? ` Opponent's Blue Crab recycled ${blueCrabRecycle.recoveredRp} RP (half the Fish's cost, rounded up and capped by its bank).`
            : " Opponent's Blue Crab triggered, but its RP bank was already at its cap."
          : "";
        const message = `${attacker.name} used ${attack.actionName} on the opponent's invading ${targetEntry.card.name}: ${rolls.join(", ")}. The attack succeeded, so the invader left your reef and went to its owner's ${destroyedCardGoesToLostZone(targetEntry.card) ? "Lost Zone" : "discard pile"}.${ensnareSummary}${toxicMessage}${selfDiscardMessage}${recycleMessage}${flashingAlarmTriggerMessage}${getAttackSequenceContinuationMessage(sequenceResult)}`;
        pushLog(message);
        setEventOverlay({ type: "faceoff-result", sourceCardId: attacker.id, defenderCardId: targetEntry.card.id, title: "Invader Removed!", message, success: true, continueAttackSequence: sequenceResult.continues });
        return;
      }
      const resilienceTriggered = cardHasAncientResilience(targetEntry.card) && !(opponent.resilienceUsedCardIds ?? []).includes(targetEntry.instanceId);
      const regenerateDecision = createRegenerateDecision({ defenderCard: targetEntry.card, defenderWasDefeated: true, controllerRp: opponent.rp, survivalAlreadyApplied: resilienceTriggered });
      const regenerateResolution = regenerateDecision.available ? resolveRegenerateDecision(regenerateDecision, "regenerate") : null;
      const regenerateTriggered = Boolean(regenerateResolution?.keepDefender);
      const defenderKept = resilienceTriggered || regenerateTriggered;
      const toxicResult = resolveToxicConsumption({ attackerCard: attacker, toxicSourceCard: targetEntry.card, consumed: !defenderKept, poisonHealActive: poisonImmune }, playerToxicRandom);
      const toxicDiscardedAttacker = toxicResult.discardAttacker;
      const selfDiscardedAttacker = shouldSelfDiscardAfterConsume({ attackerCard: attacker, defenderCard: targetEntry.card, consumed: !defenderKept });
      const attackerDiscardedAfterConsume = toxicDiscardedAttacker || selfDiscardedAttacker;
      const nextReefInstances = defenderKept || targetEntry.reefIndex < 0 ? opponent.reefCreatureInstances : removeCreatureInstances(opponent.reefCreatureInstances ?? [], [targetEntry.instanceId]).instances;
      const nextOpponentOrphans = defenderKept || targetEntry.orphanIndex < 0
        ? opponent.orphanCreatures ?? []
        : targetEntry.hostedIndex >= 0
          ? (opponent.orphanCreatures ?? []).map((entry) => entry.instanceId === targetEntry.orphanInstanceId
            ? { ...entry, hostedCardIds: removeHostedCardAtIndex(entry.hostedCardIds, targetEntry.hostedIndex) }
            : entry)
          : [
              ...(opponent.orphanCreatures ?? []).filter((entry) => entry.instanceId !== targetEntry.orphanInstanceId),
              ...(opponent.orphanCreatures?.[targetEntry.orphanIndex]?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`))),
            ];
      const nextOpponentProjection = projectNormalizedOpponentState(reconcileOpponentInstances(opponent, {
        ...opponent,
        flashingAlarmAttackBonus: opponentFlashingAlarmAfterAttack,
        corals: defenderKept || targetEntry.reefIndex >= 0 || targetEntry.orphanIndex >= 0 ? opponent.corals : opponent.corals.map((coral) => coral.id === targetEntry.coral.id ? {
          ...coral,
          slots: coral.slots.map((slot) => slot.id === targetEntry.slot.id ? targetEntry.hostedIndex >= 0 ? { ...slot, hostedCardIds: removeHostedCardAtIndex(slot.hostedCardIds, targetEntry.hostedIndex) } : { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot),
        } : coral),
        reefCreatures: nextReefInstances.map((instance) => instance.cardId),
        reefCreatureInstances: nextReefInstances,
        orphanCreatures: nextOpponentOrphans,
        discardPile: defenderKept
          ? opponent.discardPile
          : [
              ...(destroyedCardGoesToLostZone(targetEntry.card) ? [] : [targetEntry.card.id]),
              ...(targetEntry.orphanIndex >= 0 || targetEntry.hostedIndex >= 0 ? [] : (targetEntry.slot?.hostedCardIds ?? []).filter(Boolean)),
              ...opponent.discardPile,
            ],
        lostZone:
          !defenderKept && destroyedCardGoesToLostZone(targetEntry.card)
            ? [targetEntry.card.id, ...(opponent.lostZone ?? [])]
            : opponent.lostZone ?? [],
        rp: Math.max(0, opponent.rp - (regenerateTriggered ? regenerateResolution.rpCost : 0)),
        resilienceUsedCardIds: resilienceTriggered ? [...(opponent.resilienceUsedCardIds ?? []), targetEntry.instanceId] : opponent.resilienceUsedCardIds,
      }));
      let nextOpponentState = nextOpponentProjection.state;
      const opponentOwnedOrphans = getLocallyControlledOrphans(nextOpponentState.orphanCreatures, "opponent");
      const nextOpponentCap = getEcosystemRpCap(nextOpponentState.corals, [
        ...nextOpponentState.habitats,
        ...nextOpponentState.reefCreatures,
        ...opponentOwnedOrphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
      ], activeCondition);
      const blueCrabRecycle = resolveBlueCrabRecycle({
        defeatedCardIsFish: !defenderKept && targetEntry.card.category === CardCategory.FISH,
        defeatedCardIsCreatureSchool: isCreatureSchool(targetEntry.card),
        defeatedCardRpCost: targetEntry.card.cost?.rp,
        controllerHasBlueCrab: ecosystemHasCard(nextOpponentState.corals, nextOpponentState.reefCreatures, "blue-crab", opponentOwnedOrphans),
        recycleUsedTurn: nextOpponentState.blueCrabRecycleUsedTurn,
        currentTurn: turn,
        currentRp: nextOpponentState.rp,
        rpCap: nextOpponentCap,
      });
      const opponentBlueCrabRecycle = blueCrabRecycle.triggered;
      const opponentActualRecycleRp = blueCrabRecycle.recoveredRp;
      nextOpponentState = {
        ...nextOpponentState,
        rp: blueCrabRecycle.rpAfter,
        blueCrabRecycleUsedTurn: blueCrabRecycle.recycleUsedTurnAfter,
      };
      setOpponent(nextOpponentState);
      if (attackerDiscardedAfterConsume) {
        if (attackerReefIndex >= 0) {
          const attackerInstanceId = playerReefCreatureInstances[attackerReefIndex]?.instanceId;
          setPlayerReefCreatureInstances((current) => removeCreatureInstances(current, [attackerInstanceId]).instances);
        } else if (attackerOrphanIndex >= 0) {
          const attackerInstanceId = playerOrphanCreatures[attackerOrphanIndex]?.instanceId;
          setPlayerOrphanCreatureInstances((current) => {
            const removedEntry = current.find((entry) => entry.instanceId === attackerInstanceId);
            return [...current.filter((entry) => entry.instanceId !== attackerInstanceId), ...(removedEntry?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`player-orphan-${cardId}`)))];
          });
        }
        else setPlayerCorals((current) => current.map((coral) => coral.id === attackerCoralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === attackerSlot?.id ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) } : coral));
        setDiscardPile((current) => [attacker.id, ...current]);
      }
      const toxicMessage = toxicResult.triggered ? toxicResult.protected ? ` ${toxicResult.protectionSource === "poisonHeal" ? "Poison Heal" : `${attacker.name}'s Toxic Immunity`} prevented the Toxic effect.` : toxicDiscardedAttacker ? " Toxic coin flip: tails, so the consuming attacker was also discarded." : " Toxic coin flip: heads, so the attacker survived." : "";
      const selfDiscardMessage = selfDiscardedAttacker
        ? toxicDiscardedAttacker
          ? ` ${attacker.name}'s consume rule also required it to be discarded; it left play only once.`
          : ` ${attacker.name}'s consume rule discarded it after eating an Apex or Predator.`
        : "";
      const recycleMessage = opponentBlueCrabRecycle
        ? opponentActualRecycleRp > 0
          ? ` Opponent's Blue Crab recycled ${opponentActualRecycleRp} RP (half the Fish's cost, rounded up and capped by its bank).`
          : " Opponent's Blue Crab triggered, but its RP bank was already at its cap."
        : "";
      const survivalMessage = resilienceTriggered ? ` Ancient Resilience kept ${targetEntry.card.name} in play and is now used for this game.` : regenerateTriggered ? ` The opponent automatically paid 1 RP for Regenerate to keep ${targetEntry.card.name} in play.` : destroyedCardGoesToLostZone(targetEntry.card) ? ` The destroyed defender was placed in the opponent's Lost Zone.` : ` The defender was discarded.`;
      const sequenceResult = completePlayerAttackStep(selectedTarget.instanceId, { outcome: defenderKept ? "survived" : "discarded" }, { attackerSurvives: !attackerDiscardedAfterConsume, nextTargets: getPlayerAttackTargets(attacker, attack, nextOpponentState) });
      const collapseMessage = getContinuousHealthCollapseMessage(nextOpponentProjection.collateral);
      const message = `${attacker.name} used ${attack.actionName} on ${targetEntry.card.name}: ${rolls.join(", ")}. The attack succeeded.${ensnareSummary}${survivalMessage}${toxicMessage}${selfDiscardMessage}${recycleMessage}${collapseMessage ? ` ${collapseMessage}` : ""}${flashingAlarmTriggerMessage}${attack.unsupportedDetails ? ` ${attack.unsupportedDetails}` : ""}${getAttackSequenceContinuationMessage(sequenceResult)}`;
      pushLog(message);
      setEventOverlay({ type: "faceoff-result", sourceCardId: attacker.id, defenderCardId: targetEntry.card.id, title: defenderKept ? "Attack Landed — Defender Survived" : "Successful Attack!", message, success: true, continueAttackSequence: sequenceResult.continues });
    } else {
      if (flashingAlarmTriggered) {
        setOpponent((current) => ({
          ...current,
          flashingAlarmAttackBonus: triggerFlashingAlarm(current.flashingAlarmAttackBonus, targetEntry.card),
        }));
      }
      const biteBack = getBiteBackAttack(targetEntry.card);
      const attackerDefense = attacker.defense?.dice ?? attacker.defense;
      const counter = biteBack && attackerDefense ? resolveOpposedRoll(biteBack.attackDice, attackerDefense) : null;
      const counterSucceeded = Boolean(counter?.resolved && counter.attackerWins);
      if (counterSucceeded) {
        if (attackerReefIndex >= 0) {
          const attackerInstanceId = playerReefCreatureInstances[attackerReefIndex]?.instanceId;
          setPlayerReefCreatureInstances((current) => removeCreatureInstances(current, [attackerInstanceId]).instances);
        } else if (attackerOrphanIndex >= 0) {
          const attackerInstanceId = playerOrphanCreatures[attackerOrphanIndex]?.instanceId;
          setPlayerOrphanCreatureInstances((current) => {
            const removedEntry = current.find((entry) => entry.instanceId === attackerInstanceId);
            return [...current.filter((entry) => entry.instanceId !== attackerInstanceId), ...(removedEntry?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`player-orphan-${cardId}`)))];
          });
        }
        else setPlayerCorals((current) => current.map((coral) => coral.id === attackerCoralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === attackerSlot?.id ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) } : coral));
        if (destroyedCardGoesToLostZone(attacker)) setLostZone((current) => [attacker.id, ...current]);
        else setDiscardPile((current) => [attacker.id, ...current]);
      }
      const counterMessage = counter?.resolved ? ` ${targetEntry.card.name} triggered Bite Back: ${counter.attack.total} vs ${counter.defense.total}.${counterSucceeded ? destroyedCardGoesToLostZone(attacker) ? ` ${attacker.name} was destroyed and placed in your Lost Zone.` : ` ${attacker.name} was discarded.` : ` ${attacker.name} defended successfully.`}` : "";
      const sequenceResult = completePlayerAttackStep(selectedTarget.instanceId, { outcome: "defended", biteBack: counterSucceeded }, { attackerSurvives: !counterSucceeded });
      const message = `${attacker.name} used ${attack.actionName} on ${targetEntry.card.name}: ${rolls.join(", ")}. The defender won.${ensnareSummary}${counterMessage}${flashingAlarmTriggerMessage}${attack.unsupportedDetails ? ` ${attack.unsupportedDetails}` : ""}${getAttackSequenceContinuationMessage(sequenceResult)}`;
      pushLog(message);
      setEventOverlay({ type: "faceoff-result", sourceCardId: counter?.resolved ? targetEntry.card.id : attacker.id, defenderCardId: counter?.resolved ? attacker.id : targetEntry.card.id, title: counterSucceeded ? "Bite Back Counterattack!" : "Successful Defense!", message, success: false, continueAttackSequence: sequenceResult.continues });
    }
  }

  function applyPlayerOnPlayDeckDiscard(card) {
    const deckDiscard = getOnPlayOpponentDeckDiscard(card);
    if (!deckDiscard) return false;
    const discardedIds = [...opponent.palsDeck, ...opponent.foundationDeck].slice(0, deckDiscard.amount);
    if (!discardedIds.length) return false;
    setOpponent((current) => {
      const palsCount = Math.min(deckDiscard.amount, current.palsDeck.length);
      const foundationCount = Math.min(deckDiscard.amount - palsCount, current.foundationDeck.length);
      return { ...current, palsDeck: current.palsDeck.slice(palsCount), foundationDeck: current.foundationDeck.slice(foundationCount), discardPile: [...current.palsDeck.slice(0, palsCount), ...current.foundationDeck.slice(0, foundationCount), ...current.discardPile] };
    });
    const discardedNames = discardedIds.map((cardId) => cardsById[cardId]?.name ?? cardId).join(", ");
    const message = `${card.name} discarded ${discardedNames} from the top of the opponent's personal decks (Pals first).`;
    pushLog(message);
    setEventOverlay({ type: "impact-result", sourceCardId: card.id, defenderCardId: discardedIds[0], title: `Player's ${card.name} used ${deckDiscard.actionName}`, message, success: true });
    return true;
  }

  function applyPlayerOnPlaySupportBlock(card) {
    const supportBlock = getOnPlaySupportBlock(card);
    if (!supportBlock) return false;
    setOpponent((current) => ({ ...current, supportBlockedUntilRound: round }));
    const message = `${card.name} used ${supportBlock.actionName}. The opponent cannot play Support cards during its next turn.`;
    pushLog(message);
    setEventOverlay({ type: "impact-result", sourceCardId: card.id, title: `Player's ${card.name} used ${supportBlock.actionName}`, message, success: true });
    return true;
  }

  function beginPlayerOnPlaySearch(card, locationKey) {
    const search = getOnPlayUtilitySearch(card);
    if (!search) return false;
    const candidates = [...new Set([...foundationDeck, ...palsDeck].filter((cardId) => {
      const candidate = cardsById[cardId];
      if (!candidate || candidate.kind !== search.effect.targetKind) return false;
      if (search.effect.targetCategories?.length && !search.effect.targetCategories.includes(candidate.category)) return false;
      if (search.effect.targetZone && candidate.zone !== search.effect.targetZone) return false;
      if (search.effect.targetCardId && candidate.id !== search.effect.targetCardId) return false;
      return !search.effect.targetNameIncludes || candidate.name?.toLowerCase().includes(search.effect.targetNameIncludes.toLowerCase());
    }))];
    if (!candidates.length) {
      const message = `${card.name}'s ${search.actionName} found no matching card in either personal deck.`;
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${search.actionName}`, message, success: false });
      return true;
    }
    const amount = Math.max(1, Number(search.effect.amount ?? 1));
    if (amount > 1) {
      setSearchContext({ mode: "onplay-multi-search", sourceCardId: card.id, actionName: search.actionName, candidates, selected: [], max: amount });
      setEventOverlay({ type: "choose-onplay-multi-search", sourceCardId: card.id, title: `Player's ${card.name} used ${search.actionName}`, message: `Choose up to ${amount} matching cards to reveal and add to your hand.` });
      return true;
    }
    const action = { name: search.actionName, text: typeof search.action === "string" ? search.action : search.action.text, cost: { rp: 0 }, oncePerTurn: false };
    setPendingCreatureAction({ action, effect: search.effect, actionKey: `onplay:${locationKey}:${search.actionName}`, sourceCardId: card.id, candidates, actionName: search.actionName, cost: 0 });
    setEventOverlay({ type: "choose-creature-action-search", sourceCardId: card.id, title: `Player's ${card.name} used ${search.actionName}`, message: "Choose the matching card to reveal and add to your hand." });
    return true;
  }

  function beginPlayerOnPlayDraw(card, locationKey) {
    const onPlayDrawCount = getOnPlayDrawCount(card);
    if (!onPlayDrawCount) return false;
    const target = Math.min(onPlayDrawCount, foundationDeck.length + palsDeck.length);
    if (!target) {
      const message = `${card.name}'s mandatory ${getOnPlayAbilityName(card)} draw could not be completed because both personal decks are empty. You lose by deck depletion.`;
      pushLog(message);
      setPendingEvents([]);
      setAttackContext(null);
      setGameResult((current) => current ?? `Defeat: ${card.name} required you to draw ${onPlayDrawCount} card${onPlayDrawCount === 1 ? "" : "s"}, but both personal decks were empty.`);
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${getOnPlayAbilityName(card)}`, message, success: false });
      return true;
    }
    const drawEffect = { type: EffectType.DRAW_CARDS, amount: onPlayDrawCount };
    setPendingCreatureAction({ action: { name: getOnPlayAbilityName(card), cost: { rp: 0 }, oncePerTurn: false }, effect: drawEffect, actionKey: `onplay:${card.id}:${locationKey}`, sourceCardId: card.id, cost: 0, committed: true });
    setTurnDrawSelection({ requested: onPlayDrawCount, target, shortfall: getRequiredDrawShortfall(onPlayDrawCount, target), foundation: 0, pals: 0, mode: "onplay" });
    setEventOverlay({ type: "choose-action-deck", sourceCardId: card.id, title: `Player's ${card.name} used ${getOnPlayAbilityName(card)}`, message: `Allocate ${target} draw${target === 1 ? "" : "s"} between your personal decks.` });
    return true;
  }

  function beginPlayerOnPlayReorder(card, locationKey) {
    const reorder = getOnPlayReorder(card);
    if (!reorder) return false;
    if (!foundationDeck.length && !palsDeck.length) {
      const message = `${card.name}'s ${reorder.actionName} could not inspect either empty personal deck.`;
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${reorder.actionName}`, message, success: false });
      return true;
    }
    setPendingCreatureAction({ action: reorder.action, effect: reorder.effect, actionKey: `onplay:${card.id}:${locationKey}:${reorder.actionName}`, sourceCardId: card.id, actionName: reorder.actionName, cost: 0, committed: true });
    setEventOverlay({ type: "choose-action-reorder-source", sourceCardId: card.id, title: `Player's ${card.name} used ${reorder.actionName}`, message: `Choose a personal deck, then reorder up to its top ${reorder.effect.amount} cards. The On Play ability is optional; skipping it does not undo the card you played.` });
    return true;
  }

  function placeCardToSlot(slotId) {
    if (!playingCardId) return;
    const card = cardsById[playingCardId];
    const coral = findCoralBySlotId(slotId);
    if (!coral) return;
    const slot = coral.slots.find((s) => s.id === slotId);
    if (!slot) return;
    const academyPlacementBlock = getAcademyPlacementBlock({
      route: scriptedFinishRoute,
      cardId: playingCardId,
      foundationCardId: coral.cardId,
      slotClass: slot.slotClass ?? slot.slotType ?? slot.class,
    });
    if (academyPlacementBlock) {
      setTutorialHelpDismissedId(null);
      setPlayError(academyPlacementBlock);
      pushLog(academyPlacementBlock);
      return;
    }
    const error = getPlayError(card);
    if (error) {
      setPlayError(error);
      return;
    }
    const hostedCardIds = slot.cardId
      ? placeCardInSpecialHost(cardsById[slot.cardId], card, slot.hostedCardIds, playingCardId)
      : null;
    const isHostedPlacement = Boolean(hostedCardIds);
    if (!canUseSlotWithCard(slot, playingCardId) && !isHostedPlacement) {
      setPlayError("This creature cannot be placed in that slot.");
      return;
    }
    const densityRequirementAtPlay = getPlayerSchoolDensityRequirement(card).effectiveRequirement;
    const cardInstanceId = isHostedPlacement
      ? null
      : createStableInstanceId(`player-slot-${playingCardId}`);
    const hostedIndex = isHostedPlacement
      ? hostedCardIds.findIndex((hostedCardId, index) => (
          hostedCardId === playingCardId && slot.hostedCardIds?.[index] !== hostedCardId
        ))
      : -1;
    const hostedSchoolDensityRequirements = isHostedPlacement
      ? [...(slot.hostedSchoolDensityRequirements ?? [])]
      : null;
    if (hostedIndex >= 0) hostedSchoolDensityRequirements[hostedIndex] = densityRequirementAtPlay;
    const nextPlayerCorals = playerCorals.map((c) =>
        c.id === coral.id
          ? {
              ...c,
              slots: c.slots.map((s) => (s.id === slotId
                ? isHostedPlacement
                  ? { ...s, hostedCardIds, hostedSchoolDensityRequirements }
                  : { ...s, cardId: playingCardId, cardInstanceId }
                : s)),
            }
          : c,
      );
    setPlayerCorals(nextPlayerCorals);
    if (cardInstanceId) commitPlayerSchoolDensity(cardInstanceId, densityRequirementAtPlay);
    queueBubbleBurstForSlot(slotId);
    const playCost = getPlayerCardPlayCost(card);
    const onPlayResourceGain = getResourceGainFromActions(card.onPlay, "rp");
    const rpAfterCost = Math.max(0, rp - playCost);
    const playerCapAfterPlacement = getEcosystemRpCap(nextPlayerCorals, [
      ...playerHabitats,
      ...playerReefCreatures,
      ...playerOrphanCreatures.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ], activeCondition);
    const rpAfterOnPlayGain = addResourceWithinCap(rpAfterCost, onPlayResourceGain, playerCapAfterPlacement);
    const actualOnPlayGain = rpAfterOnPlayGain - rpAfterCost;
    setHand((current) => removeOneCard(current, playingCardId));
    setRp(rpAfterOnPlayGain);
    consumePlayerSchoolDensityDiscount(card);
    setPlayingCardId(null);
    setSelectedHandCard(null);
    setPlayError("");
    pushLog(isHostedPlacement
      ? `Hosted ${card.name} inside ${cardsById[slot.cardId]?.name} for ${playCost} RP.${onPlayResourceGain ? ` Its On Play ability gained ${actualOnPlayGain} RP${actualOnPlayGain < onPlayResourceGain ? ` (limited by the ${playerCapAfterPlacement} RP bank cap)` : ""}.` : ""}`
      : `Placed ${card.name} into a coral slot for ${playCost} RP.${onPlayResourceGain ? ` Its On Play ability gained ${actualOnPlayGain} RP${actualOnPlayGain < onPlayResourceGain ? ` (limited by the ${playerCapAfterPlacement} RP bank cap)` : ""}.` : ""}`);
    emitPlayerBuild(card, playCost, isHostedPlacement ? "hosted-creature" : "coral-slot");
    const onPlayDamage = getOnPlayFoundationDamage(card, [...playerHabitats, ...playerCorals.map((foundation) => foundation.cardId)]);
    const hasOnPlayAttack = Boolean(getOnPlayAttackEffect(card));
    const deckDiscardAbility = getOnPlayOpponentDeckDiscard(card);
    const onPlayDrawCount = getOnPlayDrawCount(card);
    if (!onPlayDamage && !deckDiscardAbility && !onPlayDrawCount) beginOnPlayAttack(card, coral.id, slotId);
    beginPlayerOnPlaySearch(card, slotId);
    const onPlayHeal = getOnPlayCoralHeal(card);
    const onPlayReorder = getOnPlayReorder(card);
    const randomDiscard = getOnPlayRandomDiscard(card);
    const symbiosisCandidates = cardHasSymbiosis(card) ? hand.filter((cardId) => cardId !== card.id && cardsById[cardId]?.tags?.includes("clownfish")) : [];
    if (cardHasSymbiosis(card)) {
      if (symbiosisCandidates.length) {
        setSearchContext({ mode: "symbiosis", sourceCardId: card.id, coralId: coral.id, slotId, candidates: symbiosisCandidates });
        setEventOverlay({ type: "choose-symbiosis-card", sourceCardId: card.id, title: `Player's ${card.name} used Symbiosis`, message: "Choose a Clownfish from your hand to attach to this Anemone at no additional RP cost. This printed On Play effect is mandatory while a Clownfish is available." });
      } else {
        const message = `${card.name}'s Symbiosis found no Clownfish in your hand, so no card was hosted.`;
        pushLog(message);
        setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used Symbiosis`, message, success: false });
      }
    }
    const appliedDeckDiscard = applyPlayerOnPlayDeckDiscard(card);
    const appliedSupportBlock = applyPlayerOnPlaySupportBlock(card);
    if (!onPlayDamage && deckDiscardAbility && hasOnPlayAttack) {
      // Resolve the visible deck-discard event first, then present the mandatory
      // attack target prompt. This keeps multi-part On Play cards from replacing
      // their own event popup before the player can read it.
      beginOnPlayAttack(card, coral.id, slotId, -1, appliedDeckDiscard);
    }
    if (randomDiscard && opponent.hand.length) {
      const discardedIds = shuffle(opponent.hand).slice(0, randomDiscard.amount);
      setOpponent((current) => ({ ...current, hand: discardedIds.reduce((cards, cardId) => removeOneCard(cards, cardId), current.hand), discardPile: [...discardedIds, ...current.discardPile] }));
      const discardedNames = discardedIds.map((cardId) => cardsById[cardId]?.name ?? cardId).join(", ");
      const message = `${card.name} discarded ${discardedNames} at random from the opponent's hand.`;
      pushLog(message);
      setEventOverlay({ type: "impact-result", sourceCardId: card.id, defenderCardId: discardedIds[0], title: `Player's ${card.name} used ${randomDiscard.actionName}`, message, success: true });
    }
    const onPlayDamageTargets = onPlayDamage?.targetType === "creature-school"
      ? opponentCorals.filter((foundation) => isCreatureSchool(cardsById[foundation.cardId]))
      : opponentCoralCards;
    if (onPlayDamage && onPlayDamageTargets.length) {
      setEventOverlay({
        type: "choose-impact-target",
        sourceCardId: card.id,
        title: `Player's ${card.name} used ${onPlayDamage.actionName}`,
        message: `Choose an opponent ${onPlayDamage.targetType === "creature-school" ? "Creature School" : "coral"} to receive ${onPlayDamage.amount} damage.`,
        amount: onPlayDamage.amount,
        targetCoralIds: onPlayDamageTargets.map((coral) => coral.id),
        followupOnPlayAttack: hasOnPlayAttack ? { coralId: coral.id, slotId, reefIndex: -1 } : null,
      });
    } else if (onPlayDamage) {
      const message = `${card.name}'s ${onPlayDamage.actionName} had no legal opponent ${onPlayDamage.targetType === "creature-school" ? "Creature School" : "coral"} target.`;
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${onPlayDamage.actionName}`, message, success: false });
      if (hasOnPlayAttack) beginOnPlayAttack(card, coral.id, slotId, -1, true);
    } else if (onPlayHeal) {
      const candidates = playerCoralCards.filter((candidate) => Number(candidate.health ?? candidate.maxHealth) < Number(candidate.maxHealth)).map((candidate) => candidate.id);
      if (candidates.length) {
        setSearchContext({ mode: "onplay-heal", sourceCardId: card.id, candidates, amount: onPlayHeal.amount, actionName: onPlayHeal.actionName, roll: onPlayHeal.roll });
        setEventOverlay({ type: "choose-onplay-heal-target", sourceCardId: card.id, title: `Player's ${card.name} used ${onPlayHeal.actionName}`, message: `Choose one of your damaged corals to restore ${onPlayHeal.amount} HP${onPlayHeal.roll != null ? ` (rolled ${onPlayHeal.roll})` : ""}.` });
      } else {
        const message = `${card.name}'s ${onPlayHeal.actionName} had no damaged coral to heal.`;
        pushLog(message);
        setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${onPlayHeal.actionName}`, message, success: false });
      }
    } else if (onPlayDrawCount) {
      beginPlayerOnPlayDraw(card, slotId);
      if (hasOnPlayAttack && foundationDeck.length + palsDeck.length >= onPlayDrawCount) beginOnPlayAttack(card, coral.id, slotId, -1, true);
    }
    else if (onPlayReorder) beginPlayerOnPlayReorder(card, slotId);
    if (onPlayResourceGain && !getOnPlayAttackEffect(card) && !getOnPlayUtilitySearch(card) && !onPlayDamage && !onPlayHeal && !onPlayDrawCount && !onPlayReorder && !randomDiscard && !cardHasSymbiosis(card) && !appliedDeckDiscard && !appliedSupportBlock) {
      const message = `${card.name}'s On Play ability gained ${actualOnPlayGain} RP${actualOnPlayGain < onPlayResourceGain ? `; the rest was prevented by the ${playerCapAfterPlacement} RP bank cap` : ""}. You now have ${rpAfterOnPlayGain}/${playerCapAfterPlacement} RP.`;
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} gained RP`, message, success: actualOnPlayGain > 0 });
    }
  }

  function placeCoralInEcosystem(x, y) {
    if (!playingCardId) return;
    const card = cardsById[playingCardId];
    if (!isFoundationCard(card) || Number(card.stage ?? 0) > 0) return;
    const coralId = createCoralId(playingCardId);
    const slots = createCoralSlots(card, coralId);
    const redistributed = redistributeOrphanCreatures([
      ...playerCorals,
      {
        id: coralId,
        cardId: playingCardId,
        name: card.name,
        image: card.image,
        x,
        y,
        slots,
        health: Number(card.health ?? 0),
        maxHealth: Number(card.health ?? 0),
        playedTurn: turn,
        stageEnteredTurn: turn,
      },
    ], playerOrphanCreatures);
    setPlayerCorals(redistributed.corals);
    setPlayerOrphanCreatures(redistributed.orphans);
    const playCost = getPlayerCardPlayCost(card);
    setHand((current) => removeOneCard(current, playingCardId));
    setRp((current) => Math.max(0, current - playCost));
    setPlayingCardId(null);
    setModal(null);
    setSelectedHandCard(null);
    setPlayError("");
    pushLog(`Played ${card.name} into your ecosystem for ${playCost} RP.${playerOrphanCreatures.length !== redistributed.orphans.length ? ` ${playerOrphanCreatures.length - redistributed.orphans.length} orphaned creature group(s) automatically occupied compatible slots.` : ""}`);
    emitPlayerBuild(card, playCost, "foundation");
  }

  function upgradeCoral(coralId) {
    if (!isUpgradingCoral || !upgradeableCoralIds.has(coralId)) return;
    const coral = playerCorals.find((candidate) => candidate.id === coralId);
    if (!coral || coralIsStunned(coral)) return;

    const currentCard = cardsById[coral.cardId];
    const nextCard = cardsById[playingCardId];
    const upgradeCost = Number(currentCard?.upgrade?.cost?.rp ?? nextCard?.cost?.rp ?? 0);
    if (!nextCard || currentCard?.upgrade?.nextCardId !== nextCard.id || rp < upgradeCost) return;

    const upgradedCorals = playerCorals.map((candidate) =>
        candidate.id === coralId
          ? (() => {
              const previousMaxHealth = Number(candidate.maxHealth ?? currentCard.health ?? 0);
              const previousHealth = Number(candidate.health ?? previousMaxHealth);
              const nextMaxHealth = Number(nextCard.health ?? previousMaxHealth);
              return {
              ...candidate,
              cardId: nextCard.id,
              name: nextCard.name,
              image: nextCard.image,
              maxHealth: nextMaxHealth,
              health: preserveDamageOnUpgrade(previousHealth, previousMaxHealth, nextMaxHealth),
              slots: mergeUpgradedCoralSlots(candidate.slots, nextCard, candidate.id),
              stageEnteredTurn: turn,
              };
            })()
          : candidate,
      );
    const redistributed = redistributeOrphanCreatures(upgradedCorals, playerOrphanCreatures);
    setPlayerCorals(redistributed.corals);
    setPlayerOrphanCreatures(redistributed.orphans);
    setHand((current) => removeOneCard(current, nextCard.id));
    setRp((current) => current - upgradeCost);
    setPlayingCardId(null);
    setSelectedHandCard(null);
    setPlayError("");
    pushLog(`Upgraded ${currentCard.name} to ${nextCard.stageLabel} for ${upgradeCost} RP.${playerOrphanCreatures.length !== redistributed.orphans.length ? ` ${playerOrphanCreatures.length - redistributed.orphans.length} orphaned creature group(s) occupied the new compatible slots.` : ""}`);
    emitPlayerBuild(nextCard, upgradeCost, "foundation-upgrade");
    if (cardHasSchoolMomentum(nextCard)) {
      const candidates = [...new Set([...foundationDeck, ...palsDeck].filter((cardId) => isCreatureSchool(cardsById[cardId])))];
      if (candidates.length) {
        setSearchContext({ mode: "school-momentum", sourceCardId: nextCard.id, candidates });
        setEventOverlay({ type: "choose-school-momentum", sourceCardId: nextCard.id, title: `Player's ${nextCard.name} used Momentum`, message: "Choose a Creature School from your decks to add to your hand. Both decks will be shuffled afterward." });
      } else {
        pushLog(`${nextCard.name}'s Momentum found no Creature School.`);
      }
    }
  }

  function cancelCardPlay() {
    setPlayingCardId(null);
    setPlayError("");
  }

  function completeTutorialLayoutLessonAction(actionId) {
    if (
      !tutorialUsesScriptedScenario
      || gamePhase !== "setup"
      || !playerCorals.length
      || tutorialHelp?.actionId !== actionId
    ) return;
    setTutorialLayoutProgress((current) => (
      completeGuidedAcademyLayoutAction(current, actionId)
    ));
    setTutorialHelpDismissedId(null);
  }

  function handleEcosystemClick(event) {
    if (!isPlacingCoral) return;
    const { x, y } = guidedFoundationPlacementTarget
      ?? getPlacementCoordinates(event, ecosystemZoom, ecosystemOffset);
    placeCoralInEcosystem(x, y);
    queueBubbleBurstAtClientPoint(event.clientX, event.clientY);
  }

  function handleSlotPointerDown(coralId, slotId, event) {
    const slot = playerCorals.find((coral) => coral.id === coralId)?.slots.find((candidate) => candidate.id === slotId);
    if (!slot || playingCardId || isUpgradingCoral) return;
    event.stopPropagation();
    const coralElement = event.currentTarget.closest("[data-coral]");
    const dragElement = event.currentTarget.closest("[data-slot-drag-handle]") ?? event.currentTarget;
    if (!coralElement) return;
    slotWasDraggedRef.current = false;
    const nextSlotDragStart = {
      coralId,
      slotId,
      cardId: slot.cardId ?? null,
      pointerX: event.clientX,
      pointerY: event.clientY,
      coralRect: coralElement.getBoundingClientRect(),
    };
    slotDragStartRef.current = nextSlotDragStart;
    setSlotDragStart(nextSlotDragStart);
    try {
      if (dragElement && event.pointerId != null && dragElement.setPointerCapture) {
        dragElement.setPointerCapture(event.pointerId);
      }
    } catch (e) {
      // ignore pointer capture failures
    }
  }

  function handleCoralPointerDown(coralId, event) {
    event.preventDefault();
    event.stopPropagation();
    if (isUpgradingCoral) return;
    const coral = playerCorals.find((c) => c.id === coralId);
    if (!coral) return;
    coralWasDraggedRef.current = false;
    setDraggingCoralId(coralId);
    setCoralDragStart({
      coralId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: coral.x,
      startY: coral.y,
    });
    try {
      // capture pointer so pointermove/up events continue even if cursor leaves the image
      if (event.target && event.pointerId != null && event.target.setPointerCapture) {
        event.target.setPointerCapture(event.pointerId);
      }
    } catch (e) {
      // ignore
    }
  }

  function handleCoralClick(coralId, event) {
    event.preventDefault();
    event.stopPropagation();
    if (coralWasDraggedRef.current) {
      coralWasDraggedRef.current = false;
      return;
    }
    if (isUpgradingCoral) {
      upgradeCoral(coralId);
      return;
    }
    const coral = playerCorals.find((candidate) => candidate.id === coralId);
    if (coral) setInspectedCard({ owner: "player", cardId: coral.cardId, coralId, slotId: `foundation-${coralId}`, foundation: true });
  }

  function handleCoralDragEnd() {
    setDraggingCoralId(null);
    setCoralDragStart(null);
  }

  function handleSlotDragEnd() {
    slotDragStartRef.current = null;
    setSlotDragStart(null);
  }

  function handleEcosystemPointerDown(event) {
    if (isPlacingCoral) return;
    if (event.target.closest("button") || event.target.closest("[data-coral]")) return;
    event.preventDefault();
    setIsPanning(true);
    setPanStart({ x: event.clientX, y: event.clientY, offsetX: ecosystemOffset.x, offsetY: ecosystemOffset.y });
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch (e) {
      // ignore pointer capture failures
    }
  }

  function handleEcosystemPointerMove(event) {
    const activeSlotDrag = slotDragStartRef.current;
    if (activeSlotDrag) {
      const dragDistance = Math.abs(event.clientX - activeSlotDrag.pointerX) + Math.abs(event.clientY - activeSlotDrag.pointerY);
      if (dragDistance <= 5) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = activeSlotDrag.coralRect;
      slotWasDraggedRef.current = true;
      const left = ((event.clientX - rect.left) / rect.width) * 100;
      const top = ((event.clientY - rect.top) / rect.height) * 100;
      setPlayerCorals((current) =>
        current.map((coral) =>
          coral.id === activeSlotDrag.coralId
            ? {
                ...coral,
                slots: coral.slots.map((slot) =>
                  slot.id === activeSlotDrag.slotId ? { ...slot, position: { top: `${top}%`, left: `${left}%` }, count: 1 } : slot,
                ),
              }
            : coral,
        ),
      );
      return;
    }
    if (coralDragStart) {
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = event.clientX - coralDragStart.pointerX;
      const dy = event.clientY - coralDragStart.pointerY;
      if (Math.abs(dx) + Math.abs(dy) > 5) coralWasDraggedRef.current = true;
      const safeZoom = Math.max(0.01, ecosystemZoom);
      const x = ((coralDragStart.startX / 100) * rect.width + dx / safeZoom) / rect.width * 100;
      const y = ((coralDragStart.startY / 100) * rect.height + dy / safeZoom) / rect.height * 100;
      setPlayerCorals((current) =>
        current.map((coral) =>
          coral.id === coralDragStart.coralId
            ? { ...coral, x, y }
            : coral,
        ),
      );
      return;
    }
    if (!isPanning || !panStart) return;
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    setEcosystemOffset({ x: panStart.offsetX + dx, y: panStart.offsetY + dy });
  }

  function handleEcosystemPointerUp(event) {
    const completedSlotGesture = slotDragStartRef.current;
    const completedFoundationDrag = Boolean(coralDragStart && coralWasDraggedRef.current);
    const completedSlotDrag = Boolean(completedSlotGesture && slotWasDraggedRef.current);
    const shouldInspectChild = event?.type === "pointerup"
      && completedSlotGesture?.cardId
      && !slotWasDraggedRef.current;
    setIsPanning(false);
    setPanStart(null);
    setDraggingCoralId(null);
    setCoralDragStart(null);
    handleSlotDragEnd();
    if (completedFoundationDrag) {
      completeTutorialLayoutLessonAction(GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_FOUNDATION);
    } else if (completedSlotDrag) {
      completeTutorialLayoutLessonAction(GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_SLOT);
    }
    if (shouldInspectChild) {
      setInspectedCard({
        owner: "player",
        cardId: completedSlotGesture.cardId,
        coralId: completedSlotGesture.coralId,
        slotId: completedSlotGesture.slotId,
      });
    }
  }

  function handleOpponentPointerDown(event) {
    if (event.target.closest("button")) return;
    event.preventDefault();
    setOpponentViewportTouched(true);
    setIsOpponentPanning(true);
    setOpponentPanStart({ x: event.clientX, y: event.clientY, offsetX: opponentEcosystemOffset.x, offsetY: opponentEcosystemOffset.y });
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  }

  function handleOpponentPointerMove(event) {
    if (!isOpponentPanning || !opponentPanStart) return;
    setOpponentEcosystemOffset({
      x: opponentPanStart.offsetX + event.clientX - opponentPanStart.x,
      y: opponentPanStart.offsetY + event.clientY - opponentPanStart.y,
    });
  }

  function handleOpponentPointerUp() {
    setIsOpponentPanning(false);
    setOpponentPanStart(null);
  }

  function handleFloatingCardPointerDown(key, event) {
    event.preventDefault();
    event.stopPropagation();
    const offset = floatingCardOffsets[key] ?? { x: 0, y: 0 };
    floatingCardWasDraggedRef.current = false;
    const zoom = key.startsWith("opponent-") ? opponentEcosystemZoom : ecosystemZoom;
    setFloatingCardDrag({ key, pointerX: event.clientX, pointerY: event.clientY, startX: offset.x, startY: offset.y, zoom });
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  }

  function handleFloatingCardPointerMove(event) {
    if (!floatingCardDrag) return;
    const zoom = Math.max(0.01, floatingCardDrag.zoom ?? 1);
    const x = floatingCardDrag.startX + (event.clientX - floatingCardDrag.pointerX) / zoom;
    const y = floatingCardDrag.startY + (event.clientY - floatingCardDrag.pointerY) / zoom;
    if (Math.abs(x - floatingCardDrag.startX) > 3 || Math.abs(y - floatingCardDrag.startY) > 3) floatingCardWasDraggedRef.current = true;
    setFloatingCardOffsets((current) => ({ ...current, [floatingCardDrag.key]: { x, y } }));
  }

  function handleFloatingCardPointerUp() {
    setFloatingCardDrag(null);
  }

  function inspectSearchResult(cardId) {
    if (!cardsById[cardId]) return;
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      inspectorReturnFocusRef.current = document.activeElement;
    }
    setInspectedCard({ owner: "reference", cardId, reference: true });
  }

  function closeCardInspector() {
    const returnTarget = inspectorReturnFocusRef.current;
    inspectorReturnFocusRef.current = null;
    setInspectedCard(null);
    if (returnTarget?.isConnected) {
      window.requestAnimationFrame(() => returnTarget.focus());
    }
  }

  function inspectFloatingCard(details) {
    if (floatingCardWasDraggedRef.current) {
      floatingCardWasDraggedRef.current = false;
      return;
    }
    setInspectedCard(details);
  }

  useEffect(() => {
    const attachCursorZoom = (element, setZoom, setOffset, onAdjusted) => {
      if (!element) return () => {};
      const onWheel = (event) => {
        if (event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        onAdjusted?.();
        const rect = element.getBoundingClientRect();
        const distanceX = event.clientX - rect.left - rect.width / 2;
        const distanceY = event.clientY - rect.top - rect.height / 2;
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        setZoom((currentZoom) => {
          const newZoom = clampZoom(currentZoom + delta);
          if (newZoom === currentZoom) return currentZoom;
          setOffset((currentOffset) => ({
            x: distanceX - ((distanceX - currentOffset.x) / currentZoom) * newZoom,
            y: distanceY - ((distanceY - currentOffset.y) / currentZoom) * newZoom,
          }));
          return newZoom;
        });
      };
      element.addEventListener("wheel", onWheel, { passive: false, capture: true });
      return () => element.removeEventListener("wheel", onWheel, { capture: true });
    };
    const detachPlayer = attachCursorZoom(ecosystemRef.current, setEcosystemZoom, setEcosystemOffset);
    const detachOpponent = attachCursorZoom(opponentEcosystemRef.current, setOpponentEcosystemZoom, setOpponentEcosystemOffset, () => setOpponentViewportTouched(true));
    return () => {
      detachPlayer();
      detachOpponent();
    };
  }, []);

  function pushLog(text) {
    setLog((current) => [text, ...current].slice(0, 50));
    setTurnLog((current) => [...current, text].slice(-12));
  }

  function applyCurrentHandLimit(cardIds, currentHandSize = hand.length) {
    return drawWithHandLimit(cardIds, currentHandSize, cardIds.length, Infinity);
  }

  function getCardsInPlayForComposition(corals, reefCreatureIds, orphanEntries) {
    return [
      ...(corals ?? []).flatMap((foundation) => [
        foundation.cardId,
        ...(foundation.slots ?? []).flatMap((slot) => getSlotCardIds(slot)),
      ]),
      ...(reefCreatureIds ?? []),
      ...(orphanEntries ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ];
  }

  function resolvePlayerEndOfTurnHabitats() {
    const result = resolveEndOfTurnHabitatMaintenance(playerHabitatInstances, {
      cardsInPlay: getCardsInPlayForComposition(playerCorals, playerReefCreatures, playerOrphanCreatures),
      cardLookup: cardsById,
      habitatLookup: cardsById,
    });
    if (!result.events.length) return { ...result, messages: [] };
    setPlayerHabitatInstances(result.habitats);
    if (result.destroyedHabitats.length) {
      setDiscardPile((current) => [...result.destroyedHabitats.map((habitat) => habitat.cardId), ...current]);
    }
    const messages = result.events.map((event) => {
      const message = event.destroyed
        ? `${cardsById[event.cardId]?.name} took ${event.appliedDamage} end-of-turn damage because its ecosystem requirement was not met and was destroyed.`
        : `${cardsById[event.cardId]?.name} took ${event.appliedDamage} end-of-turn damage because its ecosystem requirement was not met. ${event.currentHealth}/${event.previousHealth === event.currentHealth ? event.currentHealth : playerHabitatInstances.find((habitat) => habitat.instanceId === event.instanceId)?.maxHealth ?? event.previousHealth} HP remains.`;
      pushLog(message);
      return message;
    });
    return { ...result, messages };
  }

  function queueEvents(eventsToAdd) {
    if (!eventsToAdd.length) return;
    if (eventOverlay) {
      setPendingEvents((events) => [...events, ...eventsToAdd]);
      return;
    }
    const [firstEvent, ...remainingEvents] = eventsToAdd;
    if (firstEvent?.type === "choose-regenerate") commitEventState(firstEvent);
    setEventOverlay(firstEvent);
    setPendingEvents((events) => [...events, ...remainingEvents]);
  }

  function commitEventState(event) {
    if (event?.opponentStateAfter) setOpponent(event.opponentStateAfter);
    if (event?.playerStateAfter) {
      const next = normalizeProjectedPlayerState(event.playerStateAfter);
      const has = (key) => Object.prototype.hasOwnProperty.call(next, key);
      if (has("corals")) setPlayerCorals(next.corals);
      if (has("reefCreatureInstances")) setPlayerReefCreatureInstances(next.reefCreatureInstances);
      if (has("orphanCreatureInstances")) setPlayerOrphanCreatureInstances(next.orphanCreatureInstances);
      if (has("hand")) setHand(next.hand);
      if (has("discardPile")) setDiscardPile(next.discardPile);
      if (has("lostZone")) setLostZone(next.lostZone);
      if (has("foundationDeck")) setFoundationDeck(next.foundationDeck);
      if (has("palsDeck")) setPalsDeck(next.palsDeck);
      if (has("rp")) setRp(next.rp);
      if (has("supportBlockedUntilRound")) setSupportBlockedUntilRound(next.supportBlockedUntilRound);
      if (has("resilienceUsedCardIds")) setResilienceUsedCardIds(next.resilienceUsedCardIds);
      if (has("creatureStatuses")) setCreatureStatuses(next.creatureStatuses);
      if (has("blueCrabRecycleUsedTurn")) setBlueCrabRecycleUsedTurn(next.blueCrabRecycleUsedTurn);
      if (has("flashingAlarmAttackBonus")) setFlashingAlarmAttackBonus(next.flashingAlarmAttackBonus);
    }
    const eventLogMessages = [
      ...(event?.logMessages ?? []),
      ...(event?.logMessage ? [event.logMessage] : []),
    ].filter(Boolean);
    if (eventLogMessages.length) {
      setLog((current) => [...eventLogMessages].reverse().concat(current).slice(0, 50));
    }
    if (event?.gameResultAfter) setGameResult((current) => current ?? event.gameResultAfter);
  }

  function closeEventOverlay() {
    setFaceoffRolling(false);
    setFaceoffPreview(null);
    commitEventState(eventOverlay);
    if (eventOverlay?.continueToEndTurn) {
      setEventOverlay(null);
      endTurn();
      return;
    }
    if (eventOverlay?.continueAttackSequence) {
      setEventOverlay(null);
      return;
    }
    if (eventOverlay?.beginOpponentAfterClose) {
      setEventOverlay(null);
      setPendingEvents([]);
      if (gameResult) return;
      setGamePhase("opponent");
      setOpponentThinking(true);
      opponentThinkingTimerRef.current = setTimeout(() => {
        opponentThinkingTimerRef.current = null;
        resolveOpponentTurnRef.current?.();
      }, scaleOpponentThinkingDelay(Number(eventOverlay.thinkingDelay ?? 1200), opponentDifficulty));
      return;
    }
    if (eventOverlay?.advanceRoundAfterClose) {
      setEventOverlay(null);
      setPendingEvents([]);
      if (gameResult || eventOverlay.gameResultAfter) return;
      startRound(round + 1, { advanceTurn: true });
      return;
    }
    if (eventOverlay?.startOpeningPlayerTurnAfterClose) {
      setEventOverlay(null);
      setPendingEvents([]);
      setOpeningOpponentTurn(false);
      if (gameResult || eventOverlay.gameResultAfter) return;
      startRound(round, {
        reuseConditionId: activeConditionId,
        skipOpponentHandLimit: true,
        conditionTitle: `Round ${round} · Your First Turn`,
      });
      return;
    }
    const [nextEvent, ...remaining] = pendingEvents;
    setPendingEvents(remaining);
    if (nextEvent?.opponentSequence) {
      const isComplexDecision = ["faceoff-result", "opponent-impact", "turn-transition"].includes(nextEvent.type) || playerVp >= victoryTarget - 8 || opponentVp >= victoryTarget - 8;
      const delay = scaleOpponentThinkingDelay(isComplexDecision ? 1500 : 900, opponentDifficulty);
      setEventOverlay(null);
      setOpponentThinking(true);
      opponentThinkingTimerRef.current = setTimeout(() => {
        opponentThinkingTimerRef.current = null;
        setOpponentThinking(false);
        if (nextEvent.type === "choose-regenerate") commitEventState(nextEvent);
        setEventOverlay(nextEvent);
      }, delay);
    } else {
      setEventOverlay(nextEvent ?? null);
    }
  }

  function drawNextCondition() {
    const availableConditionIds = conditionCards.map((card) => card.id).filter((conditionId) => !persistentConditionIds.includes(conditionId));
    const source = conditionDeck.length ? conditionDeck : shuffle(availableConditionIds);
    const conditionId = source[0] ?? null;
    setConditionDeck(source.slice(1));
    setActiveConditionId(conditionId);
    const condition = conditionId ? cardsById[conditionId] : null;
    if (condition?.tags?.includes("persistent")) {
      setPersistentConditionIds((current) => current.includes(conditionId) ? current : [...current, conditionId]);
    }
    return condition;
  }

  function startRound(nextRound, {
    advanceTurn = false,
    reuseConditionId = null,
    skipOpponentHandLimit = false,
    conditionTitle = null,
  } = {}) {
    const condition = reuseConditionId ? cardsById[reuseConditionId] : drawNextCondition();
    const ecosystemRp = getEcosystemStartTurnRp(playerCorals, condition);
    const collectedRp = 1 + ecosystemRp;
    const roundRpCap = getEcosystemRpCap(playerCorals, [...playerHabitats, ...playerReefCreatures, ...playerOrphanCreatures.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], condition);
    const parasiteRequestedRp = getParasiteRequestedRp(
      playerCorals,
      playerReefCreatures,
      playerOrphanCreatures,
      opponent.corals,
      opponent.reefCreatures,
      opponent.orphanCreatures,
    );
    const parasiteTransfer = resolveParasiteCollection({
      requested: parasiteRequestedRp,
      opposingRp: opponent.rp,
      recipientRp: rp,
      recipientCap: roundRpCap,
    });
    const parasiteMessage = describeParasiteTransfer("Your Cookie Cutter", parasiteTransfer);
    const rpBeforeCollection = parasiteTransfer.recipientAfter;
    const rpAfterCollection = addResourceWithinCap(rpBeforeCollection, collectedRp, roundRpCap);
    const actualCollectedRp = Math.max(0, rpAfterCollection - Math.min(rpBeforeCollection, roundRpCap));
    const cappedRp = Math.max(0, rpBeforeCollection + collectedRp - rpAfterCollection);
    emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED, {
      collected: actualCollectedRp,
      available: collectedRp,
      bankBefore: rpBeforeCollection,
      bankAfter: rpAfterCollection,
      cap: roundRpCap,
      capped: cappedRp,
    }, { phase: "draw", round: nextRound, turn: advanceTurn ? turn + 1 : turn });
    setRp(rpAfterCollection);
    setPlayerCorals((current) => current.map(({ rpPenaltyNextTurn, ...coral }) => coral));
    if (parasiteRequestedRp) {
      setOpponent((current) => ({ ...current, rp: parasiteTransfer.sourceAfter }));
    }
    const handLimitEffect = (condition?.effects ?? []).find((effect) => effect.type === "setHandLimit");
    const handLimit = Number(handLimitEffect?.amount ?? Infinity);
    const excessCards = Number.isFinite(handLimit) && hand.length > handLimit ? hand.slice(handLimit) : [];
    const opponentHandLimitResult = skipOpponentHandLimit
      ? { state: opponent, cardsToDiscard: [] }
      : applyAutomatedHandLimitToState(opponent, handLimit, { round: nextRound });
    const opponentExcessCards = opponentHandLimitResult.cardsToDiscard;
    if (opponentExcessCards.length) setOpponent(opponentHandLimitResult.state);
    setRound(nextRound);
    setTurnLog([]);
    setGamePhase("draw");
    setHasDrawnThisTurn(false);
    const requestedDraws = 1 + getConditionExtraDraws(condition);
    const availableDraws = Math.min(requestedDraws, foundationDeck.length + palsDeck.length);
    setTurnDrawSelection({ requested: requestedDraws, target: availableDraws, shortfall: getRequiredDrawShortfall(requestedDraws, availableDraws), foundation: 0, pals: 0 });
    setTurnDrawResult(null);
    if (advanceTurn) setTurn((current) => current + 1);
    setModal(availableDraws > 0 ? "turn-draw" : null);
    setPlayingCardId(null);
    setUsedAttackers([]);
    setUsedCreatureActions([]);
    setPendingCreatureAction(null);
    setFlashingAlarmAttackBonus((current) => beginFlashingAlarmTurn(current));
    if (advanceTurn) {
      const nextPlayerTurn = turn + 1;
      setCreatureStatuses((current) => Object.fromEntries(Object.entries(current).map(([slotId, statuses]) => [slotId, statuses.filter((status) => status.expiresTurn > nextPlayerTurn)]).filter(([, statuses]) => statuses.length)));
    }
    setSupportLockSourceId(null);
    setCardsBlockedFromPlayThisTurn([]);
    setRovLightsActive(false);
    setAttackContext(null);
    setSearchContext(null);
    setPlayError("");
    if (availableDraws === 0) setGameResult((current) => current ?? `Defeat: you were required to draw ${requestedDraws} card${requestedDraws === 1 ? "" : "s"}, but both personal decks were empty.`);
    if (condition) {
      const roundNotes = [
        requestedDraws > 1 ? `This round, each player draws ${requestedDraws} cards during their draw phase.` : null,
        Number.isFinite(handLimit) ? `The hand limit this round is ${handLimit}.` : null,
        condition.tags?.includes("persistent") ? "This condition remains in play after the round ends." : "This condition applies for the current round.",
      ].filter(Boolean);
      setEventOverlay({
        type: "condition-reveal",
        round: nextRound,
        sourceCardId: condition.id,
        title: conditionTitle ?? `Round ${nextRound}`,
        message: condition.text,
        conditionName: condition.name,
        conditionText: condition.text,
        turnCollection: {
          collected: actualCollectedRp,
          available: collectedRp,
          bank: rpAfterCollection,
          cap: roundRpCap,
          capped: cappedRp,
        },
        roundNotes,
      });
    }
    setPendingEvents(parasiteRequestedRp ? [{
      type: "impact-result",
      sourceCardId: "cookie-cutter-shark",
      title: "Player's Cookie Cutter used Parasite",
      message: parasiteMessage,
      success: parasiteTransfer.collected > 0,
    }] : []);
    pushLog(
      `Round ${nextRound}: revealed ${condition?.name ?? "no condition"}. Collected ${actualCollectedRp} RP from ${collectedRp} available; bank ${rpAfterCollection}/${roundRpCap}.${cappedRp ? ` ${cappedRp} RP was discarded at the cap.` : ""} Now choose your card draw.${parasiteMessage ? ` ${parasiteMessage}` : ""}${excessCards.length ? ` Your hand is ${excessCards.length} card${excessCards.length === 1 ? "" : "s"} over the limit; choose what to discard.` : ""}${opponentExcessCards.length ? ` The opponent chose ${opponentExcessCards.length} excess card(s) to discard.` : ""}`,
    );
  }

  function beginOpeningOpponentTurn() {
    const condition = drawNextCondition();
    const requestedDraws = 1 + getConditionExtraDraws(condition);
    const handLimitEffect = (condition?.effects ?? []).find((effect) => effect.type === "setHandLimit");
    const handLimit = Number(handLimitEffect?.amount ?? Infinity);
    const roundNotes = [
      requestedDraws > 1 ? `This round, each player draws ${requestedDraws} cards during their draw phase.` : null,
      Number.isFinite(handLimit) ? `The hand limit this round is ${handLimit}.` : null,
      condition?.tags?.includes("persistent") ? "This condition remains in play after the round ends." : "This condition applies for the current round.",
    ].filter(Boolean);

    setRound(1);
    setGamePhase("transition");
    setOpeningOpponentTurn(true);
    setModal(null);
    setPendingEvents([]);
    setEventOverlay({
      type: "condition-reveal",
      round: 1,
      sourceCardId: condition?.id ?? null,
      title: "Round 1 · Opponent Goes First",
      message: condition?.text ?? "No condition was revealed.",
      conditionName: condition?.name ?? "No active condition",
      conditionText: condition?.text ?? "",
      openingOpponentTurn: true,
      beginOpponentAfterClose: true,
      thinkingDelay: 900,
      roundNotes,
    });
    pushLog(`The opponent won the opening choice and takes the first turn. Round 1 revealed ${condition?.name ?? "no condition"}.`);
  }

  function beginFirstRound() {
    if (!hasCoralInPlay) {
      setPlayError("Play a base Coral or Creature School before beginning round 1.");
      setModal("hand");
      return;
    }
    emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, {
      foundationCount: playerCorals.length,
      handCount: hand.length,
      rp,
      accepted: true,
    }, { phase: "setup", round: 0 });
    if (startingPlayer === OpeningPlayer.OPPONENT) {
      beginOpeningOpponentTurn();
      return;
    }
    startRound(1);
  }

  function adjustTurnDraw(deckType, delta) {
    setTurnDrawSelection((current) => {
      if (!current) return current;
      const authoredDraw = tutorialUsesScriptedScenario && !current.mode
        ? getScriptedTutorialTurnDraw({ round })
        : null;
      if (authoredDraw && delta > 0 && deckType !== authoredDraw.deckType) return current;
      const nextAmount = current[deckType] + delta;
      const available = deckType === "foundation" ? foundationDeck.length : palsDeck.length;
      const nextTotal = current.foundation + current.pals + delta;
      if (nextAmount < 0 || nextAmount > available || nextTotal < 0 || nextTotal > current.target) return current;
      return { ...current, [deckType]: nextAmount };
    });
  }

  function confirmTurnDraw() {
    if (!turnDrawSelection || turnDrawSelection.foundation + turnDrawSelection.pals !== turnDrawSelection.target) return;
    const authoredDraw = tutorialUsesScriptedScenario && !turnDrawSelection.mode
      ? getScriptedTutorialTurnDraw({ round })
      : null;
    const chooseCards = (deck, deckType, amount) => {
      if (!amount) return [];
      if (!authoredDraw || authoredDraw.deckType !== deckType || !deck.includes(authoredDraw.cardId)) {
        return deck.slice(0, amount);
      }
      return [authoredDraw.cardId, ...removeOneCard(deck, authoredDraw.cardId)].slice(0, amount);
    };
    const foundationCards = chooseCards(foundationDeck, "foundation", turnDrawSelection.foundation);
    const palsCards = chooseCards(palsDeck, "pals", turnDrawSelection.pals);
    const drawnCards = [...foundationCards, ...palsCards];
    const drawResult = drawWithHandLimit(drawnCards, hand.length, drawnCards.length, Infinity);
    emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN, {
      count: drawnCards.length,
      foundationCount: foundationCards.length,
      palsCount: palsCards.length,
      toHandCount: drawResult.cardsToHand.length,
      discardedCount: drawResult.cardsToDiscard.length,
      requested: turnDrawSelection.requested,
      shortfall: turnDrawSelection.shortfall,
      cards: drawnCards.map((cardId, index) => ({
        cardId,
        cardName: cardsById[cardId]?.name ?? cardId,
        source: index < foundationCards.length ? "Foundation" : "Pals",
        discarded: index >= drawResult.cardsToHand.length,
      })),
      accepted: true,
    }, { phase: "draw" });
    setFoundationDeck((current) => foundationCards.reduce((deck, cardId) => removeOneCard(deck, cardId), current));
    setPalsDeck((current) => palsCards.reduce((deck, cardId) => removeOneCard(deck, cardId), current));
    setHand((current) => [...current, ...drawResult.cardsToHand]);
    if (drawResult.cardsToDiscard.length) setDiscardPile((current) => [...drawResult.cardsToDiscard, ...current]);
    const revealed = drawnCards.map((cardId, index) => ({
      cardId,
      source: index < foundationCards.length ? "Foundation" : "Pals",
      discarded: index >= drawResult.cardsToHand.length,
    }));
    setTurnDrawResult(revealed);
    setHasDrawnThisTurn(true);
    setGamePhase("main");
    setModal("draw-result");
    pushLog(`Drew ${foundationCards.length} from Foundation and ${palsCards.length} from Pals.${turnDrawSelection.shortfall > 0 ? " The required draw could not be completed, so you lose by deck depletion." : ""}`);
    if (turnDrawSelection.shortfall > 0) {
      setGameResult((current) => current ?? `Defeat: you were required to draw ${turnDrawSelection.requested} cards, but your personal decks contained only ${turnDrawSelection.target}.`);
    }
  }

  function getPlayerOceanicSacrificeChoices(card) {
    const requiresSacrifice = (card?.specialRules ?? []).some((rule) => /discard one oceanic predator or two oceanic fish/i.test(typeof rule === "string" ? rule : rule?.text ?? ""));
    if (!requiresSacrifice) return [];
    const candidates = [
      ...playerCorals.flatMap((coral) => coral.slots.filter((slot) => slot.cardId && !slot.invasiveOwner).map((slot) => ({
        instanceId: getSlotTargetInstanceId(slot),
        densityInstanceId: getSlotCardInstanceId(slot),
        cardId: slot.cardId,
        card: cardsById[slot.cardId],
        schoolDensityRequirementAtPlay: schoolDensityCommitmentsByInstanceId[getSlotCardInstanceId(slot)]
          ?? Number(cardsById[slot.cardId]?.schoolDensityRequirement ?? 0),
        location: "slot",
        coralId: coral.id,
        slotId: slot.id,
        hostedCardIds: [...(slot.hostedCardIds ?? [])],
      }))),
      ...playerReefCreatureInstances.map((instance) => ({
        ...instance,
        densityInstanceId: instance.instanceId,
        card: cardsById[instance.cardId],
        schoolDensityRequirementAtPlay: schoolDensityCommitmentsByInstanceId[instance.instanceId]
          ?? instance.schoolDensityRequirementAtPlay
          ?? Number(cardsById[instance.cardId]?.schoolDensityRequirement ?? 0),
        location: "reef",
      })),
      ...playerOrphanCreatureInstances.filter((instance) => !instance.invasiveOwner).map((instance) => ({
        ...instance,
        densityInstanceId: instance.instanceId,
        card: cardsById[instance.cardId],
        schoolDensityRequirementAtPlay: schoolDensityCommitmentsByInstanceId[instance.instanceId]
          ?? instance.schoolDensityRequirementAtPlay
          ?? Number(cardsById[instance.cardId]?.schoolDensityRequirement ?? 0),
        location: "orphan",
      })),
    ];
    return getOceanicApexSacrificeChoices(candidates, cardsById);
  }

  function completePlayerOceanicPlay(cardId, choiceId = null) {
    const card = cardsById[cardId];
    if (!card || !hand.includes(cardId)) return;
    const choices = getPlayerOceanicSacrificeChoices(card);
    const requiresSacrifice = (card.specialRules ?? []).some((rule) => /discard one oceanic predator or two oceanic fish/i.test(typeof rule === "string" ? rule : rule?.text ?? ""));
    const choice = requiresSacrifice ? choices.find((candidate) => candidate.id === choiceId) : { candidates: [] };
    if (requiresSacrifice && !choice) {
      setPlayError(`${card.name}'s sacrifice choices changed. Choose a currently legal option.`);
      setSearchContext(null);
      setEventOverlay(null);
      return;
    }
    const sacrifices = choice.candidates ?? [];
    const densityRequirementAtPlay = getPlayerSchoolDensityRequirement(card).effectiveRequirement;
    const densityAvailableAfterSacrifice = Math.max(
      0,
      playerSchoolDensityState.capacity
        - playerSchoolDensityState.committed
        + getDensityFreedBySacrificeChoice(choice),
    );
    if (densityRequirementAtPlay > densityAvailableAfterSacrifice) {
      setPlayError(`${card.name} still needs ${densityRequirementAtPlay} available School Density after that sacrifice, but the choice would open only ${densityAvailableAfterSacrifice}.`);
      return;
    }
    const sacrificedSlotIds = new Set(sacrifices.filter((entry) => entry.location === "slot").map((entry) => entry.slotId));
    const sacrificedReefIds = sacrifices.filter((entry) => entry.location === "reef").map((entry) => entry.instanceId);
    const sacrificedOrphanIds = sacrifices.filter((entry) => entry.location === "orphan").map((entry) => entry.instanceId);
    const freedHostedCardIds = [
      ...sacrifices.filter((entry) => entry.location === "slot").flatMap((entry) => entry.hostedCardIds ?? []),
      ...sacrifices.filter((entry) => entry.location === "orphan").flatMap((entry) => entry.hostedCardIds ?? []),
    ];
    const nextPlayerCorals = sacrificedSlotIds.size
      ? playerCorals.map((coral) => ({ ...coral, slots: coral.slots.map((slot) => sacrificedSlotIds.has(slot.id) ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) }))
      : playerCorals;
    if (sacrificedSlotIds.size) setPlayerCorals(nextPlayerCorals);
    const remainingReefInstances = removeCreatureInstances(playerReefCreatureInstances, sacrificedReefIds).instances;
    const playedInstance = createCreatureInstance(card.id, createStableInstanceId(`player-reef-${card.id}`), {
      territorialTargetFoundationId: null,
      schoolDensityRequirementAtPlay: densityRequirementAtPlay,
    });
    const nextReefInstances = [...remainingReefInstances, playedInstance];
    setPlayerReefCreatureInstances(nextReefInstances);
    commitPlayerSchoolDensity(playedInstance.instanceId, densityRequirementAtPlay);
    queueBubbleBurst(76, 24);
    const remainingOrphans = removeCreatureInstances(playerOrphanCreatureInstances, sacrificedOrphanIds).instances;
    const nextOrphanInstances = sacrificedOrphanIds.length || freedHostedCardIds.length
      ? [...remainingOrphans, ...freedHostedCardIds.map((hostedCardId) => createCreatureInstance(hostedCardId, createStableInstanceId(`player-orphan-${hostedCardId}`)))]
      : playerOrphanCreatureInstances;
    if (sacrificedOrphanIds.length || freedHostedCardIds.length) setPlayerOrphanCreatureInstances(nextOrphanInstances);
    if (sacrifices.length) setDiscardPile((current) => [...sacrifices.map((entry) => entry.cardId), ...current]);
    const playCost = getPlayerCardPlayCost(card);
    const onPlayResourceGain = getResourceGainFromActions(card.onPlay, "rp");
    const rpAfterCost = Math.max(0, rp - playCost);
    const playerCapAfterPlacement = getEcosystemRpCap(nextPlayerCorals, [
      ...playerHabitats,
      ...nextReefInstances.map((instance) => instance.cardId),
      ...nextOrphanInstances.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ], activeCondition);
    const rpAfterOnPlayGain = addResourceWithinCap(rpAfterCost, onPlayResourceGain, playerCapAfterPlacement);
    const actualOnPlayGain = rpAfterOnPlayGain - rpAfterCost;
    setHand((current) => removeOneCard(current, card.id));
    setRp(rpAfterOnPlayGain);
    consumePlayerSchoolDensityDiscount(card);
    setSelectedHandCard(null);
    setPlayError("");
    setSearchContext(null);
    const sacrificeMessage = sacrifices.length ? ` As its additional play cost, ${sacrifices.map((entry) => entry.card.name).join(" and ")} ${sacrifices.length === 1 ? "was" : "were"} discarded by your choice.` : "";
    const territorialCandidates = card.id === "ocean-triggerfish" ? nextPlayerCorals.filter((foundation) => isCreatureSchool(cardsById[foundation.cardId])) : [];
    const territorialMessage = card.id === "ocean-triggerfish" ? territorialCandidates.length ? " Territorial is waiting for you to choose one of your Creature Schools." : " Territorial found no Creature School to protect." : "";
    const resourceMessage = onPlayResourceGain
      ? ` ${getOnPlayAbilityName(card)} gained ${actualOnPlayGain} RP${actualOnPlayGain < onPlayResourceGain ? `; the ${playerCapAfterPlacement} RP bank cap prevented the rest` : ""}.`
      : "";
    const committedAfterPlay = Math.max(
      0,
      playerSchoolDensityState.committed
        - getDensityFreedBySacrificeChoice(choice)
        + densityRequirementAtPlay,
    );
    const message = `${card.name} entered your open-water ecosystem for ${playCost} RP and committed ${densityRequirementAtPlay} School Density (${committedAfterPlay}/${playerSchoolDensity} now used).${sacrificeMessage}${territorialMessage}${resourceMessage}`;
    pushLog(message);
    emitPlayerBuild(card, playCost, "open-water");
    const playedSlotId = `reef-${playedInstance.instanceId}`;
    const onPlayDamage = getOnPlayFoundationDamage(card, [...playerHabitats, ...nextPlayerCorals.map((foundation) => foundation.cardId)]);
    const onPlayDamageTargets = onPlayDamage?.targetType === "creature-school"
      ? opponentCorals.filter((foundation) => isCreatureSchool(cardsById[foundation.cardId]))
      : opponentCoralCards;
    const hasOnPlayAttack = Boolean(getOnPlayAttackEffect(card));
    const discardedOpponentDeck = applyPlayerOnPlayDeckDiscard(card);
    const blockedOpponentSupports = applyPlayerOnPlaySupportBlock(card);
    const beganOnPlaySearch = beginPlayerOnPlaySearch(card, playedSlotId);
    const beganOnPlayAttack = onPlayDamage
      ? false
      : beginOnPlayAttack(card, null, playedSlotId, nextReefInstances.length - 1, discardedOpponentDeck || blockedOpponentSupports);
    let beganOnPlayDamage = false;
    if (onPlayDamage && onPlayDamageTargets.length) {
      beganOnPlayDamage = true;
      setEventOverlay({
        type: "choose-impact-target",
        sourceCardId: card.id,
        title: `Player's ${card.name} used ${onPlayDamage.actionName}`,
        message: `Choose an opponent ${onPlayDamage.targetType === "creature-school" ? "Creature School" : "coral"} to receive ${onPlayDamage.amount} damage.`,
        amount: onPlayDamage.amount,
        targetCoralIds: onPlayDamageTargets.map((foundation) => foundation.id),
        followupOnPlayAttack: hasOnPlayAttack ? { coralId: null, slotId: playedSlotId, reefIndex: nextReefInstances.length - 1 } : null,
      });
    } else if (onPlayDamage) {
      beganOnPlayDamage = true;
      const noTargetMessage = `${card.name}'s ${onPlayDamage.actionName} had no legal opponent ${onPlayDamage.targetType === "creature-school" ? "Creature School" : "coral"} target.`;
      pushLog(noTargetMessage);
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used ${onPlayDamage.actionName}`, message: noTargetMessage, success: false });
      if (hasOnPlayAttack) beginOnPlayAttack(card, null, playedSlotId, nextReefInstances.length - 1, true);
    }
    const beganOnPlayDraw = !beganOnPlayDamage && !beganOnPlayAttack && !beganOnPlaySearch && !discardedOpponentDeck && !blockedOpponentSupports
      ? beginPlayerOnPlayDraw(card, playedSlotId)
      : false;
    let beganTerritorialChoice = false;
    if (card.id === "ocean-triggerfish" && !beganOnPlayDamage && !beganOnPlayAttack && !beganOnPlaySearch && !beganOnPlayDraw && !discardedOpponentDeck && !blockedOpponentSupports) {
      beganTerritorialChoice = true;
      if (territorialCandidates.length) {
        setSearchContext({ mode: "territorial-target", sourceCardId: card.id, sourceInstanceId: playedInstance.instanceId, candidates: territorialCandidates.map((foundation) => foundation.id) });
        setEventOverlay({ type: "choose-territorial-target", sourceCardId: card.id, title: `Player's ${card.name} used Territorial`, message: "Choose one of your Creature Schools. It gets +30 HP while this Ocean Triggerfish remains in play." });
      } else {
        setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: `Player's ${card.name} used Territorial`, message: `${card.name}'s Territorial had no Creature School to target.`, success: false });
      }
    }
    if (!beganTerritorialChoice && !beganOnPlayDamage && !beganOnPlayAttack && !beganOnPlaySearch && !beganOnPlayDraw && !discardedOpponentDeck && !blockedOpponentSupports) {
      const finalRoundMilestone = createTutorialFinalRoundMilestone({
        tutorialActive: Boolean(tutorialContract),
        scriptedLesson: tutorialUsesScriptedScenario,
        round,
        cardId: card.id,
        finishPlan: scriptedFinishPlan,
      });
      setEventOverlay(finalRoundMilestone ?? {
        type: "utility-result",
        sourceCardId: card.id,
        title: `Player played ${card.name}`,
        message,
        success: true,
      });
    }
  }

  function playCardFromHand(cardId) {
    const card = cardsById[cardId];
    if (!card) {
      setPlayError("Select a card first.");
      return;
    }
    const academyBlock = getAcademyCardPlayBlock({
      route: scriptedFinishRoute,
      help: tutorialHelp,
      cardId,
      guideName: tutorialGuide.name,
    });
    if (academyBlock) {
      setTutorialHelpDismissedId(null);
      setPlayError(academyBlock);
      pushLog(academyBlock);
      return;
    }
    const error = getPlayError(card);
    if (error) {
      setPlayError(error);
      return;
    }
    if (isFoundationCard(card)) {
      setPlayingCardId(cardId);
      setModal(null);
      setPlayError("");
      return;
    }
    if (card.kind === CardKind.CREATURE) {
      if (cardUsesOpponentReef(card)) {
        const candidates = opponentCoralCards.flatMap((coral) => (coral.slots ?? []).flatMap((slot) => !slot.cardId ? [{ coralId: coral.id, slotId: slot.id }] : []));
        setSearchContext({ mode: "invasive-placement", cardId: card.id, candidates });
        setSelectedHandCard(null);
        setModal(null);
        setPlayError("");
        setEventOverlay({ type: "choose-invasive-placement", sourceCardId: card.id, title: `Place ${card.name} on the Rival Reef`, message: `${card.name} may occupy any empty opponent coral slot. Choose a slot below, or cancel to spend no card and no RP.` });
        return;
      }
      if (card.zone === CreatureZone.OCEAN && !isCreatureSchool(card)) {
        const choices = getPlayerOceanicSacrificeChoices(card);
        if (choices.length) {
          setSearchContext({ mode: "oceanic-sacrifice", cardId: card.id, choices });
          setEventOverlay({ type: "choose-oceanic-sacrifice", sourceCardId: card.id, title: `Choose ${card.name}'s Sacrifice`, message: "Choose one Oceanic Predator or two Oceanic Fish. No card or RP is spent until you confirm a choice." });
          return;
        }
        completePlayerOceanicPlay(card.id);
        return;
      }
      setPlayingCardId(cardId);
      setModal(null);
      setPlayError("Choose a valid coral slot to place this creature.");
      return;
    }
    if (card.kind === CardKind.HABITAT) {
      const playCost = getPlayerCardPlayCost(card);
      setPlayerHabitats((current) => [...current, card.id]);
      setHand((current) => removeOneCard(current, card.id));
      setRp((current) => Math.max(0, current - playCost));
      setSelectedHandCard(null);
      setPlayError("");
      pushLog(`Played ${card.name} as a habitat for ${playCost} RP.`);
      emitPlayerBuild(card, playCost, "habitat");
      return;
    }
    if (card.kind === CardKind.SUPPORT) {
      if (card.id === "ocean-jake") {
        const candidates = [...new Set(lostZone)];
        setSearchContext({ mode: "ocean-jake", supportCardId: card.id, candidates });
        setSelectedHandCard(null);
        setModal("lost-recover");
        setPlayError("");
        return;
      }
      if (card.id === "spearfishing") {
        const candidates = playerCorals.flatMap((coral) => coral.slots.filter((slot) => {
          const target = cardsById[slot.cardId];
          return cardCanBeSpearfished(target, slot, "player");
        }).map((slot) => ({ coralId: coral.id, slotId: slot.id, cardId: slot.cardId, hostedCardIds: [...(slot.hostedCardIds ?? [])], owner: getReefCardOwner(slot, "player") })));
        playerReefCreatures.forEach((candidateId, reefIndex) => {
          if ([CardCategory.FISH, CardCategory.PREDATOR].includes(cardsById[candidateId]?.category)) candidates.push({ coralId: "__reef__", slotId: getPlayerReefSlotId(reefIndex), cardId: candidateId, reefIndex, instanceId: playerReefCreatureInstances[reefIndex]?.instanceId, owner: "player" });
        });
        playerOrphanCreatures.forEach((entry) => {
          const orphanIndex = playerOrphanCreatures.findIndex((candidate) => candidate.instanceId === entry.instanceId);
          if (cardCanBeSpearfished(cardsById[entry.cardId], entry, "player")) candidates.push({ coralId: "__orphan__", slotId: getPlayerOrphanSlotId(orphanIndex), cardId: entry.cardId, orphanIndex, instanceId: entry.instanceId, owner: getReefCardOwner(entry, "player") });
        });
        setSearchContext({ mode: "spearfishing", supportCardId: card.id, candidates });
        setSelectedHandCard(null);
        setModal(null);
        setEventOverlay({ type: "choose-spearfishing-target", sourceCardId: card.id, title: "Player used Spearfishing", message: "Choose a Fish or Predator on your reef to discard and recover its printed RP cost. An invading Lionfish is a valid target and returns to its owner's discard pile. You may cancel without spending the Support card." });
        return;
      }
      if (card.id === "whirlpool" || card.id === "super-whirlpool") {
        const effect = (card.effects ?? []).find((candidate) => candidate.type === EffectType.MODIFY_RP_GENERATION);
        setSearchContext({ mode: "whirlpool", supportCardId: card.id, candidates: opponentCoralCards.map((coral) => coral.id), amount: Math.abs(Number(effect?.amount ?? 0)) });
        setSelectedHandCard(null);
        setModal(null);
        setEventOverlay({ type: "choose-whirlpool-target", sourceCardId: card.id, title: `Player used ${card.name}`, message: `Choose an opponent coral. It will produce ${Math.abs(Number(effect?.amount ?? 0))} less RP during the opponent's next collection. Cancel to spend nothing.` });
        return;
      }
      if (card.id === "coral-heal") {
        const candidates = playerCoralCards.filter((coral) => (coral.statuses ?? []).length || Number(coral.rpPenaltyNextTurn ?? 0) > 0).map((coral) => coral.id);
        setSearchContext({ mode: "clear-coral-status", supportCardId: card.id, candidates });
        setSelectedHandCard(null);
        setModal(null);
        setEventOverlay({ type: "choose-clear-status-target", sourceCardId: card.id, title: `Player used ${card.name}`, message: "Choose one of your affected corals to remove all tracked status effects. You may cancel without spending the Support card." });
        return;
      }
      if (card.id === "poison-heal") {
        const playCost = getPlayerCardPlayCost(card);
        setHand((current) => removeOneCard(current, card.id));
        setDiscardPile((current) => [card.id, ...current]);
        setRp((current) => Math.max(0, current - playCost));
        setPoisonImmunityNextPredatorAttack(true);
        applyExplicitSupportLock(card);
        setSelectedHandCard(null);
        const message = "Poison Heal will make your next attack ignore effects from Toxic, then expire.";
        pushLog(message);
        setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: "Player used Poison Heal", message, success: true });
        return;
      }
      if (card.id === "rov-lights") {
        const playCost = getPlayerCardPlayCost(card);
        setHand((current) => removeOneCard(current, card.id));
        setDiscardPile((current) => [card.id, ...current]);
        setRp((current) => Math.max(0, current - playCost));
        setRovLightsActive(true);
        applyExplicitSupportLock(card);
        setSelectedHandCard(null);
        const message = "ROV Lights gives your attacks +2 when they target Deep creatures until your turn ends.";
        pushLog(message);
        setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: "Player used ROV Lights", message, success: true });
        return;
      }
      if (card.id === "robotic-survey" || card.id === "explorer-jordan") {
        setSearchContext({ mode: "choose-inspection-deck", supportCardId: card.id, candidates: [] });
        setSelectedHandCard(null);
        setModal(null);
        setEventOverlay({ type: "choose-inspection-deck", sourceCardId: card.id, title: `Player used ${card.name}`, message: "Choose which personal deck to inspect. You may cancel before committing the Support card." });
        return;
      }
      if (card.id === "dr-evans") {
        setSearchContext({ mode: "draw-seven", supportCardId: card.id, candidates: [] });
        const target = Math.min(7, foundationDeck.length + palsDeck.length);
        setTurnDrawSelection({ requested: 7, target, shortfall: getRequiredDrawShortfall(7, target), foundation: 0, pals: 0, mode: "dr-evans" });
        setModal("support-draw");
        setSelectedHandCard(null);
        setPlayError("");
        return;
      }
      if (card.id === "coral-cement") {
        const candidates = playerCoralCards.filter((coral) => (coral.health ?? coral.maxHealth) < coral.maxHealth).map((coral) => coral.id);
        setSearchContext({ mode: "heal-coral", supportCardId: card.id, candidates });
        setModal("coral-target");
        setSelectedHandCard(null);
        setPlayError("");
        return;
      }
      if (card.id === "restocking") {
        const candidates = discardPile.filter((candidateId) => {
          const candidate = cardsById[candidateId];
          return candidate?.kind === CardKind.CREATURE && candidate.category === CardCategory.FISH;
        });
        setSearchContext({ mode: "restock", supportCardId: card.id, candidates, selectedIndices: [] });
        setModal("restock");
        setSelectedHandCard(null);
        setPlayError("");
        return;
      }
      if (card.id === "recovery") {
        const cost = getPlayerCardPlayCost(card);
        const recoveredCandidates = [...new Set(discardPile)];
        setHand((current) => removeOneCard(current, card.id));
        setDiscardPile((current) => [card.id, ...current]);
        setRp((current) => Math.max(0, current - cost));
        applyExplicitSupportLock(card);
        setSelectedHandCard(null);
        if (Math.random() < 0.5) {
          setSearchContext({ mode: "recover", supportCardId: card.id, candidates: recoveredCandidates });
          setModal("recover");
          pushLog("Recovery coin flip: heads. Choose a card that was already in your discard pile.");
        } else {
          setModal("hand");
          pushLog("Recovery coin flip: tails. No card was recovered, and Recovery was discarded.");
        }
        return;
      }
      if (card.id === "scientist-jes") {
        setSearchContext({ mode: "scientist-jes-choice", supportCardId: card.id, candidates: [] });
        setSelectedHandCard(null);
        setModal(null);
        setPlayError("");
        setEventOverlay({ type: "choose-scientist-jes", sourceCardId: card.id, title: "Player used Scientist Jes", message: "Choose one effect: search your personal decks for a Habitat, or draw two cards split however you like between Foundation and Pals." });
        return;
      }
      const searchEffect = (card.effects ?? []).find((effect) => effect.type === EffectType.SEARCH_DECK);
      const candidates = [...new Set([...foundationDeck, ...palsDeck].filter((candidateId) => {
        const candidate = cardsById[candidateId];
        if (!candidate || candidate.kind !== searchEffect?.targetKind) return false;
        if (searchEffect.targetCategories?.length && !searchEffect.targetCategories.includes(candidate.category)) return false;
        if (searchEffect.targetTags?.some((tag) => !candidate.tags?.includes(tag))) return false;
        return !searchEffect.excludeTags?.some((tag) => candidate.tags?.includes(tag));
      }))];
      setSearchContext({ mode: "deck", supportCardId: card.id, candidates, maxSelect: Math.max(1, Number(searchEffect?.amount ?? 1)), selected: [] });
      setModal("search");
      setSelectedHandCard(null);
      setPlayError("");
      return;
    }
    setPlayError("This card type cannot be placed yet.");
  }

  function completeInvasivePlacement(coralId, slotId) {
    if (searchContext?.mode !== "invasive-placement" || !searchContext.candidates.some((candidate) => candidate.coralId === coralId && candidate.slotId === slotId)) return;
    const card = cardsById[searchContext.cardId];
    const targetCoral = opponent.corals.find((coral) => coral.id === coralId && cardsById[coral.cardId]?.kind === CardKind.CORAL);
    const targetSlot = targetCoral?.slots.find((slot) => slot.id === slotId);
    if (!card || !cardUsesOpponentReef(card) || !hand.includes(card.id) || !targetSlot || targetSlot.cardId) {
      const message = "That rival slot is no longer available. No card or RP was spent.";
      setSearchContext(null);
      setEventOverlay({ type: "utility-result", sourceCardId: card?.id, title: "Invasive Placement Canceled", message, success: false });
      return;
    }
    const cost = getPlayerCardPlayCost(card);
    if (rp < cost) {
      const message = `${card.name} costs ${cost} RP, but only ${rp} RP remains. No card was spent.`;
      setSearchContext(null);
      setEventOverlay({ type: "utility-result", sourceCardId: card.id, title: "Invasive Placement Canceled", message, success: false });
      return;
    }
    const densityRequirementAtPlay = getPlayerSchoolDensityRequirement(card).effectiveRequirement;
    const cardInstanceId = createStableInstanceId(`player-invader-${card.id}`);
    setOpponent((current) => ({
      ...current,
      corals: placeInvasiveCreature(current.corals, {
        coralId,
        slotId,
        cardId: card.id,
        cardInstanceId,
        controller: "player",
      }).foundations,
    }));
    setHand((current) => removeOneCard(current, card.id));
    setRp((current) => Math.max(0, current - cost));
    commitPlayerSchoolDensity(cardInstanceId, densityRequirementAtPlay);
    consumePlayerSchoolDensityDiscount(card);
    setSearchContext(null);
    setSelectedHandCard(null);
    const message = `${card.name} invaded an empty slot on the opponent's ${cardsById[targetCoral.cardId]?.name} for ${cost} RP. It remains your creature; the opponent may remove it with Spearfishing or a legal attack.`;
    pushLog(message);
    emitPlayerBuild(card, cost, "opponent-reef");
    setEventOverlay({ type: "impact-result", sourceCardId: card.id, defenderCardId: targetCoral.cardId, title: `Player placed ${card.name} on the Rival Reef`, message, success: true });
  }

  function applyExplicitSupportLock(card) {
    if (supportExplicitlyLocksFurtherSupports(card)) setSupportLockSourceId(card.id);
  }

  function chooseScientistJes(mode) {
    if (searchContext?.mode !== "scientist-jes-choice") return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    if (mode === "search") {
      const searchEffect = (supportCard.effects ?? []).find((effect) => effect.type === EffectType.SEARCH_DECK);
      const candidates = [...new Set([...foundationDeck, ...palsDeck].filter((cardId) => cardMatchesSearchCriteria(cardsById[cardId], searchEffect)))];
      if (!candidates.length) {
        setEventOverlay({ type: "choose-scientist-jes", sourceCardId: supportCard.id, title: "Scientist Jes", message: "There is no Habitat left to search for. Choose Draw Two or cancel without spending the card." });
        return;
      }
      setSearchContext({ mode: "deck", supportCardId: supportCard.id, candidates, maxSelect: 1, selected: [], scientistJesChoice: "search" });
      setModal("search");
      setEventOverlay(null);
      return;
    }
    if (mode === "draw") {
      const drawEffect = (supportCard.effects ?? []).find((effect) => effect.type === EffectType.DRAW_CARDS);
      const target = Math.min(Number(drawEffect?.amount ?? 2), foundationDeck.length + palsDeck.length);
      if (!target) {
        setEventOverlay({ type: "choose-scientist-jes", sourceCardId: supportCard.id, title: "Scientist Jes", message: "Both personal decks are empty. Choose Habitat Search or cancel without spending the card." });
        return;
      }
      spendResolvedSupport(supportCard);
      setPendingCreatureAction({ action: { name: "Scientist Jes — Draw Two", cost: { rp: 0 }, oncePerTurn: false }, effect: drawEffect, actionKey: `support:${supportCard.id}`, sourceCardId: supportCard.id, actionName: "Draw Two", cost: 0, committed: true });
      const requested = Number(drawEffect?.amount ?? 2);
      setTurnDrawSelection({ requested, target, shortfall: getRequiredDrawShortfall(requested, target), foundation: 0, pals: 0, mode: "support" });
      setSearchContext(null);
      setModal(null);
      setEventOverlay({ type: "choose-action-deck", sourceCardId: supportCard.id, title: "Player used Scientist Jes — Draw Two", message: `Allocate ${target} draw(s) between your personal decks.` });
      return;
    }
    setSearchContext(null);
    setEventOverlay(null);
    setModal(null);
  }

  function completeSpearfishing(target) {
    if (searchContext?.mode !== "spearfishing" || !searchContext.candidates.some((candidate) => candidate.coralId === target.coralId && candidate.slotId === target.slotId)) return;
    const supportCard = cardsById[searchContext.supportCardId];
    const targetCard = cardsById[target.cardId];
    if (!supportCard || !targetCard || !hand.includes(supportCard.id)) return;
    const targetOwner = target.owner ?? "player";
    const removesOpposingInvader = targetOwner === "opponent";
    const supportCost = getPlayerCardPlayCost(supportCard);
    const recoveredRp = Number(targetCard.cost?.rp ?? 0);
    if (removesOpposingInvader) {
      const invaderRemoval = resolveSpearfishingInvaderRemoval({
        foundations: playerCorals,
        orphanEntries: playerOrphanCreatures,
        target: { ...target, location: target.coralId === "__orphan__" ? "orphan" : "slot" },
        invaderController: "opponent",
        eligibleCardIds: SPEARFISHING_FOREIGN_TARGET_CARD_IDS,
        supportCardId: supportCard.id,
        actorDiscardPile: discardPile,
        invaderDiscardPile: opponent.discardPile,
        actorRp: rp,
        actorRpCap: playerRpCap,
        supportCost,
        recoveredRp,
      });
      if (!invaderRemoval.success) {
        setSearchContext(null);
        setEventOverlay({ type: "utility-result", sourceCardId: supportCard.id, title: "Spearfishing Canceled", message: "That invading Lionfish is no longer a legal target. No card or RP was spent.", success: false });
        return;
      }
      setPlayerCorals(invaderRemoval.foundations);
      setPlayerOrphanCreatureInstances(invaderRemoval.orphanEntries);
      setDiscardPile(invaderRemoval.actorDiscardPile);
      setOpponent((current) => ({ ...current, discardPile: invaderRemoval.invaderDiscardPile }));
      setRp(invaderRemoval.actorRp);
      setCreatureStatuses((current) => Object.fromEntries(Object.entries(current).filter(([slotId]) => slotId !== target.slotId)));
    } else if (target.coralId === "__reef__") {
      setPlayerReefCreatureInstances((current) => removeCreatureInstances(current, [target.instanceId]).instances);
    } else if (target.coralId === "__orphan__") {
      setPlayerOrphanCreatureInstances((current) => {
        const removed = current.find((entry) => entry.instanceId === target.instanceId);
        return [...current.filter((entry) => entry.instanceId !== target.instanceId), ...(removed?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`player-orphan-${cardId}`)))];
      });
    } else {
      setPlayerCorals((current) => current.map((coral) => coral.id === target.coralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === target.slotId ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) } : coral));
      if (target.hostedCardIds?.some(Boolean)) setPlayerOrphanCreatures((current) => [...current, ...target.hostedCardIds.filter(Boolean).map((cardId) => ({ cardId, hostedCardIds: [] }))]);
      setCreatureStatuses((current) => Object.fromEntries(Object.entries(current).filter(([slotId]) => slotId !== target.slotId)));
    }
    setHand((current) => removeOneCard(current, supportCard.id));
    if (!removesOpposingInvader) {
      setDiscardPile((current) => [supportCard.id, targetCard.id, ...current]);
      setRp((current) => addResourceWithinCap(Math.max(0, current - supportCost), recoveredRp, playerRpCap));
    }
    applyExplicitSupportLock(supportCard);
    setSearchContext(null);
    const destinationMessage = removesOpposingInvader
      ? `${targetCard.name} was removed from your reef and returned to the opponent's discard pile. Spearfishing was discarded.`
      : `${targetCard.name} and Spearfishing were discarded.`;
    setEventOverlay({ type: "impact-result", sourceCardId: supportCard.id, defenderCardId: targetCard.id, title: "Player used Spearfishing", message: `${destinationMessage} You recovered ${recoveredRp} RP, up to your ${playerRpCap} RP bank cap.`, success: true });
    pushLog(`Spearfishing discarded ${targetCard.name}${removesOpposingInvader ? " to its owner's discard pile" : ""} and recovered ${recoveredRp} RP, capped at ${playerRpCap}.`);
  }

  function completeWhirlpool(coralId) {
    if (searchContext?.mode !== "whirlpool" || !searchContext.candidates.includes(coralId)) return;
    const supportCard = cardsById[searchContext.supportCardId];
    const target = opponentCorals.find((coral) => coral.id === coralId);
    if (!supportCard || !target || !hand.includes(supportCard.id)) return;
    const amount = Number(searchContext.amount ?? 0);
    setOpponent((current) => ({ ...current, corals: current.corals.map((coral) => coral.id === coralId ? { ...coral, rpPenaltyNextTurn: Number(coral.rpPenaltyNextTurn ?? 0) + amount } : coral) }));
    setHand((current) => removeOneCard(current, supportCard.id));
    setDiscardPile((current) => [supportCard.id, ...current]);
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
    setSearchContext(null);
    const message = `${supportCard.name} targeted ${cardsById[target.cardId]?.name}. It will produce ${amount} less RP during the opponent's next collection.`;
    pushLog(message);
    setEventOverlay({ type: "impact-result", sourceCardId: supportCard.id, defenderCardId: target.cardId, title: `Player used ${supportCard.name}`, message, success: true });
  }

  function completeSchoolMomentum(cardId) {
    if (searchContext?.mode !== "school-momentum" || !searchContext.candidates.includes(cardId)) return;
    const sourceCard = cardsById[searchContext.sourceCardId];
    const foundCard = cardsById[cardId];
    if (!sourceCard || !foundCard) return;
    setFoundationDeck((current) => shuffle(removeOneCard(current, cardId)));
    setPalsDeck((current) => shuffle(removeOneCard(current, cardId)));
    const handResult = addCardsToHandWithLimit(hand, [cardId], discardPile, Infinity);
    setHand(handResult.hand);
    setDiscardPile(handResult.discardPile);
    setSearchContext(null);
    const message = `${sourceCard.name}'s Momentum added ${foundCard.name} to your hand and shuffled your personal decks.`;
    pushLog(message);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: foundCard.id, title: `Player's ${sourceCard.name} used Momentum`, message, success: true });
  }

  function spendResolvedSupport(supportCard) {
    setHand((current) => removeOneCard(current, supportCard.id));
    setDiscardPile((current) => [supportCard.id, ...current]);
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
  }

  function chooseInspectionDeck(deckType) {
    if (searchContext?.mode !== "choose-inspection-deck" || !["foundation", "pals"].includes(deckType)) return;
    const deck = deckType === "foundation" ? foundationDeck : palsDeck;
    if (!deck.length) return;
    const supportCard = cardsById[searchContext.supportCardId];
    const topCards = deck.slice(0, 5);
    if (supportCard?.id === "robotic-survey") {
      setSearchContext({ mode: "reorder-deck", supportCardId: supportCard.id, deckType, topCards });
      setEventOverlay({ type: "reorder-deck", sourceCardId: supportCard.id, title: `Player used ${supportCard.name}`, message: `Reorder the top ${topCards.length} cards of your ${deckType} deck, then confirm.` });
      return;
    }
    const candidates = topCards.filter((cardId) => cardsById[cardId]?.kind === CardKind.CREATURE);
    setSearchContext({ mode: "explorer-top-five", supportCardId: supportCard.id, deckType, topCards, candidates });
    setEventOverlay({ type: "choose-explorer-card", sourceCardId: supportCard.id, title: `Player used ${supportCard.name}`, message: candidates.length ? "Choose one Creature from the top five to add to your hand, or choose no card and shuffle all five back." : "There were no Creatures in the top five. Confirm to shuffle them back." });
  }

  function moveInspectedDeckCard(index, delta) {
    if (searchContext?.mode !== "reorder-deck") return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= searchContext.topCards.length) return;
    setSearchContext((current) => {
      const topCards = [...current.topCards];
      [topCards[index], topCards[nextIndex]] = [topCards[nextIndex], topCards[index]];
      return { ...current, topCards };
    });
  }

  function commitDeckInspection(selectedCardId = null) {
    if (!searchContext || !["reorder-deck", "explorer-top-five"].includes(searchContext.mode)) return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    const deck = searchContext.deckType === "foundation" ? foundationDeck : palsDeck;
    let replacementTop;
    if (searchContext.mode === "reorder-deck") replacementTop = searchContext.topCards;
    else {
      if (selectedCardId && !searchContext.candidates.includes(selectedCardId)) return;
      replacementTop = shuffle(selectedCardId ? removeOneCard(searchContext.topCards, selectedCardId) : searchContext.topCards);
    }
    const nextDeck = [...replacementTop, ...deck.slice(searchContext.topCards.length)];
    if (searchContext.deckType === "foundation") setFoundationDeck(nextDeck);
    else setPalsDeck(nextDeck);
    setHand((current) => [...removeOneCard(current, supportCard.id), ...(selectedCardId ? [selectedCardId] : [])]);
    setDiscardPile((current) => [supportCard.id, ...current]);
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
    const message = searchContext.mode === "reorder-deck"
      ? `${supportCard.name} rearranged the top ${searchContext.topCards.length} cards of your ${searchContext.deckType} deck.`
      : selectedCardId ? `${supportCard.name} added ${cardsById[selectedCardId]?.name} to your hand and shuffled the other inspected cards.` : `${supportCard.name} found no chosen Creature and shuffled the inspected cards back.`;
    setSearchContext(null);
    pushLog(message);
    setEventOverlay({ type: "utility-result", sourceCardId: supportCard.id, defenderCardId: selectedCardId, title: `Player used ${supportCard.name}`, message, success: true });
  }

  function completeSupportSearch(cardId) {
    if (!searchContext?.candidates.includes(cardId)) return;
    const authoredSearchTarget = tutorialUsesScriptedScenario
      ? getScriptedTutorialSearchTargetCardId({
          cardsInPlay: scriptedPlayerCardIdsInPlay,
          cardsInHand: hand,
          searchCandidates: searchContext.candidates,
        })
      : null;
    if (authoredSearchTarget && cardId !== authoredSearchTarget) return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    let nextFoundation = removeOneCard(foundationDeck, cardId);
    let nextPals = removeOneCard(palsDeck, cardId);
    setFoundationDeck(shuffle(nextFoundation));
    setPalsDeck(shuffle(nextPals));
    setHand((current) => [...removeOneCard(current, supportCard.id), cardId]);
    setDiscardPile((current) => [supportCard.id, ...current]);
    const cost = getPlayerCardPlayCost(supportCard);
    setRp((current) => Math.max(0, current - cost));
    applyExplicitSupportLock(supportCard);
    const drawEffect = (supportCard.effects ?? []).find((effect) => effect.type === EffectType.DRAW_CARDS);
    const additionalDrawCount = supportCard.id === "scientist-jes" ? 0 : Math.max(0, Number(drawEffect?.amount ?? 0));
    if (additionalDrawCount) {
      const target = Math.min(additionalDrawCount, nextFoundation.length + nextPals.length);
      if (target) {
        setPendingCreatureAction({ action: { name: `${supportCard.name} Draw`, cost: { rp: 0 } }, effect: drawEffect, actionKey: `support:${supportCard.id}`, sourceCardId: supportCard.id, cost: 0, committed: true });
        setTurnDrawSelection({ requested: additionalDrawCount, target, shortfall: getRequiredDrawShortfall(additionalDrawCount, target), foundation: 0, pals: 0, mode: "support" });
        setSearchContext(null);
        setModal(null);
        setEventOverlay({ type: "choose-action-deck", sourceCardId: supportCard.id, title: `Player used ${supportCard.name}`, message: `${cardsById[cardId]?.name} was added to your hand. Allocate the additional ${target} draw(s) between your personal decks.` });
      } else {
        setSearchContext(null);
        setModal("hand");
        setGameResult((current) => current ?? `Defeat: ${supportCard.name} required an additional draw, but both personal decks were empty.`);
        setSelectedHandCard(cardId);
      }
    } else {
      setSearchContext(null);
      setModal("hand");
      setSelectedHandCard(cardId);
    }
    pushLog(`${supportCard.name} found ${cardsById[cardId]?.name}.${additionalDrawCount && nextFoundation.length + nextPals.length ? ` Choose how to allocate up to ${additionalDrawCount} additional draw(s).` : additionalDrawCount ? " No cards remained for its additional draws." : ""} The Support card was discarded.`);
  }

  function toggleSupportSearchCard(cardId) {
    if (searchContext?.mode !== "deck" || !searchContext.candidates.includes(cardId) || searchContext.maxSelect <= 1) return;
    const availableCopies = [...foundationDeck, ...palsDeck].filter((candidateId) => candidateId === cardId).length;
    setSearchContext((current) => {
      const selectedCopies = current.selected.filter((selectedId) => selectedId === cardId).length;
      return {
        ...current,
        selected: selectedCopies < availableCopies && current.selected.length < current.maxSelect
          ? [...current.selected, cardId]
          : current.selected.filter((selectedId) => selectedId !== cardId),
      };
    });
  }

  function completeMultipleSupportSearch() {
    if (searchContext?.mode !== "deck" || searchContext.maxSelect <= 1 || !searchContext.selected.length) return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    let nextFoundation = foundationDeck;
    let nextPals = palsDeck;
    searchContext.selected.forEach((cardId) => {
      if (nextFoundation.includes(cardId)) nextFoundation = removeOneCard(nextFoundation, cardId);
      else nextPals = removeOneCard(nextPals, cardId);
    });
    setFoundationDeck(shuffle(nextFoundation));
    setPalsDeck(shuffle(nextPals));
    const handWithoutSupport = removeOneCard(hand, supportCard.id);
    const handResult = applyCurrentHandLimit(searchContext.selected, handWithoutSupport.length);
    setHand([...handWithoutSupport, ...handResult.cardsToHand]);
    setDiscardPile((current) => [supportCard.id, ...handResult.cardsToDiscard, ...current]);
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
    const names = searchContext.selected.map((cardId) => cardsById[cardId]?.name ?? cardId).join(", ");
    setSearchContext(null);
    setModal("hand");
    setSelectedHandCard(searchContext.selected[0]);
    pushLog(`${supportCard.name} found ${names}. The Support card was discarded and both personal decks were shuffled.`);
  }

  function cancelSupportSearch() {
    setSearchContext(null);
    setTurnDrawSelection(null);
    setModal("hand");
    setPlayError("Support search cancelled. No RP or card was spent.");
  }

  function completeOceanJakeRecovery(cardId) {
    if (searchContext?.mode !== "ocean-jake" || !searchContext.candidates.includes(cardId) || !lostZone.includes(cardId)) return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    const cost = getPlayerCardPlayCost(supportCard);
    if (rp < cost) return;
    const handResult = applyCurrentHandLimit([cardId]);
    setHand((current) => [
      ...removeOneCard(current, supportCard.id),
      ...handResult.cardsToHand,
    ]);
    setLostZone((current) => [supportCard.id, ...removeOneCard(current, cardId)]);
    if (handResult.cardsToDiscard.length) setDiscardPile((current) => [...handResult.cardsToDiscard, ...current]);
    if (handResult.cardsToHand.length) setCardsBlockedFromPlayThisTurn((current) => [...current, cardId]);
    setRp((current) => Math.max(0, current - cost));
    applyExplicitSupportLock(supportCard);
    setSearchContext(null);
    setModal(null);
    setSelectedHandCard(null);
    const recoveredName = cardsById[cardId]?.name ?? cardId;
    const message = `${supportCard.name} recovered ${recoveredName} from your Lost Zone. That recovered card cannot be played until your next turn, and ${supportCard.name} moved to the Lost Zone.`;
    pushLog(message);
    setEventOverlay({ type: "utility-result", sourceCardId: supportCard.id, defenderCardId: cardId, title: `Player used ${supportCard.name}`, message, success: true });
  }

  function completeRecovery(cardId) {
    if (searchContext?.mode !== "recover" || !searchContext.candidates.includes(cardId) || !discardPile.includes(cardId)) return;
    const handResult = applyCurrentHandLimit([cardId]);
    if (handResult.cardsToHand.length) {
      setDiscardPile((current) => cardId === searchContext.supportCardId ? removeLastCard(current, cardId) : removeOneCard(current, cardId));
      setHand((current) => [...current, cardId]);
    }
    setSearchContext(null);
    setModal(null);
    setSelectedHandCard(handResult.cardsToHand.length ? cardId : null);
    pushLog(`Recovery returned ${cardsById[cardId]?.name ?? cardId} from your discard pile to your hand.`);
  }

  function completeCoralHeal(coralId) {
    if (searchContext?.mode !== "heal-coral" || !searchContext.candidates.includes(coralId)) return;
    const supportCard = cardsById[searchContext.supportCardId];
    const target = playerCorals.find((coral) => coral.id === coralId);
    if (!supportCard || !target || !hand.includes(supportCard.id)) return;
    const previousHealth = Number(target.health ?? target.maxHealth);
    const healedHealth = Math.min(target.maxHealth, previousHealth + 20);
    setPlayerCorals((current) => current.map((coral) => coral.id === coralId ? { ...coral, health: healedHealth } : coral));
    setHand((current) => removeOneCard(current, supportCard.id));
    setDiscardPile((current) => [supportCard.id, ...current]);
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
    setSearchContext(null);
    setModal("hand");
    setSelectedHandCard(null);
    pushLog(`${supportCard.name} healed ${cardsById[target.cardId]?.name} for ${healedHealth - previousHealth} HP. The Support card was discarded.`);
  }

  function completeOnPlayCoralHeal(coralId) {
    if (!["onplay-heal", "passive-heal"].includes(searchContext?.mode) || !searchContext.candidates.includes(coralId)) return;
    const target = playerCorals.find((coral) => coral.id === coralId);
    const sourceCard = cardsById[searchContext.sourceCardId];
    if (!target || !sourceCard) return;
    const previousHealth = Number(target.health ?? target.maxHealth);
    const healedHealth = Math.min(Number(target.maxHealth), previousHealth + Number(searchContext.amount ?? 0));
    setPlayerCorals((current) => current.map((coral) => coral.id === coralId ? { ...coral, health: healedHealth } : coral));
    if (searchContext.mode === "passive-heal" && searchContext.actionKey) setUsedCreatureActions((current) => [...current, searchContext.actionKey]);
    const message = `${sourceCard.name}'s ${searchContext.actionName} restored ${healedHealth - previousHealth} HP to ${cardsById[target.cardId]?.name}.${searchContext.roll != null ? ` The healing roll was ${searchContext.roll}.` : ""}`;
    pushLog(message);
    setSearchContext(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: target.cardId, title: `Player's ${sourceCard.name} used ${searchContext.actionName}`, message, success: healedHealth > previousHealth });
  }

  function beginPassiveCoralHeal(passive) {
    if (!inspectedCardData || inspectedCard?.owner !== "player" || gamePhase !== "main") return;
    const abilityFoundation = inspectedCard?.foundation ? playerCoralCards.find((coral) => coral.id === inspectedCard.coralId) : null;
    if (abilityFoundation && coralIsStunned(abilityFoundation)) {
      pushLog(`${inspectedCardData.name} cannot use its own passives while Stunned.`);
      return;
    }
    const heal = getPassiveCoralHeal(passive);
    const actionKey = `${inspectedActionKey}:${typeof passive === "object" ? passive.id ?? passive.name : heal?.actionName}`;
    if (!heal || usedCreatureActions.includes(actionKey)) return;
    const candidates = playerCoralCards.filter((coral) => coral.health < coral.maxHealth).map((coral) => coral.id);
    if (!candidates.length) {
      pushLog(`${inspectedCardData.name}'s ${heal.actionName} has no damaged coral to heal.`);
      return;
    }
    setSearchContext({ mode: "passive-heal", sourceCardId: inspectedCardData.id, candidates, amount: heal.amount, actionName: heal.actionName, actionKey });
    setInspectedCard(null);
    setEventOverlay({ type: "choose-onplay-heal-target", sourceCardId: inspectedCardData.id, title: `Player's ${inspectedCardData.name} used ${heal.actionName}`, message: `Choose one damaged coral to restore ${heal.amount} HP.` });
  }

  function getJointedStructureSources() {
    return playerCoralCards.flatMap((sourceCoral) => (sourceCoral.slots ?? []).flatMap((sourceSlot) => {
      const creature = cardsById[sourceSlot.cardId];
      if (!creature || creature.kind !== CardKind.CREATURE) return [];
      const hasDestination = playerCoralCards.some((destinationCoral) => destinationCoral.id !== sourceCoral.id
        && (destinationCoral.slots ?? []).some((destinationSlot) => !destinationSlot.cardId && canCardOccupySlot(creature, destinationSlot)));
      return hasDestination ? [{ coralId: sourceCoral.id, slotId: sourceSlot.id, cardId: creature.id }] : [];
    }));
  }

  function beginJointedStructureMove(passive) {
    if (!inspectedCardData || inspectedCard?.owner !== "player" || !inspectedCard?.foundation || gamePhase !== "main") return;
    const abilityFoundation = playerCoralCards.find((coral) => coral.id === inspectedCard.coralId);
    if (coralIsStunned(abilityFoundation)) {
      pushLog(`${inspectedCardData.name} cannot use Jointed Structure while Stunned.`);
      return;
    }
    const move = getJointedStructureMove(passive);
    const actionKey = `${inspectedActionKey}:${move?.actionName}`;
    if (!move || usedCreatureActions.includes(actionKey)) return;
    const candidates = getJointedStructureSources();
    if (!candidates.length) {
      const message = playerCoralCards.length < 2
        ? "Jointed Structure needs two different corals in your ecosystem."
        : "No slotted creature currently has a compatible empty slot on another coral.";
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: inspectedCardData.id, title: "Jointed Structure Could Not Resolve", message, success: false });
      return;
    }
    setSearchContext({ mode: "jointed-structure-source", sourceCardId: inspectedCardData.id, abilityFoundationId: inspectedCard.coralId, actionKey, actionName: move.actionName, candidates });
    setInspectedCard(null);
    setEventOverlay({ type: "choose-jointed-structure-source", sourceCardId: inspectedCardData.id, title: `Player's ${inspectedCardData.name} used ${move.actionName}`, message: "Choose one creature to move. Its identity and any creatures it hosts will move with it." });
  }

  function chooseJointedStructureSource(sourceFoundationId, sourceSlotId) {
    if (searchContext?.mode !== "jointed-structure-source") return;
    const source = searchContext.candidates.find((candidate) => candidate.coralId === sourceFoundationId && candidate.slotId === sourceSlotId);
    const sourceCoral = playerCoralCards.find((coral) => coral.id === sourceFoundationId);
    const sourceSlot = sourceCoral?.slots.find((slot) => slot.id === sourceSlotId);
    const creature = cardsById[sourceSlot?.cardId];
    if (!source || !creature) return;
    const destinations = playerCoralCards.flatMap((destinationCoral) => destinationCoral.id === sourceFoundationId ? [] : (destinationCoral.slots ?? []).flatMap((destinationSlot) => (
      !destinationSlot.cardId && canCardOccupySlot(creature, destinationSlot)
        ? [{ coralId: destinationCoral.id, slotId: destinationSlot.id, cardId: destinationCoral.cardId }]
        : []
    )));
    if (!destinations.length) {
      setSearchContext(null);
      setEventOverlay({ type: "utility-result", sourceCardId: searchContext.sourceCardId, title: "Jointed Structure Could Not Resolve", message: "That creature no longer has a compatible empty slot on another coral.", success: false });
      return;
    }
    setSearchContext((current) => ({ ...current, mode: "jointed-structure-destination", sourceFoundationId, sourceSlotId, movedCardId: creature.id, candidates: destinations }));
    setEventOverlay({ type: "choose-jointed-structure-destination", sourceCardId: searchContext.sourceCardId, defenderCardId: creature.id, title: "Choose the Destination Slot", message: `Choose a compatible empty slot on another coral for ${creature.name}.` });
  }

  function completeJointedStructureMove(destinationFoundationId, destinationSlotId) {
    if (searchContext?.mode !== "jointed-structure-destination" || !searchContext.candidates.some((candidate) => candidate.coralId === destinationFoundationId && candidate.slotId === destinationSlotId)) return;
    const abilityFoundation = playerCoralCards.find((coral) => coral.id === searchContext.abilityFoundationId);
    const result = moveSlottedCreatureBetweenFoundations(playerCorals, {
      sourceFoundationId: searchContext.sourceFoundationId,
      sourceSlotId: searchContext.sourceSlotId,
      destinationFoundationId,
      destinationSlotId,
    }, (cardId, slot) => canCardOccupySlot(cardsById[cardId], slot));
    if (!result.moved || !abilityFoundation) {
      const message = result.error ?? "The Black Coral that granted Jointed Structure is no longer in play.";
      setSearchContext(null);
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: searchContext.sourceCardId, title: "Jointed Structure Could Not Resolve", message, success: false });
      return;
    }
    const sourceFoundation = playerCorals.find((coral) => coral.id === result.sourceFoundationId);
    const destinationFoundation = playerCorals.find((coral) => coral.id === result.destinationFoundationId);
    const creature = cardsById[result.cardId];
    const message = `${cardsById[abilityFoundation.cardId]?.name}'s Jointed Structure moved ${creature?.name} from ${cardsById[sourceFoundation?.cardId]?.name} to ${cardsById[destinationFoundation?.cardId]?.name}.`;
    setPlayerCorals(result.foundations);
    setUsedCreatureActions((current) => current.includes(searchContext.actionKey) ? current : [...current, searchContext.actionKey]);
    setSearchContext(null);
    pushLog(message);
    setEventOverlay({ type: "utility-result", sourceCardId: abilityFoundation.cardId, defenderCardId: creature?.id, title: `Player's ${cardsById[abilityFoundation.cardId]?.name} used Jointed Structure`, message, success: true });
  }

  function getDamageCounterMoveAvailability(passive, abilityFoundationId = inspectedCard?.coralId) {
    const move = getDamageCounterMove(passive);
    if (!move) return null;
    const abilityFoundation = playerCoralCards.find((coral) => coral.id === abilityFoundationId);
    const destinationCandidatesFor = (sourceFoundationId) => playerCoralCards.filter((coral) => (
      coral.id !== sourceFoundationId
      && Number(coral.health ?? coral.maxHealth) > move.counterHp
    ));
    const sourceCandidates = playerCoralCards.filter((coral) => (
      Number(coral.maxHealth) - Number(coral.health ?? coral.maxHealth) >= move.counterHp
      && destinationCandidatesFor(coral.id).length > 0
    ));

    let reason = "";
    if (gamePhase !== "main") reason = "Neural Network can only be used during your action phase.";
    else if (!abilityFoundation) reason = "This Brain Coral is no longer in your ecosystem.";
    else if ((abilityFoundation.statuses ?? []).length) reason = "Neural Network cannot be used while this Brain Coral is stunned or affected by a special condition.";
    else if (playerCoralCards.length < 2) reason = "Neural Network needs two different corals in your ecosystem.";
    else if (!playerCoralCards.some((coral) => Number(coral.maxHealth) - Number(coral.health ?? coral.maxHealth) >= move.counterHp)) reason = `No coral has a full ${move.counterHp} HP damage counter to move.`;
    else if (!sourceCandidates.length) reason = "No legal destination can take the counter without being destroyed.";

    return { ...move, abilityFoundation, sourceCandidates, destinationCandidatesFor, reason };
  }

  function startDamageCounterMove(passive, abilityFoundationId, sourceCardId) {
    const availability = getDamageCounterMoveAvailability(passive, abilityFoundationId);
    if (!availability || availability.reason) {
      const message = availability?.reason ?? "Neural Network is not available.";
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId, title: "Neural Network Could Not Resolve", message, success: false });
      return;
    }
    setSearchContext({
      mode: "neural-network-source",
      sourceCardId,
      abilityFoundationId,
      counterHp: availability.counterHp,
      candidates: availability.sourceCandidates.map((coral) => coral.id),
    });
    setInspectedCard(null);
    setEventOverlay({
      type: "choose-neural-network-source",
      sourceCardId,
      title: "Use Neural Network",
      message: `Choose a damaged coral to remove one ${availability.counterHp} HP damage counter from.`,
    });
  }

  function beginDamageCounterMove(passive) {
    if (!inspectedCardData || inspectedCard?.owner !== "player" || !inspectedCard?.foundation) return;
    startDamageCounterMove(passive, inspectedCard.coralId, inspectedCardData.id);
  }

  function repeatDamageCounterMove(abilityFoundationId) {
    const abilityFoundation = playerCoralCards.find((coral) => coral.id === abilityFoundationId);
    const sourceCard = cardsById[abilityFoundation?.cardId];
    const passive = sourceCard?.passives?.find((candidate) => getDamageCounterMove(candidate));
    startDamageCounterMove(passive, abilityFoundationId, sourceCard?.id);
  }

  function failDamageCounterMove(message) {
    const sourceCardId = searchContext?.sourceCardId;
    setSearchContext(null);
    pushLog(message);
    setEventOverlay({ type: "utility-result", sourceCardId, title: "Neural Network Could Not Resolve", message, success: false });
  }

  function chooseDamageCounterSource(sourceFoundationId) {
    if (searchContext?.mode !== "neural-network-source" || !searchContext.candidates.includes(sourceFoundationId)) return;
    const abilityFoundation = playerCoralCards.find((coral) => coral.id === searchContext.abilityFoundationId);
    const sourceCard = cardsById[abilityFoundation?.cardId];
    const passive = sourceCard?.passives?.find((candidate) => getDamageCounterMove(candidate));
    const availability = getDamageCounterMoveAvailability(passive, searchContext.abilityFoundationId);
    if (!availability || availability.reason) {
      failDamageCounterMove(availability?.reason ?? "The Brain Coral that granted Neural Network is no longer in play.");
      return;
    }
    const source = availability.sourceCandidates.find((coral) => coral.id === sourceFoundationId);
    const destinations = source ? availability.destinationCandidatesFor(sourceFoundationId) : [];
    if (!source || !destinations.length) {
      failDamageCounterMove("That damage counter no longer has a legal destination.");
      return;
    }
    setSearchContext((current) => ({
      ...current,
      mode: "neural-network-destination",
      counterHp: availability.counterHp,
      sourceFoundationId,
      candidates: destinations.map((coral) => coral.id),
    }));
    setEventOverlay({
      type: "choose-neural-network-destination",
      sourceCardId: searchContext.sourceCardId,
      defenderCardId: source.cardId,
      title: "Choose the Destination Coral",
      message: `Choose a different coral to receive the ${availability.counterHp} HP damage counter. A choice that would destroy a coral is not legal.`,
    });
  }

  function completeDamageCounterMove(destinationFoundationId) {
    if (searchContext?.mode !== "neural-network-destination" || !searchContext.candidates.includes(destinationFoundationId)) return;
    const abilityFoundation = playerCoralCards.find((coral) => coral.id === searchContext.abilityFoundationId);
    const abilityCard = cardsById[abilityFoundation?.cardId];
    const passive = abilityCard?.passives?.find((candidate) => getDamageCounterMove(candidate));
    const availability = getDamageCounterMoveAvailability(passive, searchContext.abilityFoundationId);
    if (!availability || availability.reason) {
      failDamageCounterMove(availability?.reason ?? "The Brain Coral that granted Neural Network is no longer in play.");
      return;
    }
    const source = playerCoralCards.find((coral) => coral.id === searchContext.sourceFoundationId);
    const destination = playerCoralCards.find((coral) => coral.id === destinationFoundationId);
    if (!source || !destination || cardsById[source.cardId]?.kind !== CardKind.CORAL || cardsById[destination.cardId]?.kind !== CardKind.CORAL) {
      failDamageCounterMove("Both Neural Network targets must still be corals in your ecosystem.");
      return;
    }
    const result = moveFoundationDamageCounter(playerCorals, {
      sourceFoundationId: source.id,
      destinationFoundationId: destination.id,
      counterHp: availability.counterHp,
    });
    if (!result.moved) {
      failDamageCounterMove(result.error);
      return;
    }

    const nextSource = result.foundations.find((coral) => coral.id === source.id);
    const nextDestination = result.foundations.find((coral) => coral.id === destination.id);
    const sourceName = cardsById[source.cardId]?.name ?? "source coral";
    const destinationName = cardsById[destination.cardId]?.name ?? "destination coral";
    const message = `${abilityCard.name}'s Neural Network moved one ${result.amount} HP damage counter from ${sourceName} to ${destinationName}. ${sourceName} is now at ${nextSource.health}/${nextSource.maxHealth} HP; ${destinationName} is now at ${nextDestination.health}/${nextDestination.maxHealth} HP.`;
    setPlayerCorals(result.foundations);
    setSearchContext(null);
    pushLog(message);
    setEventOverlay({
      type: "utility-result",
      sourceCardId: abilityCard.id,
      defenderCardId: destination.cardId,
      title: `Player's ${abilityCard.name} used Neural Network`,
      message,
      success: true,
      repeatDamageCounterAbilityId: abilityFoundation.id,
    });
  }

  function completeCoralStatusClear(coralId) {
    if (searchContext?.mode !== "clear-coral-status" || !searchContext.candidates.includes(coralId)) return;
    const supportCard = cardsById[searchContext.supportCardId];
    const target = playerCorals.find((coral) => coral.id === coralId);
    if (!supportCard || !target || !hand.includes(supportCard.id)) return;
    const removed = [...(target.statuses ?? []).map((status) => status.type), Number(target.rpPenaltyNextTurn ?? 0) > 0 ? "RP penalty" : null].filter(Boolean).join(", ");
    setPlayerCorals((current) => current.map((coral) => {
      if (coral.id !== coralId) return coral;
      const { rpPenaltyNextTurn, ...clearedCoral } = coral;
      return { ...clearedCoral, statuses: [] };
    }));
    spendResolvedSupport(supportCard);
    setSearchContext(null);
    const message = `${supportCard.name} removed ${removed || "all effects"} from ${cardsById[target.cardId]?.name}.`;
    pushLog(message);
    setEventOverlay({ type: "utility-result", sourceCardId: supportCard.id, defenderCardId: target.cardId, title: `Player used ${supportCard.name}`, message, success: true });
  }

  function toggleRestockCard(candidateIndex) {
    if (searchContext?.mode !== "restock" || !searchContext.candidates[candidateIndex]) return;
    setSearchContext((current) => {
      const selectedIndices = current.selectedIndices.includes(candidateIndex)
        ? current.selectedIndices.filter((index) => index !== candidateIndex)
        : current.selectedIndices.length < 3 ? [...current.selectedIndices, candidateIndex] : current.selectedIndices;
      return { ...current, selectedIndices };
    });
  }

  function completeRestocking() {
    if (searchContext?.mode !== "restock" || !searchContext.selectedIndices.length) return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    const selectedCards = searchContext.selectedIndices.map((index) => searchContext.candidates[index]).filter(Boolean);
    const foundationCards = selectedCards.filter((cardId) => getPersonalDeckType(cardsById[cardId]) === "foundation");
    const palsCards = selectedCards.filter((cardId) => getPersonalDeckType(cardsById[cardId]) === "pals");
    setDiscardPile((current) => [supportCard.id, ...selectedCards.reduce((pile, cardId) => removeOneCard(pile, cardId), current)]);
    if (foundationCards.length) setFoundationDeck((current) => shuffle([...current, ...foundationCards]));
    if (palsCards.length) setPalsDeck((current) => shuffle([...current, ...palsCards]));
    setHand((current) => removeOneCard(current, supportCard.id));
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
    const names = selectedCards.map((cardId) => cardsById[cardId]?.name ?? cardId).join(", ");
    setSearchContext(null);
    setModal(null);
    setSelectedHandCard(null);
    pushLog(`Restocking shuffled ${names} into ${foundationCards.length && palsCards.length ? "their correct Foundation and Pals decks" : foundationCards.length ? "your Foundation deck" : "your Pals deck"} and was discarded.`);
  }

  function completeDrEvans() {
    if (searchContext?.mode !== "draw-seven" || !turnDrawSelection || turnDrawSelection.foundation + turnDrawSelection.pals !== turnDrawSelection.target) return;
    const supportCard = cardsById[searchContext.supportCardId];
    if (!supportCard || !hand.includes(supportCard.id)) return;
    const foundationCards = foundationDeck.slice(0, turnDrawSelection.foundation);
    const palsCards = palsDeck.slice(0, turnDrawSelection.pals);
    const drawnCards = [...foundationCards, ...palsCards];
    const discardedHand = removeOneCard(hand, supportCard.id);
    const drawResult = drawWithHandLimit(drawnCards, 0, drawnCards.length, Infinity);
    const shortfall = Number(turnDrawSelection.shortfall ?? getRequiredDrawShortfall(turnDrawSelection.requested, drawnCards.length));
    setFoundationDeck((current) => current.slice(foundationCards.length));
    setPalsDeck((current) => current.slice(palsCards.length));
    setHand(drawResult.cardsToHand);
    setDiscardPile((current) => [supportCard.id, ...discardedHand, ...drawResult.cardsToDiscard, ...current]);
    setRp((current) => Math.max(0, current - getPlayerCardPlayCost(supportCard)));
    applyExplicitSupportLock(supportCard);
    setSearchContext(null);
    setTurnDrawSelection(null);
    setModal(null);
    setSelectedHandCard(drawResult.cardsToHand[0] ?? null);
    const message = `Dr. Evans discarded ${discardedHand.length} card(s) from your hand and drew ${foundationCards.length} from Foundation plus ${palsCards.length} from Pals.${shortfall ? ` The mandatory seven-card draw was ${shortfall} card${shortfall === 1 ? "" : "s"} short, so you lose by deck depletion.` : ""}`;
    pushLog(message);
    if (shortfall) setGameResult((current) => current ?? `Defeat: Dr. Evans required seven cards, but your personal decks contained only ${drawnCards.length}.`);
    setEventOverlay({
      type: "utility-result",
      sourceCardId: supportCard.id,
      title: "Player used Dr. Evans",
      message,
      success: !shortfall,
      drawnCards: drawnCards.map((cardId, index) => ({ cardId, source: index < foundationCards.length ? "Foundation" : "Pals", discarded: index >= drawResult.cardsToHand.length })),
    });
  }

  function beginCreatureUtilityAction(action) {
    if (!inspectedCard || inspectedCard.owner !== "player") return;
    const sourceCard = cardsById[inspectedCard.cardId];
    if (inspectedFoundationIsStunned) {
      pushLog(`${sourceCard?.name ?? "That Coral"} cannot use its own actions while Stunned.`);
      return;
    }
    const effect = getSupportedUtilityEffect(action);
    const actionName = getActionName(action);
    const actionKey = `${inspectedActionKey}:${action.id ?? actionName}`;
    const cost = getActionCost(action);
    if (!effect || gameResult || gamePhase !== "main" || attackContext || playingCardId || rp < cost || (actionIsOncePerTurn(action) && usedCreatureActions.includes(actionKey))) return;
    const academyBlock = getAcademyActionBlock({
      route: scriptedFinishRoute,
      help: tutorialHelp,
      actionKey,
      target: "utility-action-button",
      guideName: tutorialGuide.name,
    });
    if (academyBlock) {
      setTutorialHelpDismissedId(null);
      setPlayError(academyBlock);
      pushLog(academyBlock);
      return;
    }
    if (effect.type === EffectType.STUN_CORAL) {
      if (!opponentCoralCards.length) {
        pushLog(`${sourceCard.name}'s ${actionName} has no opponent coral to target.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, actionName, cost, costCommitted: false, candidates: opponentCoralCards.map((coral) => coral.id) });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-coral-effect-target", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message: `Choose an opponent coral to Stun. Cancel to spend no RP${actionIsOncePerTurn(action) ? " and preserve the once-per-turn action" : ""}.` });
      return;
    }
    if (effect.type === "grantNextOnPlayAttackBonus") {
      setRp((current) => Math.max(0, current - cost));
      if (actionIsOncePerTurn(action)) setUsedCreatureActions((current) => [...current, actionKey]);
      setNextOnPlayAttackBonus({ amount: Number(effect.amount ?? 0), sourceCardId: sourceCard.id, actionName });
      setInspectedCard(null);
      const message = `${sourceCard.name}'s ${actionName} gives +${effect.amount} to your next On Play attack.`;
      pushLog(message);
      setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message, success: true });
      return;
    }
    if (effect.type === "reorderTopDeck") {
      if (!foundationDeck.length && !palsDeck.length) {
        pushLog(`${sourceCard.name}'s ${actionName} cannot inspect an empty pair of personal decks.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, actionName, cost });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-action-reorder-source", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message: `Choose a personal deck, then reorder up to its top ${effect.amount} cards. Cancel to spend nothing.` });
      return;
    }
    if (effect.type === EffectType.DRAW_CARDS) {
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, actionName, cost });
      const requested = Number(effect.amount ?? 0);
      const target = Math.min(requested, foundationDeck.length + palsDeck.length);
      setTurnDrawSelection({ requested, target, shortfall: getRequiredDrawShortfall(requested, target), foundation: 0, pals: 0, mode: "action" });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-action-deck", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message: `Allocate up to ${effect.amount} card(s) between your personal decks.` });
      return;
    }
    if (effect.type === EffectType.SEARCH_DECK) {
      const candidates = [...new Set([...foundationDeck, ...palsDeck].filter((cardId) => {
        const candidate = cardsById[cardId];
        if (!candidate || candidate.kind !== effect.targetKind) return false;
        if (effect.targetCardId && candidate.id !== effect.targetCardId) return false;
        if (effect.targetCategories?.length && !effect.targetCategories.includes(candidate.category)) return false;
        if (effect.targetTags?.some((tag) => !candidate.tags?.includes(tag))) return false;
        if (effect.targetStages?.length && !effect.targetStages.map(Number).includes(Number(candidate.stage ?? 0))) return false;
        if (effect.requiredStage !== undefined && Number(candidate.stage ?? 0) !== Number(effect.requiredStage)) return false;
        if (effect.targetNameIncludes && !candidate.name?.toLowerCase().includes(effect.targetNameIncludes.toLowerCase())) return false;
        return !effect.targetZone || candidate.zone === effect.targetZone;
      }))];
      if (!candidates.length) {
        pushLog(`${sourceCard.name}'s ${actionName} has no matching card remaining in your personal decks.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, candidates, actionName, cost });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-creature-action-search", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message: "Choose a matching card to add to your hand. Cancel to spend no RP." });
      return;
    }
    if (effect.type === EffectType.RECOVER_CARD_FROM_DISCARD || effect.type === "recoverCardFromDiscard") {
      if (!discardPile.length) {
        pushLog(`${sourceCard.name}'s ${actionName} has no legal target because your discard pile is empty.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, actionName, cost });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-action-discard", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message: effect.destination === "deck" ? "Choose a discarded card to shuffle into its correct personal deck: Corals and Creature Schools return to Foundation; all other cards return to Pals." : "Choose a card from your discard pile to return to your hand." });
      return;
    }
    if (effect.type === "discardThenSearchDeck" || effect.type === "discardThenDraw") {
      const discardCount = Math.max(0, Number(effect.discard?.amount ?? effect.discard?.min ?? 0));
      const maxDiscard = Math.max(discardCount, Number(effect.discard?.max ?? discardCount));
      if (hand.length < discardCount || (!foundationDeck.length && !palsDeck.length)) {
        pushLog(`${sourceCard.name}'s ${actionName} needs ${discardCount} card(s) in your hand and at least one card remaining in a personal deck.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, actionName, cost, handEntries: hand.map((cardId, index) => ({ cardId, index })), selectedIndices: [], minDiscard: discardCount, maxDiscard });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-action-hand-discard", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${actionName}`, message: effect.type === "discardThenDraw" ? `Choose ${discardCount} to ${maxDiscard} cards to discard, then draw the same number.` : `Choose exactly ${discardCount} cards from your hand to discard. You may cancel before paying RP or discarding.` });
      return;
    }
    if (effect.type === "modifyDefenseRoll" || effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE) {
      const categories = action.target?.categories ?? [];
      const matchesTarget = (cardId) => cardId && (!categories.length || categories.includes(cardsById[cardId]?.category));
      const candidates = playerCorals.flatMap((coral) => coral.slots.flatMap((slot) => [
        ...(matchesTarget(slot.cardId) ? [{ coralId: coral.id, slotId: slot.id, statusKey: getSlotActionKey(slot), cardId: slot.cardId }] : []),
        ...(slot.hostedCardIds ?? []).flatMap((cardId, hostedIndex) => matchesTarget(cardId) ? [{ coralId: coral.id, slotId: getHostedTargetSlotId(slot.id, hostedIndex), statusKey: getHostedTargetSlotId(slot.id, hostedIndex), cardId }] : []),
      ]));
      playerReefCreatures.forEach((cardId, index) => { if (matchesTarget(cardId)) candidates.push({ coralId: null, slotId: getPlayerReefSlotId(index), cardId }); });
      getLocallyControlledOrphans(playerOrphanCreatures, "player").forEach((entry) => {
        const index = playerOrphanCreatures.findIndex((candidate) => candidate.instanceId === entry.instanceId);
        if (matchesTarget(entry.cardId)) candidates.push({ coralId: null, slotId: getPlayerOrphanSlotId(index), cardId: entry.cardId });
      });
      if (!candidates.length) {
        pushLog(`${sourceCard.name}'s ${action.name} has no legal friendly target.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, candidates });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-friendly-creature", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${action.name}`, message: "Choose one highlighted friendly creature to receive the defensive effect." });
      return;
    }
    if (effect.type === EffectType.FLIP_COIN) {
      if (!opponentCoralCards.length) {
        pushLog(`${sourceCard.name}'s ${actionName} has no legal opponent coral target.`);
        return;
      }
      setPendingCreatureAction({ action, effect, actionKey, sourceCardId: sourceCard.id, actionName, cost, costCommitted: false, candidates: opponentCoralCards.map((coral) => coral.id) });
      setInspectedCard(null);
      setEventOverlay({ type: "choose-coin-coral-target", sourceCardId: sourceCard.id, title: `Choose a target for ${actionName}`, message: `Choose an opponent Coral before flipping. Once chosen, the ${cost} RP action is committed; ${effect.successResult ?? "heads"} applies the effect and the other result does nothing. Cancel now to spend no RP.` });
      return;
    }
    if (effect.type === "rollDiceForResource") {
      const roll = rollDie(effect.dice);
      if (!roll) return;
      const success = effect.successValues?.includes(roll.total);
      const reward = success ? Number(effect.onSuccess?.amount ?? 0) : 0;
      setRp((current) => addResourceWithinCap(Math.max(0, current - cost), reward, playerRpCap));
      if (actionIsOncePerTurn(action)) setUsedCreatureActions((current) => [...current, actionKey]);
      const message = `${sourceCard.name} rolled ${roll.total} on ${effect.dice}.${success ? ` Gained ${reward} RP.` : " The action did not succeed."}`;
      pushLog(message);
      setInspectedCard(null);
      setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${action.name}`, message, success });
    }
  }

  function completeCreatureDrawAction() {
    if (!pendingCreatureAction) return;
    if (!turnDrawSelection || turnDrawSelection.foundation + turnDrawSelection.pals !== turnDrawSelection.target) return;
    const cost = pendingCreatureAction.cost ?? getActionCost(pendingCreatureAction.action);
    const foundationCards = foundationDeck.slice(0, turnDrawSelection.foundation);
    const palsCards = palsDeck.slice(0, turnDrawSelection.pals);
    const selectedCards = [...foundationCards, ...palsCards];
    const drawResult = drawWithHandLimit(selectedCards, hand.length, selectedCards.length, Infinity);
    setFoundationDeck((current) => current.slice(foundationCards.length));
    setPalsDeck((current) => current.slice(palsCards.length));
    setHand((current) => [...current, ...drawResult.cardsToHand]);
    if (drawResult.cardsToDiscard.length) setDiscardPile((current) => [...drawResult.cardsToDiscard, ...current]);
    setRp((current) => Math.max(0, current - cost));
    if (actionIsOncePerTurn(pendingCreatureAction.action)) setUsedCreatureActions((current) => [...current, pendingCreatureAction.actionKey]);
    const sourceCard = cardsById[pendingCreatureAction.sourceCardId];
    const shortfall = Number(turnDrawSelection.shortfall ?? getRequiredDrawShortfall(turnDrawSelection.requested, selectedCards.length));
    const message = `${sourceCard.name} drew ${foundationCards.length} from Foundation and ${palsCards.length} from Pals.${shortfall ? ` The mandatory draw was ${shortfall} card${shortfall === 1 ? "" : "s"} short, so you lose by deck depletion.` : ""}`;
    const revealed = selectedCards.map((cardId, index) => ({ cardId, source: index < foundationCards.length ? "Foundation" : "Pals", discarded: index >= drawResult.cardsToHand.length }));
    pushLog(message);
    setPendingCreatureAction(null);
    setTurnDrawSelection(null);
    if (shortfall) {
      setPendingEvents([]);
      setAttackContext(null);
      setGameResult((current) => current ?? `Defeat: ${sourceCard.name} required you to draw ${turnDrawSelection.requested} cards, but your personal decks contained only ${selectedCards.length}.`);
    }
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${pendingCreatureAction.actionName ?? getActionName(pendingCreatureAction.action)}`, message, success: shortfall === 0, drawnCards: revealed });
  }

  function completeCreatureRecovery(cardId) {
    if (!pendingCreatureAction || !discardPile.includes(cardId)) return;
    const cost = pendingCreatureAction.cost ?? getActionCost(pendingCreatureAction.action);
    const sourceCard = cardsById[pendingCreatureAction.sourceCardId];
    const handResult = pendingCreatureAction.effect.destination === "deck" ? null : applyCurrentHandLimit([cardId]);
    setDiscardPile((current) => handResult?.cardsToDiscard.length ? [cardId, ...removeOneCard(current, cardId)] : removeOneCard(current, cardId));
    const recoveredDeckType = getPersonalDeckType(cardsById[cardId]);
    if (pendingCreatureAction.effect.destination === "deck" && recoveredDeckType === "foundation") setFoundationDeck((current) => shuffle([...current, cardId]));
    else if (pendingCreatureAction.effect.destination === "deck") setPalsDeck((current) => shuffle([...current, cardId]));
    else if (handResult.cardsToHand.length) setHand((current) => [...current, cardId]);
    setRp((current) => Math.max(0, current - cost));
    if (actionIsOncePerTurn(pendingCreatureAction.action)) setUsedCreatureActions((current) => [...current, pendingCreatureAction.actionKey]);
    const destination = pendingCreatureAction.effect.destination === "deck" ? `your ${recoveredDeckType === "foundation" ? "Foundation" : "Pals"} deck` : "your hand";
    const message = `${sourceCard.name} moved ${cardsById[cardId]?.name ?? cardId} from your discard pile to ${destination} for ${cost} RP.`;
    pushLog(message);
    setPendingCreatureAction(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} used ${pendingCreatureAction.actionName ?? getActionName(pendingCreatureAction.action)}`, message, success: true });
  }

  function completeCreatureActionSearch(cardId) {
    if (!pendingCreatureAction?.candidates?.includes(cardId)) return;
    const sourceCard = cardsById[pendingCreatureAction.sourceCardId];
    if (!sourceCard) return;
    const cost = pendingCreatureAction.cost ?? getActionCost(pendingCreatureAction.action);
    setFoundationDeck((current) => shuffle(removeOneCard(current, cardId)));
    setPalsDeck((current) => shuffle(removeOneCard(current, cardId)));
    const handResult = applyCurrentHandLimit([cardId]);
    if (handResult.cardsToHand.length) setHand((current) => [...current, cardId]);
    if (handResult.cardsToDiscard.length) setDiscardPile((current) => [cardId, ...current]);
    setRp((current) => Math.max(0, current - cost));
    if (actionIsOncePerTurn(pendingCreatureAction.action)) setUsedCreatureActions((current) => [...current, pendingCreatureAction.actionKey]);
    const message = `${sourceCard.name}'s ${pendingCreatureAction.actionName ?? getActionName(pendingCreatureAction.action)} found ${cardsById[cardId]?.name ?? cardId} for ${cost} RP, added it to your hand, and shuffled both personal decks.`;
    pushLog(message);
    setPendingCreatureAction(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: cardId, title: `Player's ${sourceCard.name} searched`, message, success: true });
  }

  function chooseCreatureActionReorderDeck(deckType) {
    if (!pendingCreatureAction || !["foundation", "pals"].includes(deckType)) return;
    const deck = deckType === "foundation" ? foundationDeck : palsDeck;
    if (!deck.length) return;
    setPendingCreatureAction((current) => ({ ...current, deckType, topCards: deck.slice(0, Number(current.effect.amount ?? 3)) }));
    setEventOverlay({ type: "reorder-creature-action-deck", sourceCardId: pendingCreatureAction.sourceCardId, title: `Player's ${cardsById[pendingCreatureAction.sourceCardId]?.name} used ${pendingCreatureAction.actionName}`, message: `Set the new top-to-bottom order for your ${deckType} deck.` });
  }

  function moveCreatureActionDeckCard(index, delta) {
    if (!pendingCreatureAction?.topCards) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= pendingCreatureAction.topCards.length) return;
    setPendingCreatureAction((current) => { const topCards = [...current.topCards]; [topCards[index], topCards[nextIndex]] = [topCards[nextIndex], topCards[index]]; return { ...current, topCards }; });
  }

  function commitCreatureActionReorder() {
    if (!pendingCreatureAction?.topCards?.length) return;
    const sourceCard = cardsById[pendingCreatureAction.sourceCardId];
    const deck = pendingCreatureAction.deckType === "foundation" ? foundationDeck : palsDeck;
    const nextDeck = [...pendingCreatureAction.topCards, ...deck.slice(pendingCreatureAction.topCards.length)];
    if (pendingCreatureAction.deckType === "foundation") setFoundationDeck(nextDeck);
    else setPalsDeck(nextDeck);
    setRp((current) => Math.max(0, current - pendingCreatureAction.cost));
    if (actionIsOncePerTurn(pendingCreatureAction.action)) setUsedCreatureActions((current) => [...current, pendingCreatureAction.actionKey]);
    const message = `${sourceCard.name}'s ${pendingCreatureAction.actionName} rearranged the top ${pendingCreatureAction.topCards.length} cards of your ${pendingCreatureAction.deckType} deck for ${pendingCreatureAction.cost} RP.`;
    pushLog(message);
    setPendingCreatureAction(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, title: `Player's ${sourceCard.name} completed deck rearrangement`, message, success: true });
  }

  function toggleActionHandDiscard(index) {
    if (!pendingCreatureAction?.handEntries?.some((entry) => entry.index === index)) return;
    const maxDiscard = pendingCreatureAction.maxDiscard ?? Math.max(0, Number(pendingCreatureAction.effect.discard?.amount ?? 0));
    setPendingCreatureAction((current) => ({ ...current, selectedIndices: current.selectedIndices.includes(index) ? current.selectedIndices.filter((selectedIndex) => selectedIndex !== index) : current.selectedIndices.length < maxDiscard ? [...current.selectedIndices, index] : current.selectedIndices }));
  }

  function toggleHandLimitDiscard(entryKey) {
    const choice = eventOverlay?.type === "choose-hand-limit-discard" ? eventOverlay.handLimitChoice : null;
    if (!choice?.entries.some((entry) => entry.key === entryKey)) return;
    setHandLimitDiscardSelection((current) => {
      if (current.includes(entryKey)) return current.filter((key) => key !== entryKey);
      if (current.length >= choice.requiredDiscardCount) return current;
      return [...current, entryKey];
    });
  }

  function confirmHandLimitDiscard() {
    if (eventOverlay?.type !== "choose-hand-limit-discard") return;
    const choice = eventOverlay.handLimitChoice;
    const result = resolveHandLimitChoice(choice, handLimitDiscardSelection, discardPile);

    setHand(result.hand);
    setDiscardPile(result.discardPile);
    if (modal === "draw-result" && turnDrawResult?.length) {
      const drawnStartIndex = Math.max(0, choice.entries.length - turnDrawResult.length);
      const discardedIndexes = new Set(result.discardedEntries.map((entry) => entry.snapshotIndex));
      setTurnDrawResult((current) => (current ?? []).map((entry, index) => ({
        ...entry,
        discarded: discardedIndexes.has(drawnStartIndex + index),
      })));
    }
    const discardedNames = result.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId);
    pushLog(`${activeCondition?.name ?? "Hand limit"}: you chose ${discardedNames.join(", ")} to discard and kept ${result.hand.length} cards.`);
    setHandLimitDiscardSelection([]);
    closeEventOverlay();
  }

  function confirmActionHandDiscard() {
    if (!pendingCreatureAction?.handEntries) return;
    const required = pendingCreatureAction.minDiscard ?? Math.max(0, Number(pendingCreatureAction.effect.discard?.amount ?? 0));
    const maxDiscard = pendingCreatureAction.maxDiscard ?? required;
    if (pendingCreatureAction.selectedIndices.length < required || pendingCreatureAction.selectedIndices.length > maxDiscard) return;
    const selectedCards = pendingCreatureAction.selectedIndices.map((index) => pendingCreatureAction.handEntries.find((entry) => entry.index === index)?.cardId).filter(Boolean);
    const cost = pendingCreatureAction.cost ?? getActionCost(pendingCreatureAction.action);
    let remainingHand = hand;
    selectedCards.forEach((cardId) => { remainingHand = removeOneCard(remainingHand, cardId); });
    setHand(remainingHand);
    setDiscardPile((current) => [...selectedCards, ...current]);
    if (pendingCreatureAction.effect.type === "discardThenDraw") {
      const drawCount = selectedCards.length;
      setPendingCreatureAction((current) => ({ ...current, effect: { type: EffectType.DRAW_CARDS, amount: drawCount }, discardedCards: selectedCards, handEntries: null, selectedIndices: [], committed: true }));
      setTurnDrawSelection({ requested: drawCount, target: Math.min(drawCount, foundationDeck.length + palsDeck.length), foundation: 0, pals: 0, mode: "action" });
      setEventOverlay({ type: "choose-action-deck", sourceCardId: pendingCreatureAction.sourceCardId, title: `Player's ${cardsById[pendingCreatureAction.sourceCardId]?.name} used ${pendingCreatureAction.actionName ?? getActionName(pendingCreatureAction.action)}`, message: `The ${selectedCards.length} discarded card(s) are committed. Allocate the same number of draws between your personal decks.` });
      return;
    }
    setRp((current) => Math.max(0, current - cost));
    if (actionIsOncePerTurn(pendingCreatureAction.action)) setUsedCreatureActions((current) => [...current, pendingCreatureAction.actionKey]);
    const candidates = [...new Set([...foundationDeck, ...palsDeck])];
    setPendingCreatureAction((current) => ({ ...current, discardedCards: selectedCards, searchCandidates: candidates }));
    setEventOverlay({ type: "choose-action-search-card", sourceCardId: pendingCreatureAction.sourceCardId, title: `Player's ${cardsById[pendingCreatureAction.sourceCardId]?.name} used ${pendingCreatureAction.action.name}`, message: "Choose any card from either personal deck. The discarded cards and RP cost are now committed." });
  }

  function completeActionDeckSearch(cardId) {
    if (!pendingCreatureAction?.searchCandidates?.includes(cardId)) return;
    const sourceCard = cardsById[pendingCreatureAction.sourceCardId];
    if (!sourceCard) return;
    setFoundationDeck((current) => shuffle(removeOneCard(current, cardId)));
    setPalsDeck((current) => shuffle(removeOneCard(current, cardId)));
    const handResult = applyCurrentHandLimit([cardId]);
    if (handResult.cardsToHand.length) setHand((current) => [...current, cardId]);
    if (handResult.cardsToDiscard.length) setDiscardPile((current) => [cardId, ...current]);
    const discardedNames = (pendingCreatureAction.discardedCards ?? []).map((discardedId) => cardsById[discardedId]?.name ?? discardedId).join(", ");
    const message = `${sourceCard.name} discarded ${discardedNames}, found ${cardsById[cardId]?.name}, added it to your hand, revealed it, and shuffled both personal decks.`;
    pushLog(message);
    setPendingCreatureAction(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: cardId, title: `Player's ${sourceCard.name} completed Scavenge`, message, success: true });
  }

  function completeDefensiveBuff(slotId) {
    if (!pendingCreatureAction?.candidates?.some((candidate) => candidate.slotId === slotId)) return;
    const { action, effect, actionKey, sourceCardId } = pendingCreatureAction;
    const cost = Number(action.cost?.rp ?? 0);
    const targetEntry = pendingCreatureAction.candidates.find((candidate) => candidate.slotId === slotId);
    const status = effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE
      ? { type: "defenseAdvantage", expiresTurn: turn + 1, sourceCardId }
      : { type: "defenseBonusDice", dice: effect.amount?.dice ?? "D4", expiresTurn: turn + 1, sourceCardId };
    const statusKey = targetEntry.statusKey ?? slotId;
    setCreatureStatuses((current) => ({ ...current, [statusKey]: [...(current[statusKey] ?? []), status] }));
    setRp((current) => Math.max(0, current - cost));
    if (actionIsOncePerTurn(action)) setUsedCreatureActions((current) => [...current, actionKey]);
    const sourceCard = cardsById[sourceCardId];
    const targetCard = cardsById[targetEntry.cardId];
    const message = `${sourceCard.name} gave ${targetCard.name} ${status.type === "defenseAdvantage" ? "advantage on defense rolls" : `+${status.dice} to defense rolls`} until your next turn for ${cost} RP.`;
    pushLog(message);
    setPendingCreatureAction(null);
    setEventOverlay({ type: "utility-result", sourceCardId, defenderCardId: targetCard.id, title: `Player's ${sourceCard.name} used ${action.name}`, message, success: true });
  }

  function completeCoinCoralEffect(coralId) {
    if (!pendingCreatureAction?.candidates?.includes(coralId)) return;
    const pendingAction = pendingCreatureAction;
    const target = opponentCorals.find((coral) => coral.id === coralId);
    const sourceCard = cardsById[pendingAction.sourceCardId];
    if (!target || !sourceCard) return;
    const isTargetedCoinAction = pendingAction.effect.type === EffectType.FLIP_COIN;
    const coinResolution = isTargetedCoinAction
      ? resolveTargetedCoinFlip({
          candidateIds: pendingAction.candidates,
          targetId: coralId,
          successResult: pendingAction.effect.successResult ?? "heads",
        })
      : null;
    if (isTargetedCoinAction && !coinResolution?.resolved) return;
    const effect = pendingAction.effect.onSuccess ?? pendingAction.effect;
    if (!effect) return;
    const actionName = pendingAction.actionName ?? getActionName(pendingAction.action);
    const commitCostAndActionUse = () => {
      const cost = pendingAction.cost ?? getActionCost(pendingAction.action);
      if (!pendingAction.costCommitted) {
        setRp((current) => Math.max(0, current - cost));
        if (actionIsOncePerTurn(pendingAction.action)) {
          setUsedCreatureActions((current) => current.includes(pendingAction.actionKey) ? current : [...current, pendingAction.actionKey]);
        }
      }
      return cost;
    };
    if (coinResolution && !coinResolution.success) {
      const cost = commitCostAndActionUse();
      const targetName = cardsById[target.cardId]?.name ?? "Coral";
      const message = `${sourceCard.name} targeted the opponent's ${targetName} with ${actionName}, paid ${cost} RP, and flipped ${coinResolution.coinResult}. The effect did not succeed.`;
      pushLog(message);
      setPendingCreatureAction(null);
      setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: target.cardId, title: `Player's ${sourceCard.name} used ${actionName}`, message, success: false });
      return;
    }
    let message = "";
    if (effect.type === EffectType.DAMAGE) {
      const amount = Number(effect.amount?.value ?? effect.amount ?? 0);
      const result = applyDamage(target.health ?? target.maxHealth, amount);
      if (result.destroyed) {
        const targetCard = cardsById[target.cardId];
        const handLimit = Number((activeCondition?.effects ?? []).find((candidate) => candidate.type === "setHandLimit")?.amount ?? Infinity);
        const previewTriggers = resolveFoundationDestructionTriggers([[target]], opponent.hand, opponent.discardPile, handLimit);
        setOpponent((current) => {
          const currentTarget = current.corals.find((coral) => coral.id === coralId) ?? target;
          const redistributed = redistributeOrphanCreatures(current.corals.filter((coral) => coral.id !== coralId), [...(current.orphanCreatures ?? []), ...getOrphanEntriesFromFoundation(currentTarget)]);
          const triggerResult = resolveFoundationDestructionTriggers([[currentTarget]], current.hand, current.discardPile, handLimit);
          return { ...current, corals: redistributed.corals, orphanCreatures: redistributed.orphans, hand: triggerResult.hand, discardPile: triggerResult.discardPile };
        });
        const fragmentTrigger = previewTriggers.triggers[0];
        const fragmentMessage = fragmentTrigger
          ? fragmentTrigger.cardsToHand.length
            ? ` Fragment returned ${fragmentTrigger.cardsToHand.length} ${cardsById[fragmentTrigger.targetCardId]?.name ?? "matching card"}(s) to the opponent's hand.`
            : fragmentTrigger.cardsToDiscard.length
              ? " Fragment found its card, but the hand limit kept it in discard."
              : ` Fragment triggered but found no ${cardsById[fragmentTrigger.targetCardId]?.name ?? "matching card"}.`
          : "";
        message = `${sourceCard.name} dealt ${result.appliedDamage} damage and destroyed the opponent's ${targetCard?.name}. The creatures filled compatible slots or remained orphaned on the opponent's reef.${fragmentMessage}`;
      } else {
        setOpponent((current) => ({ ...current, corals: current.corals.map((coral) => coral.id === coralId ? { ...coral, health: result.remainingHealth } : coral) }));
        message = `${sourceCard.name} dealt ${result.appliedDamage} damage to the opponent's ${cardsById[target.cardId]?.name}. ${result.remainingHealth}/${target.maxHealth} HP remains.`;
      }
    } else if (effect.type === EffectType.MODIFY_RP_GENERATION || effect.type === "modifyRpGeneration") {
      const penalty = Math.abs(Number(effect.amount ?? 0));
      setOpponent((current) => ({ ...current, corals: current.corals.map((coral) => coral.id === coralId ? { ...coral, rpPenaltyNextTurn: Number(coral.rpPenaltyNextTurn ?? 0) + penalty } : coral) }));
      message = `${sourceCard.name} made the opponent's ${cardsById[target.cardId]?.name} produce ${penalty} less RP during its next collection.`;
    } else if (effect.type === EffectType.STUN_CORAL) {
      setOpponent((current) => ({ ...current, corals: current.corals.map((coral) => coral.id === coralId ? { ...coral, statuses: [...(coral.statuses ?? []).filter((status) => status.type !== "stunned"), createStunnedStatus(sourceCard.id)] } : coral) }));
      message = `${sourceCard.name} Stunned the opponent's ${cardsById[target.cardId]?.name}. It produces no RP, cannot use its own actions or passives, and cannot be upgraded through the end of the opponent's next turn. Coral Heal can clear Stunned early.`;
    }
    if (coinResolution?.success) {
      const sourcePrefix = `${sourceCard.name} `;
      const effectSummary = message.startsWith(sourcePrefix) ? message.slice(sourcePrefix.length) : message;
      message = `${sourceCard.name}'s ${actionName} landed ${coinResolution.coinResult} and ${effectSummary.charAt(0).toLowerCase()}${effectSummary.slice(1)}`;
    }
    commitCostAndActionUse();
    pushLog(message);
    setPendingCreatureAction(null);
    setEventOverlay({ type: "impact-result", sourceCardId: sourceCard.id, defenderCardId: target.cardId, title: `Player's ${sourceCard.name} used ${actionName}`, message, success: true });
  }

  function completeSymbiosis(cardId = null) {
    if (searchContext?.mode !== "symbiosis") return;
    const sourceCard = cardsById[searchContext.sourceCardId];
    const sourceCoral = playerCorals.find((coral) => coral.id === searchContext.coralId);
    const sourceSlot = sourceCoral?.slots.find((slot) => slot.id === searchContext.slotId && slot.cardId === sourceCard?.id);
    const nextHostedCardIds = cardId && sourceSlot
      ? placeCardInSpecialHost(sourceCard, cardsById[cardId], sourceSlot.hostedCardIds, cardId)
      : null;
    if (cardId && searchContext.candidates.includes(cardId) && hand.includes(cardId) && nextHostedCardIds) {
      setPlayerCorals((current) => current.map((coral) => coral.id === searchContext.coralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === searchContext.slotId && slot.cardId === sourceCard.id ? { ...slot, hostedCardIds: nextHostedCardIds } : slot) } : coral));
      setHand((current) => removeOneCard(current, cardId));
      const message = `${sourceCard.name}'s Symbiosis hosted ${cardsById[cardId]?.name} from your hand. The hosted card counts toward VP and receives the Anemone's defensive protection.`;
      pushLog(message);
      setSearchContext(null);
      setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: cardId, title: `Player's ${sourceCard.name} used Symbiosis`, message, success: true });
      return;
    }
    const message = cardId
      ? `${sourceCard?.name ?? "Anemone"} could not host that Clownfish because the host moved, changed, or no longer has space.`
      : `${sourceCard?.name ?? "Anemone"}'s optional Clownfish attachment was skipped.`;
    pushLog(message);
    setSearchContext(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard?.id, title: "Symbiosis Skipped", message, success: false });
  }

  function completeTerritorialTarget(coralId) {
    if (searchContext?.mode !== "territorial-target" || !searchContext.candidates.includes(coralId)) return;
    const target = playerCorals.find((foundation) => foundation.id === coralId && isCreatureSchool(cardsById[foundation.cardId]));
    if (!target) {
      setSearchContext(null);
      setEventOverlay(null);
      pushLog("Territorial could not resolve because the chosen Creature School is no longer in play.");
      return;
    }
    setPlayerReefCreatureInstances((current) => current.map((instance) => instance.instanceId === searchContext.sourceInstanceId
      ? { ...instance, territorialTargetFoundationId: target.id }
      : instance));
    const sourceCard = cardsById[searchContext.sourceCardId];
    const message = `${sourceCard?.name ?? "Ocean Triggerfish"}'s Territorial gives ${cardsById[target.cardId]?.name} +30 HP while that Triggerfish remains in play.`;
    pushLog(message);
    setSearchContext(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard?.id, defenderCardId: target.cardId, title: `Player's ${sourceCard?.name ?? "Ocean Triggerfish"} used Territorial`, message, success: true });
  }

  function toggleOnPlaySearchCard(cardId) {
    if (searchContext?.mode !== "onplay-multi-search" || !searchContext.candidates.includes(cardId)) return;
    setSearchContext((current) => {
      const availableCopies = [...foundationDeck, ...palsDeck].filter((candidateId) => candidateId === cardId).length;
      const selectedCopies = current.selected.filter((selectedId) => selectedId === cardId).length;
      const selected = selectedCopies < availableCopies && current.selected.length < current.max
        ? [...current.selected, cardId]
        : current.selected.filter((selectedId) => selectedId !== cardId);
      return { ...current, selected };
    });
  }

  function completeOnPlayMultiSearch(selectedOverride = null) {
    if (searchContext?.mode !== "onplay-multi-search") return;
    const selected = selectedOverride ?? searchContext.selected;
    setFoundationDeck((current) => shuffle(selected.reduce((deck, cardId) => removeOneCard(deck, cardId), current)));
    setPalsDeck((current) => shuffle(selected.reduce((deck, cardId) => removeOneCard(deck, cardId), current)));
    if (selected.length) setHand((current) => [...current, ...selected]);
    const sourceCard = cardsById[searchContext.sourceCardId];
    const message = selected.length ? `${sourceCard.name}'s ${searchContext.actionName} revealed ${selected.map((cardId) => cardsById[cardId]?.name).join(" and ")} and added ${selected.length === 1 ? "it" : "them"} to your hand.` : `${sourceCard.name}'s optional search selected no cards.`;
    pushLog(message);
    setSearchContext(null);
    setEventOverlay({ type: "utility-result", sourceCardId: sourceCard.id, defenderCardId: selected[0], title: `Player's ${sourceCard.name} used ${searchContext.actionName}`, message, success: selected.length > 0 });
  }

  function getVisibleBoardCardCount(foundations = [], habitats = [], reefCreatures = [], orphans = []) {
    return (foundations?.length ?? 0)
      + (habitats?.length ?? 0)
      + (reefCreatures?.length ?? 0)
      + (orphans?.length ?? 0)
      + (foundations ?? []).reduce((total, foundation) => total + (foundation.slots ?? []).reduce(
        (slotTotal, slot) => slotTotal + (slot.cardId ? 1 : 0) + (slot.hostedCardIds ?? []).filter(Boolean).length,
        0,
      ), 0)
      + (orphans ?? []).reduce((total, entry) => total + (entry.hostedCardIds ?? []).filter(Boolean).length, 0);
  }

  function assessCurrentOpponentThreat(opponentState = opponent) {
    return getOpponentThreatProfile({
      playerVp,
      opponentVp,
      victoryTarget,
      playerIncome: 1 + getEcosystemStartTurnRp(playerCorals, activeCondition),
      opponentIncome: 1 + getEcosystemStartTurnRp(opponentState.corals, activeCondition),
      playerSchoolDensity: getSchoolDensity(playerCorals),
      opponentSchoolDensity: getSchoolDensity(opponentState.corals),
      playerBoardCards: getVisibleBoardCardCount(
        playerCorals,
        playerHabitats,
        playerReefCreatures,
        playerOrphanCreatures,
      ),
      opponentBoardCards: getVisibleBoardCardCount(
        opponentState.corals,
        opponentState.habitats,
        opponentState.reefCreatures,
        opponentState.orphanCreatures,
      ),
      round,
    });
  }

  function opponentAttackHasVisibleTarget(attackerCard, attack, opponentState = opponent) {
    if (!attackerCard || !attack) return false;
    const canTargetHidden = cardCanTargetHiddenByAbyss(attackerCard, attack);
    const canTargetPlayerCard = (targetCard) => cardMatchesAttackTarget(targetCard, attack)
      && (!cardIsHiddenByAbyss(targetCard, playerHabitats) || canTargetHidden);
    const visiblePlayerCards = [
      ...playerCorals.flatMap((coral) => [
        ...(isCreatureSchool(cardsById[coral.cardId]) ? [cardsById[coral.cardId]] : []),
        ...coral.slots.flatMap((slot) => slot.invasiveOwner === "opponent"
          ? []
          : [slot.cardId, ...(slot.hostedCardIds ?? [])].map((cardId) => cardsById[cardId])),
      ]),
      ...playerReefCreatures.map((cardId) => cardsById[cardId]),
      ...playerOrphanCreatures.flatMap((entry) => entry.invasiveOwner === "opponent"
        ? []
        : [entry.cardId, ...(entry.hostedCardIds ?? [])].map((cardId) => cardsById[cardId])),
    ].filter(Boolean);
    if (visiblePlayerCards.some(canTargetPlayerCard)) return true;
    return [
      ...getInvasiveCreatureTargets(opponentState.corals, "player"),
      ...getInvasiveOrphanTargets(opponentState.orphanCreatures, "player"),
    ].some((target) => cardMatchesAttackTarget(cardsById[target.cardId], attack));
  }

  function runOpponentSupports(opponentState) {
    if (opponentState.supportBlockedUntilRound >= round) return { state: opponentState, summaries: [], impacts: [], events: [], lost: false, lossSummary: "" };
    let next = opponentState;
    const threatProfile = assessCurrentOpponentThreat(opponentState);
    const criticalHardTurn = opponentDifficulty === OpponentDifficulty.HARD
      && threatProfile.level === OpponentThreatLevel.CRITICAL;
    const urgentSupportIds = new Set(["whirlpool", "super-whirlpool", "spearfishing", "rov-lights", "poison-heal"]);
    const getReservedPressureRp = (state) => {
      const pressureCosts = (state.hand ?? []).flatMap((cardId) => {
        const candidate = cardsById[cardId];
        if (candidate?.kind !== CardKind.CREATURE) return [];
        const onPlayAttack = getOnPlayAttackEffect(candidate);
        const normalAttack = getBasicAttackEffect(candidate);
        const attack = onPlayAttack ?? normalAttack;
        if (!attack || !opponentAttackHasVisibleTarget(candidate, attack, state)) return [];
        const playCost = Math.max(
          0,
          getCardPlayCost(candidate, activeCondition)
            + getOpposingPlayCostModifier(candidate, playerCorals, playerReefCreatures, playerOrphanCreatures),
        );
        const attackCost = onPlayAttack ? 0 : Number(normalAttack?.actionCost ?? 0);
        const totalCost = playCost + attackCost;
        return totalCost <= state.rp ? [totalCost] : [];
      });
      return pressureCosts.length ? Math.min(...pressureCosts) : 0;
    };
    const summaries = [];
    const impacts = [];
    const events = [];
    let lossSummary = "";
    // A non-locking search can find another Support, which is also legal to play
    // this turn. Use the finite cards in the opponent's zones as a safety bound
    // instead of freezing the count to Supports that began in hand.
    const availableSupportPlays = Math.max(1, opponentState.hand.length + opponentState.palsDeck.length + opponentState.foundationDeck.length + opponentState.discardPile.length);
    const supportPlaySafetyLimit = limitOpponentOptionalActions(availableSupportPlays, opponentDifficulty, "support");
    for (let playCount = 0; playCount < supportPlaySafetyLimit; playCount += 1) {
      let chosen = null;
      const scoreSupport = (cardId) => {
        const card = cardsById[cardId];
        if (!card || card.kind !== CardKind.SUPPORT) return -Infinity;
        if (card.id === "super-whirlpool") return 110;
        if (card.id === "whirlpool") return 100;
        if (card.id === "coral-cement" || card.id === "coral-heal") return 90;
        if (card.id === "restocking" || card.id === "recovery") return 78;
        if (card.id === "ocean-jake") return 82;
        if (card.id === "scientist-jes") return 72;
        if (card.id === "dr-evans") return next.hand.length <= 3 ? 70 : 15;
        if (card.id === "explorer-jordan") return 68;
        if (card.id === "robotic-survey") return 48;
        if ((card.effects ?? []).some((effect) => effect.type === EffectType.SEARCH_DECK || effect.type === EffectType.DRAW_CARDS)) return 65;
        if (card.id === "rov-lights" || card.id === "poison-heal") return 55;
        if (card.id === "spearfishing") return 25;
        return 45;
      };
      for (const cardId of orderOpponentChoices(next.hand, opponentDifficulty, scoreSupport)) {
        const card = cardsById[cardId];
        if (card?.kind !== CardKind.SUPPORT || cardIsBlockedFromPlayThisTurn(next, cardId) || getConditionPlayRestriction(card, activeCondition)) continue;
        const cost = getCardPlayCost(card, activeCondition);
        if (cost > next.rp) continue;
        const reservedPressureRp = criticalHardTurn ? getReservedPressureRp(next) : 0;
        if (
          reservedPressureRp > 0
          && cost > 0
          && !urgentSupportIds.has(card.id)
          && next.rp - cost < reservedPressureRp
        ) continue;
        const effects = card.effects ?? [];
        const searchEffect = effects.find((effect) => effect.type === EffectType.SEARCH_DECK);
        const chooseTopEffect = effects.find((effect) => effect.type === "chooseFromTopDeck");
        const reorderEffect = effects.find((effect) => effect.type === "peekAndReorderDeck");
        const hasSearchTarget = searchEffect && [...next.palsDeck, ...next.foundationDeck].some((candidateId) => cardMatchesSearchCriteria(cardsById[candidateId], searchEffect));
        const hasSpearfishingTarget = card.id === "spearfishing" && (
          (next.reefCreatures ?? []).some((candidateId) => [CardCategory.FISH, CardCategory.PREDATOR].includes(cardsById[candidateId]?.category))
          || (next.orphanCreatures ?? []).some((entry) => cardCanBeSpearfished(cardsById[entry.cardId], entry, "opponent"))
          || next.corals.some((coral) => coral.slots.some((slot) => cardCanBeSpearfished(cardsById[slot.cardId], slot, "opponent")))
        );
        const canUseScientistJesDraw = card.id === "scientist-jes" && Boolean(next.palsDeck.length || next.foundationDeck.length);
        const hasTopDeckCards = Boolean(next.palsDeck.length || next.foundationDeck.length);
        const usable = hasSearchTarget || (chooseTopEffect && hasTopDeckCards) || (reorderEffect && hasTopDeckCards) || canUseScientistJesDraw || (card.id === "dr-evans" && next.hand.length <= 3) || (card.id === "coral-cement" && next.corals.some((coral) => cardsById[coral.cardId]?.kind === CardKind.CORAL && coral.health < coral.maxHealth)) || (card.id === "coral-heal" && next.corals.some((coral) => cardsById[coral.cardId]?.kind === CardKind.CORAL && (coral.statuses?.length || Number(coral.rpPenaltyNextTurn ?? 0) > 0))) || (card.id === "recovery" && next.discardPile.length) || (card.id === "ocean-jake" && (next.lostZone ?? []).length) || (card.id === "restocking" && next.discardPile.some((candidateId) => cardsById[candidateId]?.category === CardCategory.FISH)) || card.id === "poison-heal" || card.id === "rov-lights" || hasSpearfishingTarget || (["whirlpool", "super-whirlpool"].includes(card.id) && playerCoralCards.length);
        if (usable) { chosen = { card, cost, effects, searchEffect, chooseTopEffect, reorderEffect }; break; }
      }
      if (!chosen) break;
      const { card, cost, effects, searchEffect, chooseTopEffect, reorderEffect } = chosen;
      next = {
        ...next,
        hand: removeOneCard(next.hand, card.id),
        discardPile: card.id === "ocean-jake" ? next.discardPile : [card.id, ...next.discardPile],
        rp: Math.max(0, next.rp - cost),
      };
      const details = [];
      let revealedCardIds = [];
      const scientistJesChoosesSearch = card.id === "scientist-jes"
        && !next.habitats.length
        && !next.hand.some((cardId) => cardsById[cardId]?.kind === CardKind.HABITAT)
        && Boolean(searchEffect && [...next.palsDeck, ...next.foundationDeck].some((candidateId) => cardMatchesSearchCriteria(cardsById[candidateId], searchEffect)));
      if (searchEffect && (card.id !== "scientist-jes" || scientistJesChoosesSearch)) {
        const candidates = [...next.palsDeck, ...next.foundationDeck].filter((candidateId) => cardMatchesSearchCriteria(cardsById[candidateId], searchEffect)).slice(0, Math.max(1, Number(searchEffect.amount ?? 1)));
        next = { ...next, palsDeck: shuffle(candidates.reduce((deck, cardId) => removeOneCard(deck, cardId), next.palsDeck)), foundationDeck: shuffle(candidates.reduce((deck, cardId) => removeOneCard(deck, cardId), next.foundationDeck)), hand: [...next.hand, ...candidates] };
        details.push(`found ${candidates.map((cardId) => cardsById[cardId]?.name).join(" and ")}`);
        if (searchEffect.revealToOpponent || /show (?:it|them) to your opponent/i.test(card.text ?? "")) revealedCardIds = candidates;
      }
      if (chooseTopEffect) {
        const amount = Math.max(1, Number(chooseTopEffect.amount ?? 5));
        const deckOptions = ["palsDeck", "foundationDeck"].map((deckKey) => ({
          deckKey,
          candidates: next[deckKey].slice(0, amount).filter((cardId) => {
            const candidate = cardsById[cardId];
            return candidate && (!chooseTopEffect.targetKind || candidate.kind === chooseTopEffect.targetKind);
          }),
        }));
        const choice = deckOptions.flatMap((option) => option.candidates.map((cardId) => ({ deckKey: option.deckKey, cardId, score: Number(cardsById[cardId]?.victoryPoints?.value ?? cardsById[cardId]?.victoryPoints ?? cardsById[cardId]?.vp ?? 0) * 10 + (cardsById[cardId]?.actions?.length ?? 0) * 3 }))).sort((left, right) => right.score - left.score)[0];
        if (choice) {
          next = { ...next, [choice.deckKey]: shuffle(removeOneCard(next[choice.deckKey], choice.cardId)), hand: [...next.hand, choice.cardId] };
          details.push(`inspected the top cards and added ${cardsById[choice.cardId]?.name} to its hand`);
          if (chooseTopEffect.revealToOpponent) revealedCardIds = [choice.cardId];
        } else details.push("inspected the top cards but found no matching creature");
      } else if (reorderEffect) {
        const amount = Math.max(1, Number(reorderEffect.amount ?? 5));
        const deckKey = next.palsDeck.length ? "palsDeck" : "foundationDeck";
        const top = next[deckKey].slice(0, amount).sort((leftId, rightId) => {
          const left = cardsById[leftId];
          const right = cardsById[rightId];
          const score = (candidate) => Number(candidate?.victoryPoints?.value ?? candidate?.victoryPoints ?? candidate?.vp ?? 0) * 10 + getCardStartTurnRp(candidate) * 8 + (candidate?.actions?.length ?? 0) * 3 - Number(candidate?.cost?.rp ?? 0);
          return score(right) - score(left);
        });
        next = { ...next, [deckKey]: [...top, ...next[deckKey].slice(top.length)] };
        details.push(`reordered the top ${top.length} cards of its ${deckKey === "palsDeck" ? "Pals" : "Foundation"} deck`);
      }
      const drawEffect = effects.find((effect) => effect.type === EffectType.DRAW_CARDS);
      if (card.id === "dr-evans") {
        const oldHand = next.hand;
        next = { ...next, hand: [], discardPile: [...oldHand, ...next.discardPile] };
        let drawn = 0;
        while (drawn < 7 && (next.palsDeck.length || next.foundationDeck.length)) {
          const deckKey = drawn % 2 === 0 && next.palsDeck.length ? "palsDeck" : next.foundationDeck.length ? "foundationDeck" : "palsDeck";
          next = { ...next, hand: [...next.hand, next[deckKey][0]], [deckKey]: next[deckKey].slice(1) };
          drawn += 1;
        }
        details.push(`discarded its hand and drew ${drawn}`);
        const shortfall = getRequiredDrawShortfall(7, drawn);
        if (shortfall) lossSummary = `Opponent's ${card.name} required a seven-card draw, but its personal decks contained only ${drawn}. The opponent loses by deck depletion.`;
      } else if (drawEffect && (card.id !== "scientist-jes" || !scientistJesChoosesSearch)) {
        const requested = Math.max(0, Number(drawEffect.amount ?? 0));
        let drawn = 0;
        while (drawn < requested && (next.palsDeck.length || next.foundationDeck.length)) {
          const deckKey = drawn % 2 === 0 && next.palsDeck.length ? "palsDeck" : next.foundationDeck.length ? "foundationDeck" : "palsDeck";
          next = { ...next, hand: [...next.hand, next[deckKey][0]], [deckKey]: next[deckKey].slice(1) };
          drawn += 1;
        }
        if (drawn) details.push(`drew ${drawn}`);
        const shortfall = getRequiredDrawShortfall(requested, drawn);
        if (shortfall) lossSummary = `Opponent's ${card.name} required ${requested} drawn card${requested === 1 ? "" : "s"}, but its personal decks contained only ${drawn}. The opponent loses by deck depletion.`;
      }
      if (card.id === "coral-cement") {
        const target = next.corals.find((coral) => cardsById[coral.cardId]?.kind === CardKind.CORAL && coral.health < coral.maxHealth);
        if (target) next = { ...next, corals: next.corals.map((coral) => coral.id === target.id ? { ...coral, health: Math.min(coral.maxHealth, coral.health + 20) } : coral) };
        if (target) details.push(`healed ${cardsById[target.cardId]?.name} for up to 20 HP`);
      } else if (card.id === "coral-heal") {
        const target = next.corals.find((coral) => cardsById[coral.cardId]?.kind === CardKind.CORAL && (coral.statuses?.length || Number(coral.rpPenaltyNextTurn ?? 0) > 0));
        if (target) next = { ...next, corals: next.corals.map((coral) => {
          if (coral.id !== target.id) return coral;
          const { rpPenaltyNextTurn, ...clearedCoral } = coral;
          return { ...clearedCoral, statuses: [] };
        }) };
        if (target) details.push(`removed all effects from ${cardsById[target.cardId]?.name}`);
      } else if (card.id === "recovery") {
        const coin = Math.random() < 0.5 ? "heads" : "tails";
        if (coin === "heads") {
          const playedRecoveryId = next.discardPile[0];
          const recoverableDiscard = next.discardPile.slice(1);
          const recoveredId = recoverableDiscard[0];
          if (recoveredId) next = { ...next, hand: [...next.hand, recoveredId], discardPile: [playedRecoveryId, ...removeOneCard(recoverableDiscard, recoveredId)] };
          details.push(recoveredId ? `flipped heads and recovered ${cardsById[recoveredId]?.name}` : "flipped heads but had no other card to recover");
        } else details.push("flipped tails and recovered nothing");
      } else if (card.id === "ocean-jake") {
        const recoveredId = (next.lostZone ?? [])[0];
        const lostAfterRecovery = recoveredId ? removeOneCard(next.lostZone, recoveredId) : [...(next.lostZone ?? [])];
        const currentHandLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
        const handResult = recoveredId
          ? applyAutomatedHandLimitToState(next, currentHandLimit, { round }, [recoveredId])
          : { state: next, incomingCardsToHand: [], incomingCardsToDiscard: [], cardsToDiscard: [] };
        next = {
          ...handResult.state,
          lostZone: [card.id, ...lostAfterRecovery],
          cardsBlockedFromPlayThisTurn: handResult.incomingCardsToHand.length
            ? [...(next.cardsBlockedFromPlayThisTurn ?? []), recoveredId]
            : next.cardsBlockedFromPlayThisTurn ?? [],
        };
        details.push(handResult.incomingCardsToHand.length
          ? `recovered ${cardsById[recoveredId]?.name} from its Lost Zone; that card cannot be played this turn, and Ocean Jake moved to the Lost Zone`
          : `moved Ocean Jake to the Lost Zone${recoveredId ? `; it chose ${handResult.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit` : ""}`);
      } else if (card.id === "restocking") {
        const recoveredIds = next.discardPile.filter((cardId) => cardsById[cardId]?.category === CardCategory.FISH).slice(0, 3);
        const recoveredFoundationIds = recoveredIds.filter((cardId) => getPersonalDeckType(cardsById[cardId]) === "foundation");
        const recoveredPalsIds = recoveredIds.filter((cardId) => getPersonalDeckType(cardsById[cardId]) === "pals");
        next = { ...next, discardPile: recoveredIds.reduce((pile, cardId) => removeOneCard(pile, cardId), next.discardPile), foundationDeck: shuffle([...next.foundationDeck, ...recoveredFoundationIds]), palsDeck: shuffle([...next.palsDeck, ...recoveredPalsIds]) };
        details.push(`restocked ${recoveredIds.length} Fish`);
      } else if (card.id === "spearfishing") {
        const spearfishingTargets = [
          ...next.corals.flatMap((coral) => coral.slots.filter((slot) => cardCanBeSpearfished(cardsById[slot.cardId], slot, "opponent")).map((slot) => ({ location: "slot", coralId: coral.id, slotId: slot.id, cardId: slot.cardId, hostedCardIds: [...(slot.hostedCardIds ?? [])], owner: getReefCardOwner(slot, "opponent") }))),
          ...(next.orphanCreatures ?? []).flatMap((entry, orphanIndex) => cardCanBeSpearfished(cardsById[entry.cardId], entry, "opponent") ? [{ location: "orphan", orphanIndex, instanceId: entry.instanceId, cardId: entry.cardId, hostedCardIds: [...(entry.hostedCardIds ?? [])], owner: getReefCardOwner(entry, "opponent") }] : []),
          ...(next.reefCreatureInstances ?? []).flatMap((entry, reefIndex) => [CardCategory.FISH, CardCategory.PREDATOR].includes(cardsById[entry.cardId]?.category) ? [{ location: "reef", reefIndex, instanceId: entry.instanceId, cardId: entry.cardId, hostedCardIds: [], owner: "opponent" }] : []),
        ];
        const target = spearfishingTargets.find((candidate) => candidate.owner === "player") ?? spearfishingTargets[0];
        const targetId = target?.cardId;
        const recoveredRp = Number(cardsById[targetId]?.cost?.rp ?? 0);
        const removesPlayerInvader = target?.owner === "player";
        const currentRpCap = getEcosystemRpCap(next.corals, [...next.habitats, ...next.reefCreatureInstances.map((entry) => entry.cardId), ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
        const invaderRemoval = removesPlayerInvader ? resolveSpearfishingInvaderRemoval({
          foundations: next.corals,
          orphanEntries: next.orphanCreatures,
          target,
          invaderController: "player",
          eligibleCardIds: SPEARFISHING_FOREIGN_TARGET_CARD_IDS,
          supportCardId: null,
          actorDiscardPile: next.discardPile,
          invaderDiscardPile: discardPile,
          actorRp: next.rp,
          actorRpCap: currentRpCap,
          recoveredRp,
        }) : null;
        const nextCorals = removesPlayerInvader
          ? invaderRemoval.foundations
          : target?.location === "slot"
            ? next.corals.map((coral) => coral.id === target.coralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === target.slotId ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) } : coral)
          : next.corals;
        const nextOrphans = removesPlayerInvader
          ? invaderRemoval.orphanEntries
          : target?.location === "orphan"
            ? [...next.orphanCreatures.filter((entry) => entry.instanceId !== target.instanceId), ...(target.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`)))]
          : [...(next.orphanCreatures ?? []), ...(target?.location === "slot" && !removesPlayerInvader ? target.hostedCardIds : []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`)))];
        const nextReefInstances = target?.location === "reef" ? removeCreatureInstances(next.reefCreatureInstances, [target.instanceId]).instances : next.reefCreatureInstances;
        next = { ...next, corals: nextCorals, orphanCreatures: nextOrphans, reefCreatureInstances: nextReefInstances, reefCreatures: nextReefInstances.map((entry) => entry.cardId), discardPile: removesPlayerInvader ? invaderRemoval.actorDiscardPile : [targetId, ...next.discardPile], rp: removesPlayerInvader ? invaderRemoval.actorRp : addResourceWithinCap(next.rp, recoveredRp, getEcosystemRpCap(nextCorals, [...next.habitats, ...nextReefInstances.map((entry) => entry.cardId), ...(nextOrphans ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition)) };
        if (removesPlayerInvader && invaderRemoval.success) impacts.push({ type: "spearfishing-owner-discard", sourceCardId: card.id, actionName: card.name, cardId: targetId });
        details.push(`discarded ${cardsById[targetId]?.name}${removesPlayerInvader ? " to its owner's discard pile" : ""} and recovered ${recoveredRp} RP`);
      } else if (card.id === "whirlpool" || card.id === "super-whirlpool") {
        const amount = card.id === "super-whirlpool" ? 2 : 1;
        impacts.push({ sourceCardId: card.id, actionName: card.name, rpPenalty: amount });
        details.push(`made your first coral produce ${amount} less RP during its next collection`);
      } else if (card.id === "poison-heal") next = { ...next, poisonImmunityNextPredatorAttack: true };
      else if (card.id === "rov-lights") next = { ...next, rovLightsActive: true };
      const handLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
      const handLimitResult = applyAutomatedHandLimitToState(next, handLimit, { round });
      next = handLimitResult.state;
      if (handLimitResult.cardsToDiscard.length) details.push(`chose ${handLimitResult.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit`);
      summaries.push(`Opponent played ${card.name}${cost ? ` for ${cost} RP` : ""}${details.length ? ` and ${details.join(", ")}` : ""}.`);
      events.push({ type: "opponent-play", sourceCardId: card.id, title: revealedCardIds.length ? `Opponent played ${card.name} and revealed ${revealedCardIds.length === 1 ? cardsById[revealedCardIds[0]]?.name : `${revealedCardIds.length} cards`}` : `Opponent played ${card.name}`, message: `${card.name}${cost ? ` cost ${cost} RP` : " cost 0 RP"}.${details.length ? ` It ${details.join(", ")}.` : ""}${revealedCardIds.length ? " The searched card selection is revealed below." : ""}`, revealedCards: revealedCardIds, success: true, opponentStateAfter: reconcileOpponentInstances(opponentState, next) });
      if (lossSummary || supportExplicitlyLocksFurtherSupports(card)) break;
    }
    return { state: reconcileOpponentInstances(opponentState, next), summaries, impacts, events, lost: Boolean(lossSummary), lossSummary };
  }

  function runOpponentTurn(current) {
    const income = 1 + getEcosystemStartTurnRp(current.corals, activeCondition);
    let next = {
      ...current,
      cardsBlockedFromPlayThisTurn: [],
      creatureStatuses: Object.fromEntries(Object.entries(current.creatureStatuses ?? {}).map(([statusKey, statuses]) => [statusKey, statuses.filter((status) => Number(status.expiresTurn ?? Infinity) > turn)]).filter(([, statuses]) => statuses.length)),
      flashingAlarmAttackBonus: beginFlashingAlarmTurn(current.flashingAlarmAttackBonus),
    };
    const collectionCap = getEcosystemRpCap(next.corals, [...next.habitats, ...next.reefCreatures, ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
    const rpBeforeCollection = next.rp;
    const rpAfterCollection = addResourceWithinCap(rpBeforeCollection, income, collectionCap);
    const collectedIncome = Math.max(0, rpAfterCollection - Math.min(rpBeforeCollection, collectionCap));
    const cappedIncome = Math.max(0, rpBeforeCollection + income - rpAfterCollection);
    next = {
      ...next,
      corals: next.corals.map(({ rpPenaltyNextTurn, ...coral }) => coral),
      rp: rpAfterCollection,
    };
    const collectionSummary = `Opponent collected ${collectedIncome} RP from ${income} available; bank ${rpAfterCollection}/${collectionCap}.${cappedIncome ? ` ${cappedIncome} RP was discarded at the cap.` : ""}`;
    const requestedDraws = 1 + getConditionExtraDraws(activeCondition);
    const startOfTurnCollection = {
      collected: collectedIncome,
      available: income,
      bank: rpAfterCollection,
      cap: collectionCap,
      capped: cappedIncome,
      requestedDraws,
    };
    const openingThreatProfile = assessCurrentOpponentThreat(next);
    const preferredDeck = chooseOpponentPreferredDeck({
      difficulty: opponentDifficulty,
      round,
      coralCount: next.corals.length,
      emptySlotCount: next.corals.reduce((total, coral) => total + coral.slots.filter((slot) => !slot.cardId).length, 0),
      foundationCardsInHand: next.hand.filter((cardId) => isFoundationCard(cardsById[cardId])).length,
      creaturesInHand: next.hand.filter((cardId) => cardsById[cardId]?.kind === CardKind.CREATURE && !isCreatureSchool(cardsById[cardId])).length,
      threatLevel: openingThreatProfile.level,
    });
    if (!next.foundationDeck.length && !next.palsDeck.length) {
      const summary = `${collectionSummary} Opponent could not draw because both personal decks were empty and loses by deck depletion.`;
      return { state: next, startOfTurnState: reconcileOpponentInstances(current, next), startOfTurnSummary: summary, startOfTurnDetails: { ...startOfTurnCollection, drawn: 0, foundationDrawn: 0, palsDrawn: 0, drawShortfall: requestedDraws, handLimitDiscarded: 0 }, lost: true, summary };
    }
    const drawnFrom = [];
    for (let index = 0; index < requestedDraws; index += 1) {
      const firstChoice = index % 2 === 0 ? preferredDeck : preferredDeck === "palsDeck" ? "foundationDeck" : "palsDeck";
      const deckKey = next[firstChoice].length ? firstChoice : firstChoice === "palsDeck" ? "foundationDeck" : "palsDeck";
      if (!next[deckKey].length) break;
      const cardId = next[deckKey][0];
      drawnFrom.push(deckKey === "palsDeck" ? "Pals" : "Foundation");
      next = { ...next, [deckKey]: next[deckKey].slice(1), hand: [...next.hand, cardId] };
    }
    const drawSummary = drawnFrom.reduce((counts, deckName) => ({ ...counts, [deckName]: (counts[deckName] ?? 0) + 1 }), {});
    const drawSummaryText = Object.entries(drawSummary).map(([deckName, count]) => `${count} from ${deckName}`).join(" and ");
    if (getRequiredDrawShortfall(requestedDraws, drawnFrom.length) > 0) {
      const summary = `Opponent was required to draw ${requestedDraws} cards, but its personal decks contained only ${drawnFrom.length}. The opponent loses by deck depletion.`;
      return {
        state: reconcileOpponentInstances(current, next),
        startOfTurnState: reconcileOpponentInstances(current, next),
        startOfTurnSummary: `${collectionSummary}${drawSummaryText ? ` Opponent drew ${drawSummaryText}.` : ""} ${summary}`,
        startOfTurnDetails: { ...startOfTurnCollection, drawn: drawnFrom.length, foundationDrawn: Number(drawSummary.Foundation ?? 0), palsDrawn: Number(drawSummary.Pals ?? 0), drawShortfall: Math.max(0, requestedDraws - drawnFrom.length), handLimitDiscarded: 0 },
        lost: true,
        summary: `${collectionSummary} ${summary}`,
      };
    }
    const handLimitEffect = (activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit");
    const opponentHandLimit = Number(handLimitEffect?.amount ?? Infinity);
    const opponentHandLimitResult = applyAutomatedHandLimitToState(next, opponentHandLimit, { round });
    const excessHandCards = opponentHandLimitResult.cardsToDiscard;
    next = opponentHandLimitResult.state;
    let handLimitSummary = excessHandCards.length ? ` The opponent chose ${excessHandCards.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : "";
    const startOfTurnState = reconcileOpponentInstances(current, next);
    const startOfTurnSummary = `${collectionSummary} Opponent drew ${drawSummaryText || "no cards"}.${handLimitSummary}`;
    const startOfTurnDetails = { ...startOfTurnCollection, drawn: drawnFrom.length, foundationDrawn: Number(drawSummary.Foundation ?? 0), palsDrawn: Number(drawSummary.Pals ?? 0), drawShortfall: 0, handLimitDiscarded: excessHandCards.length };
    const supportResult = runOpponentSupports(next);
    next = supportResult.state;
    const supportSummary = supportResult.summaries.length ? ` ${supportResult.summaries.join(" ")}` : "";
    if (supportResult.lost) {
      return {
        state: next,
        startOfTurnState,
        startOfTurnSummary,
        startOfTurnDetails,
        supportImpacts: supportResult.impacts,
        supportPlays: supportResult.events,
        lost: true,
        summary: `${collectionSummary} Opponent drew ${drawSummaryText}.${supportSummary} ${supportResult.lossSummary}`,
      };
    }

    const findUpgradeTarget = (card) => next.corals.find((coral) => {
      const currentCard = cardsById[coral.cardId];
      return currentCard?.upgrade?.canUpgrade && currentCard.upgrade.nextCardId === card.id && !coralIsStunned(coral) && turn > Number(coral.stageEnteredTurn ?? coral.playedTurn ?? turn);
    });
    const getOpponentPlayCost = (card) => {
      const upgradeTarget = isFoundationCard(card) && Number(card.stage ?? 0) > 0 ? findUpgradeTarget(card) : null;
      const baseCost = upgradeTarget ? Number(cardsById[upgradeTarget.cardId]?.upgrade?.cost?.rp ?? card.cost?.rp ?? 0) : getCardPlayCost(card, activeCondition);
      return Math.max(0, baseCost + getOpposingPlayCostModifier(card, playerCorals, playerReefCreatures, playerOrphanCreatures));
    };
    const getOpponentSchoolDensityState = (opponentState) => {
      const committed = getEcosystemSchoolDensityCommitted({
        foundations: opponentState.corals,
        invasiveFoundations: playerCorals,
        reefCreatureInstances: opponentState.reefCreatureInstances,
        orphanCreatureInstances: opponentState.orphanCreatures,
        invasiveOrphanCreatureInstances: playerOrphanCreatureInstances,
        commitmentsByInstanceId: opponentState.schoolDensityCommitmentsByInstanceId ?? {},
      }, cardsById, "opponent");
      return createSchoolDensityBucketState(opponentState.corals, committed, cardsById);
    };
    const getOpponentDensityFreedByRequiredSacrifices = (card, opponentState) => (
      getOceanicPlaySacrifices(
        card,
        opponentState.corals,
        opponentState.reefCreatures,
        opponentState.orphanCreatures,
      ).reduce((total, entry) => {
        const instanceId = entry.slotId
          ? getSlotCardInstanceId(
              opponentState.corals
                .find((foundation) => foundation.id === entry.coralId)
                ?.slots.find((slot) => slot.id === entry.slotId),
            )
          : entry.reefIndex >= 0
            ? opponentState.reefCreatureInstances?.[entry.reefIndex]?.instanceId
            : entry.orphanIndex >= 0
              ? opponentState.orphanCreatures?.[entry.orphanIndex]?.instanceId
              : null;
        return total + Number(
          opponentState.schoolDensityCommitmentsByInstanceId?.[instanceId]
          ?? cardsById[entry.cardId]?.schoolDensityRequirement
          ?? 0,
        );
      }, 0)
    );
    const opponentDensityBeforePlay = getOpponentSchoolDensityState(next);
    const playableCards = next.hand.filter((cardId) => {
      const card = cardsById[cardId];
      if (!card || cardIsBlockedFromPlayThisTurn(next, cardId) || getConditionPlayRestriction(card, activeCondition) || getOpponentPlayCost(card) > next.rp) return false;
      if (card.kind === CardKind.HABITAT) {
        if (getHabitatRequirementError(card, next.habitats)) return false;
        return !getCompositionRequirementError(card, next.corals, [...next.reefCreatures, ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])]);
      }
      if (isFoundationCard(card)) return Number(card.stage ?? 0) === 0 || Boolean(findUpgradeTarget(card));
      if (card.kind !== CardKind.CREATURE) return false;
      const densityRequirement = getEffectiveSchoolDensityRequirement(card, schoolDensityConditionIds, next.conditionDensityUses ?? {});
      const densityFreedBySacrifice = getOpponentDensityFreedByRequiredSacrifices(card, next);
      const densityAvailableForPlay = Math.max(
        0,
        opponentDensityBeforePlay.capacity
          - opponentDensityBeforePlay.committed
          + densityFreedBySacrifice,
      );
      if (densityRequirement.effectiveRequirement > densityAvailableForPlay) return false;
      if (getHabitatRequirementError(card, next.habitats)) return false;
      if (getCompositionRequirementError(card, next.corals, [...next.reefCreatures, ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])])) return false;
      if (cardUsesOpponentReef(card)) {
        return playerCoralCards.some((coral) => (coral.slots ?? []).some((slot) => !slot.cardId));
      }
      if (card.zone === CreatureZone.OCEAN) return true;
      const unmetHabitat = (card.playRequirements ?? []).some((requirement) =>
        requirement.requiredKind === CardKind.HABITAT &&
        (requirement.type === "cardInPlay" ? !next.habitats.includes(requirement.cardId) : !next.habitats.length),
      );
      if (unmetHabitat) return false;
      return next.corals.some((coral) => coral.slots.some((slot) => (
        (!slot.cardId && canCardOccupySlot(card, slot))
        || (slot.cardId && canHostSpecialPlacement(cardsById[slot.cardId], card, slot.hostedCardIds))
      )));
    });
    const opponentAttackHasLegalTarget = (attackerCard, attack) => {
      return opponentAttackHasVisibleTarget(attackerCard, attack, next);
    };
    const scoreOpponentPlay = (cardId) => {
      const card = cardsById[cardId];
      const cost = getOpponentPlayCost(card);
      const printedVp = Number(card?.victoryPoints?.value ?? card?.vp ?? 0);
      const income = getCardStartTurnRp(card);
      const actionable = (card?.actions ?? []).length + (card?.onPlay ?? []).length;
      if (isFoundationCard(card) && Number(card.stage ?? 0) > 0 && findUpgradeTarget(card)) return 120 + printedVp * 5 + income * 8 - cost;
      if (isFoundationCard(card) && Number(card.stage ?? 0) === 0) return (next.corals.length ? 35 : 100) + printedVp * 5 + income * 10 - cost;
      if (card.kind === CardKind.HABITAT) {
        const unlocksCards = next.hand.filter((candidateId) => getHabitatRequirementError(cardsById[candidateId], [...next.habitats, card.id]) === "" && getHabitatRequirementError(cardsById[candidateId], next.habitats)).length;
        return 30 + unlocksCards * 18 + printedVp * 5 - (next.habitats.includes(card.id) ? 20 : 0) - cost;
      }
      return 25 + printedVp * 7 + income * 8 + actionable * 6 - cost;
    };
    const threatProfile = assessCurrentOpponentThreat(next);
    const scoreHardOpponentPlay = (cardId) => {
      const card = cardsById[cardId];
      const printedVp = Number(card?.victoryPoints?.value ?? card?.victoryPoints ?? card?.vp ?? 0);
      const income = getCardStartTurnRp(card);
      const cost = getOpponentPlayCost(card);
      const reachesVictory = opponentVp + printedVp >= victoryTarget;
      const onPlayAttack = getOnPlayAttackEffect(card);
      const normalAttack = getBasicAttackEffect(card);
      const immediateAttack = onPlayAttack ?? normalAttack;
      const createsAttack = Boolean(immediateAttack);
      const canAffordAttackAfterPlay = Boolean(onPlayAttack)
        || cost + Number(normalAttack?.actionCost ?? 0) <= next.rp;
      const hasPlayerTarget = canAffordAttackAfterPlay
        && opponentAttackHasLegalTarget(card, immediateAttack);
      return scoreHardOpponentPermanentPlay({
        baseScore: scoreOpponentPlay(cardId),
        threatLevel: threatProfile.level,
        printedVp,
        income,
        cost,
        hasLegalAttack: createsAttack && hasPlayerTarget,
        hasAttack: createsAttack,
        isFoundation: isFoundationCard(card),
        isUpgrade: isFoundationCard(card) && Number(card.stage ?? 0) > 0,
        reachesVictory,
      });
    };
    const preferredPlayableCards = preferOpponentPlaysWithResolvableOnPlayAttacks(playableCards, {
      hasOnPlayAttack: (cardId) => Boolean(getOnPlayAttackEffect(cardsById[cardId])),
      hasLegalTarget: (cardId) => {
        const candidate = cardsById[cardId];
        return opponentAttackHasLegalTarget(candidate, getOnPlayAttackEffect(candidate));
      },
      reachesVictory: (cardId) => opponentVp + Number(cardsById[cardId]?.victoryPoints?.value ?? cardsById[cardId]?.victoryPoints ?? cardsById[cardId]?.vp ?? 0) >= victoryTarget,
    });
    const playable = selectOpponentChoice(preferredPlayableCards, opponentDifficulty, {
      mediumScore: scoreOpponentPlay,
      hardScore: scoreHardOpponentPlay,
    });

    if (!playable) {
      return {
        state: next,
        startOfTurnState,
        startOfTurnSummary,
        startOfTurnDetails,
        supportImpacts: supportResult.impacts,
        supportPlays: supportResult.events,
        summary: `${collectionSummary} Opponent drew ${drawSummaryText}.${supportSummary} It then passed with no legal affordable permanent card.${handLimitSummary}`,
      };
    }

    const card = cardsById[playable];
    const cost = getOpponentPlayCost(card);
    const densityRequirementAtPlay = card.kind === CardKind.CREATURE
      ? getEffectiveSchoolDensityRequirement(card, schoolDensityConditionIds, next.conditionDensityUses ?? {}).effectiveRequirement
      : 0;
    next = { ...next, hand: removeOneCard(next.hand, playable), rp: next.rp - cost };
    let playedCreatureLocation = null;
    let invasivePlacement = null;
    let sacrificeSummary = "";
    let symbiosisSummary = "";
    let placementSummary = "";
    let densityDiscountSummary = "";
    if (card.kind === CardKind.HABITAT) {
      next = { ...next, habitats: [...next.habitats, card.id] };
    } else if (isFoundationCard(card)) {
      const upgradeTarget = Number(card.stage ?? 0) > 0 ? findUpgradeTarget(card) : null;
      if (upgradeTarget) {
        next = { ...next, corals: next.corals.map((coral) => {
          if (coral.id !== upgradeTarget.id) return coral;
          const nextMaxHealth = Number(card.health ?? coral.maxHealth);
          return {
            ...coral,
            cardId: card.id,
            maxHealth: nextMaxHealth,
            health: preserveDamageOnUpgrade(coral.health, coral.maxHealth, nextMaxHealth),
            slots: mergeUpgradedCoralSlots(coral.slots, card, coral.id),
            stageEnteredTurn: turn,
          };
        }) };
      } else {
        const coralId = createCoralId(`opponent-${card.id}`);
        next = {
          ...next,
          corals: [...next.corals, {
            id: coralId,
            cardId: card.id,
            health: Number(card.health ?? 0),
            maxHealth: Number(card.health ?? 0),
            slots: createCoralSlots(card, coralId),
            playedTurn: turn,
            stageEnteredTurn: turn,
          }],
        };
      }
    } else if (cardUsesOpponentReef(card)) {
      const targetCoral = playerCoralCards.find((coral) => (coral.slots ?? []).some((slot) => !slot.cardId));
      const targetSlot = targetCoral?.slots.find((slot) => !slot.cardId);
      if (targetCoral && targetSlot) {
        invasivePlacement = {
          coralId: targetCoral.id,
          slotId: targetSlot.id,
          cardId: card.id,
          cardInstanceId: createStableInstanceId(`opponent-invader-${card.id}`),
          controller: "opponent",
        };
        playedCreatureLocation = { coralId: targetCoral.id, slotId: targetSlot.id, instanceId: invasivePlacement.cardInstanceId, invasive: true };
        placementSummary = ` ${card.name} invaded an empty slot on your ${cardsById[targetCoral.cardId]?.name}; it remains the opponent's creature and you may remove it with Spearfishing or a legal attack.`;
      }
    } else if (card.zone === CreatureZone.OCEAN) {
      const sacrifices = getOceanicPlaySacrifices(card, next.corals, next.reefCreatures, next.orphanCreatures);
      const sacrificedSlotIds = new Set(sacrifices.filter((entry) => entry.slotId).map((entry) => entry.slotId));
      const sacrificedReefIndexes = new Set(sacrifices.filter((entry) => entry.reefIndex >= 0).map((entry) => entry.reefIndex));
      const sacrificedOrphanIndexes = new Set(sacrifices.filter((entry) => entry.orphanIndex >= 0).map((entry) => entry.orphanIndex));
      const freedHostedCards = [...next.corals.flatMap((coral) => coral.slots.filter((slot) => sacrificedSlotIds.has(slot.id)).flatMap((slot) => slot.hostedCardIds ?? [])), ...(next.orphanCreatures ?? []).filter((_, index) => sacrificedOrphanIndexes.has(index)).flatMap((entry) => entry.hostedCardIds ?? [])];
      const sacrificedReefInstanceIds = [...sacrificedReefIndexes].map((index) => next.reefCreatureInstances?.[index]?.instanceId).filter(Boolean);
      const sacrificedOrphanInstanceIds = [...sacrificedOrphanIndexes].map((index) => next.orphanCreatures?.[index]?.instanceId).filter(Boolean);
      const remainingReefInstances = removeCreatureInstances(next.reefCreatureInstances ?? [], sacrificedReefInstanceIds).instances;
      const territorialTarget = card.id === "ocean-triggerfish" ? next.corals.find((foundation) => isCreatureSchool(cardsById[foundation.cardId])) : null;
      const playedInstance = createCreatureInstance(card.id, createStableInstanceId(`opponent-reef-${card.id}`), {
        territorialTargetFoundationId: territorialTarget?.id ?? null,
        schoolDensityRequirementAtPlay: densityRequirementAtPlay,
      });
      const nextReefInstances = [...remainingReefInstances, playedInstance];
      next = {
        ...next,
        corals: sacrificedSlotIds.size ? next.corals.map((coral) => ({ ...coral, slots: coral.slots.map((slot) => sacrificedSlotIds.has(slot.id) ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) })) : next.corals,
        reefCreatures: nextReefInstances.map((entry) => entry.cardId),
        reefCreatureInstances: nextReefInstances,
        orphanCreatures: [...(next.orphanCreatures ?? []).filter((entry) => !sacrificedOrphanInstanceIds.includes(entry.instanceId)), ...freedHostedCards.map((hostedCardId) => createCreatureInstance(hostedCardId, createStableInstanceId(`opponent-orphan-${hostedCardId}`)))],
        discardPile: sacrifices.length ? [...sacrifices.map((entry) => entry.cardId), ...next.discardPile] : next.discardPile,
      };
      if (sacrifices.length) sacrificeSummary = ` As its additional play cost, ${sacrifices.map((entry) => entry.card.name).join(" and ")} ${sacrifices.length === 1 ? "was" : "were"} discarded.`;
      if (territorialTarget) sacrificeSummary += ` Territorial gives ${cardsById[territorialTarget.cardId]?.name} +30 HP while Ocean Triggerfish remains in play.`;
      playedCreatureLocation = { reefIndex: next.reefCreatures.length - 1, instanceId: playedInstance.instanceId };
    } else {
      const specialHostTarget = next.corals.flatMap((coral) => coral.slots.map((slot) => ({ coral, slot })))
        .find(({ slot }) => slot.cardId && canHostSpecialPlacement(cardsById[slot.cardId], card, slot.hostedCardIds));
      if (specialHostTarget) {
        const previousHostedCardIds = specialHostTarget.slot.hostedCardIds ?? [];
        const nextHostedCardIds = placeCardInSpecialHost(cardsById[specialHostTarget.slot.cardId], card, previousHostedCardIds, card.id);
        const hostedIndex = nextHostedCardIds?.findIndex((cardId, index) => cardId === card.id && previousHostedCardIds[index] !== cardId) ?? -1;
        const hostedSchoolDensityRequirements = [...(specialHostTarget.slot.hostedSchoolDensityRequirements ?? [])];
        if (hostedIndex >= 0) hostedSchoolDensityRequirements[hostedIndex] = densityRequirementAtPlay;
        next = {
          ...next,
          corals: next.corals.map((coral) => coral.id === specialHostTarget.coral.id ? {
            ...coral,
            slots: coral.slots.map((slot) => slot.id === specialHostTarget.slot.id ? { ...slot, hostedCardIds: nextHostedCardIds, hostedSchoolDensityRequirements } : slot),
          } : coral),
        };
        playedCreatureLocation = { coralId: specialHostTarget.coral.id, slotId: specialHostTarget.slot.id, hostedIndex };
        placementSummary = ` ${card.name} occupied an available space inside ${cardsById[specialHostTarget.slot.cardId]?.name}.`;
      } else {
        let placed = false;
        next = {
          ...next,
          corals: next.corals.map((coral) => ({
            ...coral,
            slots: coral.slots.map((slot) => {
              if (!placed && !slot.cardId && canCardOccupySlot(card, slot)) {
                placed = true;
                const cardInstanceId = createStableInstanceId(`opponent-slot-${card.id}`);
                playedCreatureLocation = { coralId: coral.id, slotId: slot.id, instanceId: cardInstanceId };
                return { ...slot, cardId: card.id, cardInstanceId };
              }
              return slot;
            }),
          })),
        };
      }
    }
    if (card.kind === CardKind.CREATURE && playedCreatureLocation) {
      const discountResult = consumeSchoolDensityConditionDiscount(card, schoolDensityConditionIds, next.conditionDensityUses ?? {});
      next = {
        ...next,
        conditionDensityUses: discountResult.usedByCondition,
        schoolDensityCommitmentsByInstanceId: playedCreatureLocation.instanceId
          ? {
              ...(next.schoolDensityCommitmentsByInstanceId ?? {}),
              [playedCreatureLocation.instanceId]: densityRequirementAtPlay,
            }
          : next.schoolDensityCommitmentsByInstanceId ?? {},
      };
      if (discountResult.discount) densityDiscountSummary = ` ${discountResult.discount.label} reduced its School Density requirement by ${discountResult.discount.amount}; the opponent's one-time reduction is now used.`;
    }
    if (isFoundationCard(card) && (next.orphanCreatures ?? []).length) {
      const redistributed = redistributeOrphanCreatures(next.corals, next.orphanCreatures);
      const placedCount = next.orphanCreatures.length - redistributed.orphans.length;
      next = { ...next, corals: redistributed.corals, orphanCreatures: redistributed.orphans };
      if (placedCount) sacrificeSummary += ` ${placedCount} orphaned creature group(s) automatically occupied compatible slots.`;
    }
    if (cardHasSymbiosis(card) && playedCreatureLocation?.slotId) {
      const clownfishId = next.hand.find((cardId) => cardsById[cardId]?.tags?.includes("clownfish"));
      const hostSlot = next.corals.find((coral) => coral.id === playedCreatureLocation.coralId)?.slots.find((slot) => slot.id === playedCreatureLocation.slotId && slot.cardId === card.id);
      const nextHostedCardIds = clownfishId && hostSlot
        ? placeCardInSpecialHost(card, cardsById[clownfishId], hostSlot.hostedCardIds, clownfishId)
        : null;
      if (clownfishId && nextHostedCardIds) {
        next = { ...next, hand: removeOneCard(next.hand, clownfishId), corals: next.corals.map((coral) => coral.id === playedCreatureLocation.coralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === playedCreatureLocation.slotId && slot.cardId === card.id ? { ...slot, hostedCardIds: nextHostedCardIds } : slot) } : coral) };
        symbiosisSummary = ` Symbiosis hosted ${cardsById[clownfishId]?.name} from the opponent's hand.`;
      } else symbiosisSummary = clownfishId ? " Symbiosis could not host a Clownfish because the Anemone no longer had space." : " Symbiosis found no Clownfish in the opponent's hand.";
    }
    let onPlayResourceSummary = "";
    const onPlayResourceGain = getResourceGainFromActions(card.onPlay, "rp");
    if (onPlayResourceGain) {
      const cap = getEcosystemRpCap(next.corals, [
        ...next.habitats,
        ...next.reefCreatures,
        ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
      ], activeCondition);
      const rpBeforeGain = next.rp;
      const rpAfterGain = addResourceWithinCap(rpBeforeGain, onPlayResourceGain, cap);
      const actualGain = rpAfterGain - rpBeforeGain;
      next = { ...next, rp: rpAfterGain };
      onPlayResourceSummary = ` Its On Play ability gained ${actualGain} RP${actualGain < onPlayResourceGain ? ` (limited by the ${cap} RP bank cap)` : ""}.`;
    }
    let onPlayHealSummary = "";
    const onPlayHeal = getOnPlayCoralHeal(card);
    if (onPlayHeal) {
      const healResult = healMostDamagedCoral(next.corals, onPlayHeal.amount, cardsById);
      next = { ...next, corals: healResult.foundations };
      const target = healResult.targetFoundationId
        ? next.corals.find((foundation) => foundation.id === healResult.targetFoundationId)
        : null;
      onPlayHealSummary = target
        ? ` ${onPlayHeal.actionName} restored ${healResult.appliedHealing} HP to ${cardsById[target.cardId]?.name}${onPlayHeal.roll != null ? ` after rolling ${onPlayHeal.roll}` : ""}.`
        : ` ${onPlayHeal.actionName} found no damaged Coral to heal.`;
    }
    let momentumSummary = "";
    if (cardHasSchoolMomentum(card)) {
      const momentumCardId = [...next.foundationDeck, ...next.palsDeck].find((cardId) => isCreatureSchool(cardsById[cardId]));
      if (momentumCardId) {
        next = { ...next, foundationDeck: shuffle(removeOneCard(next.foundationDeck, momentumCardId)), palsDeck: shuffle(removeOneCard(next.palsDeck, momentumCardId)), hand: [...next.hand, momentumCardId] };
        momentumSummary = ` Momentum found ${cardsById[momentumCardId]?.name} and added it to the opponent's hand.`;
      } else momentumSummary = " Momentum found no Creature School.";
    }
    let onPlayDrawSummary = "";
    let onPlayDrawLossSummary = "";
    const onPlayDrawCount = getOnPlayDrawCount(card);
    if (onPlayDrawCount) {
      const drawnIds = [];
      const drawnSources = [];
      for (let index = 0; index < onPlayDrawCount; index += 1) {
        const preferred = index % 2 === 0 ? "palsDeck" : "foundationDeck";
        const deckKey = next[preferred].length ? preferred : preferred === "palsDeck" ? "foundationDeck" : "palsDeck";
        if (!next[deckKey].length) break;
        drawnIds.push(next[deckKey][0]);
        drawnSources.push(deckKey === "palsDeck" ? "Pals" : "Foundation");
        next = { ...next, [deckKey]: next[deckKey].slice(1), hand: [...next.hand, next[deckKey][0]] };
      }
      const postDrawHandLimitResult = applyAutomatedHandLimitToState(next, opponentHandLimit, { round });
      const postDrawExcess = postDrawHandLimitResult.cardsToDiscard;
      next = postDrawHandLimitResult.state;
      const shortfall = getRequiredDrawShortfall(onPlayDrawCount, drawnIds.length);
      onPlayDrawSummary = ` ${getOnPlayAbilityName(card)} drew ${drawnIds.length} card(s)${drawnSources.length ? ` (${drawnSources.join(", ")})` : ""}.${postDrawExcess.length ? ` The opponent chose ${postDrawExcess.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : ""}`;
      if (shortfall) onPlayDrawLossSummary = ` The mandatory draw was ${shortfall} card${shortfall === 1 ? "" : "s"} short, so the opponent loses by deck depletion.`;
    }
    let onPlayReorderSummary = "";
    const onPlayReorder = getOnPlayReorder(card);
    if (onPlayReorder) {
      const deckKey = next.palsDeck.length ? "palsDeck" : next.foundationDeck.length ? "foundationDeck" : null;
      if (deckKey) {
        const amount = Math.max(1, Number(onPlayReorder.effect.amount ?? 3));
        const scoreCard = (cardId) => {
          const candidate = cardsById[cardId];
          return Number(candidate?.victoryPoints?.value ?? candidate?.victoryPoints ?? candidate?.vp ?? 0) * 10 + getCardStartTurnRp(candidate) * 8 + (candidate?.actions?.length ?? 0) * 3 - Number(candidate?.cost?.rp ?? 0);
        };
        const topCards = next[deckKey].slice(0, amount).sort((leftId, rightId) => scoreCard(rightId) - scoreCard(leftId));
        next = { ...next, [deckKey]: [...topCards, ...next[deckKey].slice(topCards.length)] };
        onPlayReorderSummary = ` ${onPlayReorder.actionName} reordered the top ${topCards.length} cards of the opponent's ${deckKey === "palsDeck" ? "Pals" : "Foundation"} deck.`;
      } else onPlayReorderSummary = ` ${onPlayReorder.actionName} found both personal decks empty.`;
    }
    let onPlaySearchSummary = "";
    let onPlayRevealedCardIds = [];
    const onPlaySearch = getOnPlayUtilitySearch(card);
    if (onPlaySearch) {
      const targetIds = [...next.palsDeck, ...next.foundationDeck].filter((cardId) => {
        const candidate = cardsById[cardId];
        if (!candidate || candidate.kind !== onPlaySearch.effect.targetKind) return false;
        if (onPlaySearch.effect.targetCategories?.length && !onPlaySearch.effect.targetCategories.includes(candidate.category)) return false;
        if (onPlaySearch.effect.targetZone && candidate.zone !== onPlaySearch.effect.targetZone) return false;
        if (onPlaySearch.effect.targetCardId && candidate.id !== onPlaySearch.effect.targetCardId) return false;
        return !onPlaySearch.effect.targetNameIncludes || candidate.name?.toLowerCase().includes(onPlaySearch.effect.targetNameIncludes.toLowerCase());
      }).slice(0, Math.max(1, Number(onPlaySearch.effect.amount ?? 1)));
      if (targetIds.length) {
        next = { ...next, palsDeck: shuffle(targetIds.reduce((deck, cardId) => removeOneCard(deck, cardId), next.palsDeck)), foundationDeck: shuffle(targetIds.reduce((deck, cardId) => removeOneCard(deck, cardId), next.foundationDeck)), hand: [...next.hand, ...targetIds] };
        onPlaySearchSummary = ` ${onPlaySearch.actionName} found ${targetIds.map((cardId) => cardsById[cardId]?.name).join(" and ")}, revealed them, and added them to the opponent's hand.`;
        onPlayRevealedCardIds = targetIds;
      } else onPlaySearchSummary = ` ${onPlaySearch.actionName} found no matching card.`;
    }
    if (Number.isFinite(opponentHandLimit) && next.hand.length > opponentHandLimit) {
      const searchHandLimitResult = applyAutomatedHandLimitToState(next, opponentHandLimit, { round });
      const excess = searchHandLimitResult.cardsToDiscard;
      next = searchHandLimitResult.state;
      handLimitSummary += ` The opponent chose ${excess.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.`;
    }
    let opponentOnPlayAttack = card.kind === CardKind.CREATURE ? getOnPlayAttackEffect(card) : null;
    let onPlayAttackBonusSummary = "";
    if (opponentOnPlayAttack && next.nextOnPlayAttackBonus) {
      const bonus = next.nextOnPlayAttackBonus;
      opponentOnPlayAttack = {
        ...opponentOnPlayAttack,
        flatBonus: Number(opponentOnPlayAttack.flatBonus ?? 0) + Number(bonus.amount ?? 0),
        flatBonusSource: cardsById[bonus.sourceCardId]?.name ?? "Highlight",
      };
      next = { ...next, nextOnPlayAttackBonus: null };
      onPlayAttackBonusSummary = ` ${cardsById[bonus.sourceCardId]?.name ?? "Highlight"} added +${Number(bonus.amount ?? 0)} to this On Play attack.`;
    }
    let ensnareSummary = "";
    const ensnare = getOnPlayEnsnare(card);
    if (opponentOnPlayAttack && ensnare) {
      opponentOnPlayAttack = { ...opponentOnPlayAttack, ensnare: { actionName: ensnare.actionName, penalty: ensnare.penalty } };
      ensnareSummary = " Ensnare will flip independently before each attack in this sequence.";
    }
    const firstPlaySummary = `Opponent played ${card.name} for ${cost} RP.${placementSummary}${densityDiscountSummary}${sacrificeSummary}${symbiosisSummary}${onPlayResourceSummary}${onPlayHealSummary}${momentumSummary}${onPlayDrawSummary}${onPlayDrawLossSummary}${onPlayReorderSummary}${onPlaySearchSummary}${onPlayAttackBonusSummary}${ensnareSummary}`;
    const permanentPlays = [{
      playedCardId: card.id,
      onPlayRevealedCardIds,
      playSummary: firstPlaySummary,
    }];

    // Players may spend RP on several permanent cards in one action phase.
    // Hard opponents do the same with straightforward follow-up plays after
    // their primary, fully-resolved play. Complex On Play effects remain the
    // primary play so their event sequence is never silently skipped.
    if (opponentDifficulty === OpponentDifficulty.HARD && !onPlayDrawLossSummary) {
      const getAttackRpReserve = (state) => {
        const attackEntries = [
          ...state.corals.flatMap((foundation) => foundation.slots.flatMap((slot) => [
            ...(slot.cardId && slot.invasiveOwner !== "player" ? [{ cardId: slot.cardId, locationKey: getSlotActionKey(slot) }] : []),
            ...(slot.hostedCardIds ?? []).flatMap((hostedCardId, hostedIndex) => hostedCardId ? [{ cardId: hostedCardId, locationKey: getHostedTargetSlotId(slot.id, hostedIndex) }] : []),
          ])),
          ...(state.reefCreatureInstances ?? []).map((instance, reefIndex) => ({ cardId: instance.cardId, locationKey: `reef-${instance.instanceId ?? reefIndex}` })),
          ...getLocallyControlledOrphans(state.orphanCreatures, "opponent").map((instance, orphanIndex) => ({ cardId: instance.cardId, locationKey: `orphan-${instance.instanceId ?? orphanIndex}` })),
        ];
        return attackEntries.reduce((total, entry) => {
          const attacker = cardsById[entry.cardId];
          const attack = getBasicAttackEffect(attacker);
          if (!attack || !opponentAttackHasVisibleTarget(attacker, attack, state)) return total;
          const actionKey = getOpponentActionUseKey(entry.locationKey, attack);
          if (wasOpponentActionUsedThisTurn(state.actionUses, actionKey, turn)) return total;
          if (turn < Number(state.actionCooldowns?.[entry.locationKey] ?? 0)) return total;
          return total + Number(attack.actionCost ?? 0);
        }, 0);
      };
      const isSafeFollowUp = (candidate) => (
        candidate
        && candidate.kind !== CardKind.SUPPORT
        && !(candidate.onPlay ?? []).length
        && !cardUsesOpponentReef(candidate)
        && candidate.zone !== CreatureZone.OCEAN
      );
      const safetyLimit = next.hand.length;
      for (let playIndex = 0; playIndex < safetyLimit; playIndex += 1) {
        const densityState = getOpponentSchoolDensityState(next);
        const reserveBeforePlay = threatProfile.level === OpponentThreatLevel.CRITICAL
          ? getAttackRpReserve(next)
          : 0;
        const candidates = next.hand.filter((candidateId) => {
          const candidate = cardsById[candidateId];
          if (!isSafeFollowUp(candidate) || cardIsBlockedFromPlayThisTurn(next, candidateId) || getConditionPlayRestriction(candidate, activeCondition)) return false;
          const candidateCost = getOpponentPlayCost(candidate);
          const candidateAttack = getBasicAttackEffect(candidate);
          const candidateAttackReserve = candidateAttack && opponentAttackHasVisibleTarget(candidate, candidateAttack, next)
            ? Number(candidateAttack.actionCost ?? 0)
            : 0;
          if (candidateCost + reserveBeforePlay + candidateAttackReserve > next.rp) return false;
          if (candidate.kind === CardKind.HABITAT) {
            return !getHabitatRequirementError(candidate, next.habitats)
              && !getCompositionRequirementError(candidate, next.corals, [...next.reefCreatures, ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])]);
          }
          if (isFoundationCard(candidate)) return Number(candidate.stage ?? 0) === 0 || Boolean(findUpgradeTarget(candidate));
          if (candidate.kind !== CardKind.CREATURE) return false;
          const densityRequirement = getEffectiveSchoolDensityRequirement(candidate, schoolDensityConditionIds, next.conditionDensityUses ?? {});
          if (densityRequirement.effectiveRequirement > densityState.available) return false;
          if (getHabitatRequirementError(candidate, next.habitats)) return false;
          if (getCompositionRequirementError(candidate, next.corals, [...next.reefCreatures, ...(next.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])])) return false;
          return next.corals.some((foundation) => foundation.slots.some((slot) => !slot.cardId && canCardOccupySlot(candidate, slot)));
        });
        const candidateId = selectOpponentChoice(candidates, opponentDifficulty, {
          mediumScore: scoreOpponentPlay,
          hardScore: scoreHardOpponentPlay,
        });
        if (!candidateId) break;
        const candidate = cardsById[candidateId];
        const candidateCost = getOpponentPlayCost(candidate);
        next = { ...next, hand: removeOneCard(next.hand, candidateId), rp: Math.max(0, next.rp - candidateCost) };
        let followUpPlacement = "";
        if (candidate.kind === CardKind.HABITAT) {
          next = { ...next, habitats: [...next.habitats, candidate.id] };
        } else if (isFoundationCard(candidate)) {
          const upgradeTarget = Number(candidate.stage ?? 0) > 0 ? findUpgradeTarget(candidate) : null;
          if (upgradeTarget) {
            next = {
              ...next,
              corals: next.corals.map((foundation) => {
                if (foundation.id !== upgradeTarget.id) return foundation;
                const nextMaxHealth = Number(candidate.health ?? foundation.maxHealth);
                return {
                  ...foundation,
                  cardId: candidate.id,
                  maxHealth: nextMaxHealth,
                  health: preserveDamageOnUpgrade(foundation.health, foundation.maxHealth, nextMaxHealth),
                  slots: mergeUpgradedCoralSlots(foundation.slots, candidate, foundation.id),
                  stageEnteredTurn: turn,
                };
              }),
            };
          } else {
            const foundationId = createCoralId(`opponent-${candidate.id}`);
            next = {
              ...next,
              corals: [...next.corals, {
                id: foundationId,
                cardId: candidate.id,
                health: Number(candidate.health ?? 0),
                maxHealth: Number(candidate.health ?? 0),
                slots: createCoralSlots(candidate, foundationId),
                playedTurn: turn,
                stageEnteredTurn: turn,
              }],
            };
          }
          if ((next.orphanCreatures ?? []).length) {
            const redistributed = redistributeOrphanCreatures(next.corals, next.orphanCreatures);
            next = { ...next, corals: redistributed.corals, orphanCreatures: redistributed.orphans };
          }
        } else {
          let placedCreature = null;
          next = {
            ...next,
            corals: next.corals.map((foundation) => ({
              ...foundation,
              slots: foundation.slots.map((slot) => {
                if (placedCreature || slot.cardId || !canCardOccupySlot(candidate, slot)) return slot;
                const cardInstanceId = createStableInstanceId(`opponent-slot-${candidate.id}`);
                placedCreature = { cardInstanceId };
                return { ...slot, cardId: candidate.id, cardInstanceId };
              }),
            })),
          };
          if (!placedCreature) break;
          const densityRequirement = getEffectiveSchoolDensityRequirement(candidate, schoolDensityConditionIds, next.conditionDensityUses ?? {}).effectiveRequirement;
          const discountResult = consumeSchoolDensityConditionDiscount(candidate, schoolDensityConditionIds, next.conditionDensityUses ?? {});
          next = {
            ...next,
            conditionDensityUses: discountResult.usedByCondition,
            schoolDensityCommitmentsByInstanceId: {
              ...(next.schoolDensityCommitmentsByInstanceId ?? {}),
              [placedCreature.cardInstanceId]: densityRequirement,
            },
          };
          followUpPlacement = discountResult.discount
            ? ` ${discountResult.discount.label} reduced its School Density requirement by ${discountResult.discount.amount}.`
            : "";
        }
        const followUpSummary = `Opponent also played ${candidate.name} for ${candidateCost} RP.${followUpPlacement}`;
        permanentPlays.push({
          playedCardId: candidate.id,
          onPlayRevealedCardIds: [],
          playSummary: followUpSummary,
        });
      }
    }
    const combinedPlaySummary = permanentPlays.map((play) => play.playSummary).join(" ");
    return {
      state: next,
      startOfTurnState,
      startOfTurnSummary,
      startOfTurnDetails,
      supportImpacts: supportResult.impacts,
      supportPlays: supportResult.events,
      lost: Boolean(onPlayDrawLossSummary),
      playedCardId: card.id,
      permanentPlays,
      onPlayRevealedCardIds,
      invasivePlacement,
      playSummary: combinedPlaySummary,
      foundationDamage: card.kind === CardKind.CREATURE ? getOnPlayFoundationDamage(card, [...next.habitats, ...next.corals.map((foundation) => foundation.cardId)]) : null,
      randomDiscard: card.kind === CardKind.CREATURE ? getOnPlayRandomDiscard(card) : null,
      deckDiscard: card.kind === CardKind.CREATURE ? getOnPlayOpponentDeckDiscard(card) : null,
      supportBlock: card.kind === CardKind.CREATURE ? getOnPlaySupportBlock(card) : null,
      onPlayAttack: card.kind === CardKind.CREATURE && playedCreatureLocation ? {
        cardId: card.id,
        ...playedCreatureLocation,
        attack: opponentOnPlayAttack,
      } : null,
      damageSourceName: card.name,
      damageSourceCardId: card.id,
      summary: `${collectionSummary} Opponent drew ${drawSummaryText}.${supportSummary} ${combinedPlaySummary}${handLimitSummary}`,
    };
  }

  function applyOpponentFoundationDamage(currentPlayerCorals, currentOrphans, damageEffect, sourceName, currentHand = hand, availableDiscard = discardPile, handLimit = Infinity) {
    const amount = Number(damageEffect?.amount ?? 0);
    if (!amount || !currentPlayerCorals.length) return null;
    const target = currentPlayerCorals.find((foundation) => damageEffect.targetType === "creature-school"
      ? isCreatureSchool(cardsById[foundation.cardId])
      : cardsById[foundation.cardId]?.kind === CardKind.CORAL);
    if (!target) return null;
    const result = applyDamage(target.health ?? target.maxHealth ?? cardsById[target.cardId]?.health, amount);
    if (!result.destroyed) {
      return {
        corals: currentPlayerCorals.map((coral) => coral.id === target.id ? { ...coral, health: result.remainingHealth } : coral),
        orphanCreatures: currentOrphans,
        discardedCardIds: [],
        summary: `Opponent's ${sourceName} dealt ${result.appliedDamage} damage to your ${cardsById[target.cardId]?.name}. ${result.remainingHealth}/${target.maxHealth} HP remains.`,
      };
    }
    const redistributed = redistributeOrphanCreatures(currentPlayerCorals.filter((coral) => coral.id !== target.id), [...currentOrphans, ...getOrphanEntriesFromFoundation(target)]);
    const triggerResult = resolveFoundationDestructionTriggers([[target]], currentHand, availableDiscard, Infinity);
    const fragmentTrigger = triggerResult.triggers[0];
    const fragmentSummary = fragmentTrigger
      ? fragmentTrigger.cardsToHand.length
        ? ` Fragment returned ${fragmentTrigger.cardsToHand.length} ${cardsById[fragmentTrigger.targetCardId]?.name ?? "matching card"}(s) to your hand.`
        : fragmentTrigger.cardsToDiscard.length
          ? " Fragment found its card, but your hand limit kept it in discard."
          : ` Fragment triggered but found no ${cardsById[fragmentTrigger.targetCardId]?.name ?? "matching card"}.`
      : "";
    return {
      corals: redistributed.corals,
      orphanCreatures: redistributed.orphans,
      discardedCardIds: [target.cardId],
      hand: triggerResult.hand,
      discardPile: triggerResult.discardPile,
      fragmentTriggers: triggerResult.triggers,
      summary: `Opponent's ${sourceName} dealt ${result.appliedDamage} damage and destroyed your ${cardsById[target.cardId]?.name}. Its creatures filled compatible slots; ${redistributed.orphans.length} remain orphaned on your reef.${fragmentSummary}`,
    };
  }

  function runOpponentUtilityAction(opponentState, currentPlayerState) {
    const currentPlayerFoundations = currentPlayerState?.corals ?? [];
    const handLimit = Number((activeCondition?.effects ?? []).find((candidate) => candidate.type === "setHandLimit")?.amount ?? Infinity);
    const entries = [
      ...opponentState.corals.flatMap((coral) => coral.slots.flatMap((slot) => slot.invasiveOwner === "player" ? [] : [
        ...(slot.cardId ? [{ card: cardsById[slot.cardId], locationKey: getSlotActionKey(slot), statusKey: getSlotActionKey(slot) }] : []),
        ...(slot.hostedCardIds ?? []).map((cardId, hostedIndex) => ({ card: cardsById[cardId], locationKey: getHostedTargetSlotId(slot.id, hostedIndex), statusKey: getHostedTargetSlotId(slot.id, hostedIndex) })),
      ])),
      ...(opponentState.reefCreatures ?? []).map((cardId, reefIndex) => ({ card: cardsById[cardId], locationKey: `reef-${opponentState.reefCreatureInstances?.[reefIndex]?.instanceId ?? reefIndex}`, statusKey: `reef-${opponentState.reefCreatureInstances?.[reefIndex]?.instanceId ?? reefIndex}` })),
      ...getLocallyControlledOrphans(opponentState.orphanCreatures, "opponent").flatMap((entry) => {
        const orphanIndex = (opponentState.orphanCreatures ?? []).findIndex((candidate) => candidate.instanceId === entry.instanceId);
        const orphanInstanceId = entry.instanceId ?? orphanIndex;
        return [
          { card: cardsById[entry.cardId], locationKey: `orphan-${orphanInstanceId}`, statusKey: `orphan-${orphanInstanceId}` },
          ...(entry.hostedCardIds ?? []).flatMap((cardId, hostedIndex) => cardId ? [{ card: cardsById[cardId], locationKey: getOrphanHostedTargetSlotId(orphanInstanceId, hostedIndex), statusKey: getOrphanHostedTargetSlotId(orphanInstanceId, hostedIndex) }] : []),
        ];
      }),
    ];
    const scoreCard = (cardId) => {
      const card = cardsById[cardId];
      return Number(card?.victoryPoints?.value ?? card?.victoryPoints ?? card?.vp ?? 0) * 10
        + getCardStartTurnRp(card) * 8
        + (card?.actions?.length ?? 0) * 3
        - Number(card?.cost?.rp ?? 0);
    };
    const commitAction = (state, actionKey, cost, oncePerTurn) => ({
      ...state,
      rp: Math.max(0, Number(state.rp ?? 0) - cost),
      actionUses: oncePerTurn
        ? markOpponentActionUsed(state.actionUses, actionKey, turn)
        : state.actionUses,
    });
    const applyPlayerCoralEffect = (effect, target, sourceCardId) => {
      if (!target || !effect) return { state: currentPlayerState, summary: "had no legal coral target", success: false };
      const targetCard = cardsById[target.cardId];
      if (effect.type === EffectType.STUN_CORAL) {
        return {
          state: {
            ...currentPlayerState,
            corals: currentPlayerFoundations.map((foundation) => foundation.id === target.id
              ? { ...foundation, statuses: [...(foundation.statuses ?? []).filter((status) => status.type !== "stunned"), createStunnedStatus(sourceCardId)] }
              : foundation),
          },
          summary: `Stunned your ${targetCard?.name}; it produces no RP, cannot use its own actions or passives, and cannot be upgraded through the end of your next turn (Coral Heal can clear it early)`,
          success: true,
        };
      }
      if (effect.type === EffectType.MODIFY_RP_GENERATION || effect.type === "modifyRpGeneration") {
        const penalty = Math.abs(Number(effect.amount ?? 0));
        return {
          state: {
            ...currentPlayerState,
            corals: currentPlayerFoundations.map((foundation) => foundation.id === target.id
              ? { ...foundation, rpPenaltyNextTurn: Number(foundation.rpPenaltyNextTurn ?? 0) + penalty }
              : foundation),
          },
          summary: `made your ${targetCard?.name} produce ${penalty} less RP during its next collection`,
          success: penalty > 0,
        };
      }
      if (effect.type === EffectType.DAMAGE) {
        const amount = Number(effect.amount?.value ?? effect.amount ?? 0);
        const damage = applyDamage(target.health ?? target.maxHealth, amount);
        if (!damage.destroyed) {
          return {
            state: {
              ...currentPlayerState,
              corals: currentPlayerFoundations.map((foundation) => foundation.id === target.id ? { ...foundation, health: damage.remainingHealth } : foundation),
            },
            summary: `dealt ${damage.appliedDamage} damage to your ${targetCard?.name}; ${damage.remainingHealth}/${target.maxHealth} HP remains`,
            success: damage.appliedDamage > 0,
          };
        }
        const redistributed = redistributeOrphanCreatures(
          currentPlayerFoundations.filter((foundation) => foundation.id !== target.id),
          [...(currentPlayerState.orphanCreatureInstances ?? []), ...getOrphanEntriesFromFoundation(target)],
        );
        const triggerResult = resolveFoundationDestructionTriggers(
          [[target]],
          currentPlayerState.hand ?? [],
          currentPlayerState.discardPile ?? [],
          Infinity,
        );
        const projected = projectNormalizedPlayerState({
          ...currentPlayerState,
          corals: redistributed.corals,
          orphanCreatureInstances: redistributed.orphans,
          hand: triggerResult.hand,
          discardPile: triggerResult.discardPile,
        });
        const fragmentSummary = triggerResult.triggers.map((trigger) => trigger.cardsToHand.length
          ? ` Fragment returned ${trigger.cardsToHand.length} ${cardsById[trigger.targetCardId]?.name ?? "matching card"} to your hand.`
          : trigger.cardsToDiscard.length
            ? " Fragment found its card, but the hand limit kept it in discard."
            : ` Fragment found no ${cardsById[trigger.targetCardId]?.name ?? "matching card"}.`).join("");
        return {
          state: projected.state,
          summary: `dealt ${damage.appliedDamage} damage and destroyed your ${targetCard?.name}; its creatures filled compatible slots or became orphans.${fragmentSummary}${getContinuousHealthCollapseMessage(projected.collateral) ? ` ${getContinuousHealthCollapseMessage(projected.collateral)}` : ""}`,
          success: true,
        };
      }
      return { state: currentPlayerState, summary: "has an effect that is not implemented", success: false };
    };
    for (const foundation of opponentState.corals) {
      const sourceCard = cardsById[foundation.cardId];
      if (coralIsStunned(foundation)) continue;
      for (const [passiveIndex, passive] of (sourceCard?.passives ?? []).entries()) {
        const heal = getPassiveCoralHeal(passive);
        if (heal) {
          const actionKey = getOpponentActionUseKey(`foundation-${foundation.id}`, passive, passiveIndex);
          if (wasOpponentActionUsedThisTurn(opponentState.actionUses, actionKey, turn)) continue;
          const target = opponentState.corals
            .filter((candidate) => cardsById[candidate.cardId]?.kind === CardKind.CORAL && Number(candidate.health ?? candidate.maxHealth) < Number(candidate.maxHealth ?? 0))
            .sort((left, right) => Number(left.health ?? 0) - Number(right.health ?? 0))[0];
          if (!target) continue;
          const healedHealth = Math.min(Number(target.maxHealth), Number(target.health ?? target.maxHealth) + heal.amount);
          const next = {
            ...opponentState,
            corals: opponentState.corals.map((candidate) => candidate.id === target.id ? { ...candidate, health: healedHealth } : candidate),
            actionUses: markOpponentActionUsed(opponentState.actionUses, actionKey, turn),
          };
          return { state: next, sourceCardId: sourceCard.id, defenderCardId: target.cardId, actionName: heal.actionName, success: true, summary: `Opponent's ${sourceCard.name} used ${heal.actionName} and healed ${cardsById[target.cardId]?.name} for ${healedHealth - Number(target.health ?? target.maxHealth)} HP.` };
        }
        const counterMove = getDamageCounterMove(passive);
        if (!counterMove || (foundation.statuses ?? []).length) continue;
        const actionKey = getOpponentActionUseKey(`foundation-${foundation.id}`, passive, passiveIndex);
        if (wasOpponentActionUsedThisTurn(opponentState.actionUses, actionKey, turn)) continue;
        const sources = opponentState.corals
          .filter((candidate) => Number(candidate.maxHealth ?? 0) - Number(candidate.health ?? candidate.maxHealth ?? 0) >= counterMove.counterHp)
          .sort((left, right) => Number(left.health ?? 0) - Number(right.health ?? 0));
        let resolution = null;
        let source = null;
        let destination = null;
        for (const candidateSource of sources) {
          const destinations = opponentState.corals
            .filter((candidate) => candidate.id !== candidateSource.id && Number(candidate.health ?? candidate.maxHealth ?? 0) - counterMove.counterHp > 0)
            .sort((left, right) => Number(right.health ?? 0) - Number(left.health ?? 0));
          for (const candidateDestination of destinations) {
            const attempt = moveFoundationDamageCounter(opponentState.corals, { sourceFoundationId: candidateSource.id, destinationFoundationId: candidateDestination.id, counterHp: counterMove.counterHp });
            if (!attempt.moved) continue;
            resolution = attempt;
            source = candidateSource;
            destination = candidateDestination;
            break;
          }
          if (resolution) break;
        }
        if (!resolution) continue;
        return {
          // Neural Network is repeatable for a player. The deterministic AI makes
          // one legal move per turn so it cannot oscillate damage counters forever.
          state: { ...opponentState, corals: resolution.foundations, actionUses: markOpponentActionUsed(opponentState.actionUses, actionKey, turn) },
          sourceCardId: sourceCard.id,
          defenderCardId: destination.cardId,
          actionName: counterMove.actionName,
          success: true,
          summary: `Opponent's ${sourceCard.name} used ${counterMove.actionName} to move one ${counterMove.counterHp} HP damage counter from ${cardsById[source.cardId]?.name} to ${cardsById[destination.cardId]?.name}.`,
        };
      }
    }
    for (const entry of entries) {
      for (const [actionIndex, action] of (entry.card?.actions ?? []).entries()) {
        const effect = getSupportedUtilityEffect(action);
        const cost = getActionCost(action);
        const actionKey = getOpponentActionUseKey(entry.locationKey, action, actionIndex);
        const oncePerTurn = actionIsOncePerTurn(action);
        if (!effect || cost > opponentState.rp || (oncePerTurn && wasOpponentActionUsedThisTurn(opponentState.actionUses, actionKey, turn))) continue;
        if (effect.type === EffectType.STUN_CORAL) {
          const target = currentPlayerFoundations.find((foundation) => cardsById[foundation.cardId]?.kind === CardKind.CORAL);
          if (!target) continue;
          const playerEffect = applyPlayerCoralEffect(effect, target, entry.card.id);
          return {
            state: commitAction(opponentState, actionKey, cost, oncePerTurn),
            playerState: playerEffect.state,
            sourceCardId: entry.card.id,
            defenderCardId: target.cardId,
            actionName: getActionName(action),
            success: playerEffect.success,
            summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP and ${playerEffect.summary}.`,
          };
        }
        if (effect.type === EffectType.FLIP_COIN) {
          const target = currentPlayerFoundations.find((foundation) => cardsById[foundation.cardId]?.kind === CardKind.CORAL);
          if (!target) continue;
          const coinResolution = resolveTargetedCoinFlip({
            candidateIds: [target.id],
            targetId: target.id,
            successResult: effect.successResult ?? "heads",
          });
          const committedState = commitAction(opponentState, actionKey, cost, oncePerTurn);
          if (!coinResolution.success) return { state: committedState, playerState: currentPlayerState, sourceCardId: entry.card.id, defenderCardId: target.cardId, actionName: getActionName(action), success: false, summary: `Opponent's ${entry.card.name} targeted your ${cardsById[target.cardId]?.name ?? "Coral"} with ${getActionName(action)} for ${cost} RP and flipped ${coinResolution.coinResult}, so it had no effect.` };
          const playerEffect = applyPlayerCoralEffect(effect.onSuccess, target, entry.card.id);
          return { state: committedState, playerState: playerEffect.state, sourceCardId: entry.card.id, defenderCardId: target.cardId, actionName: getActionName(action), success: playerEffect.success, summary: `Opponent's ${entry.card.name} targeted your ${cardsById[target.cardId]?.name ?? "Coral"} with ${getActionName(action)} for ${cost} RP, flipped ${coinResolution.coinResult}, and ${playerEffect.summary}.` };
        }
        if (effect.type === "grantNextOnPlayAttackBonus") {
          if (opponentState.nextOnPlayAttackBonus) continue;
          const next = commitAction({ ...opponentState, nextOnPlayAttackBonus: { amount: Number(effect.amount ?? 0), sourceCardId: entry.card.id, actionName: getActionName(action) } }, actionKey, cost, oncePerTurn);
          return { state: next, sourceCardId: entry.card.id, actionName: getActionName(action), success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP; its next On Play attack gets +${Number(effect.amount ?? 0)}.` };
        }
        if (effect.type === "reorderTopDeck") {
          const deckKey = opponentState.palsDeck.length > 1 ? "palsDeck" : opponentState.foundationDeck.length > 1 ? "foundationDeck" : null;
          if (!deckKey) continue;
          const amount = Math.max(1, Number(effect.amount ?? 3));
          const top = opponentState[deckKey].slice(0, amount).sort((leftId, rightId) => scoreCard(rightId) - scoreCard(leftId));
          const next = commitAction({ ...opponentState, [deckKey]: [...top, ...opponentState[deckKey].slice(top.length)] }, actionKey, cost, oncePerTurn);
          return { state: next, sourceCardId: entry.card.id, actionName: getActionName(action), success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP and reordered the top ${top.length} cards of its ${deckKey === "palsDeck" ? "Pals" : "Foundation"} deck.` };
        }
        if (effect.type === EffectType.DRAW_CARDS) {
          const amount = Math.max(0, Number(effect.amount ?? 0));
          if (!amount || (!opponentState.foundationDeck.length && !opponentState.palsDeck.length)) continue;
          let next = commitAction(opponentState, actionKey, cost, oncePerTurn);
          const drawn = [];
          for (let index = 0; index < amount; index += 1) {
            const preferred = index % 2 === 0 ? "palsDeck" : "foundationDeck";
            const deckKey = next[preferred].length ? preferred : preferred === "palsDeck" ? "foundationDeck" : "palsDeck";
            if (!next[deckKey].length) break;
            drawn.push({ cardId: next[deckKey][0], source: deckKey === "palsDeck" ? "Pals" : "Foundation" });
            next = { ...next, [deckKey]: next[deckKey].slice(1), hand: [...next.hand, next[deckKey][0]] };
          }
          const actionDrawHandLimitResult = applyAutomatedHandLimitToState(next, handLimit, { round });
          const excess = actionDrawHandLimitResult.cardsToDiscard;
          next = actionDrawHandLimitResult.state;
          const shortfall = getRequiredDrawShortfall(amount, drawn.length);
          return {
            state: next,
            sourceCardId: entry.card.id,
            actionName: getActionName(action),
            success: shortfall === 0,
            lost: shortfall > 0,
            summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP and drew ${drawn.length} card(s)${drawn.length ? ` (${drawn.map((card) => card.source).join(", ")})` : ""}.${excess.length ? ` The opponent chose ${excess.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : ""}${shortfall ? ` The mandatory draw was ${shortfall} card${shortfall === 1 ? "" : "s"} short, so the opponent loses by deck depletion.` : ""}`,
          };
        }
        if (effect.type === EffectType.SEARCH_DECK) {
          const targetId = [...opponentState.palsDeck, ...opponentState.foundationDeck].find((cardId) => {
            const candidate = cardsById[cardId];
            if (!candidate || candidate.kind !== effect.targetKind) return false;
            if (effect.targetCategories?.length && !effect.targetCategories.includes(candidate.category)) return false;
            if (effect.targetTags?.some((tag) => !candidate.tags?.includes(tag))) return false;
            if (effect.targetStages?.length && !effect.targetStages.map(Number).includes(Number(candidate.stage ?? 0))) return false;
            if (effect.requiredStage !== undefined && Number(candidate.stage ?? 0) !== Number(effect.requiredStage)) return false;
            if (effect.targetZone && candidate.zone !== effect.targetZone) return false;
            return !effect.targetNameIncludes || candidate.name?.toLowerCase().includes(effect.targetNameIncludes.toLowerCase());
          });
          if (!targetId) continue;
          const handResult = applyAutomatedHandLimitToState({
            ...opponentState,
            palsDeck: shuffle(removeOneCard(opponentState.palsDeck, targetId)),
            foundationDeck: shuffle(removeOneCard(opponentState.foundationDeck, targetId)),
          }, handLimit, { round }, [targetId]);
          const next = commitAction(handResult.state, actionKey, cost, oncePerTurn);
          return { state: next, sourceCardId: entry.card.id, actionName: getActionName(action), revealedCards: [targetId], success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP and found ${cardsById[targetId]?.name}.${handResult.cardsToDiscard.length ? ` It chose ${handResult.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : " It was revealed and added to the opponent's hand."}` };
        }
        if (effect.type === EffectType.RECOVER_CARD_FROM_DISCARD || effect.type === "recoverCardFromDiscard") {
          const targetId = opponentState.discardPile[0];
          if (!targetId) continue;
          const recoveredDeckType = getPersonalDeckType(cardsById[targetId]);
          const destination = effect.destination === "deck" ? `${recoveredDeckType === "foundation" ? "Foundation" : "Pals"} deck` : "hand";
          const recoveredPile = removeOneCard(opponentState.discardPile, targetId);
          const handResult = applyAutomatedHandLimitToState({ ...opponentState, discardPile: recoveredPile }, handLimit, { round }, [targetId]);
          const next = effect.destination === "deck"
            ? {
                ...opponentState,
                discardPile: removeOneCard(opponentState.discardPile, targetId),
                foundationDeck: recoveredDeckType === "foundation" ? shuffle([...opponentState.foundationDeck, targetId]) : opponentState.foundationDeck,
                palsDeck: recoveredDeckType === "pals" ? shuffle([...opponentState.palsDeck, targetId]) : opponentState.palsDeck,
              }
            : handResult.state;
          const committed = commitAction(next, actionKey, cost, oncePerTurn);
          return { state: committed, sourceCardId: entry.card.id, actionName: getActionName(action), success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP and moved ${cardsById[targetId]?.name} from its discard pile to its ${destination}.${effect.destination !== "deck" && handResult.cardsToDiscard.length ? ` It chose ${handResult.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : ""}` };
        }
        if (effect.type === "discardThenSearchDeck") {
          const discardCount = Math.max(0, Number(effect.discard?.amount ?? 0));
          const deckCards = [...opponentState.palsDeck, ...opponentState.foundationDeck];
          if (!discardCount || opponentState.hand.length < discardCount || !deckCards.length) continue;
          const discardedIds = [...opponentState.hand].sort((leftId, rightId) => scoreCard(leftId) - scoreCard(rightId)).slice(0, discardCount);
          const targetId = [...deckCards].sort((leftId, rightId) => scoreCard(rightId) - scoreCard(leftId))[0];
          let remainingHand = opponentState.hand;
          discardedIds.forEach((cardId) => { remainingHand = removeOneCard(remainingHand, cardId); });
          const handResult = applyAutomatedHandLimitToState({
            ...opponentState,
            hand: remainingHand,
            discardPile: [...discardedIds, ...opponentState.discardPile],
            palsDeck: shuffle(removeOneCard(opponentState.palsDeck, targetId)),
            foundationDeck: shuffle(removeOneCard(opponentState.foundationDeck, targetId)),
          }, handLimit, { round }, [targetId]);
          const next = commitAction(handResult.state, actionKey, cost, oncePerTurn);
          return { state: next, sourceCardId: entry.card.id, actionName: getActionName(action), revealedCards: [targetId], success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP, discarded ${discardedIds.map((cardId) => cardsById[cardId]?.name).join(" and ")}, and revealed ${cardsById[targetId]?.name}.${handResult.cardsToDiscard.length ? ` It then chose ${handResult.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : " It was added to the opponent's hand."}` };
        }
        if (effect.type === "discardThenDraw") {
          const minimum = Math.max(0, Number(effect.discard?.min ?? effect.discard?.amount ?? 0));
          const maximum = Math.max(minimum, Number(effect.discard?.max ?? minimum));
          const discardCount = Math.min(maximum, opponentState.hand.length, opponentState.palsDeck.length + opponentState.foundationDeck.length);
          if (!discardCount || discardCount < minimum) continue;
          const discardedIds = [...opponentState.hand].sort((leftId, rightId) => scoreCard(leftId) - scoreCard(rightId)).slice(0, discardCount);
          let remainingHand = opponentState.hand;
          discardedIds.forEach((cardId) => { remainingHand = removeOneCard(remainingHand, cardId); });
          let next = { ...opponentState, hand: remainingHand, discardPile: [...discardedIds, ...opponentState.discardPile] };
          const drawnIds = [];
          for (let index = 0; index < discardCount; index += 1) {
            const preferred = index % 2 === 0 ? "palsDeck" : "foundationDeck";
            const deckKey = next[preferred].length ? preferred : preferred === "palsDeck" ? "foundationDeck" : "palsDeck";
            if (!next[deckKey].length) break;
            const cardId = next[deckKey][0];
            drawnIds.push(cardId);
            next = { ...next, [deckKey]: next[deckKey].slice(1), hand: [...next.hand, cardId] };
          }
          const handResult = applyAutomatedHandLimitToState(next, handLimit, { round });
          next = commitAction(handResult.state, actionKey, cost, oncePerTurn);
          return { state: next, sourceCardId: entry.card.id, actionName: getActionName(action), success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP, discarded ${discardCount} card(s), and drew ${drawnIds.length}.${handResult.cardsToDiscard.length ? ` It chose ${handResult.cardsToDiscard.map((cardId) => cardsById[cardId]?.name ?? cardId).join(" and ")} to discard at the hand limit.` : ""}` };
        }
        if (effect.type === "modifyDefenseRoll" || effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE) {
          const categories = action?.target?.categories ?? [];
          const target = entries.find((candidate) => candidate.card && (!categories.length || categories.includes(candidate.card.category)));
          if (!target) continue;
          const status = effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE
            ? { type: "defenseAdvantage", expiresTurn: turn + 1, sourceCardId: entry.card.id }
            : { type: "defenseBonusDice", dice: effect.amount?.dice ?? "D4", expiresTurn: turn + 1, sourceCardId: entry.card.id };
          const nextStatuses = { ...(opponentState.creatureStatuses ?? {}), [target.statusKey]: [...(opponentState.creatureStatuses?.[target.statusKey] ?? []), status] };
          const next = commitAction({ ...opponentState, creatureStatuses: nextStatuses }, actionKey, cost, oncePerTurn);
          return { state: next, sourceCardId: entry.card.id, defenderCardId: target.card.id, actionName: getActionName(action), success: true, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} for ${cost} RP and gave ${target.card.name} ${status.type === "defenseAdvantage" ? "advantage on defense rolls" : `+${status.dice} to defense rolls`} until its next turn.` };
        }
        if (effect.type === "rollDiceForResource") {
          const roll = rollDie(effect.dice);
          if (!roll) continue;
          const success = (effect.successValues ?? []).includes(roll.total);
          const gained = success ? Number(effect.onSuccess?.amount ?? 0) : 0;
          const cap = getEcosystemRpCap(opponentState.corals, [...opponentState.habitats, ...opponentState.reefCreatures, ...(opponentState.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
          const committed = commitAction(opponentState, actionKey, cost, oncePerTurn);
          const next = { ...committed, rp: addResourceWithinCap(committed.rp, gained, cap) };
          return { state: next, sourceCardId: entry.card.id, actionName: getActionName(action), success, summary: `Opponent's ${entry.card.name} used ${getActionName(action)} and rolled ${roll.total} on ${effect.dice}.${success ? ` It gained ${gained} RP, up to its ${cap} RP cap.` : " It gained no RP."}` };
        }
      }
    }
    return null;
  }

  function runOpponentUtilityActions(opponentState, currentPlayerState) {
    let nextOpponent = opponentState;
    let nextPlayer = currentPlayerState;
    const actions = [];
    const creatureActionCount = [
      ...opponentState.corals.flatMap((coral) => coral.slots.flatMap((slot) => [slot.cardId, ...(slot.hostedCardIds ?? [])])),
      ...(opponentState.reefCreatures ?? []),
      ...getLocallyControlledOrphans(opponentState.orphanCreatures, "opponent").flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ].filter(Boolean).reduce((total, cardId) => total + (cardsById[cardId]?.actions?.length ?? 0), 0);
    const foundationActionCount = opponentState.corals.reduce((total, foundation) => total + (cardsById[foundation.cardId]?.passives ?? []).filter((passive) => getPassiveCoralHeal(passive) || getDamageCounterMove(passive)).length, 0);
    const availableActionCount = Math.max(1, creatureActionCount + foundationActionCount);
    const safetyLimit = limitOpponentOptionalActions(availableActionCount, opponentDifficulty, "utility");
    for (let index = 0; index < safetyLimit; index += 1) {
      const result = runOpponentUtilityAction(nextOpponent, nextPlayer);
      if (!result) break;
      nextOpponent = result.state;
      nextPlayer = result.playerState ?? nextPlayer;
      actions.push(result);
      if (result.lost) break;
    }
    return {
      state: nextOpponent,
      playerState: nextPlayer,
      actions,
      lost: actions.some((action) => action.lost),
      summary: actions.map((action) => action.summary).filter(Boolean).join(" "),
    };
  }

  function runOpponentAttackStep(opponentState, currentPlayerCorals, currentPlayerReefEntries, currentPlayerOrphans, onPlayAttack = null, excludedTargetInstanceIds = [], controllerState = {}) {
    const currentPlayerReefInstances = reconcileCreatureZone(currentPlayerReefEntries, currentPlayerReefEntries, "player-reef");
    const currentPlayerReefCreatures = currentPlayerReefInstances.map((instance) => instance.cardId);
    const controllerRp = Number(controllerState.rp ?? rp);
    const controllerCreatureStatuses = controllerState.creatureStatuses ?? creatureStatuses;
    const controllerResilienceUsedCardIds = controllerState.resilienceUsedCardIds ?? resilienceUsedCardIds;
    const actionCostAlreadyPaid = Boolean(controllerState.actionCostAlreadyPaid);
    const excludedTargets = new Set(excludedTargetInstanceIds);
    const attackerEntries = opponentState.corals.flatMap((coral) =>
      coral.slots.filter((slot) => {
        if (slot.invasiveOwner === "player") return false;
        const isTriggeredAttacker = onPlayAttack?.coralId === coral.id && onPlayAttack?.slotId === slot.id && onPlayAttack?.cardId === slot.cardId;
        const attack = isTriggeredAttacker ? onPlayAttack.attack : onPlayAttack ? null : getBasicAttackEffect(cardsById[slot.cardId]);
        const locationKey = getSlotActionKey(slot);
        const actionUseKey = attack ? getOpponentActionUseKey(locationKey, attack) : null;
        return attack
          && (actionCostAlreadyPaid || attack.actionCost <= opponentState.rp)
          && (onPlayAttack || turn >= Number(opponentState.actionCooldowns?.[locationKey] ?? 0))
          && (onPlayAttack || actionCostAlreadyPaid || !wasOpponentActionUsedThisTurn(opponentState.actionUses, actionUseKey, turn));
      }).map((slot) => ({
        coral,
        slot,
        locationKey: getSlotActionKey(slot),
        card: cardsById[slot.cardId],
        attack: onPlayAttack?.coralId === coral.id && onPlayAttack?.slotId === slot.id ? onPlayAttack.attack : getBasicAttackEffect(cardsById[slot.cardId]),
      })),
    );
    (opponentState.reefCreatures ?? []).forEach((cardId, reefIndex) => {
      const card = cardsById[cardId];
      const reefInstanceId = opponentState.reefCreatureInstances?.[reefIndex]?.instanceId;
      const isTriggeredAttacker = onPlayAttack?.cardId === cardId && (onPlayAttack?.reefInstanceId ? onPlayAttack.reefInstanceId === reefInstanceId : onPlayAttack?.reefIndex === reefIndex);
      const attack = isTriggeredAttacker ? onPlayAttack.attack : onPlayAttack ? null : getBasicAttackEffect(card);
      const stableSlotId = `reef-${reefInstanceId ?? reefIndex}`;
      const actionUseKey = attack ? getOpponentActionUseKey(stableSlotId, attack) : null;
      if (attack && (actionCostAlreadyPaid || attack.actionCost <= opponentState.rp) && (onPlayAttack || turn >= Number(opponentState.actionCooldowns?.[stableSlotId] ?? 0)) && (onPlayAttack || actionCostAlreadyPaid || !wasOpponentActionUsedThisTurn(opponentState.actionUses, actionUseKey, turn))) attackerEntries.push({ coral: null, slot: null, reefIndex, instanceId: reefInstanceId, locationKey: stableSlotId, card, attack });
    });
    (opponentState.orphanCreatures ?? []).forEach((entry, orphanIndex) => {
      if (!getLocallyControlledOrphans([entry], "opponent").length) return;
      const card = cardsById[entry.cardId];
      const isTriggeredAttacker = onPlayAttack?.cardId === entry.cardId && (onPlayAttack?.orphanInstanceId ? onPlayAttack.orphanInstanceId === entry.instanceId : onPlayAttack?.orphanIndex === orphanIndex);
      const attack = isTriggeredAttacker ? onPlayAttack.attack : onPlayAttack ? null : getBasicAttackEffect(card);
      const stableSlotId = `orphan-${entry.instanceId ?? orphanIndex}`;
      const actionUseKey = attack ? getOpponentActionUseKey(stableSlotId, attack) : null;
      if (attack && (actionCostAlreadyPaid || attack.actionCost <= opponentState.rp) && (onPlayAttack || turn >= Number(opponentState.actionCooldowns?.[stableSlotId] ?? 0)) && (onPlayAttack || actionCostAlreadyPaid || !wasOpponentActionUsedThisTurn(opponentState.actionUses, actionUseKey, turn))) attackerEntries.push({ coral: null, slot: null, reefIndex: -1, orphanIndex, instanceId: entry.instanceId, locationKey: stableSlotId, card, attack });
    });
    const collectAvailableTargets = (candidateAttacker) => {
      const targetEntries = currentPlayerCorals.flatMap((coral) => coral.slots.flatMap((slot) => slot.invasiveOwner === "opponent" ? [] : [{ cardId: slot.cardId, hostedIndex: -1, instanceId: getSlotTargetInstanceId(slot) }, ...(slot.hostedCardIds ?? []).map((cardId, hostedIndex) => ({ cardId, hostedIndex, instanceId: `hosted:${getHostedTargetSlotId(slot.id, hostedIndex)}` }))].filter((entry) => {
        const card = cardsById[entry.cardId];
        return cardMatchesAttackTarget(card, candidateAttacker.attack) && (!cardIsHiddenByAbyss(card, playerHabitats) || cardCanTargetHiddenByAbyss(candidateAttacker.card, candidateAttacker.attack));
      }).map((entry) => ({ coral, slot, hostedIndex: entry.hostedIndex, card: cardsById[entry.cardId], instanceId: entry.instanceId }))));
      (currentPlayerReefCreatures ?? []).forEach((cardId, reefIndex) => {
        const card = cardsById[cardId];
        if (cardMatchesAttackTarget(card, candidateAttacker.attack) && (!cardIsHiddenByAbyss(card, playerHabitats) || cardCanTargetHiddenByAbyss(candidateAttacker.card, candidateAttacker.attack))) targetEntries.push({ coral: null, slot: null, reefIndex, instanceId: currentPlayerReefInstances[reefIndex]?.instanceId, card });
      });
      (currentPlayerOrphans ?? []).forEach((entry, orphanIndex) => {
        if (entry.invasiveOwner === "opponent") return;
        const canTargetCard = (card) => cardMatchesAttackTarget(card, candidateAttacker.attack)
          && (!cardIsHiddenByAbyss(card, playerHabitats) || cardCanTargetHiddenByAbyss(candidateAttacker.card, candidateAttacker.attack));
        const card = cardsById[entry.cardId];
        if (canTargetCard(card)) targetEntries.push({ coral: null, slot: null, reefIndex: -1, orphanIndex, hostedIndex: -1, orphanInstanceId: entry.instanceId, instanceId: entry.instanceId, card });
        (entry.hostedCardIds ?? []).forEach((hostedCardId, hostedIndex) => {
          const hostedCard = cardsById[hostedCardId];
          if (!hostedCardId || !canTargetCard(hostedCard)) return;
          const hostedSlotId = getOrphanHostedTargetSlotId(entry.instanceId ?? `legacy-${orphanIndex}`, hostedIndex);
          targetEntries.push({
            coral: null,
            slot: null,
            reefIndex: -1,
            orphanIndex,
            hostedIndex,
            orphanInstanceId: entry.instanceId,
            hostCardId: entry.cardId,
            instanceId: `hosted:${hostedSlotId}`,
            card: hostedCard,
          });
        });
      });
      currentPlayerCorals.forEach((foundation) => {
        const card = cardsById[foundation.cardId];
        if (isCreatureSchool(card) && cardMatchesAttackTarget(card, candidateAttacker.attack)) targetEntries.push({ coral: foundation, slot: null, school: true, card, instanceId: `foundation:${foundation.id}` });
      });
      getInvasiveCreatureTargets(opponentState.corals, "player").forEach((target) => {
        const card = cardsById[target.cardId];
        if (!cardMatchesAttackTarget(card, candidateAttacker.attack)) return;
        const coral = opponentState.corals.find((foundation) => foundation.id === target.coralId);
        const slot = coral?.slots.find((candidate) => candidate.id === target.slotId);
        if (coral && slot) targetEntries.push({ coral, slot, card, instanceId: target.instanceId, onOpponentBoard: true });
      });
      getInvasiveOrphanTargets(opponentState.orphanCreatures, "player").forEach((target) => {
        const card = cardsById[target.cardId];
        if (!cardMatchesAttackTarget(card, candidateAttacker.attack)) return;
        targetEntries.push({
          coral: null,
          slot: null,
          card,
          instanceId: target.instanceId,
          onOpponentBoard: true,
          onOpponentOrphan: true,
          opponentOrphanIndex: target.orphanIndex,
        });
      });
      return targetEntries.filter((entry) => entry.instanceId && !excludedTargets.has(entry.instanceId));
    };
    const scoreAttacker = (entry) => {
      const diceSides = Number(String(entry.attack?.attackDice ?? "").match(/D(\d+)/i)?.[1] ?? 0);
      const repeatAttacks = Math.max(1, Number(entry.attack?.repeatAttacks ?? 1));
      const printedVp = Number(entry.card?.victoryPoints?.value ?? entry.card?.victoryPoints ?? entry.card?.vp ?? 0);
      return diceSides * repeatAttacks + printedVp * 2 - Number(entry.attack?.actionCost ?? 0);
    };
    const selectableAttackers = filterOpponentAttackersWithLegalTargets(
      attackerEntries,
      collectAvailableTargets,
      { preserveMandatoryAttack: Boolean(onPlayAttack) },
    );
    const attackerEntry = opponentDifficulty === OpponentDifficulty.HARD
      ? selectOpponentChoice(selectableAttackers, opponentDifficulty, { mediumScore: scoreAttacker, hardScore: scoreAttacker })
      : selectableAttackers[0];
    if (!attackerEntry) return null;
    const flashingAlarmBonus = getFlashingAlarmAttackBonus(opponentState.flashingAlarmAttackBonus);
    const opponentAttackActionKey = onPlayAttack ? null : getOpponentActionUseKey(attackerEntry.locationKey, attackerEntry.attack);
    const opponentCooldownKey = !onPlayAttack && attackerEntry.attack.skipNextTurn ? (attackerEntry.slot ? getSlotActionKey(attackerEntry.slot) : attackerEntry.orphanIndex >= 0 ? `orphan-${attackerEntry.instanceId ?? attackerEntry.orphanIndex}` : `reef-${attackerEntry.instanceId ?? attackerEntry.reefIndex}`) : null;
    const availableTargetEntries = collectAvailableTargets(attackerEntry);
    const attackThreatProfile = assessCurrentOpponentThreat(opponentState);
    const scoreTarget = (entry) => {
      const printedVp = Number(entry.card?.victoryPoints?.value ?? entry.card?.victoryPoints ?? entry.card?.vp ?? 0);
      const income = getCardStartTurnRp(entry.card);
      const defenseSides = Number(String(entry.card?.defense?.dice ?? entry.card?.defense ?? "").match(/D(\d+)/i)?.[1] ?? 0);
      const actionValue = Number(entry.card?.actions?.length ?? 0) * 5;
      const damagedSchoolValue = entry.school ? Math.max(0, Number(entry.coral?.maxHealth ?? 0) - Number(entry.coral?.health ?? entry.coral?.maxHealth ?? 0)) / 5 : 0;
      const schoolDensityCapacity = entry.school ? Number(entry.card?.schoolDensity ?? 0) : 0;
      const engineDisruption = schoolDensityCapacity * (
        attackThreatProfile.level === OpponentThreatLevel.CRITICAL
          ? 0.8
          : attackThreatProfile.level === OpponentThreatLevel.PRESSURE
            ? 0.45
            : 0.2
      );
      return printedVp * 15 + income * 10 + Number(entry.card?.cost?.rp ?? 0) * 2 + actionValue + (entry.school ? 18 : 0) + damagedSchoolValue + engineDisruption - defenseSides;
    };
    const targetEntry = opponentDifficulty === OpponentDifficulty.HARD
      ? selectOpponentChoice(availableTargetEntries, opponentDifficulty, { mediumScore: scoreTarget, hardScore: scoreTarget })
      : availableTargetEntries[0];
    if (!targetEntry) {
      if (!onPlayAttack) return null;
      const targetFamilies = formatAttackTargetFamilies(attackerEntry.attack);
      return {
        corals: currentPlayerCorals,
        reefCreatures: currentPlayerReefCreatures,
        discardedCardId: null,
        attackerCardId: attackerEntry.card.id,
        defenderCardId: null,
        attackerWins: false,
        actionCost: 0,
        noLegalTarget: true,
        summary: targetFamilies
          ? `${attackerEntry.attack.actionName} can only target ${targetFamilies}. None are currently in your ecosystem, so ${attackerEntry.card.name}'s On Play attack ended without a target.`
          : `Opponent's ${attackerEntry.card.name} used ${attackerEntry.attack.actionName}, but there was no legal target.`,
      };
    }
    const targetAvoidance = getTargetAvoidance(targetEntry.card);
    if (targetAvoidance) {
      const coinResult = Math.random() < 0.5 ? "heads" : "tails";
      if (coinResult === targetAvoidance.failureResult) {
        return {
          corals: currentPlayerCorals,
          reefCreatures: currentPlayerReefCreatures,
          discardedCardId: null,
          attackerCardId: attackerEntry.card.id,
          defenderCardId: targetEntry.card.id,
          targetInstanceId: targetEntry.instanceId,
          eventSourceCardId: targetEntry.card.id,
          attackerWins: false,
          defenderEvaded: true,
          actionCost: attackerEntry.attack.actionCost,
          opponentCooldownKey,
          opponentAttackActionKey,
          summary: `${targetEntry.card.name} used ${targetAvoidance.abilityName} and flipped ${coinResult}, so Opponent's ${attackerEntry.card.name}${onPlayAttack ? ` ${attackerEntry.attack.actionName}` : " attack"} failed before dice were rolled.`,
        };
      }
    }
    if (targetEntry.school) {
      const hasDisadvantage = attackerHasDisadvantageFromMassive(targetEntry.card);
      const hasAdvantage = cardHasAttackAdvantage(attackerEntry.card, targetEntry.card, opponentState.habitats, attackerEntry.attack);
      const useAdvantage = hasAdvantage && !hasDisadvantage;
      const useDisadvantage = hasDisadvantage && !hasAdvantage;
      const rolls = [0].map(() => {
        const first = rollDie(attackerEntry.attack.attackDice);
        const second = useAdvantage || useDisadvantage ? rollDie(attackerEntry.attack.attackDice) : null;
        const modifier = getAttackConditionalModifier(attackerEntry.card, { ...targetEntry.card, health: targetEntry.coral.health, maxHealth: targetEntry.coral.maxHealth }, opponentState.habitats, opponentState.corals, opponentState.reefCreatures, attackerEntry.attack, opponentState.orphanCreatures);
        const baseTotal = second ? (useAdvantage ? Math.max(first.total, second.total) : Math.min(first.total, second.total)) : first?.total;
        const rolledBonus = getRolledAttackBonus(attackerEntry.attack, baseTotal, opponentState.habitats);
        const rovLightsBonus = getRovLightsAttackBonus(opponentState.rovLightsActive, targetEntry.card);
        return first ? { total: baseTotal + modifier.flat + rolledBonus.flat + rovLightsBonus + flashingAlarmBonus, detail: `${second ? `${first.total}/${second.total} ${useAdvantage ? "advantage" : "disadvantage"}` : `${first.total}${hasAdvantage && hasDisadvantage ? " (advantage and disadvantage canceled)" : ""}`}${modifier.details.length || rolledBonus.detail || rovLightsBonus || flashingAlarmBonus ? ` [${[...modifier.details, rolledBonus.detail, rovLightsBonus ? "+2 ROV Lights" : null, flashingAlarmBonus ? `+${flashingAlarmBonus} Flashing Alarm` : null].filter(Boolean).join(", ")}]` : ""}` } : null;
      }).filter(Boolean);
      if (!rolls.length) return null;
      const result = applyDamage(targetEntry.coral.health ?? targetEntry.coral.maxHealth, rolls.reduce((total, roll) => total + roll.total * 10, 0));
      const redistributed = result.destroyed ? redistributeOrphanCreatures(currentPlayerCorals.filter((foundation) => foundation.id !== targetEntry.coral.id), [...currentPlayerOrphans, ...getOrphanEntriesFromFoundation(targetEntry.coral)]) : { corals: currentPlayerCorals.map((foundation) => foundation.id === targetEntry.coral.id ? { ...foundation, health: result.remainingHealth } : foundation), orphans: currentPlayerOrphans };
      return { corals: redistributed.corals, orphanCreatures: redistributed.orphans, reefCreatures: currentPlayerReefCreatures, reefCreatureInstances: currentPlayerReefInstances, discardedCardId: result.destroyed ? targetEntry.card.id : null, attackerCardId: attackerEntry.card.id, defenderCardId: targetEntry.card.id, targetInstanceId: targetEntry.instanceId, attackerWins: true, actionCost: attackerEntry.attack.actionCost, opponentCooldownKey, opponentAttackActionKey, summary: `Opponent's ${attackerEntry.card.name}${onPlayAttack ? ` used ${attackerEntry.attack.actionName} on` : " attacked"} ${targetEntry.card.name}, rolled ${rolls.map((roll) => roll.detail).join(", ")}, and dealt ${result.appliedDamage} damage.${result.destroyed ? ` Your Creature School was discarded; ${redistributed.orphans.length} creature group(s) remain orphaned after redistribution.` : ` ${result.remainingHealth}/${targetEntry.coral.maxHealth} HP remains.`}` };
    }
    const defenseDice = targetEntry.card.defense?.dice ?? targetEntry.card.defense;
    if (!defenseDice) return {
      corals: currentPlayerCorals,
      reefCreatures: currentPlayerReefCreatures,
      orphanCreatures: currentPlayerOrphans,
      opponentCorals: opponentState.corals,
      opponentReefCreatures: opponentState.reefCreatures,
      opponentOrphanCreatures: opponentState.orphanCreatures,
      attackerCardId: attackerEntry.card.id,
      defenderCardId: targetEntry.card.id,
      targetInstanceId: targetEntry.instanceId,
      eventSourceCardId: attackerEntry.card.id,
      actionCost: 0,
      noLegalTarget: true,
      resolutionUnsupported: true,
      summary: `Opponent's ${attackerEntry.card.name} could not resolve its attack against ${targetEntry.card.name} because that card has no defense die in the current data. No RP was spent and neither card moved.`,
    };
    const rolls = [];
    let attackerWins = false;
    const targetStatusKey = targetEntry.hostedIndex >= 0
      ? targetEntry.orphanIndex >= 0
        ? getOrphanHostedTargetSlotId(targetEntry.orphanInstanceId, targetEntry.hostedIndex)
        : getHostedTargetSlotId(targetEntry.slot?.id, targetEntry.hostedIndex)
      : targetEntry.slot ? getSlotActionKey(targetEntry.slot) : targetEntry.reefIndex >= 0 ? `reef-${targetEntry.instanceId ?? targetEntry.reefIndex}` : targetEntry.orphanIndex >= 0 ? `orphan-${targetEntry.instanceId ?? targetEntry.orphanIndex}` : null;
    const activeDefenseStatuses = controllerCreatureStatuses[targetStatusKey] ?? [];
    const attackAdvantage = cardHasAttackAdvantage(attackerEntry.card, targetEntry.card, opponentState.habitats, attackerEntry.attack);
    const defenseAdjustment = getDefenseAdjustment(attackerEntry.attack, targetEntry.card, opponentState.habitats);
    const attackDisadvantage = attackerHasDisadvantageFromMassive(targetEntry.card);
    const useAttackAdvantage = attackAdvantage && !attackDisadvantage;
    const useAttackDisadvantage = attackDisadvantage && !attackAdvantage;
    const defenseAdvantage = hasDefenseAdvantage({ targetCard: targetEntry.card, statuses: activeDefenseStatuses, ignoreDefensiveBonuses: defenseAdjustment.ignoresBonuses });
    const attachedDefenseBonus = !defenseAdjustment.ignoresBonuses && targetEntry.coral && !coralIsStunned(targetEntry.coral) ? calculateAttachedCreatureDefenseBonus(cardsById[targetEntry.coral.cardId]) : 0;
    const hostedDefenseBonusDice = !defenseAdjustment.ignoresBonuses && targetEntry.hostedIndex >= 0 ? getHostedDefenseBonusDice(cardsById[targetEntry.hostCardId ?? targetEntry.slot?.cardId], targetEntry.card) : null;
    const cloakDefenseBonus = !defenseAdjustment.ignoresBonuses ? getCloakDefenseBonus(targetEntry.card) : 0;
    const darknessShroudDefenseBonus = !defenseAdjustment.ignoresBonuses ? getDarknessShroudDefenseBonus(targetEntry.card, playerHabitats) : 0;
    const rovLightsBonus = getRovLightsAttackBonus(opponentState.rovLightsActive, targetEntry.card);
    for (let index = 0; index < 1 && !attackerWins; index += 1) {
      const result = resolveOpposedRoll(attackerEntry.attack.attackDice, defenseDice);
      if (!result.resolved) return null;
      const secondDefenseRoll = defenseAdvantage ? rollDie(defenseDice) : null;
      const chosenDefenseRoll = secondDefenseRoll ? Math.max(result.defense.total, secondDefenseRoll.total) : result.defense.total;
      let defenseTotal = Math.max(0, chosenDefenseRoll + defenseAdjustment.flat + cloakDefenseBonus + darknessShroudDefenseBonus + attachedDefenseBonus);
      const rollDetails = [];
      if (secondDefenseRoll) rollDetails.push(`Massive/defense advantage ${result.defense.total}/${secondDefenseRoll.total}`);
      if (cloakDefenseBonus) rollDetails.push(`+${cloakDefenseBonus} Cloak`);
      if (darknessShroudDefenseBonus) rollDetails.push(`+${darknessShroudDefenseBonus} Darkness Shroud`);
      if (attachedDefenseBonus) rollDetails.push(`+${attachedDefenseBonus} Shelter`);
      const hostedDefenseRoll = hostedDefenseBonusDice ? rollDie(hostedDefenseBonusDice) : null;
      if (hostedDefenseRoll) {
        defenseTotal += hostedDefenseRoll.total;
        rollDetails.push(`+${hostedDefenseRoll.total} Stinging Fortress`);
      }
      (!defenseAdjustment.ignoresBonuses ? activeDefenseStatuses : []).filter((status) => status.type === "defenseBonusDice").forEach((status) => {
        const bonusRoll = rollDie(status.dice);
        if (bonusRoll) {
          defenseTotal += bonusRoll.total;
          rollDetails.push(`+${bonusRoll.total} from ${status.dice}`);
        }
      });
      const advantageRoll = useAttackAdvantage || useAttackDisadvantage ? rollDie(attackerEntry.attack.attackDice) : null;
      const modifier = getAttackConditionalModifier(attackerEntry.card, targetEntry.card, opponentState.habitats, opponentState.corals, opponentState.reefCreatures, attackerEntry.attack, opponentState.orphanCreatures);
      const chosenAttackRoll = advantageRoll ? (useAttackAdvantage ? Math.max(result.attack.total, advantageRoll.total) : Math.min(result.attack.total, advantageRoll.total)) : result.attack.total;
      const rolledBonus = getRolledAttackBonus(attackerEntry.attack, chosenAttackRoll, opponentState.habitats);
      let attackTotal = chosenAttackRoll + modifier.flat + rolledBonus.flat + rovLightsBonus + flashingAlarmBonus;
      let scatterDetail = "";
      if (attackTotal > defenseTotal && cardHasScatter(targetEntry.card)) {
        const scatterFirst = rollDie(attackerEntry.attack.attackDice);
        const scatterSecond = useAttackAdvantage || useAttackDisadvantage ? rollDie(attackerEntry.attack.attackDice) : null;
        const scatterBase = scatterSecond ? (useAttackAdvantage ? Math.max(scatterFirst.total, scatterSecond.total) : Math.min(scatterFirst.total, scatterSecond.total)) : scatterFirst?.total ?? 0;
        const scatterModifier = getAttackConditionalModifier(attackerEntry.card, targetEntry.card, opponentState.habitats, opponentState.corals, opponentState.reefCreatures, attackerEntry.attack, opponentState.orphanCreatures);
        const scatterRolledBonus = getRolledAttackBonus(attackerEntry.attack, scatterBase, opponentState.habitats);
        attackTotal = scatterBase + scatterModifier.flat + scatterRolledBonus.flat + rovLightsBonus + flashingAlarmBonus;
        scatterDetail = `; Scatter reroll ${attackTotal}`;
      }
      rolls.push(`${attackTotal}${advantageRoll ? ` (${result.attack.total}/${advantageRoll.total} ${useAttackAdvantage ? "advantage" : "disadvantage"})` : attackAdvantage && attackDisadvantage ? " (advantage and disadvantage canceled)" : ""}${modifier.details.length || rolledBonus.detail || rovLightsBonus || flashingAlarmBonus ? ` [${[...modifier.details, rolledBonus.detail, rovLightsBonus ? "+2 ROV Lights" : null, flashingAlarmBonus ? `+${flashingAlarmBonus} Flashing Alarm` : null].filter(Boolean).join(", ")}]` : ""} vs ${defenseTotal}${defenseAdjustment.flat ? ` (${defenseAdjustment.flat} defense)` : ""}${defenseAdjustment.ignoresBonuses ? " (defensive bonuses ignored)" : rollDetails.length ? ` (${rollDetails.join(", ")})` : ""}${scatterDetail}`);
      attackerWins = attackTotal > defenseTotal;
    }
    if (!attackerWins) {
      const biteBack = getBiteBackAttack(targetEntry.card);
      const attackerDefense = attackerEntry.card.defense?.dice ?? attackerEntry.card.defense;
      const counter = biteBack && attackerDefense ? resolveOpposedRoll(biteBack.attackDice, attackerDefense) : null;
      const counterSucceeded = Boolean(counter?.resolved && counter.attack.total > counter.defense.total);
      const opponentCorals = counterSucceeded && attackerEntry.coral ? opponentState.corals.map((coral) => coral.id === attackerEntry.coral.id ? {
        ...coral,
        slots: coral.slots.map((slot) => slot.id === attackerEntry.slot.id ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot),
      } : coral) : opponentState.corals;
      const opponentReefCreatureInstances = counterSucceeded && attackerEntry.reefIndex >= 0
        ? removeCreatureInstances(opponentState.reefCreatureInstances ?? [], [attackerEntry.instanceId]).instances
        : opponentState.reefCreatureInstances ?? [];
      const opponentReefCreatures = opponentReefCreatureInstances.map((instance) => instance.cardId);
      const opponentOrphanCreatures = counterSucceeded && attackerEntry.orphanIndex >= 0
        ? [...(opponentState.orphanCreatures ?? []).filter((entry) => entry.instanceId !== attackerEntry.instanceId), ...(opponentState.orphanCreatures?.[attackerEntry.orphanIndex]?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`)))]
        : opponentState.orphanCreatures ?? [];
      return {
        corals: currentPlayerCorals,
        reefCreatures: currentPlayerReefCreatures,
        discardedCardId: null,
        opponentCorals,
        opponentReefCreatures,
        opponentReefCreatureInstances,
        opponentOrphanCreatures,
        opponentDiscardedCardId: counterSucceeded ? attackerEntry.card.id : null,
        opponentDiscardedCardWasDestroyed: counterSucceeded,
        attackerCardId: attackerEntry.card.id,
        defenderCardId: targetEntry.card.id,
        targetInstanceId: targetEntry.instanceId,
        counterCardId: counter?.resolved ? targetEntry.card.id : null,
        counterSucceeded,
        attackerWins: false,
        actionCost: attackerEntry.attack.actionCost,
        opponentCooldownKey,
        opponentAttackActionKey,
        summary: `Opponent's ${attackerEntry.card.name}${onPlayAttack ? ` used ${attackerEntry.attack.actionName} on` : " attacked"} ${targetEntry.card.name}: ${rolls.join(", ")}. Your defender won.${counter?.resolved ? ` ${targetEntry.card.name} used ${biteBack.actionName} (${counter.attack.total} vs ${counter.defense.total}) and ${counterSucceeded ? destroyedCardGoesToLostZone(attackerEntry.card) ? `destroyed ${attackerEntry.card.name}, placing it in the opponent's Lost Zone` : `discarded ${attackerEntry.card.name}` : "the counterattack failed"}.` : ""}${attackerEntry.attack.unsupportedDetails ? ` ${attackerEntry.attack.unsupportedDetails}` : ""}`,
      };
    }
    if (targetEntry.onOpponentBoard) {
      const defeatedInvaderDestination = destroyedCardGoesToLostZone(targetEntry.card)
        ? "Lost Zone"
        : "discard pile";
      const invasiveRemoval = targetEntry.onOpponentOrphan
        ? { foundations: opponentState.corals, removedCardId: null }
        : removeInvasiveCreature(opponentState.corals, {
            coralId: targetEntry.coral.id,
            slotId: targetEntry.slot.id,
            controller: "player",
          });
      const invasiveOrphanRemoval = targetEntry.onOpponentOrphan
        ? removeInvasiveOrphan(opponentState.orphanCreatures, {
            instanceId: targetEntry.instanceId,
            controller: "player",
          })
        : { orphans: opponentState.orphanCreatures ?? [], removedCardId: null };
      const toxicResult = resolveToxicConsumption({ attackerCard: attackerEntry.card, toxicSourceCard: targetEntry.card, consumed: true, poisonHealActive: opponentState.poisonImmunityNextPredatorAttack });
      const selfDiscardedAttacker = shouldSelfDiscardAfterConsume({ attackerCard: attackerEntry.card, defenderCard: targetEntry.card, consumed: true });
      const attackerDiscardedAfterConsume = toxicResult.discardAttacker || selfDiscardedAttacker;
      const opponentCoralsAfterAttack = attackerDiscardedAfterConsume && attackerEntry.coral
        ? invasiveRemoval.foundations.map((coral) => coral.id === attackerEntry.coral.id ? {
            ...coral,
            slots: coral.slots.map((slot) => slot.id === attackerEntry.slot.id ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot),
          } : coral)
        : invasiveRemoval.foundations;
      const opponentReefInstancesAfterAttack = attackerDiscardedAfterConsume && attackerEntry.reefIndex >= 0
        ? removeCreatureInstances(opponentState.reefCreatureInstances ?? [], [attackerEntry.instanceId]).instances
        : opponentState.reefCreatureInstances ?? [];
      let opponentOrphansAfterAttack = invasiveOrphanRemoval.orphans;
      if (attackerDiscardedAfterConsume && attackerEntry.orphanIndex >= 0) {
        const removedEntry = opponentOrphansAfterAttack.find((entry) => entry.instanceId === attackerEntry.instanceId);
        opponentOrphansAfterAttack = [
          ...opponentOrphansAfterAttack.filter((entry) => entry.instanceId !== attackerEntry.instanceId),
          ...(removedEntry?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`))),
        ];
      }
      return {
        corals: currentPlayerCorals,
        reefCreatures: currentPlayerReefCreatures,
        reefCreatureInstances: currentPlayerReefInstances,
        orphanCreatures: currentPlayerOrphans,
        discardedCardId: targetEntry.card.id,
        discardedCardIds: [targetEntry.card.id],
        opponentCorals: opponentCoralsAfterAttack,
        opponentReefCreatures: opponentReefInstancesAfterAttack.map((instance) => instance.cardId),
        opponentReefCreatureInstances: opponentReefInstancesAfterAttack,
        opponentOrphanCreatures: opponentOrphansAfterAttack,
        opponentDiscardedCardId: attackerDiscardedAfterConsume ? attackerEntry.card.id : null,
        opponentDiscardedCardWasDestroyed: false,
        attackerCardId: attackerEntry.card.id,
        defenderCardId: targetEntry.card.id,
        targetInstanceId: targetEntry.instanceId,
        attackerWins: true,
        actionCost: attackerEntry.attack.actionCost,
        opponentCooldownKey,
        opponentAttackActionKey,
        summary: `Opponent's ${attackerEntry.card.name} attacked your invading ${targetEntry.card.name}: ${rolls.join(", ")}. The attack succeeded, so the invader left the opponent's reef and went to your ${defeatedInvaderDestination}.${toxicResult.triggered ? toxicResult.protected ? " Poison Heal or Toxic Immunity prevented Toxic." : toxicResult.discardAttacker ? " Toxic also discarded the opponent's attacker." : " The opponent's attacker survived Toxic." : ""}`,
      };
    }
    const defeatedCorals = targetEntry.reefIndex >= 0 || targetEntry.orphanIndex >= 0 ? currentPlayerCorals : currentPlayerCorals.map((coral) => coral.id === targetEntry.coral.id ? {
      ...coral,
      slots: coral.slots.map((slot) => slot.id === targetEntry.slot.id ? targetEntry.hostedIndex >= 0 ? { ...slot, hostedCardIds: removeHostedCardAtIndex(slot.hostedCardIds, targetEntry.hostedIndex) } : { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot),
    } : coral);
    const defeatedReefInstances = targetEntry.reefIndex >= 0 ? removeCreatureInstances(currentPlayerReefInstances, [targetEntry.instanceId]).instances : currentPlayerReefInstances;
    const defeatedOrphans = targetEntry.orphanIndex < 0
      ? currentPlayerOrphans
      : targetEntry.hostedIndex >= 0
        ? currentPlayerOrphans.map((entry) => entry.instanceId === targetEntry.orphanInstanceId
          ? { ...entry, hostedCardIds: removeHostedCardAtIndex(entry.hostedCardIds, targetEntry.hostedIndex) }
          : entry)
        : [
            ...currentPlayerOrphans.filter((entry) => entry.instanceId !== targetEntry.orphanInstanceId),
            ...(currentPlayerOrphans[targetEntry.orphanIndex]?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`player-orphan-${cardId}`))),
          ];
    const defeatedDiscardIds = [targetEntry.card.id, ...(targetEntry.orphanIndex >= 0 || targetEntry.hostedIndex >= 0 ? [] : (targetEntry.slot?.hostedCardIds ?? []).filter(Boolean))];
    const resilienceTriggered = cardHasAncientResilience(targetEntry.card) && !controllerResilienceUsedCardIds.includes(targetEntry.instanceId);
    const regenerateDecision = createRegenerateDecision({ defenderCard: targetEntry.card, defenderWasDefeated: true, controllerRp, survivalAlreadyApplied: resilienceTriggered });
    if (resilienceTriggered || regenerateDecision.available) {
      return {
        corals: currentPlayerCorals,
        reefCreatures: currentPlayerReefCreatures,
        reefCreatureInstances: currentPlayerReefInstances,
        orphanCreatures: currentPlayerOrphans,
        discardedCardId: null,
        attackerCardId: attackerEntry.card.id,
        defenderCardId: targetEntry.card.id,
        targetInstanceId: targetEntry.instanceId,
        attackerWins: true,
        defenderSurvived: true,
        playerResilienceUsedCardId: resilienceTriggered ? targetEntry.instanceId : null,
        pendingRegenerate: regenerateDecision.available ? {
          decision: regenerateDecision,
          defeatedCorals,
          defeatedReefInstances,
          defeatedOrphans,
          discardedCardIds: defeatedDiscardIds,
          attackerCardId: attackerEntry.card.id,
          attackerLocation: { coralId: attackerEntry.coral?.id ?? null, slotId: attackerEntry.slot?.id ?? null, reefInstanceId: attackerEntry.reefIndex >= 0 ? attackerEntry.instanceId : null, orphanInstanceId: attackerEntry.orphanIndex >= 0 ? attackerEntry.instanceId : null },
          targetLocation: {
            coralId: targetEntry.coral?.id ?? null,
            slotId: targetEntry.slot?.id ?? null,
            hostedIndex: targetEntry.hostedIndex,
            reefInstanceId: targetEntry.reefIndex >= 0 ? targetEntry.instanceId : null,
            orphanInstanceId: targetEntry.orphanIndex >= 0 ? targetEntry.orphanInstanceId : null,
          },
          toxicSourceCardId: targetEntry.card.id,
          opponentPoisonHealActive: Boolean(opponentState.poisonImmunityNextPredatorAttack),
        } : null,
        actionCost: attackerEntry.attack.actionCost,
        opponentCooldownKey,
        opponentAttackActionKey,
        summary: `Opponent's ${attackerEntry.card.name}${onPlayAttack ? ` used ${attackerEntry.attack.actionName} on` : " attacked"} ${targetEntry.card.name}: ${rolls.join(", ")}. The attack succeeded, but ${resilienceTriggered ? `Ancient Resilience kept ${targetEntry.card.name} in play and is now used for this game` : `${targetEntry.card.name}'s Regenerate is waiting for your decision`}.`,
      };
    }
    const toxicResult = resolveToxicConsumption({ attackerCard: attackerEntry.card, toxicSourceCard: targetEntry.card, consumed: true, poisonHealActive: opponentState.poisonImmunityNextPredatorAttack });
    const toxicDiscardedAttacker = toxicResult.discardAttacker;
    const selfDiscardedAttacker = shouldSelfDiscardAfterConsume({ attackerCard: attackerEntry.card, defenderCard: targetEntry.card, consumed: true });
    const attackerDiscardedAfterConsume = toxicDiscardedAttacker || selfDiscardedAttacker;
    const opponentReefInstancesAfterToxic = attackerDiscardedAfterConsume && attackerEntry.reefIndex >= 0 ? removeCreatureInstances(opponentState.reefCreatureInstances ?? [], [attackerEntry.instanceId]).instances : opponentState.reefCreatureInstances ?? [];
    return {
      corals: defeatedCorals,
      reefCreatures: defeatedReefInstances.map((instance) => instance.cardId),
      reefCreatureInstances: defeatedReefInstances,
      orphanCreatures: defeatedOrphans,
      discardedCardId: targetEntry.card.id,
      discardedCardIds: defeatedDiscardIds,
      opponentCorals: attackerDiscardedAfterConsume && attackerEntry.coral ? opponentState.corals.map((coral) => coral.id === attackerEntry.coral.id ? { ...coral, slots: coral.slots.map((slot) => slot.id === attackerEntry.slot.id ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) } : coral) : opponentState.corals,
      opponentReefCreatures: opponentReefInstancesAfterToxic.map((instance) => instance.cardId),
      opponentReefCreatureInstances: opponentReefInstancesAfterToxic,
      opponentOrphanCreatures: attackerDiscardedAfterConsume && attackerEntry.orphanIndex >= 0 ? [...(opponentState.orphanCreatures ?? []).filter((entry) => entry.instanceId !== attackerEntry.instanceId), ...(opponentState.orphanCreatures?.[attackerEntry.orphanIndex]?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`)))] : opponentState.orphanCreatures ?? [],
      opponentDiscardedCardId: attackerDiscardedAfterConsume ? attackerEntry.card.id : null,
      opponentDiscardedCardWasDestroyed: false,
      attackerCardId: attackerEntry.card.id,
      defenderCardId: targetEntry.card.id,
      targetInstanceId: targetEntry.instanceId,
      attackerWins: true,
      actionCost: attackerEntry.attack.actionCost,
      opponentCooldownKey,
      opponentAttackActionKey,
      summary: `Opponent's ${attackerEntry.card.name}${onPlayAttack ? ` used ${attackerEntry.attack.actionName} on` : " attacked"} ${targetEntry.card.name}: ${rolls.join(", ")}. ${destroyedCardGoesToLostZone(targetEntry.card) ? `${targetEntry.card.name} was destroyed and sent to your Lost Zone.` : `${targetEntry.card.name} was discarded.`}${toxicResult.triggered ? toxicResult.protected ? ` ${toxicResult.protectionSource === "poisonHeal" ? "Poison Heal" : `${attackerEntry.card.name}'s Toxic Immunity`} prevented Toxic.` : toxicDiscardedAttacker ? " Toxic coin flip: tails, so the opponent's consuming attacker was also discarded." : " Toxic coin flip: heads, so the opponent's attacker survived." : ""}${selfDiscardedAttacker ? toxicDiscardedAttacker ? ` ${attackerEntry.card.name}'s consume rule also required it to be discarded; it left play only once.` : ` ${attackerEntry.card.name}'s consume rule discarded it after eating an Apex or Predator.` : ""}${attackerEntry.attack.unsupportedDetails ? ` ${attackerEntry.attack.unsupportedDetails}` : ""}`,
    };
  }

  function runOpponentAttack(opponentState, currentPlayerCorals, currentPlayerReefEntries, currentPlayerOrphans, onPlayAttack = null, continuation = null, controllerState = {}) {
    let workingOpponent = normalizeProjectedOpponentState(reconcileOpponentInstances(opponentState, opponentState));
    let workingCorals = currentPlayerCorals;
    let workingReefInstances = reconcileCreatureZone(currentPlayerReefEntries, currentPlayerReefEntries, "player-reef");
    let workingOrphans = reconcileCreatureZone(currentPlayerOrphans, currentPlayerOrphans, "player-orphan");
    const normalizedOpeningBoard = reconcileFoundationHealthToFixedPoint(workingCorals, workingReefInstances, workingOrphans);
    workingCorals = normalizedOpeningBoard.corals;
    workingOrphans = normalizedOpeningBoard.orphans;
    let workingControllerRp = Number(controllerState.rp ?? rp);
    let workingBlueCrabRecycleUsedTurn = Object.prototype.hasOwnProperty.call(controllerState, "blueCrabRecycleUsedTurn")
      ? controllerState.blueCrabRecycleUsedTurn
      : blueCrabRecycleUsedTurn;
    const workingCreatureStatuses = controllerState.creatureStatuses ?? creatureStatuses;
    const baseResilienceUsedCardIds = controllerState.resilienceUsedCardIds ?? resilienceUsedCardIds;
    const excludedTargetIds = [...(continuation?.excludedTargetInstanceIds ?? [])];
    const attackOffset = Math.max(0, Number(continuation?.attackOffset ?? 0));
    const steps = [];
    const discardedCardIds = [];
    const opponentDiscardedCardIds = [];
    const playerResilienceUsedCardIds = [];
    let requiredAttacks = Math.max(1, Number(continuation?.remainingAttacks ?? 1));

    for (let attackNumber = 0; attackNumber < requiredAttacks; attackNumber += 1) {
      let attackForStep = onPlayAttack;
      let ensnareForStep = null;
      if (onPlayAttack?.attack?.ensnare) {
        ensnareForStep = resolveEnsnareForAttack(onPlayAttack.attack, Math.random);
        attackForStep = { ...onPlayAttack, attack: ensnareForStep.attack };
      }
      let step = runOpponentAttackStep(workingOpponent, workingCorals, workingReefInstances, workingOrphans, attackForStep, excludedTargetIds, {
        rp: workingControllerRp,
        creatureStatuses: workingCreatureStatuses,
        resilienceUsedCardIds: [...new Set([...baseResilienceUsedCardIds, ...playerResilienceUsedCardIds])],
        actionCostAlreadyPaid: Boolean(continuation),
      });
      if (!step) break;
      if (ensnareForStep) {
        const ensnareMessage = `Ensnare attack ${attackOffset + attackNumber + 1}: ${ensnareForStep.coinResult}.${ensnareForStep.applied ? ` Your defender had -${ensnareForStep.penalty} defense for this attack.` : " No defense penalty was applied."}`;
        step = { ...step, summary: `${ensnareMessage} ${step.summary}` };
      }
      if (attackNumber === 0 && !continuation) {
        const attackEffect = onPlayAttack?.attack ?? getBasicAttackEffect(cardsById[step.attackerCardId]);
        requiredAttacks = getDynamicAttackRepeat(cardsById[step.attackerCardId], attackEffect, opponentState.corals, opponentState.reefCreatures, opponentState.habitats);
      }
      if (step.noLegalTarget && attackNumber > 0) break;
      if (step.targetInstanceId) excludedTargetIds.push(step.targetInstanceId);
      workingCorals = step.corals ?? workingCorals;
      workingReefInstances = step.reefCreatureInstances ?? reconcileCreatureZone(workingReefInstances, step.reefCreatures ?? workingReefInstances, "player-reef");
      workingOrphans = step.orphanCreatures ?? workingOrphans;
      const normalizedPlayerBoard = reconcileFoundationHealthToFixedPoint(workingCorals, workingReefInstances, workingOrphans);
      workingCorals = normalizedPlayerBoard.corals;
      workingOrphans = normalizedPlayerBoard.orphans;
      discardedCardIds.push(...(step.discardedCardIds ?? (step.discardedCardId ? [step.discardedCardId] : [])));
      if (step.opponentDiscardedCardId) opponentDiscardedCardIds.push(step.opponentDiscardedCardId);
      if (step.playerResilienceUsedCardId) playerResilienceUsedCardIds.push(step.playerResilienceUsedCardId);
      workingOpponent = reconcileOpponentInstances(workingOpponent, {
        ...workingOpponent,
        corals: step.opponentCorals ?? workingOpponent.corals,
        reefCreatures: step.opponentReefCreatures ?? workingOpponent.reefCreatures,
        reefCreatureInstances: step.opponentReefCreatureInstances ?? workingOpponent.reefCreatureInstances,
        orphanCreatures: step.opponentOrphanCreatures ?? workingOpponent.orphanCreatures,
      });
      if (step.targetInstanceId) {
        workingOpponent = { ...workingOpponent, poisonImmunityNextPredatorAttack: false };
      }
      workingOpponent = normalizeProjectedOpponentState(workingOpponent);
      const playerRpCapAfterStep = getEcosystemRpCap(workingCorals, [...playerHabitats, ...workingReefInstances.map((instance) => instance.cardId), ...workingOrphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
      const rpOverflowLost = Math.max(0, workingControllerRp - playerRpCapAfterStep);
      if (rpOverflowLost) {
        workingControllerRp = playerRpCapAfterStep;
        step = { ...step, playerRpAfter: workingControllerRp, playerRpCapOverflowLost: rpOverflowLost };
      }
      const defeatedCard = cardsById[step.discardedCardId];
      const blueCrabCanRecycle = Boolean(
        defeatedCard
          && defeatedCard.category === CardCategory.FISH
          && !isCreatureSchool(defeatedCard)
          && ecosystemHasCard(workingCorals, workingReefInstances.map((instance) => instance.cardId), "blue-crab", workingOrphans)
          && workingBlueCrabRecycleUsedTurn !== turn
      );
      if (blueCrabCanRecycle) {
        const nominalRecoveredRp = halfCostRoundedUp(defeatedCard.cost?.rp);
        const cap = getEcosystemRpCap(workingCorals, [...playerHabitats, ...workingReefInstances.map((instance) => instance.cardId), ...workingOrphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
        const rpBeforeRecycle = workingControllerRp;
        workingControllerRp = addResourceWithinCap(workingControllerRp, nominalRecoveredRp, cap);
        workingBlueCrabRecycleUsedTurn = turn;
        step = {
          ...step,
          playerBlueCrabRecoveredRp: workingControllerRp - rpBeforeRecycle,
          playerBlueCrabNominalRp: nominalRecoveredRp,
          playerRpAfter: workingControllerRp,
          playerBlueCrabRecycleUsedTurnAfter: workingBlueCrabRecycleUsedTurn,
        };
      }
      steps.push({ ...step, attackNumber: attackOffset + attackNumber + 1, requiredAttacks: attackOffset + requiredAttacks });
      if (step.pendingRegenerate) {
        const attackEffect = onPlayAttack?.attack ?? getBasicAttackEffect(cardsById[step.attackerCardId]);
        const remainingAttacks = requiredAttacks - attackNumber - 1;
        step.pendingRegenerate = {
          ...step.pendingRegenerate,
          continuation: remainingAttacks > 0 ? {
            remainingAttacks,
            attackOffset: attackOffset + attackNumber + 1,
            excludedTargetInstanceIds: [...excludedTargetIds],
            forcedAttack: {
              cardId: step.attackerCardId,
              coralId: step.pendingRegenerate.attackerLocation.coralId,
              slotId: step.pendingRegenerate.attackerLocation.slotId,
              reefInstanceId: step.pendingRegenerate.attackerLocation.reefInstanceId,
              orphanInstanceId: step.pendingRegenerate.attackerLocation.orphanInstanceId,
              attack: attackEffect,
            },
          } : null,
        };
        steps[steps.length - 1] = { ...step, attackNumber: attackOffset + attackNumber + 1, requiredAttacks: attackOffset + requiredAttacks };
        break;
      }
      if (step.opponentDiscardedCardId || step.noLegalTarget || step.resolutionUnsupported) break;
    }

    if (!steps.length) return null;
    const [firstStep] = steps;
    const lastStep = steps[steps.length - 1];
    const sequenceStoppedEarly = steps.length < requiredAttacks && !lastStep.pendingRegenerate && !lastStep.noLegalTarget && !lastStep.resolutionUnsupported;
    const summary = `${steps.map((step) => step.summary).join(" ")}${sequenceStoppedEarly ? " The repeated attack ended because the attacker left play or no different legal target remained." : ""}`;
    return {
      ...lastStep,
      corals: workingCorals,
      reefCreatures: workingReefInstances.map((instance) => instance.cardId),
      reefCreatureInstances: workingReefInstances,
      orphanCreatures: workingOrphans,
      opponentCorals: workingOpponent.corals,
      opponentReefCreatures: workingOpponent.reefCreatures,
      opponentReefCreatureInstances: workingOpponent.reefCreatureInstances,
      opponentOrphanCreatures: workingOpponent.orphanCreatures,
      opponentPoisonImmunityNextPredatorAttack: workingOpponent.poisonImmunityNextPredatorAttack,
      opponentDiscardedCardId: opponentDiscardedCardIds[0] ?? null,
      opponentDiscardedCardIds,
      discardedCardId: discardedCardIds[0] ?? null,
      discardedCardIds,
      attackerCardId: firstStep.attackerCardId,
      actionCost: firstStep.actionCost,
      opponentCooldownKey: firstStep.opponentCooldownKey,
      opponentAttackActionKey: firstStep.opponentAttackActionKey,
      playerResilienceUsedCardIds,
      playerRpAfter: workingControllerRp,
      playerBlueCrabRecycleUsedTurnAfter: workingBlueCrabRecycleUsedTurn,
      steps,
      summary,
    };
  }

  function buildOpponentAttackEventSequence(attackResult, initialPlayerState, initialOpponentState, { actionCostAlreadyPaid = false } = {}) {
    if (!attackResult) return { events: [], playerState: initialPlayerState, opponentState: initialOpponentState, summary: "" };
    let nextPlayer = normalizeProjectedPlayerState({ ...initialPlayerState });
    let nextOpponent = normalizeProjectedOpponentState(reconcileOpponentInstances(initialOpponentState, initialOpponentState));
    const events = [];
    const summaryParts = [];
    const steps = attackResult.steps ?? [attackResult];

    steps.forEach((step, stepIndex) => {
      const nextCorals = step.corals ?? nextPlayer.corals;
      const nextReefInstances = step.reefCreatureInstances
        ?? reconcileCreatureZone(nextPlayer.reefCreatureInstances, step.reefCreatures ?? nextPlayer.reefCreatureInstances, "player-reef");
      const nextOrphanInstances = step.orphanCreatures
        ? reconcileCreatureZone(nextPlayer.orphanCreatureInstances, step.orphanCreatures, "player-orphan")
        : nextPlayer.orphanCreatureInstances;
      let nextDiscardPile = nextPlayer.discardPile;
      let nextLostZone = nextPlayer.lostZone ?? [];
      let nextFoundationDeck = nextPlayer.foundationDeck;
      const stepExtras = [];
      const discardedIds = step.discardedCardIds ?? (step.discardedCardId ? [step.discardedCardId] : []);
      if (discardedIds.length) {
        const primaryDefeatedCard = cardsById[step.discardedCardId];
        if (step.discardedCardId && destroyedCardGoesToLostZone(primaryDefeatedCard)) {
          nextLostZone = [step.discardedCardId, ...nextLostZone];
          nextDiscardPile = [...removeOneCard(discardedIds, step.discardedCardId), ...nextDiscardPile];
          stepExtras.push(`${primaryDefeatedCard.name} was placed in your Lost Zone.`);
        } else {
          nextDiscardPile = [...discardedIds, ...nextDiscardPile];
        }
        if (cardHasPlenteous(primaryDefeatedCard) && nextDiscardPile.includes("krill-bloom-base")) {
          nextDiscardPile = removeOneCard(nextDiscardPile, "krill-bloom-base");
          nextFoundationDeck = shuffle([...nextFoundationDeck, "krill-bloom-base"]);
          stepExtras.push("Plenteous recycled a base Krill Bloom into your Foundation deck.");
        }
      }
      if (step.playerRpCapOverflowLost) {
        stepExtras.push(`Your RP bank cap fell and ${step.playerRpCapOverflowLost} excess RP was returned before any recovery was applied.`);
      }
      if (Object.prototype.hasOwnProperty.call(step, "playerBlueCrabRecoveredRp")) {
        stepExtras.push(step.playerBlueCrabRecoveredRp > 0
          ? `Blue Crab recycled ${step.playerBlueCrabRecoveredRp} RP (up to half the defeated Fish's cost, capped by your RP bank).`
          : `Blue Crab triggered, but your RP bank was already at its cap.`);
      }
      const occupiedSlotIds = new Set([
        ...nextCorals.flatMap((coral) => coral.slots.flatMap((slot) => slot.cardId ? [getSlotActionKey(slot), ...(slot.hostedCardIds ?? []).flatMap((cardId, hostedIndex) => cardId ? [getHostedTargetSlotId(slot.id, hostedIndex)] : [])] : [])),
        ...nextReefInstances.map((instance) => `reef-${instance.instanceId}`),
        ...nextOrphanInstances.map((instance) => `orphan-${instance.instanceId}`),
      ]);
      const nextFlashingAlarmAttackBonus = step.targetInstanceId && !step.resolutionUnsupported
        ? triggerFlashingAlarm(nextPlayer.flashingAlarmAttackBonus, cardsById[step.defenderCardId])
        : nextPlayer.flashingAlarmAttackBonus;
      if (nextFlashingAlarmAttackBonus !== nextPlayer.flashingAlarmAttackBonus) {
        stepExtras.push(`${cardsById[step.defenderCardId]?.name}'s Flashing Alarm will give you +${nextFlashingAlarmAttackBonus.amount} on every attack roll during your next turn.`);
      }
      nextPlayer = {
        ...nextPlayer,
        corals: nextCorals,
        reefCreatureInstances: nextReefInstances,
        orphanCreatureInstances: nextOrphanInstances,
        discardPile: nextDiscardPile,
        lostZone: nextLostZone,
        foundationDeck: nextFoundationDeck,
        rp: step.playerRpAfter ?? nextPlayer.rp,
        blueCrabRecycleUsedTurn: step.playerBlueCrabRecycleUsedTurnAfter ?? nextPlayer.blueCrabRecycleUsedTurn,
        flashingAlarmAttackBonus: nextFlashingAlarmAttackBonus,
        resilienceUsedCardIds: step.playerResilienceUsedCardId
          ? [...new Set([...nextPlayer.resilienceUsedCardIds, step.playerResilienceUsedCardId])]
          : nextPlayer.resilienceUsedCardIds,
        creatureStatuses: Object.fromEntries(Object.entries(nextPlayer.creatureStatuses).filter(([slotId]) => occupiedSlotIds.has(slotId))),
      };
      const playerProjection = projectNormalizedPlayerState(nextPlayer);
      nextPlayer = playerProjection.state;
      const playerCollateral = playerProjection.collateral;

      const normalizedOccupiedSlotIds = new Set([
        ...nextPlayer.corals.flatMap((coral) => coral.slots.flatMap((slot) => slot.cardId ? [getSlotActionKey(slot), ...(slot.hostedCardIds ?? []).flatMap((cardId, hostedIndex) => cardId ? [getHostedTargetSlotId(slot.id, hostedIndex)] : [])] : [])),
        ...nextPlayer.reefCreatureInstances.map((instance) => `reef-${instance.instanceId}`),
        ...nextPlayer.orphanCreatureInstances.map((instance) => `orphan-${instance.instanceId}`),
      ]);
      nextPlayer = {
        ...nextPlayer,
        creatureStatuses: Object.fromEntries(Object.entries(nextPlayer.creatureStatuses).filter(([slotId]) => normalizedOccupiedSlotIds.has(slotId))),
      };

      nextOpponent = reconcileOpponentInstances(nextOpponent, {
        ...nextOpponent,
        corals: step.opponentCorals ?? nextOpponent.corals,
        reefCreatures: step.opponentReefCreatures ?? nextOpponent.reefCreatures,
        reefCreatureInstances: step.opponentReefCreatureInstances ?? nextOpponent.reefCreatureInstances,
        orphanCreatures: step.opponentOrphanCreatures ?? nextOpponent.orphanCreatures,
      });
      if (step.opponentDiscardedCardId) {
        const destroyedOpponentCard = cardsById[step.opponentDiscardedCardId];
        nextOpponent = step.opponentDiscardedCardWasDestroyed && destroyedCardGoesToLostZone(destroyedOpponentCard)
          ? { ...nextOpponent, lostZone: [step.opponentDiscardedCardId, ...(nextOpponent.lostZone ?? [])] }
          : { ...nextOpponent, discardPile: [step.opponentDiscardedCardId, ...nextOpponent.discardPile] };
      }
      if (stepIndex === 0 && !actionCostAlreadyPaid) {
        nextOpponent = {
          ...nextOpponent,
          rp: Math.max(0, nextOpponent.rp - Number(attackResult.actionCost ?? step.actionCost ?? 0)),
          actionCooldowns: attackResult.opponentCooldownKey
            ? { ...(nextOpponent.actionCooldowns ?? {}), [attackResult.opponentCooldownKey]: turn + 2 }
            : nextOpponent.actionCooldowns,
          actionUses: attackResult.opponentAttackActionKey
            ? markOpponentActionUsed(nextOpponent.actionUses, attackResult.opponentAttackActionKey, turn)
            : nextOpponent.actionUses,
        };
      }
      if (step.targetInstanceId) {
        nextOpponent = { ...nextOpponent, poisonImmunityNextPredatorAttack: false };
      }
      const opponentProjection = projectNormalizedOpponentState({ ...nextOpponent, rovLightsActive: false });
      nextOpponent = opponentProjection.state;
      const opponentCollateral = opponentProjection.collateral;

      const message = `${step.summary}${stepExtras.length ? ` ${stepExtras.join(" ")}` : ""}`;
      summaryParts.push(message);
      if (step.pendingRegenerate) {
        events.push({
          type: "choose-regenerate",
          sourceCardId: step.attackerCardId,
          defenderCardId: step.defenderCardId,
          title: `${cardsById[step.defenderCardId]?.name} Can Regenerate`,
          message: `${message} Choose whether to spend 1 RP to keep ${cardsById[step.defenderCardId]?.name} in play.`,
          regenerate: step.pendingRegenerate,
          success: false,
          playerStateAfter: nextPlayer,
          opponentStateAfter: nextOpponent,
          logMessage: message,
          opponentSequence: true,
        });
        return;
      }
      if (!step.noLegalTarget || step.resolutionUnsupported) {
        events.push({
          type: step.noLegalTarget ? "opponent-impact" : "faceoff-result",
          sourceCardId: step.counterCardId ?? step.eventSourceCardId ?? step.attackerCardId,
          defenderCardId: step.counterCardId ? step.attackerCardId : step.defenderCardId,
          title: step.resolutionUnsupported ? "Opponent Attack Could Not Resolve" : step.noLegalTarget ? `${cardsById[step.attackerCardId]?.name ?? "On Play Attack"} Found No Valid Target` : step.defenderEvaded ? "Your Creature Evaded" : step.counterSucceeded ? "Bite Back Counterattack!" : step.defenderSurvived ? "Your Defender Survived" : step.attackerWins ? `Opponent Attack ${step.attackNumber ?? 1} Succeeded` : `Your Creature Defended Attack ${step.attackNumber ?? 1}`,
          message,
          success: step.noLegalTarget ? false : step.counterCardId ? step.counterSucceeded : !step.attackerWins,
          playerStateAfter: nextPlayer,
          opponentStateAfter: nextOpponent,
          logMessage: message,
          opponentSequence: true,
        });
      }
      const playerCollapseEvent = buildContinuousHealthCollapseEvent(playerCollateral, {
        sourceCardId: step.attackerCardId,
        playerStateAfter: nextPlayer,
        opponentStateAfter: nextOpponent,
        opponentSequence: true,
      });
      const opponentCollapseEvent = buildContinuousHealthCollapseEvent(opponentCollateral, {
        sourceCardId: step.counterCardId ?? step.defenderCardId,
        playerStateAfter: nextPlayer,
        opponentStateAfter: nextOpponent,
        opponentSequence: true,
      });
      [playerCollapseEvent, opponentCollapseEvent].filter(Boolean).forEach((collapseEvent) => {
        events.push(collapseEvent);
        summaryParts.push(collapseEvent.message);
      });
    });

    return { events, playerState: nextPlayer, opponentState: nextOpponent, summary: summaryParts.join(" ") };
  }

  function preserveOpponentNormalActionsAfterOnPlay(attackResult) {
    if (!attackResult) return attackResult;
    const preserve = (pendingRegenerate) => pendingRegenerate
      ? { ...pendingRegenerate, resumeNormalActionsAfterOnPlay: true }
      : pendingRegenerate;
    return {
      ...attackResult,
      pendingRegenerate: preserve(attackResult.pendingRegenerate),
      steps: (attackResult.steps ?? []).map((step) => ({
        ...step,
        pendingRegenerate: preserve(step.pendingRegenerate),
      })),
    };
  }

  function buildOpponentUtilityEvents(utilities) {
    return (utilities?.actions ?? []).map((opponentUtility) => {
      const message = `${opponentUtility.summary}${opponentUtility.revealedCards?.length ? " The searched card is revealed below." : ""}`;
      return {
        type: "utility-result",
        sourceCardId: opponentUtility.sourceCardId,
        defenderCardId: opponentUtility.defenderCardId,
        title: `Opponent's ${cardsById[opponentUtility.sourceCardId]?.name} used ${opponentUtility.actionName}`,
        message,
        revealedCards: opponentUtility.revealedCards ?? [],
        success: opponentUtility.success !== false,
        opponentStateAfter: opponentUtility.state,
        playerStateAfter: opponentUtility.playerState,
        logMessage: message,
        opponentSequence: true,
      };
    });
  }

  function runOpponentNormalAttackActions(opponentState, currentPlayerState) {
    let nextOpponent = normalizeProjectedOpponentState(opponentState);
    let nextPlayer = normalizeProjectedPlayerState(currentPlayerState);
    const events = [];
    const summaries = [];
    let firstAttack = null;
    const availableCreatureCount = [
      ...nextOpponent.corals.flatMap((coral) => coral.slots.flatMap((slot) => [slot.cardId, ...(slot.hostedCardIds ?? [])])),
      ...(nextOpponent.reefCreatures ?? []),
      ...getLocallyControlledOrphans(nextOpponent.orphanCreatures, "opponent").flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ].filter(Boolean).length;
    const configuredLimit = getOpponentNormalAttackLimit(opponentDifficulty);
    const safetyLimit = Number.isFinite(configuredLimit)
      ? Math.min(availableCreatureCount, configuredLimit)
      : availableCreatureCount;

    for (let attackIndex = 0; attackIndex < safetyLimit; attackIndex += 1) {
      const attack = runOpponentAttack(
        nextOpponent,
        nextPlayer.corals,
        nextPlayer.reefCreatureInstances,
        nextPlayer.orphanCreatureInstances,
        null,
        null,
        {
          rp: nextPlayer.rp,
          blueCrabRecycleUsedTurn: nextPlayer.blueCrabRecycleUsedTurn,
          creatureStatuses: nextPlayer.creatureStatuses,
          resilienceUsedCardIds: nextPlayer.resilienceUsedCardIds,
        },
      );
      if (!attack) break;
      if (!firstAttack) firstAttack = attack;
      const resolution = buildOpponentAttackEventSequence(attack, nextPlayer, nextOpponent);
      events.push(...resolution.events);
      if (resolution.summary) summaries.push(resolution.summary);
      nextPlayer = resolution.playerState;
      nextOpponent = resolution.opponentState;
      if (resolution.events.some((event) => event.type === "choose-regenerate")) break;
    }

    return {
      attack: firstAttack,
      events,
      playerState: nextPlayer,
      opponentState: { ...nextOpponent, rovLightsActive: false },
      summary: summaries.join(" "),
      hasPendingRegenerate: events.some((event) => event.type === "choose-regenerate"),
    };
  }

  function runOpponentNormalActions(opponentState, currentPlayerState) {
    const threatProfile = assessCurrentOpponentThreat(opponentState);
    const attackFirst = shouldOpponentAttackBeforeUtility(opponentDifficulty, threatProfile.level);
    const emptyUtilities = (state, playerState) => ({
      state,
      playerState,
      actions: [],
      lost: false,
      summary: "",
    });

    if (attackFirst) {
      const attacks = runOpponentNormalAttackActions(opponentState, currentPlayerState);
      const utilities = attacks.hasPendingRegenerate
        ? emptyUtilities(attacks.opponentState, attacks.playerState)
        : runOpponentUtilityActions(attacks.opponentState, attacks.playerState);
      return {
        utilities,
        attack: attacks.attack,
        attackResolution: attacks,
        events: [...attacks.events, ...buildOpponentUtilityEvents(utilities)],
        playerState: utilities.playerState,
        opponentState: utilities.state,
        summary: [attacks.summary, utilities.summary].filter(Boolean).join(" "),
        lost: Boolean(utilities.lost),
        hasPendingRegenerate: attacks.hasPendingRegenerate,
      };
    }

    const utilities = runOpponentUtilityActions(opponentState, currentPlayerState);
    const attacks = utilities.lost
      ? {
          attack: null,
          events: [],
          playerState: utilities.playerState,
          opponentState: { ...utilities.state, rovLightsActive: false },
          summary: "",
          hasPendingRegenerate: false,
        }
      : runOpponentNormalAttackActions(utilities.state, utilities.playerState);
    return {
      utilities,
      attack: attacks.attack,
      attackResolution: attacks,
      events: [...buildOpponentUtilityEvents(utilities), ...attacks.events],
      playerState: attacks.playerState,
      opponentState: attacks.opponentState,
      summary: [utilities.summary, attacks.summary].filter(Boolean).join(" "),
      lost: Boolean(utilities.lost),
      hasPendingRegenerate: attacks.hasPendingRegenerate,
    };
  }

  function resolvePlayerRegenerateChoice(choice) {
    const pending = eventOverlay?.regenerate;
    if (eventOverlay?.type !== "choose-regenerate" || !pending) return;
    const resolution = resolveRegenerateDecision(pending.decision, choice);
    if (!resolution.resolved) return;
    const defender = cardsById[pending.toxicSourceCardId];
    const attacker = cardsById[pending.attackerCardId];
    const targetLocation = pending.targetLocation ?? {};
    let nextPlayerCorals = playerCorals;
    let nextPlayerReefInstances = playerReefCreatureInstances;
    let nextPlayerOrphans = playerOrphanCreatures;
    let nextPlayerHand = hand;
    let nextPlayerDiscardPile = discardPile;
    let nextPlayerLostZone = lostZone;
    let nextPlayerFoundationDeck = foundationDeck;
    let nextPlayerRp = Math.max(0, rp - (resolution.keepDefender ? resolution.rpCost : 0));
    let nextBlueCrabRecycleUsedTurn = blueCrabRecycleUsedTurn;
    let nextOpponent = {
      ...opponent,
      poisonImmunityNextPredatorAttack: pending.opponentPoisonHealActive
        ? false
        : opponent.poisonImmunityNextPredatorAttack,
    };
    let toxicResult = { triggered: false, discardAttacker: false };
    let toxicMessage = "";
    let selfDiscardMessage = "";
    let attackerDiscardedAfterConsume = false;
    let recycleMessage = "";
    let regeneratePlayerCollateral = null;
    let regenerateOpponentCollateral = null;
    if (!resolution.keepDefender) {
      if (targetLocation.coralId) {
        nextPlayerCorals = playerCorals.map((coral) => coral.id === targetLocation.coralId ? {
          ...coral,
          slots: coral.slots.map((slot) => slot.id === targetLocation.slotId
            ? targetLocation.hostedIndex >= 0
              ? { ...slot, hostedCardIds: removeHostedCardAtIndex(slot.hostedCardIds, targetLocation.hostedIndex) }
              : { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] }
            : slot),
        } : coral);
      }
      if (targetLocation.reefInstanceId) {
        nextPlayerReefInstances = removeCreatureInstances(playerReefCreatureInstances, [targetLocation.reefInstanceId]).instances;
      }
      if (targetLocation.orphanInstanceId) {
        const removedEntry = playerOrphanCreatures.find((entry) => entry.instanceId === targetLocation.orphanInstanceId);
        nextPlayerOrphans = targetLocation.hostedIndex >= 0
          ? playerOrphanCreatures.map((entry) => entry.instanceId === targetLocation.orphanInstanceId
            ? { ...entry, hostedCardIds: removeHostedCardAtIndex(entry.hostedCardIds, targetLocation.hostedIndex) }
            : entry)
          : [
              ...playerOrphanCreatures.filter((entry) => entry.instanceId !== targetLocation.orphanInstanceId),
              ...(removedEntry?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`player-orphan-${cardId}`))),
            ];
      }
      const defeatedIds = (pending.discardedCardIds ?? []).filter(Boolean);
      if (destroyedCardGoesToLostZone(defender)) {
        nextPlayerLostZone = [defender.id, ...nextPlayerLostZone];
        nextPlayerDiscardPile = [...removeOneCard(defeatedIds, defender.id), ...nextPlayerDiscardPile];
      } else {
        nextPlayerDiscardPile = [...defeatedIds, ...nextPlayerDiscardPile];
      }
      toxicResult = resolveToxicConsumption({ attackerCard: attacker, toxicSourceCard: defender, consumed: true, poisonHealActive: pending.opponentPoisonHealActive });
      const selfDiscardedAttacker = shouldSelfDiscardAfterConsume({ attackerCard: attacker, defenderCard: defender, consumed: true });
      attackerDiscardedAfterConsume = toxicResult.discardAttacker || selfDiscardedAttacker;
      if (toxicResult.triggered) {
        toxicMessage = toxicResult.protected
          ? ` ${toxicResult.protectionSource === "poisonHeal" ? "The opponent's Poison Heal" : `${attacker.name}'s Toxic Immunity`} prevented Toxic.`
          : toxicResult.discardAttacker ? " Toxic rolled tails, so the opponent's consuming attacker was also discarded." : " Toxic rolled heads, so the opponent's attacker survived.";
      }
      if (selfDiscardedAttacker) {
        selfDiscardMessage = toxicResult.discardAttacker
          ? ` ${attacker.name}'s consume rule also required it to be discarded; it left play only once.`
          : ` ${attacker.name}'s consume rule discarded it after eating an Apex or Predator.`;
      }
      if (attackerDiscardedAfterConsume) {
        if (pending.attackerLocation.coralId) {
          nextOpponent = { ...nextOpponent, corals: nextOpponent.corals.map((coral) => coral.id === pending.attackerLocation.coralId ? { ...coral, slots: coral.slots.map((slot) => slot.id === pending.attackerLocation.slotId ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] } : slot) } : coral) };
        } else if (pending.attackerLocation.reefInstanceId) {
          const removed = removeCreatureInstances(nextOpponent.reefCreatureInstances ?? [], [pending.attackerLocation.reefInstanceId]);
          nextOpponent = { ...nextOpponent, reefCreatureInstances: removed.instances, reefCreatures: removed.instances.map((instance) => instance.cardId) };
        } else if (pending.attackerLocation.orphanInstanceId) {
          const removedEntry = nextOpponent.orphanCreatures.find((entry) => entry.instanceId === pending.attackerLocation.orphanInstanceId);
          nextOpponent = { ...nextOpponent, orphanCreatures: [...nextOpponent.orphanCreatures.filter((entry) => entry.instanceId !== pending.attackerLocation.orphanInstanceId), ...(removedEntry?.hostedCardIds ?? []).filter(Boolean).map((cardId) => createCreatureInstance(cardId, createStableInstanceId(`opponent-orphan-${cardId}`)))] };
        }
        nextOpponent = { ...nextOpponent, discardPile: [attacker.id, ...nextOpponent.discardPile] };
      }

      const recycleKrill = cardHasPlenteous(defender) && nextPlayerDiscardPile.includes("krill-bloom-base");
      if (recycleKrill) {
        nextPlayerDiscardPile = removeOneCard(nextPlayerDiscardPile, "krill-bloom-base");
        nextPlayerFoundationDeck = shuffle([...nextPlayerFoundationDeck, "krill-bloom-base"]);
        recycleMessage += " Plenteous recycled a base Krill Bloom into your Foundation deck.";
      }
      const stateBeforeBlueCrabProjection = projectNormalizedPlayerState({
        corals: nextPlayerCorals,
        reefCreatureInstances: nextPlayerReefInstances,
        orphanCreatureInstances: nextPlayerOrphans,
        hand: nextPlayerHand,
        discardPile: nextPlayerDiscardPile,
        lostZone: nextPlayerLostZone,
        foundationDeck: nextPlayerFoundationDeck,
        palsDeck,
        rp: nextPlayerRp,
        supportBlockedUntilRound,
        resilienceUsedCardIds,
        creatureStatuses,
        blueCrabRecycleUsedTurn: nextBlueCrabRecycleUsedTurn,
      });
      const stateBeforeBlueCrab = stateBeforeBlueCrabProjection.state;
      regeneratePlayerCollateral = stateBeforeBlueCrabProjection.collateral;
      const overflowLost = Math.max(0, nextPlayerRp - stateBeforeBlueCrab.rp);
      nextPlayerCorals = stateBeforeBlueCrab.corals;
      nextPlayerReefInstances = stateBeforeBlueCrab.reefCreatureInstances;
      nextPlayerOrphans = stateBeforeBlueCrab.orphanCreatureInstances;
      nextPlayerHand = stateBeforeBlueCrab.hand;
      nextPlayerDiscardPile = stateBeforeBlueCrab.discardPile;
      nextPlayerLostZone = stateBeforeBlueCrab.lostZone ?? nextPlayerLostZone;
      nextPlayerFoundationDeck = stateBeforeBlueCrab.foundationDeck;
      nextPlayerRp = stateBeforeBlueCrab.rp;
      if (overflowLost) recycleMessage += ` Your RP bank cap fell and ${overflowLost} excess RP was returned before Blue Crab resolved.`;
      const blueCrabCanRecycle = defender?.category === CardCategory.FISH
        && !isCreatureSchool(defender)
        && ecosystemHasCard(nextPlayerCorals, nextPlayerReefInstances.map((instance) => instance.cardId), "blue-crab", nextPlayerOrphans)
        && nextBlueCrabRecycleUsedTurn !== turn;
      if (blueCrabCanRecycle) {
        const nominalRecoveredRp = halfCostRoundedUp(defender.cost?.rp);
        const cap = getEcosystemRpCap(nextPlayerCorals, [...playerHabitats, ...nextPlayerReefInstances.map((instance) => instance.cardId), ...nextPlayerOrphans.flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])])], activeCondition);
        const rpBeforeRecycle = nextPlayerRp;
        nextPlayerRp = addResourceWithinCap(nextPlayerRp, nominalRecoveredRp, cap);
        const actualRecoveredRp = nextPlayerRp - rpBeforeRecycle;
        nextBlueCrabRecycleUsedTurn = turn;
        recycleMessage += actualRecoveredRp > 0
          ? ` Blue Crab recycled ${actualRecoveredRp} RP before the bank cap.`
          : " Blue Crab triggered, but your RP bank was already at its cap.";
      }
    }

    const occupiedSlotIds = new Set([
      ...nextPlayerCorals.flatMap((coral) => coral.slots.flatMap((slot) => slot.cardId ? [getSlotActionKey(slot), ...(slot.hostedCardIds ?? []).flatMap((cardId, hostedIndex) => cardId ? [getHostedTargetSlotId(slot.id, hostedIndex)] : [])] : [])),
      ...nextPlayerReefInstances.map((instance) => `reef-${instance.instanceId}`),
      ...nextPlayerOrphans.map((instance) => `orphan-${instance.instanceId}`),
    ]);
    const choicePlayerState = normalizeProjectedPlayerState({
      corals: nextPlayerCorals,
      reefCreatureInstances: nextPlayerReefInstances,
      orphanCreatureInstances: nextPlayerOrphans,
      hand: nextPlayerHand,
      discardPile: nextPlayerDiscardPile,
      lostZone: nextPlayerLostZone,
      foundationDeck: nextPlayerFoundationDeck,
      palsDeck,
      rp: nextPlayerRp,
      supportBlockedUntilRound,
      resilienceUsedCardIds,
      creatureStatuses: Object.fromEntries(Object.entries(creatureStatuses).filter(([slotId]) => occupiedSlotIds.has(slotId))),
      blueCrabRecycleUsedTurn: nextBlueCrabRecycleUsedTurn,
      flashingAlarmAttackBonus,
    });
    const choiceOpponentProjection = projectNormalizedOpponentState(reconcileOpponentInstances(opponent, nextOpponent));
    const choiceOpponentState = choiceOpponentProjection.state;
    regenerateOpponentCollateral = choiceOpponentProjection.collateral;

    const continuation = !attackerDiscardedAfterConsume ? pending.continuation : null;
    let continuationResult = continuation ? runOpponentAttack(
      choiceOpponentState,
      choicePlayerState.corals,
      choicePlayerState.reefCreatureInstances,
      choicePlayerState.orphanCreatureInstances,
      continuation.forcedAttack,
      continuation,
      {
        rp: choicePlayerState.rp,
        blueCrabRecycleUsedTurn: choicePlayerState.blueCrabRecycleUsedTurn,
        creatureStatuses: choicePlayerState.creatureStatuses,
        resilienceUsedCardIds: choicePlayerState.resilienceUsedCardIds,
      },
    ) : null;
    if (pending.resumeNormalActionsAfterOnPlay) {
      continuationResult = preserveOpponentNormalActionsAfterOnPlay(continuationResult);
    }
    const onPlayContinuationResolution = continuationResult
      ? buildOpponentAttackEventSequence(continuationResult, choicePlayerState, choiceOpponentState, { actionCostAlreadyPaid: true })
      : { events: [], playerState: choicePlayerState, opponentState: choiceOpponentState, summary: "" };
    const onPlayContinuationHasPendingRegenerate = onPlayContinuationResolution.events.some((event) => event.type === "choose-regenerate");
    const opponentVpAfterOnPlayContinuation = getEcosystemVictoryPoints(
      onPlayContinuationResolution.opponentState.corals,
      onPlayContinuationResolution.opponentState.habitats,
      onPlayContinuationResolution.opponentState.reefCreatures,
      {
        controller: "opponent",
        localOrphans: onPlayContinuationResolution.opponentState.orphanCreatures,
        rivalCorals: onPlayContinuationResolution.playerState.corals,
        rivalOrphans: onPlayContinuationResolution.playerState.orphanCreatureInstances,
      },
    );
    const normalActionsAfterOnPlay = pending.resumeNormalActionsAfterOnPlay
      && !onPlayContinuationHasPendingRegenerate
      && opponentVpAfterOnPlayContinuation < victoryTarget
        ? runOpponentNormalActions(onPlayContinuationResolution.opponentState, onPlayContinuationResolution.playerState)
        : null;
    const continuationResolution = {
      events: [...onPlayContinuationResolution.events, ...(normalActionsAfterOnPlay?.events ?? [])],
      playerState: normalActionsAfterOnPlay?.playerState ?? onPlayContinuationResolution.playerState,
      opponentState: normalActionsAfterOnPlay?.opponentState ?? onPlayContinuationResolution.opponentState,
      summary: [onPlayContinuationResolution.summary, normalActionsAfterOnPlay?.summary].filter(Boolean).join(" "),
    };
    const remainingRegenerate = continuationResolution.events.some((event) => event.type === "choose-regenerate");
    const opponentLostAfterFollowup = Boolean(normalActionsAfterOnPlay?.lost);
    const maintenanceEvents = [];
    let finalOpponentState = normalizeProjectedOpponentState(continuationResolution.opponentState);
    if (!remainingRegenerate) {
      finalOpponentState = {
        ...finalOpponentState,
        flashingAlarmAttackBonus: endFlashingAlarmTurn(finalOpponentState.flashingAlarmAttackBonus),
      };
      if (!opponentLostAfterFollowup) {
        const maintenance = resolveEndOfTurnHabitatMaintenance(finalOpponentState.habitatInstances, {
          cardsInPlay: getCardsInPlayForComposition(finalOpponentState.corals, finalOpponentState.reefCreatures, finalOpponentState.orphanCreatures),
          cardLookup: cardsById,
          habitatLookup: cardsById,
        });
        maintenance.events.forEach((event) => {
          const maintenanceMessage = event.destroyed
            ? `Opponent's ${cardsById[event.cardId]?.name} took ${event.appliedDamage} end-of-turn damage and was destroyed.`
            : `Opponent's ${cardsById[event.cardId]?.name} took ${event.appliedDamage} end-of-turn damage. ${event.currentHealth} HP remains.`;
          const nextHabitats = event.destroyed
            ? finalOpponentState.habitatInstances.filter((habitat) => habitat.instanceId !== event.instanceId)
            : finalOpponentState.habitatInstances.map((habitat) => habitat.instanceId === event.instanceId ? { ...habitat, currentHealth: event.currentHealth } : habitat);
          finalOpponentState = {
            ...finalOpponentState,
            habitats: nextHabitats.map((habitat) => habitat.cardId),
            habitatInstances: nextHabitats,
            discardPile: event.destroyed ? [event.cardId, ...finalOpponentState.discardPile] : finalOpponentState.discardPile,
          };
          maintenanceEvents.push({ type: "opponent-impact", sourceCardId: event.cardId, title: event.destroyed ? "Opponent Habitat Destroyed" : "Opponent Habitat Deteriorated", message: maintenanceMessage, success: event.destroyed, opponentStateAfter: finalOpponentState, logMessage: maintenanceMessage, opponentSequence: true });
        });
      }
    }
    const opponentStunRecovery = resolveStunnedAtControllerTurnBoundary(finalOpponentState.corals, {
      turnComplete: !remainingRegenerate,
    });
    const opponentStunRecoverySummary = opponentStunRecovery.recoveredFoundationIds.length
      ? `${opponentStunRecovery.recoveredFoundationIds.length} opponent Coral${opponentStunRecovery.recoveredFoundationIds.length === 1 ? "" : "s"} recovered from Stunned at the end of its turn.`
      : "";
    finalOpponentState = { ...finalOpponentState, corals: opponentStunRecovery.foundations };

    const message = resolution.keepDefender
      ? `You chose Regenerate and paid ${resolution.rpCost} RP. ${defender.name} remains in play.`
      : `You declined Regenerate. ${destroyedCardGoesToLostZone(defender) ? `${defender.name} was destroyed and placed in your Lost Zone.` : `${defender.name} was discarded.`}${toxicMessage}${selfDiscardMessage}${recycleMessage}`;
    const regenerateCollapseEvents = [
      buildContinuousHealthCollapseEvent(regeneratePlayerCollateral, {
        sourceCardId: attacker?.id,
        playerStateAfter: choicePlayerState,
        opponentStateAfter: choiceOpponentState,
        opponentSequence: true,
      }),
      buildContinuousHealthCollapseEvent(regenerateOpponentCollateral, {
        sourceCardId: defender?.id,
        playerStateAfter: choicePlayerState,
        opponentStateAfter: choiceOpponentState,
        opponentSequence: true,
      }),
    ].filter(Boolean);
    const postChoicePlayerState = normalizeProjectedPlayerState(continuationResolution.playerState);
    const postChoicePlayerVp = getEcosystemVictoryPoints(
      postChoicePlayerState.corals,
      playerHabitats,
      postChoicePlayerState.reefCreatureInstances.map((instance) => instance.cardId),
      {
        controller: "player",
        localOrphans: postChoicePlayerState.orphanCreatureInstances,
        rivalCorals: finalOpponentState.corals,
        rivalOrphans: finalOpponentState.orphanCreatures,
      },
    );
    const postChoiceOpponentVp = getEcosystemVictoryPoints(finalOpponentState.corals, finalOpponentState.habitats, finalOpponentState.reefCreatures, {
      controller: "opponent",
      localOrphans: finalOpponentState.orphanCreatures,
      rivalCorals: postChoicePlayerState.corals,
      rivalOrphans: postChoicePlayerState.orphanCreatureInstances,
    });
    const postChoiceVictoryResult = remainingRegenerate ? null : determineVictoryResult(postChoicePlayerVp, postChoiceOpponentVp, victoryTarget);
    const postChoiceGameResult = opponentLostAfterFollowup
      ? "Victory: the opponent could not complete a required draw from its personal decks."
      : postChoiceVictoryResult?.message ?? null;
    setPendingEvents((current) => {
      const extraSummaryActions = [
        message,
        ...regenerateCollapseEvents.map((event) => event.message),
        ...splitTurnActionLines(continuationResolution.summary),
        ...maintenanceEvents.map((event) => event.message),
        opponentStunRecoverySummary,
      ].filter(Boolean);
      const updatedEvents = current.map((event) => event.type === "turn-transition"
        ? {
            ...event,
            actions: extraSummaryActions.length ? [...(event.actions ?? []), ...extraSummaryActions] : event.actions,
            opponentStateAfter: finalOpponentState,
            gameResultAfter: event.gameResultAfter ?? postChoiceGameResult,
          }
        : event);
      const transitionIndex = updatedEvents.findIndex((event) => event.type === "turn-transition");
      const insertionIndex = transitionIndex < 0 ? updatedEvents.length : transitionIndex;
      return [
        ...updatedEvents.slice(0, insertionIndex),
        ...regenerateCollapseEvents,
        ...continuationResolution.events,
        ...maintenanceEvents,
        ...updatedEvents.slice(insertionIndex),
      ];
    });
    setEventOverlay({
      ...eventOverlay,
      type: "faceoff-result",
      title: resolution.keepDefender ? "Regenerate Chosen" : "Regenerate Declined",
      message,
      success: resolution.keepDefender,
      regenerate: null,
      playerStateAfter: choicePlayerState,
      opponentStateAfter: choiceOpponentState,
      logMessage: message,
    });
  }

  function endTurn() {
    if (isSetup) {
      const academyBlock = getAcademyEndTurnBlock({
        route: scriptedFinishRoute,
        help: tutorialHelp,
        guideName: tutorialGuide.name,
      });
      if (academyBlock) {
        setTutorialHelpDismissedId(null);
        setPlayError(academyBlock);
        pushLog(academyBlock);
        return;
      }
      beginFirstRound();
      return;
    }
    if (isStartOfTurn) {
      pushLog("You must choose a personal deck and draw before ending your turn.");
      return;
    }
    if (opponentThinking) return;
    if (playingCardId || attackContext || searchContext || pendingCreatureAction) {
      pushLog("Finish or cancel your current placement, attack, or card effect before ending your turn.");
      return;
    }
    const academyBlock = getAcademyEndTurnBlock({
      route: scriptedFinishRoute,
      help: tutorialHelp,
      guideName: tutorialGuide.name,
    });
    if (academyBlock) {
      setTutorialHelpDismissedId(null);
      setPlayError(academyBlock);
      pushLog(academyBlock);
      return;
    }
    const boardComplexity = playerCorals.length + opponentCorals.length + playerReefCreatures.length + opponent.reefCreatures.length + playerOrphanCreatures.length + (opponent.orphanCreatures?.length ?? 0);
    const endgameDecision = playerVp >= victoryTarget - 8 || opponentVp >= victoryTarget - 8;
    const thinkingDelay = scriptedTutorialScenario?.opponentTurnMode === "observe"
      ? 350
      : Math.min(5200, 1100 + boardComplexity * 140 + (endgameDecision ? 1400 : 0));
    const habitatMaintenance = resolvePlayerEndOfTurnHabitats();
    const stunRecovery = clearStunnedFromFoundationsAtControllerTurnEnd(playerCorals);
    const stunRecoveryMessage = stunRecovery.recoveredFoundationIds.length
      ? `${stunRecovery.recoveredFoundationIds.length} Stunned Coral${stunRecovery.recoveredFoundationIds.length === 1 ? "" : "s"} recovered at the end of your turn and can produce RP, use abilities, and upgrade normally next turn.`
      : null;
    const actions = [...turnLog, ...(habitatMaintenance.messages ?? []), stunRecoveryMessage].filter(Boolean);
    emitTutorialEvent(SIMULATOR_TUTORIAL_ACTION_TYPES.TURN_ENDED, {
      actionCount: actions.length,
      playerVp,
      rp,
      accepted: true,
    }, { phase: "main" });
    setFlashingAlarmAttackBonus((current) => endFlashingAlarmTurn(current));
    if (stunRecovery.recoveredFoundationIds.length) {
      setPlayerCorals((current) => clearStunnedFromFoundationsAtControllerTurnEnd(current).foundations);
    }
    setGamePhase("transition");
    setModal(null);
    setEventOverlay({
      type: "turn-transition",
      title: "Opponent's Turn",
      message: "Your turn is complete.",
      actions: actions.length ? actions : ["You ended your turn without taking an action."],
      beginOpponentAfterClose: true,
      thinkingDelay,
    });
  }

  function resolveOpponentTurn() {
    setOpponentThinking(false);
    setEventOverlay(null);
    if (scriptedTutorialScenario?.opponentTurnMode === "observe") {
      const observerState = normalizeProjectedOpponentState(reconcileOpponentInstances(opponent, opponent));
      const message = `${tutorialGuide.name} keeps the practice reef unchanged and watches how you apply the lesson.`;
      queueEvents([{
        type: "turn-transition",
        title: "Your Turn",
        message: `${tutorialGuide.name}'s observation turn is complete.`,
        actions: [message],
        advanceRoundAfterClose: true,
        opponentStateAfter: observerState,
        gameResultAfter: null,
        opponentSequence: true,
      }]);
      return;
    }
    const turnEvents = [];
    let stagedPlayerState = normalizeProjectedPlayerState({
      corals: playerCorals,
      reefCreatureInstances: playerReefCreatureInstances,
      orphanCreatureInstances: playerOrphanCreatureInstances,
      hand,
      discardPile,
      lostZone,
      foundationDeck,
      palsDeck,
      rp,
      supportBlockedUntilRound,
      resilienceUsedCardIds,
      creatureStatuses,
      blueCrabRecycleUsedTurn,
      flashingAlarmAttackBonus: endFlashingAlarmTurn(flashingAlarmAttackBonus),
    });
    const stagePlayerState = (updates) => {
      stagedPlayerState = normalizeProjectedPlayerState({ ...stagedPlayerState, ...updates });
      return stagedPlayerState;
    };
    const opponentParasiteRequestedRp = getParasiteRequestedRp(
      opponent.corals,
      opponent.reefCreatures,
      opponent.orphanCreatures,
      playerCorals,
      playerReefCreatures,
      playerOrphanCreatures,
    );
    const opponentStartCap = getEcosystemRpCap(opponent.corals, [
      ...opponent.habitats,
      ...opponent.reefCreatures,
      ...(opponent.orphanCreatures ?? []).flatMap((entry) => [entry.cardId, ...(entry.hostedCardIds ?? [])]),
    ], activeCondition);
    const opponentParasiteTransfer = resolveParasiteCollection({
      requested: opponentParasiteRequestedRp,
      opposingRp: stagedPlayerState.rp,
      recipientRp: opponent.rp,
      recipientCap: opponentStartCap,
    });
    const opponentParasiteMessage = describeParasiteTransfer("Opponent's Cookie Cutter", opponentParasiteTransfer);
    const opponentForTurn = opponentParasiteRequestedRp
      ? { ...opponent, rp: opponentParasiteTransfer.recipientAfter }
      : opponent;
    const playerStateAfterOpponentParasite = opponentParasiteRequestedRp
      ? stagePlayerState({ rp: opponentParasiteTransfer.sourceAfter })
      : stagedPlayerState;
    const opponentResult = runOpponentTurn(opponentForTurn);
    const opponentStateAfterPlay = normalizeProjectedOpponentState(reconcileOpponentInstances(opponent, opponentResult.state));
    const opponentVpAfterPlay = getEcosystemVictoryPoints(
      opponentStateAfterPlay.corals,
      opponentStateAfterPlay.habitats,
      opponentStateAfterPlay.reefCreatures,
      {
        controller: "opponent",
        localOrphans: opponentStateAfterPlay.orphanCreatures,
        rivalCorals: stagedPlayerState.corals,
        rivalOrphans: stagedPlayerState.orphanCreatureInstances,
      },
    );
    const opponentReachedVictoryOnPlay = opponentVpAfterPlay >= victoryTarget;
    if (opponentParasiteRequestedRp) {
      turnEvents.push({
        type: "opponent-impact",
        sourceCardId: "cookie-cutter-shark",
        title: "Opponent's Cookie Cutter used Parasite",
        message: opponentParasiteMessage,
        success: opponentParasiteTransfer.collected > 0,
        playerStateAfter: playerStateAfterOpponentParasite,
        opponentStateAfter: normalizeProjectedOpponentState(reconcileOpponentInstances(opponent, opponentForTurn)),
        logMessage: opponentParasiteMessage,
      });
    }
    if (opponentResult.startOfTurnState) {
      turnEvents.push({
        type: "opponent-status",
        title: "Opponent Starts Turn",
        message: opponentResult.startOfTurnSummary,
        turnCollection: opponentResult.startOfTurnDetails,
        success: true,
        opponentStateAfter: opponentResult.startOfTurnState,
        logMessage: opponentResult.startOfTurnSummary,
      });
    }
    const opponentRandomDiscardIds = opponentResult.randomDiscard ? shuffle(hand).slice(0, opponentResult.randomDiscard.amount) : [];
    const opponentDeckDiscardIds = opponentResult.deckDiscard ? [...palsDeck, ...foundationDeck].slice(0, opponentResult.deckDiscard.amount) : [];
    const supportTargetCoral = playerCoralCards[0] ?? null;
    const supportImpactStages = [];
    let playerCoralsAfterSupports = stagedPlayerState.corals;
    (opponentResult.supportImpacts ?? []).forEach((impact) => {
      if (impact.type === "spearfishing-owner-discard") {
        supportImpactStages.push({
          impact,
          playerStateAfter: stagePlayerState({ discardPile: [impact.cardId, ...stagedPlayerState.discardPile] }),
        });
        return;
      }
      if (!supportTargetCoral) return;
      playerCoralsAfterSupports = playerCoralsAfterSupports.map((coral) => coral.id === supportTargetCoral.id ? {
        ...coral,
        rpPenaltyNextTurn: Number(coral.rpPenaltyNextTurn ?? 0) + Number(impact.rpPenalty ?? 0),
      } : coral);
      supportImpactStages.push({ impact, playerStateAfter: stagePlayerState({ corals: playerCoralsAfterSupports }) });
    });
    const invasivePlacementResult = opponentResult.invasivePlacement
      ? placeInvasiveCreature(stagedPlayerState.corals, opponentResult.invasivePlacement)
      : { foundations: stagedPlayerState.corals, placed: false };
    const playerStateAfterInvasion = invasivePlacementResult.placed
      ? stagePlayerState({ corals: invasivePlacementResult.foundations })
      : stagedPlayerState;
    playerCoralsAfterSupports = playerStateAfterInvasion.corals;
    const playerStateAfterSupportBlock = opponentResult.supportBlock
      ? stagePlayerState({ supportBlockedUntilRound: round + 1 })
      : stagedPlayerState;
    let playerStateAfterDeckDiscard = stagedPlayerState;
    if (opponentDeckDiscardIds.length) {
      const palsCount = Math.min(opponentResult.deckDiscard.amount, stagedPlayerState.palsDeck.length);
      const foundationCount = Math.min(opponentResult.deckDiscard.amount - palsCount, stagedPlayerState.foundationDeck.length);
      playerStateAfterDeckDiscard = stagePlayerState({
        palsDeck: stagedPlayerState.palsDeck.slice(palsCount),
        foundationDeck: stagedPlayerState.foundationDeck.slice(foundationCount),
        discardPile: [...opponentDeckDiscardIds, ...stagedPlayerState.discardPile],
      });
    }
    let playerStateAfterRandomDiscard = stagedPlayerState;
    if (opponentRandomDiscardIds.length) {
      playerStateAfterRandomDiscard = stagePlayerState({
        hand: opponentRandomDiscardIds.reduce((cards, cardId) => removeOneCard(cards, cardId), stagedPlayerState.hand),
        discardPile: [...opponentRandomDiscardIds, ...stagedPlayerState.discardPile],
      });
    }
    const currentHandLimit = Number((activeCondition?.effects ?? []).find((effect) => effect.type === "setHandLimit")?.amount ?? Infinity);
    const coralDamageResult = opponentResult.lost ? null : applyOpponentFoundationDamage(playerCoralsAfterSupports, stagedPlayerState.orphanCreatureInstances, opponentResult.foundationDamage, opponentResult.damageSourceName, stagedPlayerState.hand, stagedPlayerState.discardPile, currentHandLimit);
    let coralDamageSummary = "";
    let coralDamageCollateral = null;
    let playerStateAfterCoralDamage = stagedPlayerState;
    if (coralDamageResult) {
      const orphanCreatureInstances = reconcileCreatureZone(stagedPlayerState.orphanCreatureInstances, coralDamageResult.orphanCreatures ?? stagedPlayerState.orphanCreatureInstances, "player-orphan");
      const coralDamageProjection = projectNormalizedPlayerState({
        ...stagedPlayerState,
        corals: coralDamageResult.corals,
        orphanCreatureInstances,
        hand: coralDamageResult.hand ?? stagedPlayerState.hand,
        discardPile: coralDamageResult.discardPile ?? stagedPlayerState.discardPile,
      });
      playerStateAfterCoralDamage = coralDamageProjection.state;
      coralDamageCollateral = coralDamageProjection.collateral;
      stagedPlayerState = playerStateAfterCoralDamage;
      coralDamageSummary = coralDamageResult.summary;
    }
    const playerCoralsAfterDamage = playerStateAfterCoralDamage.corals ?? playerCoralsAfterSupports;
    const opponentOnPlayAttack = opponentResult.lost || !opponentResult.onPlayAttack?.attack ? null : runOpponentAttack(
      opponentStateAfterPlay,
      playerCoralsAfterDamage,
      playerStateAfterCoralDamage.reefCreatureInstances,
      playerStateAfterCoralDamage.orphanCreatureInstances,
      opponentResult.onPlayAttack,
      null,
      {
        rp: playerStateAfterCoralDamage.rp,
        blueCrabRecycleUsedTurn: playerStateAfterCoralDamage.blueCrabRecycleUsedTurn,
        creatureStatuses: playerStateAfterCoralDamage.creatureStatuses,
        resilienceUsedCardIds: playerStateAfterCoralDamage.resilienceUsedCardIds,
      },
    );
    const preservedOnPlayAttack = preserveOpponentNormalActionsAfterOnPlay(opponentOnPlayAttack);
    const opponentOnPlayAttackResolution = preservedOnPlayAttack
      ? buildOpponentAttackEventSequence(preservedOnPlayAttack, stagedPlayerState, opponentStateAfterPlay)
      : { events: [], playerState: stagedPlayerState, opponentState: opponentStateAfterPlay, summary: "" };
    if (opponentOnPlayAttack) stagePlayerState(opponentOnPlayAttackResolution.playerState);
    const opponentStateAfterOnPlayAttack = opponentOnPlayAttackResolution.opponentState;
    const playerStateAfterOnPlayAttack = opponentOnPlayAttackResolution.playerState;
    const onPlayHasPendingRegenerate = opponentOnPlayAttackResolution.events.some((event) => event.type === "choose-regenerate");
    const opponentVpAfterMandatoryResolution = getEcosystemVictoryPoints(
      opponentStateAfterOnPlayAttack.corals,
      opponentStateAfterOnPlayAttack.habitats,
      opponentStateAfterOnPlayAttack.reefCreatures,
      {
        controller: "opponent",
        localOrphans: opponentStateAfterOnPlayAttack.orphanCreatures,
        rivalCorals: playerStateAfterOnPlayAttack.corals,
        rivalOrphans: playerStateAfterOnPlayAttack.orphanCreatureInstances,
      },
    );
    const opponentVictoryAfterMandatoryResolution = !onPlayHasPendingRegenerate
      && opponentReachedVictoryOnPlay
      && opponentVpAfterMandatoryResolution >= victoryTarget;
    const opponentNormalActions = opponentResult.lost || onPlayHasPendingRegenerate || opponentVictoryAfterMandatoryResolution
      ? null
      : runOpponentNormalActions(opponentStateAfterOnPlayAttack, playerStateAfterOnPlayAttack);
    if (opponentNormalActions) stagePlayerState(opponentNormalActions.playerState);
    const opponentLostAfterUtility = opponentResult.lost || Boolean(opponentNormalActions?.lost);
    const opponentAttackResolution = {
      events: [...opponentOnPlayAttackResolution.events, ...(opponentNormalActions?.events ?? [])],
      playerState: opponentNormalActions?.playerState ?? opponentOnPlayAttackResolution.playerState,
      opponentState: opponentNormalActions?.opponentState ?? opponentOnPlayAttackResolution.opponentState,
      summary: [opponentOnPlayAttackResolution.summary, opponentNormalActions?.summary].filter(Boolean).join(" "),
    };
    const opponentStateAfterAttack = opponentAttackResolution.opponentState;
    const opponentStateWithInstances = normalizeProjectedOpponentState(reconcileOpponentInstances(opponent, opponentStateAfterAttack));
    const opponentVictoryLocked = !opponentLostAfterUtility && opponentVictoryAfterMandatoryResolution;
    const hasPendingRegenerate = opponentAttackResolution.events.some((event) => event.type === "choose-regenerate");
    const opponentHabitatMaintenance = hasPendingRegenerate || opponentLostAfterUtility || opponentVictoryLocked ? {
      habitats: opponentStateWithInstances.habitatInstances,
      destroyedHabitats: [],
      events: [],
    } : resolveEndOfTurnHabitatMaintenance(opponentStateWithInstances.habitatInstances, {
      cardsInPlay: getCardsInPlayForComposition(opponentStateWithInstances.corals, opponentStateWithInstances.reefCreatures, opponentStateWithInstances.orphanCreatures),
      cardLookup: cardsById,
      habitatLookup: cardsById,
    });
    let finalOpponentState = hasPendingRegenerate
      ? opponentStateWithInstances
      : {
          ...opponentStateWithInstances,
          flashingAlarmAttackBonus: endFlashingAlarmTurn(opponentStateWithInstances.flashingAlarmAttackBonus),
        };
    const habitatTurnEvents = [];
    opponentHabitatMaintenance.events.forEach((event) => {
      const message = event.destroyed
        ? `Opponent's ${cardsById[event.cardId]?.name} took ${event.appliedDamage} end-of-turn damage because its ecosystem requirement was not met and was destroyed.`
        : `Opponent's ${cardsById[event.cardId]?.name} took ${event.appliedDamage} end-of-turn damage because its ecosystem requirement was not met. ${event.currentHealth} HP remains.`;
      const nextHabitats = event.destroyed
        ? finalOpponentState.habitatInstances.filter((habitat) => habitat.instanceId !== event.instanceId)
        : finalOpponentState.habitatInstances.map((habitat) => habitat.instanceId === event.instanceId ? { ...habitat, currentHealth: event.currentHealth } : habitat);
      finalOpponentState = {
        ...finalOpponentState,
        habitats: nextHabitats.map((habitat) => habitat.cardId),
        habitatInstances: nextHabitats,
        discardPile: event.destroyed ? [event.cardId, ...finalOpponentState.discardPile] : finalOpponentState.discardPile,
      };
      habitatTurnEvents.push({ type: "opponent-impact", sourceCardId: event.cardId, title: event.destroyed ? "Opponent Habitat Destroyed" : "Opponent Habitat Deteriorated", message, success: event.destroyed, opponentStateAfter: finalOpponentState, logMessage: message });
    });
    if (!opponentHabitatMaintenance.events.length) {
      finalOpponentState = {
        ...finalOpponentState,
        habitats: opponentHabitatMaintenance.habitats.map((habitat) => habitat.cardId),
        habitatInstances: opponentHabitatMaintenance.habitats,
        discardPile: [...opponentHabitatMaintenance.destroyedHabitats.map((habitat) => habitat.cardId), ...finalOpponentState.discardPile],
      };
    }
    const opponentStunRecovery = resolveStunnedAtControllerTurnBoundary(finalOpponentState.corals, {
      turnComplete: !hasPendingRegenerate,
    });
    const opponentStunRecoverySummary = opponentStunRecovery.recoveredFoundationIds.length
      ? `${opponentStunRecovery.recoveredFoundationIds.length} opponent Coral${opponentStunRecovery.recoveredFoundationIds.length === 1 ? "" : "s"} recovered from Stunned at the end of its turn.`
      : "";
    finalOpponentState = { ...finalOpponentState, corals: opponentStunRecovery.foundations };

    const supportImpactEvents = supportImpactStages.map(({ impact, playerStateAfter }) => {
      if (impact.type === "spearfishing-owner-discard") {
        const targetName = cardsById[impact.cardId]?.name ?? "Your invading creature";
        const message = `Opponent used Spearfishing to remove ${targetName} from its reef. ${targetName} returned to your discard pile.`;
        return { type: "opponent-impact", sourceCardId: impact.sourceCardId, defenderCardId: impact.cardId, title: "Your Invader Was Removed", message, success: true, playerStateAfter, logMessage: message };
      }
      const message = `Opponent played ${cardsById[impact.sourceCardId]?.name}; your ${cardsById[supportTargetCoral.cardId]?.name} will produce ${impact.rpPenalty} less RP during its next collection.`;
      return { type: "opponent-impact", sourceCardId: impact.sourceCardId, defenderCardId: supportTargetCoral.cardId, title: `Opponent's ${cardsById[impact.sourceCardId]?.name} used ${impact.actionName}`, message, success: true, playerStateAfter, logMessage: message };
    });
    const remainingSupportImpacts = [...supportImpactEvents];
    (opponentResult.supportPlays ?? []).forEach((supportEvent) => {
      turnEvents.push({ ...supportEvent, logMessage: supportEvent.message });
      const matchingImpactIndex = remainingSupportImpacts.findIndex((impactEvent) => impactEvent.sourceCardId === supportEvent.sourceCardId);
      if (matchingImpactIndex >= 0) turnEvents.push(...remainingSupportImpacts.splice(matchingImpactIndex, 1));
    });
    turnEvents.push(...remainingSupportImpacts);
    const opponentPermanentPlays = opponentResult.permanentPlays
      ?? (opponentResult.playedCardId ? [{
        playedCardId: opponentResult.playedCardId,
        playSummary: opponentResult.playSummary,
        onPlayRevealedCardIds: opponentResult.onPlayRevealedCardIds ?? [],
      }] : []);
    opponentPermanentPlays.forEach((play, playIndex) => {
      const noTargetOnPlaySummary = playIndex === 0 && opponentOnPlayAttack?.noLegalTarget && !opponentOnPlayAttack.resolutionUnsupported
        ? ` ${opponentOnPlayAttackResolution.summary}`
        : "";
      const revealedCards = play.onPlayRevealedCardIds ?? [];
      const message = `${play.playSummary}${noTargetOnPlaySummary}${revealedCards.length ? " Its searched card selection is revealed below." : ""}`;
      turnEvents.push({ type: "opponent-play", sourceCardId: play.playedCardId, title: `Opponent played ${cardsById[play.playedCardId]?.name}`, message, revealedCards, success: true, opponentStateAfter: opponentStateAfterPlay, playerStateAfter: playerStateAfterInvasion, logMessage: message });
    });
    if (opponentResult.supportBlock) {
      const message = `Opponent's ${opponentResult.damageSourceName} used ${opponentResult.supportBlock.actionName}. You cannot play Support cards during your next turn.`;
      turnEvents.push({ type: "opponent-impact", sourceCardId: opponentResult.damageSourceCardId, title: `Opponent's ${opponentResult.damageSourceName} used ${opponentResult.supportBlock.actionName}`, message, success: true, playerStateAfter: playerStateAfterSupportBlock, logMessage: message });
    }
    if (opponentDeckDiscardIds.length) {
      const names = opponentDeckDiscardIds.map((cardId) => cardsById[cardId]?.name ?? cardId).join(", ");
      const message = `Opponent's ${opponentResult.damageSourceName} discarded ${names} from the top of your personal decks (Pals first).`;
      turnEvents.push({ type: "opponent-impact", sourceCardId: opponentResult.damageSourceCardId, defenderCardId: opponentDeckDiscardIds[0], title: `Opponent's ${opponentResult.damageSourceName} used ${opponentResult.deckDiscard.actionName}`, message, success: true, playerStateAfter: playerStateAfterDeckDiscard, logMessage: message });
    }
    if (opponentRandomDiscardIds.length) {
      const names = opponentRandomDiscardIds.map((cardId) => cardsById[cardId]?.name ?? cardId).join(", ");
      const message = `Opponent's ${opponentResult.damageSourceName} discarded ${names} at random from your hand.`;
      turnEvents.push({ type: "opponent-impact", sourceCardId: opponentResult.damageSourceCardId, defenderCardId: opponentRandomDiscardIds[0], title: `Opponent's ${opponentResult.damageSourceName} used ${opponentResult.randomDiscard.actionName}`, message, success: true, playerStateAfter: playerStateAfterRandomDiscard, logMessage: message });
    }
    if (coralDamageResult) {
      turnEvents.push({
        type: "opponent-impact",
        sourceCardId: opponentResult.damageSourceCardId,
        title: `Opponent's ${opponentResult.damageSourceName} used ${opponentResult.foundationDamage?.actionName ?? getOnPlayAbilityName(cardsById[opponentResult.damageSourceCardId])}`,
        message: coralDamageSummary,
        success: coralDamageResult.discardedCardIds.length > 0,
        playerStateAfter: playerStateAfterCoralDamage,
        logMessage: coralDamageSummary,
      });
      const collapseEvent = buildContinuousHealthCollapseEvent(coralDamageCollateral, {
        sourceCardId: opponentResult.damageSourceCardId,
        playerStateAfter: playerStateAfterCoralDamage,
        opponentSequence: true,
      });
      if (collapseEvent) turnEvents.push(collapseEvent);
    }
    turnEvents.push(...opponentAttackResolution.events);
    const opponentSummary = [opponentParasiteMessage, opponentResult.summary, coralDamageResult?.summary, getContinuousHealthCollapseMessage(coralDamageCollateral), opponentAttackResolution.summary, ...habitatTurnEvents.map((event) => event.message), opponentStunRecoverySummary].filter(Boolean).join(" ");
    turnEvents.push(...habitatTurnEvents);
    const normalizedFinalPlayerState = normalizeProjectedPlayerState(stagedPlayerState);
    const finalPlayerVp = getEcosystemVictoryPoints(
      normalizedFinalPlayerState.corals,
      playerHabitats,
      normalizedFinalPlayerState.reefCreatureInstances.map((instance) => instance.cardId),
      {
        controller: "player",
        localOrphans: normalizedFinalPlayerState.orphanCreatureInstances,
        rivalCorals: finalOpponentState.corals,
        rivalOrphans: finalOpponentState.orphanCreatures,
      },
    );
    const finalOpponentVp = getEcosystemVictoryPoints(finalOpponentState.corals, finalOpponentState.habitats, finalOpponentState.reefCreatures, {
      controller: "opponent",
      localOrphans: finalOpponentState.orphanCreatures,
      rivalCorals: normalizedFinalPlayerState.corals,
      rivalOrphans: normalizedFinalPlayerState.orphanCreatureInstances,
    });
    const stagedVictoryResult = hasPendingRegenerate ? null : determineVictoryResult(finalPlayerVp, finalOpponentVp, victoryTarget);
    turnEvents.push({
      type: "turn-transition",
      title: "Your Turn",
      message: "The opponent's turn is complete.",
      actions: splitTurnActionLines(opponentSummary),
      advanceRoundAfterClose: !openingOpponentTurn,
      startOpeningPlayerTurnAfterClose: openingOpponentTurn,
      opponentStateAfter: finalOpponentState,
      gameResultAfter: opponentLostAfterUtility ? "Victory: the opponent could not complete a required draw from its personal decks." : opponentVictoryLocked ? `Defeat: the opponent was first to reach ${victoryTarget} VP.` : stagedVictoryResult?.message ?? null,
    });
    queueEvents(turnEvents.map((event) => ({ ...event, opponentSequence: true })));
  }

  function cancelOpeningCoinFlip() {
    openingCoinFlipIdRef.current += 1;
    openingCoinFlipActiveRef.current = false;
  }

  function prepareOpeningCoinFlip(call) {
    cancelOpeningCoinFlip();
    setEventOverlay(createOpeningCoinReadyOverlay({ call }));
  }

  function flipForOpeningTurn() {
    if (eventOverlay?.type !== OpeningCoinPhase.READY || openingCoinFlipActiveRef.current) return;
    openingCoinFlipActiveRef.current = true;
    const flipId = openingCoinFlipIdRef.current + 1;
    openingCoinFlipIdRef.current = flipId;
    const result = resolveOpeningCoinFlip({
      call: eventOverlay.coinCall,
      random: Math.random,
      forcedWinner: tutorialUsesScriptedScenario ? OpeningPlayer.PLAYER : null,
    });
    setEventOverlay(createOpeningCoinFlippingOverlay({
      result,
      flipId,
      tutorial: tutorialUsesScriptedScenario,
    }));
  }

  function completeOpeningCoinFlip(flipId) {
    if (openingCoinFlipIdRef.current !== flipId) return;
    openingCoinFlipActiveRef.current = false;
    setEventOverlay((currentOverlay) => {
      if (currentOverlay?.type !== OpeningCoinPhase.FLIPPING || currentOverlay.flipId !== flipId) {
        return currentOverlay;
      }
      return createOpeningCoinResultOverlay({
        result: {
          call: currentOverlay.coinCall,
          landed: currentOverlay.coinLanded,
          winner: currentOverlay.coinWinner,
        },
        opponentName: isStoryMode ? storyOpponentName : "The opponent",
      });
    });
  }

  function chooseOpeningTurn(playerChoice = OpeningPlayer.PLAYER) {
    cancelOpeningCoinFlip();
    const chosenStarter = chooseOpeningPlayer({
      winner: eventOverlay?.coinWinner,
      playerChoice,
      tutorial: tutorialUsesScriptedScenario,
    });
    setStartingPlayer(chosenStarter);
    setOpeningOpponentTurn(false);
    setEventOverlay({
      type: "round-transition",
      title: "Setup Round",
      message: `Build the foundation of your ecosystem. You have 3 RP and eight opening cards: play a valid base Coral or Creature School, then ${chosenStarter === OpeningPlayer.PLAYER ? "you will take" : "the opponent will take"} the first turn.`,
      success: true,
    });
    pushLog(chosenStarter === OpeningPlayer.PLAYER
      ? "You will take the first turn after setup."
      : "The opponent will take the first turn after setup.");
  }

  function openOpeningCoinFlip() {
    cancelOpeningCoinFlip();
    setEventOverlay(createOpeningCoinCallOverlay({
      tutorial: tutorialUsesScriptedScenario,
      guideName: tutorialGuide.name,
    }));
    setTurnLog(["The opening coin flip will decide who takes the first turn."]);
  }

  function finishTutorialBoardTour() {
    setTutorialBoardTourStep(null);
    openOpeningCoinFlip();
  }

  function advanceTutorialBoardTour() {
    const nextStep = getNextGuidedAcademyBoardTourStep(tutorialBoardTourStep);
    if (nextStep === null) {
      finishTutorialBoardTour();
      return;
    }
    setTutorialBoardTourStep(nextStep);
  }

  function restartGame(deckId = selectedDeckId, opponentDeckId = selectedOpponentDeckId, nextVictoryTarget = pendingVictoryTarget, nextOpponentDifficulty = pendingOpponentDifficulty) {
    cancelOpeningCoinFlip();
    const nextGame = createInitialGameState(
      deckId,
      opponentDeckId,
      tutorialUsesScriptedScenario ? createSeededRandom(0x5ea9a15) : Math.random,
      {
        scriptedTutorial: tutorialUsesScriptedScenario,
        playerDeckSnapshot: isStoryMode ? storyPlayerDeckSnapshot : null,
      },
    );
    const deckName = isStoryMode && storyPlayerDeckSnapshot
      ? storyPlayerDeckSnapshot.name
      : prebuiltDecks.find((deck) => deck.id === deckId)?.name ?? deckId;
    const opponentDeckName = getPlayableDeckById(opponentDeckId)?.name ?? opponentDeckId;
    const normalizedDifficulty = normalizeOpponentDifficulty(nextOpponentDifficulty);
    const difficultyLabel = getOpponentDifficultyProfile(normalizedDifficulty).label;
    setSelectedDeckId(deckId);
    setSelectedOpponentDeckId(opponentDeckId);
    setOpponentDifficulty(normalizedDifficulty);
    setPendingOpponentDifficulty(normalizedDifficulty);
    setVictoryTarget(nextVictoryTarget);
    setPendingVictoryTarget(nextVictoryTarget);
    setScriptedTutorialScenario(nextGame.scriptedTutorialScenario);
    setFoundationDeck(nextGame.foundationDeck);
    setPalsDeck(nextGame.palsDeck);
    setHand(nextGame.hand);
    setPlayerCorals([]);
    setBubbleBursts([]);
    setPlayerHabitats([]);
    setPlayerReefCreatures([]);
    setPlayerOrphanCreatures([]);
    setOpponent(nextGame.opponent);
    setOpponentThinking(false);
    if (opponentThinkingTimerRef.current) clearTimeout(opponentThinkingTimerRef.current);
    opponentThinkingTimerRef.current = null;
    setDiscardPile([]);
    setLostZone([]);
    setConditionDeck(nextGame.conditionDeck);
    setActiveConditionId(null);
    setPersistentConditionIds([]);
    setConditionDensityUses({});
    setSchoolDensityCommitmentsByInstanceId({});
    setBlueCrabRecycleUsedTurn(null);
    setResilienceUsedCardIds([]);
    setRound(0);
    setGamePhase("setup");
    setStartingPlayer(null);
    setOpeningOpponentTurn(false);
    setTurn(1);
    setRp(3);
    setHasDrawnThisTurn(false);
    setTurnDrawSelection(null);
    setTurnDrawResult(null);
    setModal(null);
    setSelectedHandCard(null);
    setHandPopoverCardId(null);
    setPlayingCardId(null);
    setUsedAttackers([]);
    setActionCooldowns({});
    setSupportLockSourceId(null);
    setSupportBlockedUntilRound(0);
    setCardsBlockedFromPlayThisTurn([]);
    setUsedCreatureActions([]);
    setPendingCreatureAction(null);
    setCreatureStatuses({});
    setPoisonImmunityNextPredatorAttack(false);
    setRovLightsActive(false);
    setNextOnPlayAttackBonus(null);
    setFlashingAlarmAttackBonus(null);
    setAttackContext(null);
    setSearchContext(null);
    setGameResult(null);
    tutorialVpRef.current = {
      player: 0,
      opponent: getEcosystemVictoryPoints(
        nextGame.opponent.corals,
        nextGame.opponent.habitats,
        [
          ...nextGame.opponent.reefCreatures,
          ...(nextGame.opponent.orphanCreatures ?? []).flatMap((entry) => [
            entry.cardId,
            ...(entry.hostedCardIds ?? []),
          ]),
        ],
      ),
    };
    setInspectedCard(null);
    setHandLimitDiscardSelection([]);
    setEventOverlay(tutorialUsesScriptedScenario ? null : createOpeningCoinCallOverlay());
    setPendingEvents([]);
    setFaceoffRolling(false);
    setFaceoffPreview(null);
    setTurnLog(tutorialUsesScriptedScenario
      ? [`${tutorialGuide.name} is walking you around the match board before the opening coin flip.`]
      : ["The opening coin flip will decide who takes the first turn."]);
    setPlayError("");
    setTutorialLayoutProgress(createGuidedAcademyLayoutProgress());
    setEcosystemZoom(1);
    setEcosystemOffset({ x: 0, y: 0 });
    setOpponentEcosystemZoom(1);
    setOpponentEcosystemOffset({ x: 0, y: 0 });
    setOpponentViewportTouched(false);
    setFloatingCardOffsets({});
    setFloatingCardDrag(null);
    const unavailablePlayerCards = getUnavailableDeckEntries(
      deckId,
      isStoryMode ? storyPlayerDeckSnapshot : null,
    );
    const unavailableOpponentCards = getUnavailableDeckEntries(opponentDeckId);
    const unavailableWarnings = [
      unavailablePlayerCards.length ? `Deck data warning: ${unavailablePlayerCards.map((entry) => `${entry.unavailableName ?? entry.cardId} ×${entry.quantity}`).join(", ")} ${unavailablePlayerCards.length === 1 ? "is" : "are"} listed in your deck but have no card rules in the repository, so those copies are excluded.` : null,
      unavailableOpponentCards.length ? `Opponent deck data warning: ${unavailableOpponentCards.map((entry) => `${entry.unavailableName ?? entry.cardId} ×${entry.quantity}`).join(", ")} ${unavailableOpponentCards.length === 1 ? "is" : "are"} missing repository card rules and excluded.` : null,
    ].filter(Boolean);
    setLog([...unavailableWarnings, tutorialUsesScriptedScenario
      ? `New guided aquarium lesson started: your ${deckName} versus ${tutorialGuide.name}'s prepared practice reef. Tour the board before calling the opening coin flip.`
      : `New ${difficultyLabel} game started: your ${deckName} versus the opponent's ${opponentDeckName}. Call the opening coin flip to decide who takes the first turn.`]);
  }

  function restartStoryGame(reason = eventOverlay?.initial ? "begin" : "retry") {
    storyResultRecordedRef.current = false;
    setTutorialExitConfirmationOpen(false);
    setTutorialHelpDismissedId(null);
    setTutorialBoardTourStep(tutorialContract && tutorialUsesScriptedScenario ? 0 : null);
    if (tutorialContract) {
      if (reason === "begin") {
        emitTutorialEvent(SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_STARTED, {
          reason,
          playerDeckId: storyPlayerDeckId,
          opponentDeckId: storyOpponentDeckId,
          victoryTarget: storyVictoryTarget,
        }, { actor: "system", phase: "setup", round: 0, turn: 1 });
      } else {
        const restartedProgress = restartSimulatorTutorialProgress(tutorialContract, tutorialProgressRef.current);
        tutorialProgressRef.current = restartedProgress;
        tutorialEventIdRef.current = 0;
        setTutorialProgress(restartedProgress);
        const restartEvent = emitTutorialEvent(SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_RESTARTED, {
          reason,
          playerDeckId: storyPlayerDeckId,
          opponentDeckId: storyOpponentDeckId,
          victoryTarget: storyVictoryTarget,
        }, { actor: "system", phase: "setup", round: 0, turn: 1 });
        notifyTutorialCallback("onRetry", restartEvent?.event ?? null, tutorialProgressRef.current);
      }
    }
    restartGame(storyPlayerDeckId, storyOpponentDeckId, storyVictoryTarget, storyDifficulty);
  }

  function returnToStoryTown(reason = gameResult ? "duel-complete" : "player-exit") {
    if (!isStoryMode) return;
    if (!tutorialContract) {
      storyMode?.onExit?.();
      return;
    }
    const exitEvent = emitTutorialEvent(SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_EXITED, {
      reason,
      duelOutcome: tutorialProgressRef.current?.lastDuelOutcome ?? null,
    }, { actor: "system", phase: gameResult ? "result" : gamePhase });
    notifyTutorialCallback("onExit", exitEvent?.event ?? null, tutorialProgressRef.current);
    storyMode?.onExit?.({
      reason,
      tutorialEvent: exitEvent?.event ?? null,
      tutorialProgress: tutorialProgressRef.current,
    });
  }

  function exitStoryMode() {
    if (gameResult) {
      returnToStoryTown("duel-complete");
      return;
    }
    returnToStoryTown("player-exit");
  }

  function requestStoryExit() {
    if (tutorialExitRequiresConfirmation) {
      setTutorialExitConfirmationOpen(true);
      return;
    }
    exitStoryMode();
  }

  function confirmTutorialExit() {
    setTutorialExitConfirmationOpen(false);
    const historyGuard = tutorialHistoryGuardRef.current;
    if (
      !historyGuard
      || window.history.state?.[TUTORIAL_HISTORY_GUARD_STATE_KEY] !== historyGuard.token
    ) {
      exitStoryMode();
      return;
    }

    historyGuard.allowNavigation = true;
    let completed = false;
    let fallbackTimer = null;
    const completeExit = () => {
      if (completed) return;
      completed = true;
      window.removeEventListener("popstate", completeExit);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      exitStoryMode();
    };
    window.addEventListener("popstate", completeExit, { once: true });
    window.history.back();
    fallbackTimer = window.setTimeout(completeExit, 500);
  }

  function openNewGameSetup() {
    if (isStoryMode) {
      restartStoryGame();
      return;
    }
    setPendingVictoryTarget(victoryTarget);
    setPendingOpponentDifficulty(opponentDifficulty);
    setEventOverlay({
      type: "new-game-setup",
      title: "Start a New SeaPals Game",
      message: "Choose a deck for each side. You will open with four Foundation and four Pals cards, play a base Coral or Creature School during setup, then race to the selected VP target.",
    });
  }

  const modalCards = useMemo(() => {
    if (modal === "hand") return hand;
    if (modal === "discard") return discardPile;
    if (modal === "lost") return lostZone;
    if (modal === "search" || modal === "recover" || modal === "lost-recover" || modal === "coral-target" || modal === "restock") return searchContext?.candidates ?? [];
    return [];
  }, [modal, hand, discardPile, lostZone, searchContext]);

  const modalTitle = modal === "hand" ? "Your Hand" : modal === "discard" ? "Discard Pile" : modal === "search" ? "Search Your Decks" : modal === "recover" ? "Recover a Card" : modal === "lost-recover" ? "Recover from the Lost Zone" : modal === "coral-target" ? "Choose a Coral" : modal === "restock" ? "Choose Up to Three Fish" : modal === "support-draw" ? "Choose Dr. Evans' Cards" : modal === "turn-draw" ? "Choose Your Cards" : modal === "draw-result" ? "Cards Drawn" : "Lost Zone";
  const isDarkZoneModal = Boolean(modal);
  const selectedHandPlayError =
    modal === "hand" && selectedHandCard ? getPlayError(cardsById[selectedHandCard]) : "";
  const handPopoverCard = handPopoverCardId && hand.includes(handPopoverCardId) ? cardsById[handPopoverCardId] : null;
  const handPopoverPlayError = handPopoverCard ? getPlayError(handPopoverCard) : "";
  const visiblePlayError = playError || selectedHandPlayError;
  const accessibilitySettingsAvailable = typeof onOpenAccessibilitySettings === "function";
  const canOpenAccessibilitySettings = accessibilitySettingsAvailable
    && gamePhase === "main"
    && !opponentThinking
    && !eventOverlay
    && !modal
    && !faceoffRolling;
  const isOpeningCoinEvent = eventOverlay?.type?.startsWith("opening-coin-") === true;

  return (
    <main className={`seapals-game-shell fixed inset-0 z-30 overflow-hidden bg-[#061522] p-2 text-slate-100 sm:p-3${accessibilityReducedMotion ? " seapals-reduced-motion" : ""}${accessibilityHighContrast ? " seapals-high-contrast" : ""}`}>
      <style jsx global>{`
        @keyframes seapalsDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes seapalsEventPop { 0% { transform: scale(.88); opacity: 0; } 65% { transform: scale(1.025); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes seapalsCoinReady {
          0%, 100% { transform: translateY(0) rotateX(7deg) rotateY(-8deg); }
          50% { transform: translateY(-.45rem) rotateX(-4deg) rotateY(8deg); }
        }
        @keyframes seapalsCoinReadyTails {
          0%, 100% { transform: translateY(0) rotateX(7deg) rotateY(172deg); }
          50% { transform: translateY(-.45rem) rotateX(-4deg) rotateY(188deg); }
        }
        @keyframes seapalsCoinFlipHeads {
          0% { transform: translateY(0) rotateY(0deg) rotateZ(0deg); }
          44% { transform: translateY(-5.25rem) rotateY(900deg) rotateZ(12deg); }
          78% { transform: translateY(.25rem) rotateY(1620deg) rotateZ(-6deg); }
          89% { transform: translateY(-.85rem) rotateY(1740deg) rotateZ(3deg); }
          100% { transform: translateY(0) rotateY(1800deg) rotateZ(0deg); }
        }
        @keyframes seapalsCoinFlipTails {
          0% { transform: translateY(0) rotateY(0deg) rotateZ(0deg); }
          44% { transform: translateY(-5.25rem) rotateY(990deg) rotateZ(12deg); }
          78% { transform: translateY(.25rem) rotateY(1800deg) rotateZ(-6deg); }
          89% { transform: translateY(-.85rem) rotateY(1920deg) rotateZ(3deg); }
          100% { transform: translateY(0) rotateY(1980deg) rotateZ(0deg); }
        }
        @keyframes seapalsCoinShadow {
          0%, 100% { opacity: .5; transform: scaleX(1); }
          44% { opacity: .14; transform: scaleX(.46); }
          78% { opacity: .6; transform: scaleX(1.08); }
          89% { opacity: .32; transform: scaleX(.76); }
        }
        @keyframes seapalsHudGlow { 0%, 100% { box-shadow: 0 0 0 rgba(34,211,238,0); } 50% { box-shadow: 0 0 26px rgba(34,211,238,.16); } }
        @keyframes seapalsPlayableCard { 0%, 49% { background-color: rgba(52,211,153,.26); box-shadow: inset 0 0 24px rgba(110,231,183,.12), 0 0 18px rgba(52,211,153,.18); } 50%, 100% { background-color: rgba(34,211,238,.08); box-shadow: none; } }
        @keyframes seapalsSlotBeacon { 0%, 49% { background-color: rgba(110,231,183,.28); box-shadow: 0 0 0 10px rgba(52,211,153,.12), 0 0 42px rgba(52,211,153,.65); filter: brightness(1.25); } 50%, 100% { background-color: rgba(16,185,129,.07); box-shadow: 0 0 0 4px rgba(52,211,153,.05); filter: brightness(.92); } }
        @keyframes seapalsTutorialFocus { 0%, 100% { outline-color: rgba(251,191,36,.7); box-shadow: 0 0 0 4px rgba(251,191,36,.16), 0 0 24px rgba(251,191,36,.34); } 50% { outline-color: rgba(254,240,138,1); box-shadow: 0 0 0 7px rgba(251,191,36,.25), 0 0 42px rgba(251,191,36,.58); } }
        @keyframes seapalsDialogueTurnIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes seapalsTypeCursorBlink { 0%, 45% { opacity: 1; } 46%, 100% { opacity: .12; } }
        @keyframes seapalsTargetBeaconIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes seapalsTargetArrowBob { 0%, 100% { opacity: 1; } 50% { opacity: .62; } }
        .seapals-game-shell {
          background-image:
            radial-gradient(circle at 12% 8%, rgba(14,165,233,.18), transparent 30%),
            radial-gradient(circle at 88% 92%, rgba(16,185,129,.14), transparent 34%),
            linear-gradient(145deg, #061522 0%, #071b2d 48%, #04111d 100%);
        }
        .seapals-hud-panel { background: linear-gradient(145deg, rgba(15,35,52,.96), rgba(8,24,39,.96)); }
        .seapals-arena-frame { box-shadow: 0 24px 80px rgba(0,0,0,.42), inset 0 1px rgba(255,255,255,.06); }
        .seapals-turn-button:not(:disabled) { animation: seapalsHudGlow 2.4s ease-in-out infinite; }
        .seapals-opening-coin-stage {
          position: relative;
          display: flex;
          min-height: 11.5rem;
          align-items: center;
          justify-content: center;
          perspective: 900px;
        }
        .seapals-opening-coin {
          position: relative;
          z-index: 2;
          width: 7rem;
          height: 7rem;
          border-radius: 999px;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .seapals-opening-coin-face {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: .38rem solid #fef3c7;
          border-radius: 999px;
          backface-visibility: hidden;
          color: #422006;
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,.78), transparent 18%),
            linear-gradient(145deg, #fde68a 0%, #f59e0b 58%, #b45309 100%);
          box-shadow:
            inset 0 0 0 .18rem rgba(120,53,15,.5),
            inset -.5rem -.6rem 1rem rgba(120,53,15,.28),
            0 .6rem 1.4rem rgba(2,8,23,.38);
          text-shadow: 0 1px rgba(255,255,255,.48);
        }
        .seapals-opening-coin-face strong {
          font-size: 3.25rem;
          font-weight: 950;
          line-height: .9;
        }
        .seapals-opening-coin-face span {
          margin-top: .35rem;
          font-size: .6rem;
          font-weight: 950;
          letter-spacing: .16em;
        }
        .seapals-opening-coin-heads { transform: translateZ(.32rem); }
        .seapals-opening-coin-tails { transform: rotateY(180deg) translateZ(.32rem); }
        .seapals-opening-coin-ready-heads { transform: rotateY(0deg); animation: seapalsCoinReady 1.8s ease-in-out infinite; }
        .seapals-opening-coin-ready-tails { transform: rotateY(180deg); animation: seapalsCoinReadyTails 1.8s ease-in-out infinite; }
        .seapals-opening-coin-flipping-heads { animation: seapalsCoinFlipHeads 1.35s cubic-bezier(.22,.72,.25,1) forwards; }
        .seapals-opening-coin-flipping-tails { animation: seapalsCoinFlipTails 1.35s cubic-bezier(.22,.72,.25,1) forwards; }
        .seapals-opening-coin-landed-heads { transform: rotateY(0deg); }
        .seapals-opening-coin-landed-tails { transform: rotateY(180deg); }
        .seapals-opening-coin-shadow {
          position: absolute;
          z-index: 1;
          bottom: 1.3rem;
          width: 5.5rem;
          height: .8rem;
          border-radius: 999px;
          background: rgba(2,8,23,.68);
          filter: blur(.25rem);
        }
        .seapals-opening-coin-shadow-flipping { animation: seapalsCoinShadow 1.35s ease-in-out forwards; }
        .seapals-opening-coin-trigger {
          display: inline-flex;
          min-width: 13rem;
          flex-direction: column;
          align-items: center;
          border: 2px solid rgba(251,191,36,.58);
          border-radius: 1.5rem;
          padding: .5rem 1.2rem 1rem;
          color: #fef3c7;
          background: linear-gradient(180deg, rgba(120,53,15,.12), rgba(15,23,42,.58));
          box-shadow: 0 16px 42px rgba(2,8,23,.3);
          cursor: pointer;
        }
        .seapals-opening-coin-trigger:hover { border-color: #fde68a; background-color: rgba(251,191,36,.08); }
        .seapals-opening-coin-trigger:hover .seapals-opening-coin { animation-duration: .9s; }
        .seapals-opening-coin-trigger:focus-visible {
          outline: 4px solid #22d3ee;
          outline-offset: 4px;
          border-color: #fef3c7;
        }
        .seapals-tutorial-target {
          outline: 3px solid #fbbf24 !important;
          outline-offset: 3px;
          animation: seapalsTutorialFocus 1.15s ease-in-out infinite !important;
        }
        .seapals-professor-coach-wrap {
          position: absolute;
          z-index: 160;
          top: 5.25rem;
          left: 1rem;
          width: min(32rem, calc(100% - 2rem));
          pointer-events: none;
        }
        .seapals-professor-coach-wrap-low {
          top: auto;
          bottom: 1rem;
        }
        .seapals-professor-coach-wrap-anchored {
          position: fixed;
          top: auto;
          right: auto;
          bottom: auto;
          left: auto;
          width: min(32rem, calc(100vw - 1.5rem));
          transition: left 240ms ease-out, top 240ms ease-out;
        }
        .seapals-professor-coach-arrow {
          position: absolute;
          z-index: 3;
          display: grid;
          width: 2.75rem;
          height: 2.75rem;
          place-items: center;
          color: #fbbf24;
          font-size: 2.6rem;
          font-weight: 950;
          line-height: 1;
          pointer-events: none;
          filter: drop-shadow(0 3px 2px rgba(2, 8, 23, .72));
        }
        .seapals-professor-coach-side-above .seapals-professor-coach-arrow,
        .seapals-professor-coach-side-below .seapals-professor-coach-arrow {
          left: var(--seapals-coach-arrow-offset);
          transform: translateX(-50%);
        }
        .seapals-professor-coach-side-above .seapals-professor-coach-arrow {
          top: calc(100% - .2rem);
        }
        .seapals-professor-coach-side-below .seapals-professor-coach-arrow {
          bottom: calc(100% - .2rem);
        }
        .seapals-professor-coach-side-left .seapals-professor-coach-arrow,
        .seapals-professor-coach-side-right .seapals-professor-coach-arrow {
          top: var(--seapals-coach-arrow-offset);
          transform: translateY(-50%);
        }
        .seapals-professor-coach-side-left .seapals-professor-coach-arrow {
          left: calc(100% - .2rem);
        }
        .seapals-professor-coach-side-right .seapals-professor-coach-arrow {
          right: calc(100% - .2rem);
        }
        .seapals-professor-card {
          position: relative;
          display: flex;
          gap: .75rem;
          overflow: hidden;
          padding: 1rem 3.5rem 1rem 1rem;
          border: 2px solid rgba(14, 116, 144, .42);
          border-radius: 1.5rem;
          color: #0f172a;
          background: linear-gradient(135deg, #fffdf4 0%, #f2fbfa 55%, #dff8fb 100%);
          box-shadow: 0 20px 56px rgba(2, 8, 23, .42), 0 0 0 5px rgba(103, 232, 249, .08);
          pointer-events: auto;
        }
        .seapals-professor-card-inline {
          margin: 1rem 0;
          padding: .75rem 3.25rem .75rem .75rem;
          border-radius: 1.125rem;
          box-shadow: 0 12px 32px rgba(2, 8, 23, .28);
        }
        .seapals-professor-dialogue {
          display: flex;
          flex-direction: column;
          gap: .5rem;
          max-height: min(10rem, 24dvh);
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-right: .25rem;
          scrollbar-gutter: stable;
        }
        .seapals-professor-turn {
          width: fit-content;
          max-width: 92%;
          padding: .55rem .7rem;
          border: 1px solid rgba(14, 116, 144, .16);
          border-radius: 1rem;
          font-size: .75rem;
          font-weight: 650;
          line-height: 1.5;
          opacity: 0;
          animation: seapalsDialogueTurnIn 300ms ease-out forwards;
        }
        .seapals-professor-turn-left {
          align-self: flex-start;
          border-bottom-left-radius: .3rem;
          color: #334155;
          background: rgba(255, 255, 255, .86);
        }
        .seapals-professor-turn-header {
          display: flex;
          min-height: 2rem;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          margin-bottom: .15rem;
        }
        .seapals-professor-speaker {
          display: block;
          color: #0e7490;
          font-size: .55rem;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .seapals-professor-show-all {
          flex: 0 0 auto;
          min-height: 2rem;
          padding: .3rem .6rem;
          border: 1px solid rgba(14, 116, 144, .24);
          border-radius: 999px;
          color: #155e75;
          background: rgba(207, 250, 254, .72);
          font-size: .6rem;
          font-weight: 950;
          letter-spacing: .05em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .seapals-professor-show-all:hover,
        .seapals-professor-show-all:focus-visible {
          border-color: #0891b2;
          background: #cffafe;
          outline: 2px solid rgba(8, 145, 178, .28);
          outline-offset: 2px;
        }
        .seapals-professor-typewriter {
          display: grid;
          min-width: 0;
          margin: 0;
        }
        .seapals-professor-message-measure,
        .seapals-professor-message-visible {
          grid-area: 1 / 1;
          min-width: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .seapals-professor-message-measure { visibility: hidden; }
        .seapals-professor-message-visible { align-self: start; }
        .seapals-professor-type-cursor {
          display: inline-block;
          width: .12rem;
          height: 1em;
          margin-left: .08rem;
          border-radius: 999px;
          vertical-align: -.12em;
          background: #0891b2;
          animation: seapalsTypeCursorBlink .7s step-end infinite;
        }
        .seapals-professor-next {
          opacity: 0;
          animation: seapalsDialogueTurnIn 300ms ease-out forwards;
        }
        .seapals-target-beacon {
          position: fixed;
          z-index: 120;
          display: flex;
          width: min(19rem, calc(100vw - 1rem));
          align-items: center;
          gap: .6rem;
          padding: .65rem 2.4rem .65rem .7rem;
          border: 2px solid rgba(14, 116, 144, .58);
          border-radius: 1rem;
          color: #0f172a;
          background: linear-gradient(135deg, #fffdf4 0%, #ecfeff 100%);
          box-shadow: 0 16px 44px rgba(2, 8, 23, .48), 0 0 0 5px rgba(251, 191, 36, .16);
          pointer-events: none;
          animation: seapalsTargetBeaconIn 220ms ease-out;
        }
        .seapals-target-beacon-above { transform: translate(-50%, -100%); }
        .seapals-target-beacon-below { transform: translate(-50%, 0); }
        .seapals-target-beacon .seapals-professor-portrait {
          width: 2.75rem;
          height: 2.75rem;
          border-radius: .75rem;
        }
        .seapals-target-beacon strong {
          display: block;
          color: #0e7490;
          font-size: .62rem;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .seapals-target-beacon span:not(.seapals-professor-portrait):not(.seapals-target-beacon-arrow) {
          display: block;
          margin-top: .12rem;
          font-size: .75rem;
          font-weight: 800;
          line-height: 1.35;
        }
        .seapals-target-beacon-arrow {
          position: absolute;
          left: calc(50% + var(--seapals-target-arrow-shift, 0px));
          width: 1.125rem;
          height: var(--seapals-target-arrow-length, 24px);
          color: #fbbf24;
          transform: translateX(-50%);
          filter: drop-shadow(0 3px 2px rgba(2, 8, 23, .7));
          animation: seapalsTargetArrowBob .8s ease-in-out infinite;
        }
        .seapals-target-beacon-arrow::before,
        .seapals-target-beacon-arrow::after {
          position: absolute;
          left: 50%;
          content: "";
          transform: translateX(-50%);
        }
        .seapals-target-beacon-arrow::before {
          width: 3px;
          border-radius: 999px;
          background: currentColor;
        }
        .seapals-target-beacon-above .seapals-target-beacon-arrow { top: 100%; }
        .seapals-target-beacon-above .seapals-target-beacon-arrow::before {
          top: 0;
          height: calc(100% - 7px);
        }
        .seapals-target-beacon-above .seapals-target-beacon-arrow::after {
          bottom: 0;
          border-top: 8px solid currentColor;
          border-right: 6px solid transparent;
          border-left: 6px solid transparent;
        }
        .seapals-target-beacon-below .seapals-target-beacon-arrow {
          bottom: 100%;
        }
        .seapals-target-beacon-below .seapals-target-beacon-arrow::before {
          top: 7px;
          height: calc(100% - 7px);
        }
        .seapals-target-beacon-below .seapals-target-beacon-arrow::after {
          top: 0;
          border-right: 6px solid transparent;
          border-bottom: 8px solid currentColor;
          border-left: 6px solid transparent;
        }
        .seapals-professor-portrait {
          position: relative;
          display: block;
          flex: 0 0 auto;
          width: 6rem;
          height: 6rem;
          overflow: hidden;
          border: 2px solid rgba(8, 145, 178, .4);
          border-radius: 1rem;
          background: linear-gradient(145deg, #cffafe, #a7f3d0);
          box-shadow: inset 0 0 18px rgba(255, 255, 255, .52);
        }
        .seapals-professor-portrait-compact {
          width: 3.5rem;
          height: 3.5rem;
          border-radius: .875rem;
        }
        .seapals-professor-hide {
          position: absolute;
          top: .5rem;
          right: .5rem;
          display: inline-flex;
          min-width: 2.75rem;
          min-height: 2.75rem;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(14, 116, 144, .24);
          border-radius: .75rem;
          color: #155e75;
          background: rgba(255, 255, 255, .72);
          font-size: .625rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
          cursor: pointer;
        }
        .seapals-professor-hide:hover,
        .seapals-professor-hide:focus-visible {
          border-color: rgba(8, 145, 178, .62);
          background: #ffffff;
          outline: 2px solid rgba(34, 211, 238, .45);
          outline-offset: 2px;
        }
        .seapals-professor-show {
          position: absolute;
          z-index: 65;
          left: 1rem;
          bottom: 1rem;
          min-height: 2.75rem;
          padding: .65rem 1rem;
          border: 1px solid rgba(103, 232, 249, .55);
          border-radius: 999px;
          color: #ecfeff;
          background: rgba(8, 47, 73, .96);
          box-shadow: 0 12px 30px rgba(2, 8, 23, .4);
          font-size: .75rem;
          font-weight: 900;
          cursor: pointer;
        }
        .seapals-professor-show:hover,
        .seapals-professor-show:focus-visible {
          background: #0e7490;
          outline: 2px solid rgba(103, 232, 249, .65);
          outline-offset: 2px;
        }
        .seapals-setup-playable-card { animation: seapalsPlayableCard 1s step-end infinite; }
        .seapals-slot-target { animation: seapalsSlotBeacon 1s step-end infinite; }
        .seapals-card-art-well,
        .seapals-game-shell img[data-card-art-fallback="true"],
        .seapals-game-shell img[src*="SeaPalsTCGLogoWhite.svg"] {
          background:
            radial-gradient(circle at 24% 18%, rgba(103,232,249,.22), transparent 32%),
            radial-gradient(circle at 78% 82%, rgba(52,211,153,.18), transparent 38%),
            linear-gradient(155deg, #0e7490 0%, #07506c 42%, #082f49 100%) !important;
        }
        .seapals-game-shell img[data-card-art-fallback="true"],
        .seapals-game-shell img[src*="SeaPalsTCGLogoWhite.svg"] { padding: 12%; object-fit: contain !important; }
        .seapals-high-contrast {
          color: #fff;
          background: #000 !important;
          background-image: none !important;
        }
        .seapals-high-contrast :is(button, a[href], [role="button"]):focus-visible {
          outline: 4px solid #ffea00 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 2px #000 !important;
        }
        .seapals-high-contrast :is(.seapals-hud-panel, .seapals-arena-frame, .seapals-professor-card) {
          border-color: #fff !important;
          box-shadow: 0 0 0 2px #000, 0 0 0 4px #fff !important;
        }
        .seapals-high-contrast :is(.seapals-opening-coin-face, .seapals-opening-coin-trigger) {
          border-color: #fff !important;
          box-shadow: 0 0 0 2px #000, 0 0 0 4px #fff !important;
        }
        .seapals-reduced-motion :is(.seapals-setup-playable-card, .seapals-slot-target, .seapals-tutorial-target, .seapals-professor-turn, .seapals-professor-next, .seapals-professor-coach-wrap-anchored, .seapals-professor-coach-arrow, .seapals-target-beacon, .seapals-target-beacon-arrow, .seapals-professor-type-cursor, .seapals-card-drawer, .seapals-event-card, .seapals-turn-button) {
          animation: none !important;
          transition: none !important;
        }
        .seapals-reduced-motion .seapals-professor-turn,
        .seapals-reduced-motion .seapals-professor-next { opacity: 1 !important; }
        .seapals-reduced-motion .seapals-professor-type-cursor { display: none; }
        .seapals-reduced-motion *,
        .seapals-reduced-motion *::before,
        .seapals-reduced-motion *::after {
          scroll-behavior: auto !important;
          animation: none !important;
          transition: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .seapals-game-shell *,
          .seapals-game-shell *::before,
          .seapals-game-shell *::after {
            scroll-behavior: auto !important;
            animation: none !important;
            transition: none !important;
          }
          .seapals-setup-playable-card, .seapals-slot-target, .seapals-tutorial-target, .seapals-professor-turn, .seapals-professor-next, .seapals-professor-coach-wrap-anchored, .seapals-professor-coach-arrow, .seapals-target-beacon, .seapals-target-beacon-arrow, .seapals-professor-type-cursor { animation: none !important; opacity: 1 !important; transition: none !important; }
          .seapals-professor-type-cursor { display: none; }
          .seapals-setup-playable-card { background-color: rgba(52,211,153,.2); border-color: rgba(167,243,208,.9); }
          .seapals-slot-target { background-color: rgba(52,211,153,.2); border-color: rgba(167,243,208,.9); box-shadow: 0 0 30px rgba(52,211,153,.45); }
          .seapals-tutorial-target { outline-color: #fbbf24 !important; box-shadow: 0 0 0 5px rgba(251,191,36,.25) !important; }
        }
        .seapals-card-drawer { animation: seapalsDrawerIn 260ms ease-out; }
        .seapals-event-card { animation: seapalsEventPop 320ms ease-out; }
        @media (max-width: 767px) {
          .seapals-professor-coach-wrap,
          .seapals-professor-coach-wrap-low {
            position: fixed;
            top: auto;
            right: .5rem;
            bottom: 4.75rem;
            left: .5rem;
            width: auto;
          }
          .seapals-professor-coach-wrap-anchored {
            right: auto;
            bottom: auto;
            width: min(32rem, calc(100vw - 1.5rem));
          }
          .seapals-professor-card {
            max-height: 32dvh;
            overflow-y: auto;
            gap: .625rem;
            padding: .75rem 3.125rem .75rem .75rem;
            border-radius: 1.125rem;
          }
          .seapals-professor-card-inline {
            max-height: none;
            overflow: visible;
          }
          .seapals-professor-portrait {
            width: 3.5rem;
            height: 3.5rem;
            border-radius: .875rem;
          }
          .seapals-professor-show {
            position: fixed;
            left: .5rem;
            bottom: 4.75rem;
          }
        }
      `}</style>
      <section className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[minmax(0,1fr)_9rem_auto]">
        <div className="seapals-hud-panel seapals-arena-frame relative flex h-full min-h-0 flex-col rounded-2xl border border-cyan-400/25 p-3 shadow-2xl xl:col-start-1 xl:row-span-3 xl:row-start-1">
          <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                {isStoryMode ? (
                  <button type="button" onClick={requestStoryExit} aria-label={`Exit duel and return to ${storyReturnLabel}`} className="group flex h-10 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,.12)] transition hover:border-cyan-200/50 hover:bg-cyan-300/15">
                    <span className="text-lg font-black transition group-hover:-translate-x-0.5">←</span><span className="hidden text-[10px] font-black uppercase tracking-wider sm:inline">{storyReturnLabel}</span>
                  </button>
                ) : (
                  <Link href="/" aria-label="Exit simulator and return home" className="group flex h-10 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,.12)] transition hover:border-cyan-200/50 hover:bg-cyan-300/15">
                    <span className="text-lg font-black transition group-hover:-translate-x-0.5">←</span><span className="hidden text-[10px] font-black uppercase tracking-wider sm:inline">Home</span>
                  </Link>
                )}
                <div>
                  <h1 className="text-lg font-black tracking-tight text-white">SeaPals Simulator</h1>
                  <p className="hidden text-xs text-cyan-100/60 sm:block">Build your reef. Outsmart the opposing ecosystem.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex overflow-hidden rounded-xl border border-white/10 bg-slate-950/45 shadow-lg xl:hidden${tutorialTargetClass("vp-score")}`} aria-label="Victory points in play" data-tutorial-target="vp-score">
                <div className="border-r border-white/10 px-4 py-1.5 text-center">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Your Reef</div>
                  <div className="text-xl font-black tabular-nums text-white">{playerVp}<span className="text-xs text-emerald-300">/{victoryTarget} VP</span></div>
                  <div className="text-[9px] font-semibold text-cyan-300/70">{playerSchoolDensityState.committed}/{playerSchoolDensity} SD used{playerSchoolDensityState.overCapacity ? ` · ${playerSchoolDensityState.overCapacity} over` : ""}</div>
                </div>
                <div className="px-4 py-1.5 text-center">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-300">{opponentHudLabel} · {opponentDifficultyProfile.label}</div>
                  <div className="text-xl font-black tabular-nums text-white">{opponentVp}<span className="text-xs text-rose-300">/{victoryTarget} VP</span></div>
                  <div className="text-[9px] font-semibold text-rose-300/80">{opponent.rp}/{opponentRpCap} RP · {opponentSchoolDensityState.committed}/{opponentSchoolDensity} SD used{opponentSchoolDensityState.overCapacity ? ` · ${opponentSchoolDensityState.overCapacity} over` : ""}</div>
                </div>
              </div>
              <div className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-violet-100 shadow-sm">
                <span className={`xl:hidden${tutorialTargetClass("condition-panel")}`} data-tutorial-target="condition-panel">{isSetup ? "Setup Round" : `Round ${round} • Turn ${turn}`} • {gamePhase === "draw" ? "Choose cards" : gamePhase === "main" ? "Play & Act" : gamePhase === "opponent" ? "Opponent turn" : "Transition"}</span>
                <span className="hidden xl:inline">{isSetup ? "Setup Round" : `Round ${round} • Turn ${turn}`} • {gamePhase === "draw" ? "Choose cards" : gamePhase === "main" ? "Play & Act" : gamePhase === "opponent" ? "Opponent turn" : "Transition"}</span>
              </div>
              <RulesChat
                placement="simulator"
                gamePhase={gamePhase}
                activeConditionName={activeCondition?.name ?? null}
                gameContext={{
                  gamePhase,
                  round,
                  rp,
                  rpCap: playerRpCap,
                  playerVp,
                  victoryTarget,
                  activeConditionName: activeCondition?.name ?? null,
                  activeConditionText: activeCondition?.text ?? null,
                  selectedCardName: handPopoverCard?.name ?? inspectedCardData?.name ?? null,
                  selectedCardPlayError: handPopoverCard ? handPopoverPlayError : null,
                  tutorialAction: tutorialTargetBeaconHelp?.action ?? tutorialHelp?.action ?? null,
                  tutorialTargetLabel: tutorialTargetBeaconHelp?.targetLabel ?? tutorialHelp?.targetLabel ?? null,
                  tutorialGuideName: tutorialGuide.name,
                }}
              />
              <details className="relative">
                <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden">Menu</summary>
                <div className="absolute right-0 top-11 z-[70] w-48 rounded-xl border border-cyan-300/20 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl">
                  <button type="button" onClick={openNewGameSetup} className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10">{isStoryMode ? "Restart Duel" : "Start New Game"}</button>
                  {accessibilitySettingsAvailable ? (
                    <button
                      type="button"
                      disabled={!canOpenAccessibilitySettings}
                      title={canOpenAccessibilitySettings ? "Adjust adventure accessibility settings" : "Finish the current animation or decision first"}
                      onClick={canOpenAccessibilitySettings ? onOpenAccessibilitySettings : undefined}
                      className="mt-1 min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Accessibility Settings
                    </button>
                  ) : null}
                  {isStoryMode ? (
                    <button type="button" onClick={requestStoryExit} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10">Return to {storyReturnLabel}</button>
                  ) : (
                    <>
                      <a href="/adventure" className="mt-1 block rounded-lg bg-cyan-400/10 px-3 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20">Play Reefbound Story</a>
                      <Link href="/" className="mt-1 block rounded-lg px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">Exit to Home</Link>
                    </>
                  )}
                </div>
              </details>
              <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-slate-950/45 p-1 shadow-sm" aria-label="Game controls">
                <div className="px-2 text-center" title={`Reef Points: ${rp} of ${playerRpCap}`}>
                  <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600">RP</div>
                  <div className="text-lg font-black leading-none text-emerald-700">{rp}</div>
                </div>
                <button type="button" onClick={() => setModal("hand")} className="rounded-lg px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-white/10">Hand ({hand.length})</button>
                <button type="button" onClick={() => setModal("discard")} className="hidden rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 sm:block">Discard</button>
                <button type="button" onClick={() => setModal("lost")} className="hidden rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 sm:block">Lost</button>
                <button type="button" onClick={openNewGameSetup} className="hidden rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 xl:block">{isStoryMode ? "Restart Duel" : "New Game"}</button>
                <button type="button" onClick={endTurn} disabled={Boolean(gameResult) || opponentThinking || (isSetup && !hasCoralInPlay) || isStartOfTurn} className={`seapals-turn-button rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3 py-2 text-xs font-black text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40${tutorialTargetClass("turn-button")}`} data-tutorial-target="turn-button">
                  {opponentThinking ? "Thinking…" : isSetup ? startingPlayer === OpeningPlayer.OPPONENT ? "Opponent First" : "Round 1" : "End Turn"}
                </button>
              </div>
            </div>
          </div>

          <div className="hidden">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-cyan-50 shadow-inner" role="status">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Mission prompt</div>
              <div className="mt-0.5 text-sm font-semibold">
                {isSetup
                  ? "Setup: play a base Coral or Creature School from your opening hand, then begin round 1."
                  : isStartOfTurn
                    ? "Choose cards from either personal deck for this turn."
                    : "Play cards, use abilities, and make legal attacks in any order before ending your turn."}
              </div>
              {poisonImmunityNextPredatorAttack ? <div className="mt-2 inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">Poison Heal: next attack ignores Toxic</div> : null}
              {rovLightsActive ? <div className="ml-2 mt-2 inline-flex rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-900">ROV Lights: +2 attack against Deep creatures</div> : null}
              {nextOnPlayAttackBonus ? <div className="ml-2 mt-2 inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{cardsById[nextOnPlayAttackBonus.sourceCardId]?.name}: +{nextOnPlayAttackBonus.amount} next On Play attack</div> : null}
              {flashingAlarmAttackBonus ? <div className="ml-2 mt-2 inline-flex rounded-full border border-fuchsia-300 bg-fuchsia-100 px-3 py-1 text-xs font-black text-fuchsia-900">Flashing Alarm: +{flashingAlarmAttackBonus.amount} {flashingAlarmAttackBonus.phase === "active" ? "all attacks this turn" : "all attacks next turn"}</div> : null}
              {round > 0 && round <= supportBlockedUntilRound ? <div className="ml-2 mt-2 inline-flex rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-black text-rose-900">Echo Disruption: Support cards unavailable this turn</div> : null}
            </div>
            <div className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-violet-50 shadow-inner">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Active condition</div>
              <div className="mt-0.5 text-sm font-semibold">{activeCondition?.name ?? "Reveals when round 1 begins"}</div>
              {activeCondition?.text ? <div className="mt-0.5 max-w-md text-xs text-violet-100/75">{activeCondition.text}</div> : null}
              {unsupportedConditionEffects.length ? (
                <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                  This condition's special effect is displayed but not implemented yet.
                </div>
              ) : null}
              {persistentConditions.length ? (
                <div className="mt-3 border-t border-violet-200 pt-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">Persistent events</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {persistentConditions.map((condition) => {
                      const playerUsed = Boolean(conditionDensityUses[condition.id]);
                      const opponentUsed = Boolean(opponent.conditionDensityUses?.[condition.id]);
                      const conditionMessage = `${condition.text} Your reduction is ${playerUsed ? "used" : "available"}; the opponent's reduction is ${opponentUsed ? "used" : "available"}.`;
                      return <button key={condition.id} type="button" onClick={() => setEventOverlay({ type: "condition-detail", sourceCardId: condition.id, title: condition.name, message: conditionMessage, success: true })} className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-bold text-violet-800 hover:bg-violet-100">
                        {condition.name} · You {playerUsed ? "used" : "ready"} / Rival {opponentUsed ? "used" : "ready"}
                      </button>
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {tutorialContract ? (
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {tutorialAnnouncement}
            </p>
          ) : null}

          {tutorialBoardTourOpen ? <div className="fixed inset-0 z-[159]" aria-hidden="true" /> : null}

          {tutorialBoardTourOpen ? (
            <ProfessorCoachOverlay help={tutorialBoardTourHelp}>
              <ProfessorGuideCard
                guide={tutorialGuide}
                help={tutorialBoardTourHelp}
                step={tutorialBoardTourHelp.index + 1}
                total={tutorialBoardTourHelp.totalSteps}
                dismissLabel="Skip tour"
                onDismiss={finishTutorialBoardTour}
                onBack={tutorialBoardTourHelp.index > 0 ? () => setTutorialBoardTourStep((current) => Math.max(0, Number(current) - 1)) : null}
                onAdvance={advanceTutorialBoardTour}
                advanceLabel={tutorialBoardTourHelp.advanceLabel}
              />
            </ProfessorCoachOverlay>
          ) : null}

          {tutorialHelpFloating ? (
            <div className={`seapals-professor-coach-wrap${tutorialHelp.target === "opponent-board" ? " seapals-professor-coach-wrap-low" : ""}`}>
              <ProfessorGuideCard
                guide={tutorialGuide}
                help={tutorialHelp}
                step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                total={tutorialContract.checkpoints.length}
                onDismiss={() => setTutorialHelpDismissedId(tutorialHelpDismissalKey)}
              />
            </div>
          ) : null}

          <ProfessorTargetBeacon
            guide={tutorialGuide}
            help={tutorialTargetBeaconHelp}
            active={tutorialTargetBeaconOpen && !tutorialBoardTourOpen}
          />

          {tutorialHelp && !tutorialHelpOpen && !eventOverlay && !modal && !roundFlash && !gameResult ? (
            <button
              type="button"
              onClick={() => setTutorialHelpDismissedId(null)}
              className="seapals-professor-show"
            >
              Show {tutorialGuide.name}&apos;s tip
            </button>
          ) : null}

          {gameResult && !tutorialLessonWon ? (
            <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-amber-100 px-6 py-4 text-center text-lg font-black text-amber-950" role="alert">
              <div>{gameResult}</div>
              {isStoryMode ? (
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {tutorialContract ? (
                    <button type="button" onClick={() => restartStoryGame("result-retry")} className="rounded-full border-2 border-amber-950 px-6 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-200">
                      Retry Practice Duel
                    </button>
                  ) : null}
                  <button type="button" onClick={() => returnToStoryTown("duel-complete")} className="rounded-full bg-amber-950 px-6 py-2.5 text-sm font-black text-amber-50 shadow-lg transition hover:bg-slate-900">
                    Return to {storyReturnLabel}
                  </button>
                </div>
              ) : selectedPlayerDeck ? (
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  <Link
                    href={{
                      pathname: "/store",
                      query: { deck: selectedPlayerDeck.id },
                    }}
                    className="rounded-full bg-amber-950 px-6 py-2.5 text-sm font-black text-amber-50 shadow-lg transition hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-300/70"
                  >
                    Shop {selectedPlayerDeck.name}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-slate-950/55 p-1 xl:hidden" aria-label="Choose ecosystem to view">
            <button type="button" onClick={() => setMobileBoardView("player")} className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition ${mobileBoardView === "player" ? "bg-emerald-400 text-slate-950 shadow-lg" : "text-slate-300 hover:bg-white/5"}`}>Your Reef</button>
            <button type="button" onClick={() => setMobileBoardView("opponent")} className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition ${mobileBoardView === "opponent" ? "bg-rose-400 text-slate-950 shadow-lg" : "text-slate-300 hover:bg-white/5"}`}>{opponentHudLabel}{opponentThinking ? " • Thinking" : ""}</button>
          </div>

          <div className="min-h-0 w-full flex-1 rounded-2xl border border-cyan-300/20 bg-[#06111d] shadow-[0_18px_60px_rgba(0,0,0,.35)]">
            <div className="h-full min-h-0 overflow-hidden rounded-2xl bg-[#071724]">
              <div className={`${mobileBoardView === "opponent" ? "h-full" : "hidden"} border-b border-cyan-300/20 bg-slate-900 xl:block xl:h-[45%]`}>
                <div className="flex h-10 items-center justify-between gap-4 border-b border-white/5 bg-gradient-to-r from-rose-500/10 via-slate-900 to-slate-900 px-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-rose-200"><span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,.8)]" /> {isStoryMode ? `${storyOpponentName}'s Ecosystem` : "Rival Ecosystem"}</div>
                  {attackContext ? (
                    <div className="flex items-center gap-2" role="status">
                      <div className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-lg">Choose a highlighted target</div>
                      {!attackContext.costCommitted && !attackContext.onPlay ? <button type="button" onClick={() => setAttackContext(null)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/10">Cancel</button> : <span className="text-[10px] font-bold text-emerald-200">Finish each repeated attack</span>}
                    </div>
                  ) : null}
                </div>
                <div
                  ref={opponentEcosystemRef}
                  className={`seapals-ecosystem-ocean relative h-[calc(100%-40px)] w-full overflow-hidden${tutorialTargetClass("opponent-board")}`}
                  data-tutorial-target="opponent-board"
                  onPointerDown={handleOpponentPointerDown}
                  onPointerMove={handleOpponentPointerMove}
                  onPointerUp={handleOpponentPointerUp}
                  onPointerCancel={handleOpponentPointerUp}
                  onLostPointerCapture={handleOpponentPointerUp}
                  style={{ touchAction: "none", overscrollBehavior: "contain", cursor: isOpponentPanning ? "grabbing" : "grab" }}
                >
                  <div className="absolute right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-full border border-rose-300/25 bg-slate-950/85 text-white shadow-xl backdrop-blur" aria-label="Opponent ecosystem zoom controls">
                    <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setOpponentViewportTouched(true); setOpponentEcosystemZoom((current) => clampZoom(current + 0.1)); }} className="flex h-10 w-10 items-center justify-center text-xl font-bold hover:bg-white/10" aria-label="Zoom in on opponent ecosystem">+</button>
                    <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setOpponentViewportTouched(true); zoomEcosystemToFit("opponent"); }} className="border-y border-white/10 px-1 py-1 text-[9px] font-black uppercase text-rose-200" aria-label="Fit opponent ecosystem to view">Fit</button>
                    <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setOpponentViewportTouched(true); setOpponentEcosystemZoom((current) => clampZoom(current - 0.1)); }} className="flex h-10 w-10 items-center justify-center text-xl font-bold hover:bg-white/10" aria-label="Zoom out on opponent ecosystem">−</button>
                  </div>
                  <div className="absolute inset-0" style={{ transform: `translate(${opponentEcosystemOffset.x}px, ${opponentEcosystemOffset.y}px) scale(${opponentEcosystemZoom})`, transformOrigin: "center center" }}>
                    <div className="absolute inset-0">
                      {opponent.habitats.length ? (
                        <div className="absolute left-4 top-4 z-30 flex max-w-[30%] flex-wrap gap-2">
                          {opponent.habitatInstances.map((habitatInstance) => {
                            const cardId = habitatInstance.cardId;
                            const card = cardsById[cardId];
                            const key = `opponent-habitat-${habitatInstance.instanceId}`;
                            const offset = floatingCardOffsets[key] ?? { x: 0, y: 0 };
                            return (
                              <button key={habitatInstance.instanceId} type="button" onPointerDown={(event) => handleFloatingCardPointerDown(key, event)} onPointerMove={handleFloatingCardPointerMove} onPointerUp={handleFloatingCardPointerUp} onClick={() => inspectFloatingCard({ owner: "opponent", cardId, coralId: null, slotId: key, habitatInstanceId: habitatInstance.instanceId, foundation: true, zone: "habitat", currentHealth: habitatInstance.currentHealth, maxHealth: habitatInstance.maxHealth })} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} className="seapals-in-play-card relative w-[120px] cursor-grab rounded-xl text-center active:cursor-grabbing">
                                <InPlayHoverLabel card={card} zoom={opponentEcosystemZoom} />
                                <img src={card?.image} alt={card?.name} className="h-[150px] w-[120px] rounded-xl bg-white object-contain shadow-lg" />
                                <span className="block truncate text-[9px] font-bold text-amber-950">{card?.name}</span>
                                {habitatInstance.maxHealth ? <span className="block text-[8px] font-black text-rose-700">{habitatInstance.currentHealth}/{habitatInstance.maxHealth} HP</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {(opponent.reefCreatures ?? []).length ? <div className="absolute left-1/2 top-4 z-30 flex max-w-[34%] -translate-x-1/2 flex-wrap justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50/95 p-2 shadow-lg">{opponent.reefCreatures.map((cardId, index) => { const card = cardsById[cardId]; const targetSlotId = getOpponentReefSlotId(index); const isTarget = attackContext?.targets.some((target) => target.coralId === "__reef__" && target.slotId === targetSlotId); const key = `opponent-${targetSlotId}`; const offset = floatingCardOffsets[key] ?? { x: 0, y: 0 }; return <button key={opponent.reefCreatureInstances?.[index]?.instanceId ?? `${cardId}-${index}`} type="button" data-tutorial-target={isTarget ? "opponent-board" : undefined} onPointerDown={(event) => handleFloatingCardPointerDown(key, event)} onPointerMove={handleFloatingCardPointerMove} onPointerUp={handleFloatingCardPointerUp} onClick={() => isTarget ? resolvePlayerAttack("__reef__", targetSlotId) : inspectFloatingCard({ owner: "opponent", cardId, coralId: null, slotId: key })} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} className={`seapals-in-play-card relative w-[120px] cursor-grab rounded-lg text-center active:cursor-grabbing ${isTarget ? "animate-pulse ring-4 ring-emerald-400" : ""}`}><InPlayHoverLabel card={card} zoom={opponentEcosystemZoom} /><img src={card?.image} alt={card?.name} className="h-[150px] w-[120px] rounded-lg bg-white object-contain" /><span className="block truncate text-[9px] font-bold text-violet-950">{card?.name}</span></button>; })}</div> : null}
                      {(opponent.orphanCreatures ?? []).length ? (
                        <div className="absolute right-4 top-4 z-30 flex max-w-[34%] flex-wrap justify-end gap-2 rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/95 p-2 shadow-lg">
                          <div className="absolute -top-3 right-2 rounded-full bg-orange-600 px-2 py-1 text-[8px] font-black uppercase text-white">Orphaned</div>
                          {opponent.orphanCreatures.map((entry, index) => {
                            const card = cardsById[entry.cardId];
                            const targetSlotId = getOpponentOrphanSlotId(index);
                            const isTarget = attackContext?.targets.some((target) => target.coralId === "__orphan__" && target.slotId === targetSlotId);
                            return (
                              <div key={entry.instanceId ?? `${entry.cardId}-${index}`} className="rounded-lg bg-orange-100/90 p-1 text-center">
                                <button type="button" data-tutorial-target={isTarget ? "opponent-board" : undefined} onPointerDown={(event) => event.stopPropagation()} onClick={() => isTarget ? resolvePlayerAttack("__orphan__", targetSlotId) : setInspectedCard({ owner: "opponent", cardId: entry.cardId, coralId: null, slotId: `opponent-${targetSlotId}`, orphanIndex: index })} className={`seapals-in-play-card relative w-14 rounded-lg text-center ${isTarget ? "animate-pulse ring-4 ring-emerald-400" : ""}`}>
                                  <InPlayHoverLabel card={card} zoom={opponentEcosystemZoom} />
                                  <img src={card?.image} alt={card?.name} className="h-20 w-14 rounded-lg object-contain" />
                                  <span className="block truncate text-[8px] font-bold text-orange-950">{card?.name}</span>
                                </button>
                                {(entry.hostedCardIds ?? []).some(Boolean) ? (
                                  <div className="mt-1 flex justify-center gap-1 border-t border-fuchsia-300 pt-1">
                                    {entry.hostedCardIds.map((hostedCardId, hostedIndex) => {
                                      if (!hostedCardId) return null;
                                      const hostedCard = cardsById[hostedCardId];
                                      const hostedSlotId = getOrphanHostedTargetSlotId(entry.instanceId ?? `legacy-${index}`, hostedIndex);
                                      const hostedIsTarget = attackContext?.targets.some((target) => target.coralId === "__orphan__" && target.slotId === hostedSlotId);
                                      return (
                                        <button key={`${hostedCardId}-${hostedIndex}`} type="button" data-tutorial-target={hostedIsTarget ? "opponent-board" : undefined} onPointerDown={(event) => event.stopPropagation()} onClick={() => hostedIsTarget ? resolvePlayerAttack("__orphan__", hostedSlotId) : setInspectedCard({ owner: "opponent", cardId: hostedCardId, coralId: null, slotId: `opponent-${hostedSlotId}`, orphanIndex: index, hostedIndex })} className={`seapals-in-play-card relative ${hostedIsTarget ? "animate-pulse rounded ring-4 ring-emerald-400" : "rounded"}`} title={`Hosted by ${card?.name}`}>
                                          <InPlayHoverLabel card={hostedCard} zoom={opponentEcosystemZoom} />
                                          <img src={hostedCard?.image} alt={hostedCard?.name} className="h-12 w-9 rounded bg-white object-contain" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {opponentCorals.length ? opponentCorals.map((coral, coralIndex) => {
                        const card = cardsById[coral.cardId];
                        const densityBucket = opponentSchoolDensityState.byFoundationId[coral.id] ?? null;
                        const anchorPositions = getOpponentSlotPositions(coral.slots.length);
                        const isFoundationTarget = attackContext?.targets.some((target) => target.coralId === coral.id && target.slotId === "__foundation__");
                        const gridOffset = getOpponentCoralGridOffset(coralIndex, opponentCorals.length);
                        return (
                          <div key={coral.id} className="absolute h-[210px] w-[180px] -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(50% + ${gridOffset.x}px)`, top: `calc(50% + ${gridOffset.y + (opponent.habitats.length || opponent.reefCreatures.length || (opponent.orphanCreatures?.length ?? 0) ? 360 : 0)}px)` }}>
                            <button type="button" aria-label={`Inspect ${card?.name}. ${coral.health} of ${coral.maxHealth} HP${densityBucket ? `; ${densityBucket.used} of ${densityBucket.capacity} School Density used` : ""}.`} data-tutorial-target={isFoundationTarget ? "opponent-board" : undefined} onPointerDown={(event) => event.stopPropagation()} onClick={() => isFoundationTarget ? resolvePlayerAttack(coral.id, "__foundation__") : setInspectedCard({ owner: "opponent", cardId: coral.cardId, coralId: coral.id, slotId: `opponent-foundation-${coral.id}`, foundation: true })} className={`seapals-in-play-card relative z-20 mx-auto block h-[200px] w-[160px] rounded-[1.25rem] border-4 bg-white/95 p-2 shadow-2xl ${isFoundationTarget ? "animate-pulse border-emerald-400 ring-4 ring-emerald-300" : "border-rose-300"}`}>
                              <InPlayHoverLabel card={card} zoom={opponentEcosystemZoom} />
                              <img src={card?.image} alt={card?.name} className="h-[160px] w-full rounded-xl object-contain" />
                              <span className="absolute inset-x-2 bottom-1">
                                <FoundationVitals foundation={coral} densityBucket={densityBucket} owner="opponent" compact />
                              </span>
                              {(coral.statuses ?? []).length ? <div className="absolute -right-2 -top-2 rounded-full bg-amber-500 px-2 py-1 text-[9px] font-black uppercase text-slate-950 shadow-lg">{coral.statuses.map((status) => status.type).join(", ")}</div> : null}
                              {coral.rpPenaltyNextTurn ? <div className="mt-1 rounded-full bg-cyan-100 px-2 py-0.5 text-center text-[9px] font-black text-cyan-800">−{coral.rpPenaltyNextTurn} RP next collection</div> : null}
                            </button>
                            {coral.slots.map((slot, slotIndex) => {
                              const position = slot.position ?? anchorPositions[slotIndex];
                              const slotCard = cardsById[slot.cardId];
                              const isTarget = attackContext?.targets.some((target) => target.coralId === coral.id && target.slotId === slot.id);
                              return (
                                <div key={slot.id} className="absolute inset-0">
                                  <div className="pointer-events-none absolute bg-slate-400 opacity-70" style={getSlotConnectorStyle(position)} />
                                  <button
                                    type="button"
                                    disabled={!slotCard}
                                    data-tutorial-target={isTarget ? "opponent-board" : undefined}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      if (isTarget) resolvePlayerAttack(coral.id, slot.id);
                                      else if (slotCard) setInspectedCard({ owner: "opponent", cardId: slot.cardId, coralId: coral.id, slotId: slot.id });
                                    }}
                                    className={`seapals-in-play-card absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center ${
                                      slotCard
                                        ? `h-[150px] w-[120px] rounded-[1.25rem] shadow-xl ${isTarget ? "animate-pulse ring-4 ring-emerald-300" : ""}`
                                        : "h-[96px] w-[96px] rounded-full border border-cyan-200/25 bg-slate-950/55 shadow-[inset_0_0_22px_rgba(34,211,238,.08),0_8px_24px_rgba(0,0,0,.25)]"
                                    }`}
                                    style={{ left: position.left, top: position.top }}
                                  >
                                    {slotCard ? <><InPlayHoverLabel card={slotCard} zoom={opponentEcosystemZoom} /><img src={slotCard.image} alt={slotCard.name} className="h-full w-full rounded-[1.15rem] object-contain" /></> : <><EmptySlotHoverLabel slot={slot} zoom={opponentEcosystemZoom} position={position} /><img src={getSlotIconPath(slot)} alt={`${getCreatureSlotLabel(slot)} empty slot`} className="h-28 w-28 max-w-none object-contain opacity-90" /></>}
                                  </button>
                                  {(slot.hostedCardIds ?? []).some(Boolean) ? <div className="absolute z-30 flex gap-1 rounded-lg border border-fuchsia-300 bg-fuchsia-50/95 p-1 shadow-lg" style={{ left: `calc(${position.left} + 48px)`, top: `calc(${position.top} - 68px)` }}>{slot.hostedCardIds.map((hostedCardId, hostedIndex) => { if (!hostedCardId) return null; const hostedCard = cardsById[hostedCardId]; const hostedTargetSlotId = getHostedTargetSlotId(slot.id, hostedIndex); const hostedIsTarget = attackContext?.targets.some((target) => target.coralId === coral.id && target.slotId === hostedTargetSlotId); return <button key={`${hostedCardId}-${hostedIndex}`} type="button" data-tutorial-target={hostedIsTarget ? "opponent-board" : undefined} onPointerDown={(event) => event.stopPropagation()} onClick={() => hostedIsTarget ? resolvePlayerAttack(coral.id, hostedTargetSlotId) : setInspectedCard({ owner: "opponent", cardId: hostedCardId, coralId: coral.id, slotId: hostedTargetSlotId, hostedBySlotId: slot.id })} className={`seapals-in-play-card relative ${hostedIsTarget ? "animate-pulse rounded-md ring-4 ring-emerald-400" : "rounded-md"}`} title={`Hosted by ${slotCard?.name}`}><InPlayHoverLabel card={hostedCard} zoom={opponentEcosystemZoom} /><img src={hostedCard?.image} alt={hostedCard?.name} className="h-16 w-11 rounded-md bg-white object-contain" /></button>; })}</div> : null}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }) : <div className="absolute inset-0 flex items-center justify-center"><div className="rounded-2xl border border-rose-200 bg-white/90 px-6 py-4 font-semibold text-rose-700">The opponent has no coral in play.</div></div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${mobileBoardView === "player" ? "h-full" : "hidden"} bg-slate-900 xl:block xl:h-[55%]`}>
                <div className="flex h-10 items-center justify-between gap-4 border-b border-white/5 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-900 px-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" /> Your Ecosystem</div>
                  {isPlacingCoral && (
                    <div className="flex items-center gap-2" role="status">
                      <div className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-lg">Click to place your {isCreatureSchool(playingCard) ? "Creature School" : "Coral"}</div>
                      <button type="button" onClick={cancelCardPlay} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/10">Cancel</button>
                    </div>
                  )}
                  {isUpgradingCoral && (
                    <div className="flex items-center gap-2" role="status">
                      <div className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-lg">Choose a highlighted coral</div>
                      <button
                        type="button"
                        onClick={cancelCardPlay}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div
                  ref={ecosystemRef}
                  className={`seapals-ecosystem-ocean relative h-[calc(100%-40px)] w-full ${isPlacingCoral ? "cursor-crosshair" : ""}${tutorialTargetClass("player-board")}`}
                  data-tutorial-target="player-board"
                  onPointerDown={handleEcosystemPointerDown}
                  onPointerMove={handleEcosystemPointerMove}
                  onPointerUp={handleEcosystemPointerUp}
                  onPointerCancel={handleEcosystemPointerUp}
                  onLostPointerCapture={handleEcosystemPointerUp}
                  style={{ touchAction: "none", overscrollBehavior: "contain", userSelect: "none" }}
                >
                  {!isPlacingCoral && !isUpgradingCoral ? (
                    <div className="absolute right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-full border border-emerald-300/25 bg-slate-950/85 text-white shadow-xl backdrop-blur" aria-label="Your ecosystem zoom controls">
                      <button
                        type="button"
                        data-tutorial-target="player-zoom-in"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setEcosystemZoom((current) => clampZoom(current + 0.1));
                          completeTutorialLayoutLessonAction(GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN);
                        }}
                        className={`flex h-10 w-10 items-center justify-center text-xl font-bold hover:bg-white/10${tutorialTargetClass("player-zoom-in")}`}
                        aria-label="Zoom in on your ecosystem"
                      >+</button>
                      <button
                        type="button"
                        data-tutorial-target="player-zoom-fit"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          zoomEcosystemToFit("player");
                          completeTutorialLayoutLessonAction(GUIDED_ACADEMY_LAYOUT_ACTIONS.FIT);
                        }}
                        className={`border-y border-white/10 px-1 py-1 text-[9px] font-black uppercase text-emerald-200${tutorialTargetClass("player-zoom-fit")}`}
                        aria-label="Fit your ecosystem to view"
                      >Fit</button>
                      <button
                        type="button"
                        data-tutorial-target="player-zoom-out"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setEcosystemZoom((current) => clampZoom(current - 0.1));
                          completeTutorialLayoutLessonAction(GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT);
                        }}
                        className={`flex h-10 w-10 items-center justify-center text-xl font-bold hover:bg-white/10${tutorialTargetClass("player-zoom-out")}`}
                        aria-label="Zoom out on your ecosystem"
                      >−</button>
                    </div>
                  ) : null}
                  <div className="absolute inset-0 overflow-hidden">
                    <div
                      className="absolute inset-0 h-full w-full"
                      style={{
                        transform: `translate(${ecosystemOffset.x}px, ${ecosystemOffset.y}px) scale(${ecosystemZoom})`,
                        transformOrigin: "center center",
                        cursor: isPanning ? "grabbing" : "grab",
                        userSelect: "none",
                      }}
                    >
                      {playerHabitats.length ? (
                        <div className="absolute left-6 top-6 z-30 flex max-w-[70%] gap-3">
                          {playerHabitatInstances.map((habitatInstance, index) => {
                            const cardId = habitatInstance.cardId;
                            const habitat = cardsById[cardId];
                            const key = `player-habitat-${habitatInstance.instanceId}`;
                            const offset = floatingCardOffsets[key] ?? { x: 0, y: 0 };
                            return (
                              <button key={habitatInstance.instanceId} type="button" onPointerDown={(event) => handleFloatingCardPointerDown(key, event)} onPointerMove={handleFloatingCardPointerMove} onPointerUp={handleFloatingCardPointerUp} onClick={() => inspectFloatingCard({ owner: "player", cardId, coralId: null, slotId: key, habitatInstanceId: habitatInstance.instanceId })} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} className="seapals-in-play-card relative w-[120px] cursor-grab text-center active:cursor-grabbing">
                                <InPlayHoverLabel card={habitat} zoom={ecosystemZoom} />
                                <img src={habitat?.image} alt={habitat?.name} className="h-[150px] w-[120px] rounded-xl bg-white object-contain shadow-lg" />
                                <span className="mt-1 block truncate text-[10px] font-bold text-amber-950">{habitat?.name}</span>
                                {habitatInstance.maxHealth ? <span className="block text-[9px] font-black text-rose-700">{habitatInstance.currentHealth}/{habitatInstance.maxHealth} HP</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {playerReefCreatures.length ? (
                        <div className="absolute right-6 top-6 z-30 flex gap-3 rounded-2xl border border-violet-300 bg-violet-50/95 p-3 shadow-lg">
                          <div className="absolute -top-3 right-3 rounded-full bg-violet-700 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white">Open Water</div>
                          {playerReefCreatures.map((cardId, index) => {
                            const card = cardsById[cardId];
                            const targetSlotId = getPlayerReefSlotId(index);
                            const key = `player-${targetSlotId}`;
                            const offset = floatingCardOffsets[key] ?? { x: 0, y: 0 };
                            return <button key={playerReefCreatureInstances[index]?.instanceId ?? `${cardId}-${index}`} type="button" data-tutorial-action-key={targetSlotId} onPointerDown={(event) => handleFloatingCardPointerDown(key, event)} onPointerMove={handleFloatingCardPointerMove} onPointerUp={handleFloatingCardPointerUp} onClick={() => inspectFloatingCard({ owner: "player", cardId, coralId: null, slotId: targetSlotId })} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} className={`seapals-in-play-card relative w-[120px] cursor-grab text-center active:cursor-grabbing${tutorialActionTargetClass(targetSlotId)}`}><InPlayHoverLabel card={card} zoom={ecosystemZoom} /><img src={card?.image} alt={card?.name} className="h-[150px] w-[120px] rounded-xl bg-white object-contain" /><span className="mt-1 block truncate text-[10px] font-bold text-violet-950">{card?.name}</span></button>;
                          })}
                        </div>
                      ) : null}
                      {playerOrphanCreatures.length ? (
                        <div className="absolute right-6 top-48 z-30 flex max-w-[48%] flex-wrap gap-2 rounded-2xl border-2 border-dashed border-orange-400 bg-orange-50/95 p-3 shadow-lg">
                          <div className="absolute -top-3 right-3 rounded-full bg-orange-600 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white">Orphaned — waiting for slots</div>
                          {playerOrphanCreatures.map((entry, index) => {
                            const card = cardsById[entry.cardId];
                            const hostedCount = (entry.hostedCardIds ?? []).filter(Boolean).length;
                            const targetSlotId = getPlayerOrphanSlotId(index);
                            const isForeignInvader = entry.invasiveOwner === "opponent";
                            const isInvaderTarget = attackContext?.targets.some((target) => target.coralId === "__own_invader_orphan__" && target.instanceId === entry.instanceId);
                            return (
                              <button
                                key={entry.instanceId ?? `${entry.cardId}-${index}`}
                                type="button"
                                data-tutorial-action-key={!isForeignInvader ? targetSlotId : undefined}
                                data-tutorial-target={isInvaderTarget ? "player-board" : undefined}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => isInvaderTarget
                                  ? resolvePlayerAttack("__own_invader_orphan__", `orphan-${entry.instanceId}`)
                                  : setInspectedCard({ owner: isForeignInvader ? "opponent" : "player", cardId: entry.cardId, coralId: null, slotId: targetSlotId, orphanIndex: index })}
                                className={`seapals-in-play-card relative w-20 text-center ${isInvaderTarget ? "animate-pulse ring-4 ring-amber-300" : ""}${!isForeignInvader ? tutorialActionTargetClass(targetSlotId) : ""}`}
                              >
                                <InPlayHoverLabel card={card} zoom={ecosystemZoom} />
                                <img src={card?.image} alt={card?.name} className="h-24 w-20 rounded-xl object-contain" />
                                <span className="mt-1 block truncate text-[9px] font-bold text-orange-950">{card?.name}</span>
                                {isForeignInvader ? <span className="absolute left-0 top-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[7px] font-black uppercase text-white">Opponent invader</span> : null}
                                {hostedCount ? <span className="absolute right-0 top-0 rounded-full bg-fuchsia-600 px-1.5 py-0.5 text-[8px] font-black text-white">+{hostedCount}</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {playerCorals.map((coral) => {
                        const densityBucket = playerSchoolDensityState.byFoundationId[coral.id] ?? null;
                        const anchorPositions = getBracketSlotPositions(coral.slots.length);
                        const canUpgradeThisCoral = upgradeableCoralIds.has(coral.id);
                        const isLayoutFoundationTarget = Boolean(
                          tutorialHelpTargetActive
                          && tutorialHelp?.target === "foundation-drag"
                          && coral.cardId === scriptedFinishPlan?.setupCardId
                        );
                        return (
                          <div
                            key={coral.id}
                            data-coral
                            data-card-id={coral.cardId}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ top: `${coral.y}%`, left: `${coral.x}%`, width: "240px", height: "280px" }}
                          >
                            <div className="relative h-full w-full">
                               <div
                                 data-upgrade-target={canUpgradeThisCoral ? "true" : undefined}
                                 data-tutorial-target={canUpgradeThisCoral
                                   ? "placement"
                                   : isLayoutFoundationTarget
                                     ? "foundation-drag"
                                     : undefined}
                                 role="button"
                                 tabIndex={0}
                                 aria-label={`Inspect ${coral.name}. ${coral.health ?? coral.maxHealth} of ${coral.maxHealth} HP${densityBucket ? `; ${densityBucket.used} of ${densityBucket.capacity} School Density used` : ""}.`}
                                 className={`seapals-in-play-card relative z-20 mx-auto h-[260px] w-[220px] rounded-[1.5rem] bg-slate-100 shadow-xl ${
                                   draggingCoralId === coral.id ? "ring-2 ring-emerald-300" : ""
                                 } ${
                                   canUpgradeThisCoral ? "cursor-pointer" : ""
                                 }${canUpgradeThisCoral ? tutorialTargetClass("placement") : ""}${isLayoutFoundationTarget ? tutorialTargetClass("foundation-drag") : ""}`}
                                 onPointerDown={(event) => handleCoralPointerDown(coral.id, event)}
                                 onClick={(event) => handleCoralClick(coral.id, event)}
                                 onKeyDown={(event) => {
                                   if (event.key === "Enter" || event.key === " ") handleCoralClick(coral.id, event);
                                 }}
                                >
                                <InPlayHoverLabel card={cardsById[coral.cardId]} zoom={ecosystemZoom} />
                                <img
                                  src={coral.image}
                                  alt={coral.name}
                                  onDragStart={(event) => event.preventDefault()}
                                  className={`absolute inset-x-0 top-4 mx-auto h-[220px] w-[180px] rounded-[1.5rem] object-contain ${
                                    canUpgradeThisCoral
                                      ? "cursor-pointer"
                                      : draggingCoralId === coral.id
                                        ? "cursor-grabbing"
                                        : "cursor-grab"
                                  }`}
                                />
                                <span className="absolute inset-x-4 bottom-3">
                                  <FoundationVitals foundation={coral} densityBucket={densityBucket} />
                                </span>
                                {(coral.statuses ?? []).length ? <div className="absolute -right-2 -top-2 rounded-full bg-amber-500 px-2 py-1 text-[9px] font-black uppercase text-slate-950 shadow-lg">{coral.statuses.map((status) => status.type).join(", ")}</div> : null}
                              </div>
                              {coral.slots.map((slot, index) => {
                                const position = slot.position ?? anchorPositions[index];
                                const slotFilled = Boolean(slot.cardId);
                                const slotCard = slotFilled ? cardsById[slot.cardId] : null;
                                const isInvaderTarget = attackContext?.targets.some((target) => target.coralId === "__own_invader__" && target.hostCoralId === coral.id && target.slotId === slot.id);
                                const validHostTarget = Boolean(slotFilled && playingCardId && canHostCardInSlot(slot, playingCardId));
                                const academyPlacementAllowed = !playingCardId || isAcademyPlacementAllowed({
                                  route: scriptedFinishRoute,
                                  cardId: playingCardId,
                                  foundationCardId: coral.cardId,
                                  slotClass: slot.slotClass ?? slot.slotType ?? slot.class,
                                });
                                const validTarget = Boolean(
                                  playingCardId
                                  && academyPlacementAllowed
                                  && (canUseSlotWithCard(slot, playingCardId) || validHostTarget)
                                );
                                const emptyPlacementMode = Boolean(!slotFilled && playingCardId && !isUpgradingCoral);
                                const isLayoutSlotTarget = Boolean(
                                  tutorialHelpTargetActive
                                  && tutorialHelp?.target === "slot-drag"
                                  && coral.cardId === scriptedFinishPlan?.setupCardId
                                  && index === 0
                                );
                                return (
                                  <div key={slot.id} className="absolute top-0 left-0 h-full w-full">
                                    <div
                                      className="pointer-events-none absolute bg-slate-400 opacity-70"
                                      style={getSlotConnectorStyle(position)}
                                    />
                                     <div
                                       data-slot-drag-handle
                                       data-slot-id={slot.id}
                                       data-tutorial-target={validTarget
                                         ? "placement"
                                         : isLayoutSlotTarget
                                           ? "slot-drag"
                                           : undefined}
                                      onPointerDown={(event) => {
                                        if (validHostTarget || validTarget || isInvaderTarget) {
                                          event.stopPropagation();
                                          return;
                                        }
                                        handleSlotPointerDown(coral.id, slot.id, event);
                                      }}
                                      onPointerMove={handleEcosystemPointerMove}
                                      onPointerUp={handleEcosystemPointerUp}
                                      onPointerCancel={handleEcosystemPointerUp}
                                      onLostPointerCapture={handleSlotDragEnd}
                                      className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center transition ${!slotFilled ? "seapals-in-play-card" : ""} ${
                                        slotFilled
                                          ? `h-[220px] w-[180px] rounded-[1.5rem] shadow-2xl ${validHostTarget ? "ring-4 ring-emerald-300" : ""}`
                                          : emptyPlacementMode
                                            ? validTarget
                                              ? "seapals-slot-target z-30 h-[190px] w-[190px] rounded-full border-4 bg-transparent shadow-none"
                                              : "h-[112px] w-[112px] rounded-full border border-white/10 bg-slate-950/35 opacity-30 shadow-inner"
                                            : "h-[112px] w-[112px] cursor-grab rounded-full border-2 border-cyan-200/25 bg-slate-950/55 shadow-[inset_0_0_24px_rgba(34,211,238,.08),0_10px_28px_rgba(0,0,0,.28)] active:cursor-grabbing"
                                      }${isLayoutSlotTarget ? tutorialTargetClass("slot-drag") : ""}`}
                                      style={{ top: position.top, left: position.left, touchAction: 'none' }}
                                    >
                                      {!slotFilled ? <EmptySlotHoverLabel slot={slot} zoom={ecosystemZoom} position={position} /> : null}
                                      {slotFilled ? (
                                        <button
                                          type="button"
                                          data-tutorial-action-key={getSlotActionKey(slot)}
                                          data-tutorial-target={isInvaderTarget ? "player-board" : undefined}
                                          onPointerDown={(event) => validHostTarget || isInvaderTarget ? event.stopPropagation() : handleSlotPointerDown(coral.id, slot.id, event)}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (isInvaderTarget) {
                                              resolvePlayerAttack("__own_invader__", slot.id);
                                              return;
                                            }
                                            if (validHostTarget) {
                                              placeCardToSlot(slot.id);
                                              return;
                                            }
                                            if (slotWasDraggedRef.current) {
                                              slotWasDraggedRef.current = false;
                                              return;
                                            }
                                            setInspectedCard({ owner: slot.invasiveOwner === "opponent" ? "opponent" : "player", cardId: slot.cardId, coralId: coral.id, slotId: slot.id });
                                          }}
                                          className={`seapals-in-play-card relative h-full w-full rounded-[1.5rem] transition ${isInvaderTarget ? "animate-pulse cursor-pointer ring-4 ring-amber-300" : validHostTarget ? "cursor-pointer ring-4 ring-emerald-400" : "cursor-grab ring-cyan-400 hover:ring-4 active:cursor-grabbing"}${tutorialActionTargetClass(getSlotActionKey(slot))}`}
                                          style={{ touchAction: "none" }}
                                        >
                                          <InPlayHoverLabel card={slotCard} zoom={ecosystemZoom} />
                                          <img
                                            src={slotCard?.image}
                                            alt={slotCard?.name}
                                            draggable={false}
                                            className="pointer-events-none h-full w-full select-none rounded-[1.5rem] object-contain"
                                          />
                                          {slot.invasiveOwner === "opponent" ? <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-1 text-[9px] font-black uppercase text-white shadow-lg">Opponent invader</span> : null}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={!validTarget}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            placeCardToSlot(slot.id);
                                          }}
                                          className={`relative flex h-full w-full flex-col items-center justify-center px-2 text-[11px] font-semibold transition ${
                                            validTarget
                                              ? "pointer-events-auto cursor-pointer rounded-full border-0 bg-transparent drop-shadow-[0_0_18px_rgba(110,231,183,.9)]"
                                              : emptyPlacementMode
                                                ? "pointer-events-none rounded-full border-0 bg-transparent"
                                                : "pointer-events-none rounded-full border-0 bg-transparent"
                                          }`}
                                        >
                                          <img src={getSlotIconPath(slot)} alt={slot.type} className={`pointer-events-none max-w-none select-none object-contain ${validTarget ? "h-44 w-44" : emptyPlacementMode ? "h-28 w-28 opacity-60" : "h-32 w-32 opacity-90"}`} />
                                          <span className="sr-only">{slot.type}</span>
                                        </button>
                                      )}
                                      {(slot.hostedCardIds ?? []).some(Boolean) ? <div className="absolute -right-12 top-2 z-30 flex flex-col gap-1 rounded-xl border border-fuchsia-300 bg-fuchsia-50/95 p-1 shadow-lg">{slot.hostedCardIds.map((hostedCardId, hostedIndex) => { if (!hostedCardId) return null; const hostedCard = cardsById[hostedCardId]; return <button key={`${hostedCardId}-${hostedIndex}`} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setInspectedCard({ owner: "player", cardId: hostedCardId, coralId: coral.id, slotId: `${slot.id}:hosted:${hostedIndex}`, hostedBySlotId: slot.id }); }} className="seapals-in-play-card relative rounded-lg ring-fuchsia-400 hover:ring-2" title={`Hosted by ${slotCard?.name}`}><InPlayHoverLabel card={hostedCard} zoom={ecosystemZoom} /><img src={hostedCard?.image} alt={hostedCard?.name} className="h-20 w-14 rounded-lg bg-white object-contain" /></button>; })}</div> : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {bubbleBursts.length ? (
                    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden" aria-hidden="true">
                      {bubbleBursts.map((burst) => <BubbleBurst key={burst.id} x={burst.x} y={burst.y} />)}
                    </div>
                  ) : null}
                  {isPlacingCoral && (
                    <button
                      type="button"
                      aria-label={`Click to place your ${isCreatureSchool(playingCard) ? "Creature School" : "Coral"}`}
                      onClick={handleEcosystemClick}
                      className={`absolute inset-0 z-50 cursor-crosshair bg-transparent${guidedFoundationPlacementTarget ? "" : tutorialTargetClass("placement")}`}
                      data-tutorial-target={guidedFoundationPlacementTarget ? undefined : "placement"}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-0 border-4 border-emerald-400 transition-opacity duration-100 ${
                          actionBlinkOn ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {guidedFoundationPlacementTarget ? (
                        <span
                          aria-hidden="true"
                          data-tutorial-target="placement"
                          className={`pointer-events-none absolute flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-emerald-200 bg-emerald-300/20 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_34px_rgba(52,211,153,.95)]${tutorialTargetClass("placement")}`}
                          style={{
                            left: `${guidedFoundationPlacementTarget.x}%`,
                            top: `${guidedFoundationPlacementTarget.y}%`,
                          }}
                        >
                          Place here
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {mobileHudPanel ? (
            <div className="absolute inset-x-3 bottom-[4.75rem] z-[60] max-h-[45dvh] overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl xl:hidden">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-black text-white">{mobileHudPanel === "zones" ? "Game Zones" : "Mission Feed"}</h2><button type="button" onClick={() => setMobileHudPanel(null)} className="rounded-lg border border-white/10 px-3 py-1 text-xs font-bold text-slate-200">Close</button></div>
              {mobileHudPanel === "zones" ? (
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setMobileHudPanel(null); setModal("discard"); }} className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4 font-bold text-cyan-100">Discard Pile<span className="mt-1 block text-2xl font-black">{discardPile.length}</span></button><button type="button" onClick={() => { setMobileHudPanel(null); setModal("lost"); }} className="rounded-xl border border-violet-300/20 bg-violet-400/10 p-4 font-bold text-violet-100">Lost Zone<span className="mt-1 block text-2xl font-black">{lostZone.length}</span></button></div>
              ) : (
                <div><div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm font-semibold text-cyan-50">{isSetup ? "Setup: play a base Coral or Creature School, then begin round 1." : isStartOfTurn ? "Choose cards from your personal decks for this turn." : "Play cards, use abilities, and attack in any legal order."}</div><div className="mt-2 rounded-xl border border-violet-300/20 bg-violet-400/10 p-3 text-sm text-violet-100"><strong>{activeCondition?.name ?? "No active condition"}</strong>{activeCondition?.text ? <span className="mt-1 block text-xs text-violet-100/70">{activeCondition.text}</span> : null}</div><ol className="mt-2 space-y-2 rounded-xl bg-slate-900 p-3 text-xs">{log.slice(0, 8).map((entry, index) => <li key={`${entry}-${index}`} className={index === 0 ? "font-bold text-cyan-300" : "text-slate-300"}>{entry}</li>)}</ol></div>
              )}
            </div>
          ) : null}
          <div className="mt-2 grid h-14 shrink-0 grid-cols-[64px_64px_minmax(0,1fr)_92px] gap-1.5 xl:hidden" aria-label="Mobile game command dock">
            <button type="button" onClick={() => setMobileHudPanel((current) => current === "zones" ? null : "zones")} className={`rounded-xl border border-white/10 bg-white/5 px-1 text-[10px] font-bold text-slate-200${tutorialTargetClass("zones")}`} data-tutorial-target="zones">Zones<br /><span className="text-cyan-300">{discardPile.length + lostZone.length}</span></button>
            <button type="button" onClick={() => setMobileHudPanel((current) => current === "feed" ? null : "feed")} className={`rounded-xl border border-white/10 bg-white/5 px-1 text-[10px] font-bold text-slate-200${tutorialTargetClass("event-feed")}`} data-tutorial-target="event-feed">Guide<br /><span className="text-violet-300">Feed</span></button>
            <button type="button" onClick={() => setModal("hand")} className={`rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 text-sm font-black text-cyan-50 shadow-lg${tutorialTargetClass("hand")}`} data-tutorial-target="hand">Open Hand <span className="text-cyan-300">({hand.length})</span><span className={`block text-[10px] font-semibold text-emerald-300${tutorialTargetClass("rp-bank")}`} data-tutorial-target="rp-bank">{rp} RP ready</span></button>
            <button type="button" onClick={endTurn} disabled={Boolean(gameResult) || opponentThinking || (isSetup && !hasCoralInPlay) || isStartOfTurn} className={`seapals-turn-button rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40${tutorialTargetClass("turn-button")}`} data-tutorial-target="turn-button">{opponentThinking ? "Thinking…" : isSetup ? startingPlayer === OpeningPlayer.OPPONENT ? "Opponent First" : "Round 1" : "End Turn"}</button>
          </div>
        </div>

        <div className="seapals-hud-panel hidden min-h-0 overflow-y-auto rounded-2xl border border-cyan-400/20 p-3 shadow-xl xl:col-start-2 xl:row-start-1 xl:flex xl:flex-col">
          <div className={`grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-slate-950/45${tutorialTargetClass("vp-score")}`} data-tutorial-target="vp-score">
            <div className="border-r border-white/10 p-3 text-center"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Your Reef</div><div className="mt-0.5 text-2xl font-black tabular-nums text-white">{playerVp}<span className="text-sm text-emerald-300">/{victoryTarget} VP</span></div><div className="text-xs text-cyan-200/65">{playerSchoolDensityState.committed}/{playerSchoolDensity} SD used{playerSchoolDensityState.overCapacity ? ` · ${playerSchoolDensityState.overCapacity} over capacity` : ` · ${playerSchoolDensityState.available} open`}</div></div>
            <div className="p-3 text-center"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-300">{opponentHudLabel} · {opponentDifficultyProfile.label}</div><div className="mt-0.5 text-2xl font-black tabular-nums text-white">{opponentVp}<span className="text-sm text-rose-300">/{victoryTarget} VP</span></div><div className="text-xs text-rose-200/65">{opponent.rp}/{opponentRpCap} RP · {opponentSchoolDensityState.committed}/{opponentSchoolDensity} SD used{opponentSchoolDensityState.overCapacity ? ` · ${opponentSchoolDensityState.overCapacity} over capacity` : ` · ${opponentSchoolDensityState.available} open`}</div></div>
          </div>

          <button type="button" disabled={!activeCondition} onClick={() => activeCondition && setEventOverlay({ type: "condition-detail", sourceCardId: activeCondition.id, title: activeCondition.name, message: activeCondition.text, success: true })} className={`mt-2 w-full rounded-xl border border-violet-300/20 bg-violet-400/10 p-3 text-left transition hover:border-violet-300/40 disabled:cursor-default${tutorialTargetClass("condition-panel")}`} data-tutorial-target="condition-panel">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Active condition</span><strong className="mt-0.5 block text-base text-violet-50">{activeCondition?.name ?? "Reveals when Round 1 begins"}</strong>{activeCondition?.text ? <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-violet-100/70">{activeCondition.text}</span> : null}
          </button>
          {persistentConditions.length ? <div className="mt-2 flex flex-wrap gap-1">{persistentConditions.map((condition) => <button key={condition.id} type="button" onClick={() => setEventOverlay({ type: "condition-detail", sourceCardId: condition.id, title: condition.name, message: `${condition.text} Your reduction is ${conditionDensityUses[condition.id] ? "used" : "available"}; the opponent's reduction is ${opponent.conditionDensityUses?.[condition.id] ? "used" : "available"}.`, success: true })} className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-[9px] font-bold text-violet-200">{condition.name} · {conditionDensityUses[condition.id] ? "Used" : "Ready"}</button>)}</div> : null}

          <div className={`mt-2 flex items-center justify-between rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2${tutorialTargetClass("rp-bank")}`} data-tutorial-target="rp-bank"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/40 bg-slate-950/40 text-xl font-black text-emerald-200">{rp}</div><div><div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">RP Bank</div><div className="text-sm font-bold text-white">{rp}/{playerRpCap} available</div></div></div><div className="text-right text-xs leading-tight text-emerald-100/60">Next collection<br />+1{startTurnRp > 0 ? ` + ${startTurnRp}` : ""} RP</div></div>
          <div className={`mt-2 grid grid-cols-2 gap-2${tutorialTargetClass("zones")}`} data-tutorial-target="zones"><button type="button" onClick={() => setModal("discard")} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/10"><span><span className="mr-2 text-cyan-300">↺</span>Discard</span><strong className="rounded-full bg-slate-950/60 px-2 py-0.5 text-cyan-200">{discardPile.length}</strong></button><button type="button" onClick={() => setModal("lost")} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-violet-300/35 hover:bg-violet-300/10"><span><span className="mr-2 text-violet-300">◇</span>Lost</span><strong className="rounded-full bg-slate-950/60 px-2 py-0.5 text-violet-200">{lostZone.length}</strong></button></div>
          {poisonImmunityNextPredatorAttack || rovLightsActive || nextOnPlayAttackBonus || flashingAlarmAttackBonus || (round > 0 && round <= supportBlockedUntilRound) ? <div className="mt-2 flex flex-wrap gap-1">{poisonImmunityNextPredatorAttack ? <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-bold text-emerald-200">Poison immune</span> : null}{rovLightsActive ? <span className="rounded-full bg-cyan-400/15 px-2 py-1 text-[9px] font-bold text-cyan-200">ROV lights</span> : null}{nextOnPlayAttackBonus ? <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[9px] font-bold text-amber-200">+{nextOnPlayAttackBonus.amount} next attack</span> : null}{flashingAlarmAttackBonus ? <span className="rounded-full bg-fuchsia-400/15 px-2 py-1 text-[9px] font-bold text-fuchsia-200">Flashing Alarm +{flashingAlarmAttackBonus.amount} {flashingAlarmAttackBonus.phase === "active" ? "this turn" : "next turn"}</span> : null}{round > 0 && round <= supportBlockedUntilRound ? <span className="rounded-full bg-rose-400/15 px-2 py-1 text-[9px] font-bold text-rose-200">Support locked</span> : null}</div> : null}

          <section className={`mt-3 flex min-h-48 flex-1 flex-col overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/35 p-2${tutorialTargetClass("hand")}`} aria-label="Your hand card list" data-tutorial-target="hand">
            <div className="flex items-center justify-between px-1 pb-2"><div><h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Your hand</h3><p className="text-xs text-slate-400">Click a card for details</p></div><span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-cyan-400/10 px-2 text-sm font-black text-cyan-200" aria-label={`${hand.length} cards in hand`}>{hand.length}</span></div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {hand.length ? hand.map((cardId, cardIndex) => { const card = cardsById[cardId]; const error = getPlayError(card); return (
                <button key={`${cardId}-${cardIndex}`} type="button" data-card-id={cardId} data-tutorial-hand-card-id={cardId} onClick={() => { setSelectedHandCard(cardId); setHandPopoverCardId(cardId); setPlayError(""); }} className={`group grid w-full grid-cols-[3.6rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-1.5 text-left transition hover:border-cyan-300/45 hover:bg-cyan-300/10 ${isSetup && !error ? "seapals-setup-playable-card border-emerald-300/60 bg-emerald-400/15" : "border-white/10 bg-white/5"}${tutorialCardTargetClass(cardId)}`}>
                  <span className="seapals-card-art-well relative h-20 overflow-hidden rounded-md shadow"><img src={card?.image} alt={card?.name} className="h-full w-full object-contain" /></span>
                  <span className="min-w-0"><strong className="block truncate text-sm text-white">{card?.name}</strong><span className="mt-1 block truncate text-xs font-semibold text-slate-300">{getCardClassLabel(card)}</span><span className={`mt-1 block text-xs font-bold ${error ? "text-rose-300" : "text-emerald-300"}`}>{error ? "Unavailable" : "Ready to play"}</span></span>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-200">{getPlayerCardPlayCost(card)} RP</span>
                </button>
              ); }) : <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">Your hand is empty.</div>}
            </div>
          </section>
        </div>

        {handPopoverCard ? (
          <>
            <button type="button" aria-label="Close hand card details" onClick={() => setHandPopoverCardId(null)} className="fixed inset-0 z-40 hidden bg-slate-950/25 xl:block" />
            <aside className="seapals-hud-panel fixed right-[21.5rem] top-1/2 z-50 hidden max-h-[calc(100dvh-1rem)] w-[24rem] max-w-[calc(100vw-23rem)] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-cyan-300/30 p-4 shadow-[0_28px_90px_rgba(0,0,0,.65)] xl:flex" aria-label={`${handPopoverCard.name} details`}>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="mb-3 flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Card details</div><h3 className="text-lg font-black text-white">{handPopoverCard.name}</h3></div><button type="button" onClick={() => setHandPopoverCardId(null)} className={`rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10${tutorialTargetClass("close-modal")}`} data-tutorial-target="close-modal">Close</button></div>
                {tutorialHelpInline && tutorialHelp.target === "close-modal" ? (
                  <ProfessorGuideCard guide={tutorialGuide} help={tutorialHelp} step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)} total={tutorialContract.checkpoints.length} inline onDismiss={() => setTutorialHelpDismissedId(tutorialHelpDismissalKey)} />
                ) : null}
                <div className="seapals-card-art-well rounded-xl border border-cyan-200/15 p-3 shadow-inner"><img src={handPopoverCard.image} alt={handPopoverCard.name} className="h-[46dvh] max-h-[420px] min-h-[250px] w-full object-contain" /></div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold"><span className="rounded-full bg-cyan-400/15 px-2 py-1 text-cyan-200">{getCardClassLabel(handPopoverCard)}</span><span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-200">{getPlayerCardPlayCost(handPopoverCard)} RP</span>{Number(handPopoverCard.victoryPoints ?? 0) > 0 ? <span className="rounded-full bg-amber-400/15 px-2 py-1 text-amber-200">{handPopoverCard.victoryPoints} VP</span> : null}</div>
                {handPopoverCard.text ? <p className="mt-3 max-h-20 overflow-y-auto rounded-xl bg-slate-950/45 p-3 text-[11px] leading-relaxed text-slate-300">{handPopoverCard.text}</p> : null}
                {handPopoverPlayError ? <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-200">{handPopoverPlayError}</div> : null}
                {tutorialHelpInline && ["play-card", "turn-button"].includes(tutorialHelp.target) ? (
                  <ProfessorGuideCard guide={tutorialGuide} help={tutorialHelp} step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)} total={tutorialContract.checkpoints.length} inline onDismiss={() => setTutorialHelpDismissedId(tutorialHelpDismissalKey)} />
                ) : null}
              </div>
              <button type="button" disabled={Boolean(handPopoverPlayError)} onClick={() => { const cardId = handPopoverCardId; setHandPopoverCardId(null); playCardFromHand(cardId); }} className={`mt-3 w-full shrink-0 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-300${tutorialTargetClass("play-card")}`} data-tutorial-target="play-card">Play card</button>
            </aside>
          </>
        ) : null}

        <div className={`seapals-hud-panel hidden rounded-2xl border border-cyan-400/20 p-3 shadow-xl xl:col-start-2 xl:row-start-2 xl:flex xl:min-h-0 xl:flex-col${tutorialTargetClass("event-feed")}`} data-tutorial-target="event-feed">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white">Recent events</h2>
              <p className="text-xs text-cyan-100/55">Latest game resolutions</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">Live</span>
          </div>
          <ol className="space-y-2 overflow-y-auto rounded-xl border border-white/5 bg-slate-950/65 p-3 text-xs leading-relaxed text-slate-100 xl:min-h-0 xl:flex-1" aria-live="polite">
            {log.slice(0, 4).map((entry, index) => (
              <li key={`${entry}-${index}`} className={index === 0 ? "font-semibold text-cyan-300" : "text-slate-300"}>
                {entry}
              </li>
            ))}
          </ol>
        </div>

        <div className="hidden xl:col-start-2 xl:row-start-3 xl:block">
          <button type="button" onClick={endTurn} disabled={Boolean(gameResult) || opponentThinking || (isSetup && !hasCoralInPlay) || isStartOfTurn} className={`seapals-turn-button w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-4 text-base font-black text-slate-950 shadow-xl transition hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40${tutorialTargetClass("turn-button")}`} data-tutorial-target="turn-button">{opponentThinking ? "Opponent Thinking…" : isSetup ? startingPlayer === OpeningPlayer.OPPONENT ? "Begin Opponent Turn" : "Begin Round 1" : "End Turn"}</button>
        </div>
      </section>

      {inspectedCardData ? (
        <>
          <button type="button" aria-label="Close card inspector" onClick={closeCardInspector} className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm" />
          <aside
            className="seapals-card-drawer seapals-hud-panel fixed inset-y-0 right-0 z-[110] w-full max-w-md overflow-y-auto border-l border-cyan-300/30 p-6 text-slate-100 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seapals-card-inspector-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{inspectedCard.reference ? "Deck search preview" : inspectedCard.foundation ? inspectedCard.owner === "player" ? "Your Foundation" : "Opponent Foundation" : inspectedCard.owner === "player" ? "Your Creature" : "Opponent Creature"}</div>
                <h2 id="seapals-card-inspector-title" className="mt-1 text-2xl font-black text-white">{inspectedCardData.name}</h2>
              </div>
              <button type="button" autoFocus onClick={closeCardInspector} className={`rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10${tutorialTargetClass("close-modal")}`} data-tutorial-target="close-modal">Close</button>
            </div>
            {tutorialHelpInline && tutorialHelp.target === "close-modal" ? (
              <div className="mt-4">
                <ProfessorGuideCard guide={tutorialGuide} help={tutorialHelp} step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)} total={tutorialContract.checkpoints.length} inline onDismiss={() => setTutorialHelpDismissedId(tutorialHelpDismissalKey)} />
              </div>
            ) : null}
            <img src={inspectedCardData.image} alt={inspectedCardData.name} className="mt-5 h-96 w-full rounded-3xl border border-white/10 bg-slate-950/45 object-contain" />
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-200">{getCardClassLabel(inspectedCardData)}</span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">{getPlayerCardPlayCost(inspectedCardData)} RP</span>
              {inspectedCardData.defense ? <span className="rounded-full bg-indigo-400/15 px-3 py-1 text-indigo-200">Defense {inspectedCardData.defense?.dice ?? inspectedCardData.defense}</span> : null}
              {Number(inspectedCardData.victoryPoints ?? 0) > 0 ? <span className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">{inspectedCardData.victoryPoints} VP</span> : null}
            </div>
            {inspectedFoundation ? (
              <div className="mt-4">
                <FoundationVitals
                  foundation={inspectedFoundation}
                  densityBucket={inspectedFoundationDensityBucket}
                  owner={inspectedCard.owner}
                />
              </div>
            ) : null}
            {inspectedCard.owner === "player" && (creatureStatuses[inspectedActionKey] ?? []).length ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                <strong className="block">Active protection</strong>
                {(creatureStatuses[inspectedActionKey] ?? []).map((status, index) => (
                  <div key={`${status.sourceCardId}-${status.type}-${index}`}>
                    {cardsById[status.sourceCardId]?.name ?? "An ally"}: {status.type === "defenseAdvantage" ? "roll defense with advantage" : `add ${status.dice} to defense`} until your next turn
                  </div>
                ))}
              </div>
            ) : null}
            {inspectedCardData.text ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300">{inspectedCardData.text}</p> : null}
            {(inspectedCardData.passives ?? []).length ? (
              <section className="mt-5">
                <h3 className="font-black text-white">Passive abilities</h3>
                <div className="mt-2 space-y-2">
                  {inspectedCardData.passives.map((passive, index) => {
                    const passiveText = typeof passive === "string" ? passive : passive.text;
                    const passiveName = typeof passive === "object" ? passive.name : passiveText.split(":")[0];
                    const heal = getPassiveCoralHeal(passive);
                    const damageCounterMove = getDamageCounterMove(passive);
                    const jointedStructureMove = getJointedStructureMove(passive);
                    const damageCounterAvailability = damageCounterMove && inspectedCard.owner === "player"
                      ? getDamageCounterMoveAvailability(passive, inspectedCard.coralId)
                      : null;
                    const isActionPhasePassive = Boolean(heal || damageCounterMove || /once per turn|as often as you like on your turn/i.test(passiveText ?? ""));
                    const actionKey = `${inspectedActionKey}:${typeof passive === "object" ? passive.id ?? passiveName : passiveName}`;
                    const alreadyUsed = usedCreatureActions.includes(actionKey);
                    return (
                      <div key={passive.id ?? index} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                        <strong>{passiveName ? `${passiveName}: ` : ""}</strong>
                        {typeof passive === "string" && passiveText.includes(":") ? passiveText.slice(passiveText.indexOf(":") + 1).trim() : passiveText}
                        {inspectedCard.owner === "player" && heal ? (
                          <button type="button" disabled={gamePhase !== "main" || alreadyUsed} onClick={() => beginPassiveCoralHeal(passive)} className="mt-3 w-full rounded-full bg-emerald-600 px-4 py-2 font-bold text-white disabled:bg-slate-400">
                            {alreadyUsed ? "Used This Turn" : `Use ${heal.actionName}`}
                          </button>
                        ) : null}
                        {inspectedCard.owner === "player" && damageCounterMove ? (
                          <>
                            <button type="button" disabled={Boolean(damageCounterAvailability?.reason)} onClick={() => beginDamageCounterMove(passive)} className="mt-3 w-full rounded-full bg-violet-600 px-4 py-2 font-bold text-white disabled:bg-slate-400">
                              Use {damageCounterMove.actionName}
                            </button>
                            {damageCounterAvailability?.reason ? <div className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">{damageCounterAvailability.reason}</div> : null}
                          </>
                        ) : null}
                        {inspectedCard.owner === "player" && jointedStructureMove ? (
                          <button type="button" disabled={gamePhase !== "main" || alreadyUsed} onClick={() => beginJointedStructureMove(passive)} className="mt-3 w-full rounded-full bg-cyan-600 px-4 py-2 font-bold text-white disabled:bg-slate-400">
                            {alreadyUsed ? "Used This Turn" : `Use ${jointedStructureMove.actionName}`}
                          </button>
                        ) : null}
                        {isActionPhasePassive && !heal && !damageCounterMove && !jointedStructureMove ? <div className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">This action-phase passive is visible for teaching, but its interactive resolution is not implemented yet.</div> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {(inspectedCardData.onPlay ?? []).length ? (
              <section className="mt-5">
                <h3 className="font-black text-white">On play</h3>
                <div className="mt-2 space-y-2">{inspectedCardData.onPlay.map((action, index) => { const actionName = typeof action === "string" ? action.split(":")[0] : action.name; const actionText = typeof action === "string" ? action.slice(action.indexOf(":") + 1).trim() : action.text; return <div key={action.id ?? index} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300"><strong className="text-white">{actionName ? `${actionName}: ` : ""}</strong>{actionText}</div>; })}</div>
              </section>
            ) : null}
            {(inspectedCardData.actions ?? []).length ? (
              <section className="mt-5">
                <h3 className="font-black text-white">Actions</h3>
                <div className="mt-2 space-y-2">{inspectedCardData.actions.map((action, index) => {
                  const utilityEffect = getSupportedUtilityEffect(action);
                  const actionName = typeof action === "string" ? action.split(":")[0] : action.name;
                  const actionText = typeof action === "string" ? action.slice(action.indexOf(":") + 1).trim() : action.text ?? "Action ability";
                  const actionKey = `${inspectedActionKey}:${action.id ?? actionName}`;
                  const cost = Number(action.cost?.rp ?? actionText.match(/cost:\s*(\d+)\s*rp/i)?.[1] ?? 0);
                  const alreadyUsed = actionIsOncePerTurn(action) && usedCreatureActions.includes(actionKey);
                  return (
                    <div key={action.id ?? index} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                      <strong>{actionName}: </strong>{actionText}
                      {inspectedCard.owner === "player" && utilityEffect ? (
                        <button
                          type="button"
                          disabled={gamePhase !== "main" || rp < cost || alreadyUsed || inspectedFoundationIsStunned}
                          onClick={() => beginCreatureUtilityAction(action)}
                          className={`mt-3 w-full rounded-full bg-cyan-600 px-4 py-2 font-bold text-white disabled:bg-slate-400${tutorialActionTargetClass(actionKey)}`}
                          data-tutorial-target="utility-action-button"
                          data-tutorial-action-key={actionKey}
                        >
                          {inspectedFoundationIsStunned ? `${actionName} Unavailable While Stunned` : alreadyUsed ? `${actionName} Used This Turn` : `Use ${actionName} (${cost} RP)`}
                        </button>
                      ) : null}
                      {inspectedCard.owner === "player" && !utilityEffect && !parseLegacyAttackAction(action) && !getActionEffects(action).some((effect) => effect.type === EffectType.ATTACK) ? <div className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">This action is not implemented yet.</div> : null}
                    </div>
                  );
                })}</div>
              </section>
            ) : null}
            {tutorialHelpInline && ["attack-button", "utility-action-button"].includes(tutorialHelp.target) ? (
              <ProfessorGuideCard guide={tutorialGuide} help={tutorialHelp} step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)} total={tutorialContract.checkpoints.length} inline onDismiss={() => setTutorialHelpDismissedId(tutorialHelpDismissalKey)} />
            ) : null}
            {inspectedCard.owner === "player" && getBasicAttackEffect(inspectedCardData) ? (
              <button
                type="button"
                disabled={gamePhase !== "main" || usedAttackers.includes(inspectedActionKey) || turn < Number(actionCooldowns[inspectedActionKey] ?? 0) || rp < getBasicAttackEffect(inspectedCardData).actionCost}
                onClick={() => {
                  attackWithCreature(inspectedCard.coralId, inspectedCard.slotId);
                  setInspectedCard(null);
                }}
                className={`mt-6 w-full rounded-full bg-rose-600 px-6 py-3 font-black text-white disabled:bg-slate-400${tutorialTargetClass("attack-button")}`}
                data-tutorial-target="attack-button"
              >
                {turn < Number(actionCooldowns[inspectedActionKey] ?? 0) ? "Unavailable This Turn" : usedAttackers.includes(inspectedActionKey) ? "Action Already Used" : `Use ${getBasicAttackEffect(inspectedCardData).actionName} (${getBasicAttackEffect(inspectedCardData).actionCost} RP)`}
              </button>
            ) : null}
          </aside>
        </>
      ) : null}

      {opponentThinking ? (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[85] -translate-x-1/2 rounded-full border border-cyan-300/60 bg-slate-950/95 px-6 py-3 text-white shadow-[0_12px_40px_rgba(15,23,42,0.55)] backdrop-blur" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">{[0, 1, 2].map((index) => <span key={index} className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" style={{ animationDelay: `${index * 180}ms` }} />)}</div>
            <span className="font-black">Opponent is thinking…</span>
            <span className="hidden text-xs text-slate-300 sm:inline">Reviewing RP, cards, targets, and VP</span>
          </div>
        </div>
      ) : null}

      {tutorialCompletionDialogOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tutorial-complete-title" aria-describedby="tutorial-complete-description">
          <div className="w-full max-w-xl rounded-[2rem] border-2 border-amber-300 bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 p-6 text-center text-white shadow-[0_24px_90px_rgba(8,145,178,.45)] sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-300 text-3xl font-black text-amber-950 shadow-lg" aria-hidden="true">✓</div>
            <div className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-amber-200">26 VP Aquarium Reef</div>
            <h2 id="tutorial-complete-title" className="mt-2 text-3xl font-black sm:text-4xl">Aquarium Lesson Complete</h2>
            <div className="mx-auto mt-5 w-fit rounded-2xl border border-emerald-300/45 bg-emerald-300/15 px-6 py-3 text-2xl font-black tabular-nums text-emerald-100">
              {playerVp} of {victoryTarget} VP
            </div>
            <p id="tutorial-complete-description" className="mt-5 text-base leading-relaxed text-cyan-50/85">
              You carried the Whale Shark milestone into the final round, used Deep Sea Fishing to find Hammerhead, and completed the practice reef. Your lesson progress has been recorded.
            </p>
            <button type="button" autoFocus onClick={() => returnToStoryTown("duel-complete")} className="mt-7 min-h-12 rounded-full bg-gradient-to-r from-amber-300 to-emerald-300 px-8 py-3 text-base font-black text-slate-950 shadow-lg transition hover:brightness-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
              Finish Lesson &amp; Return
            </button>
          </div>
        </div>
      ) : null}

      {tutorialExitConfirmationOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tutorial-exit-title" aria-describedby="tutorial-exit-description">
          <div className="w-full max-w-lg rounded-[2rem] border border-cyan-300/45 bg-slate-900 p-6 text-white shadow-2xl sm:p-8">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Unfinished Aquarium Lesson</div>
            <h2 id="tutorial-exit-title" className="mt-2 text-2xl font-black sm:text-3xl">Leave the lesson?</h2>
            <p id="tutorial-exit-description" className="mt-4 text-base leading-relaxed text-slate-200">
              Your completed lesson skills are saved. The current practice reef and board will restart from setup, so leaving now means you will replay this practice duel when you return.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={confirmTutorialExit} className="min-h-11 rounded-full border border-rose-300/50 px-6 py-2.5 text-sm font-black text-rose-100 transition hover:bg-rose-300/10">
                Leave &amp; Restart Later
              </button>
              <button type="button" autoFocus onClick={() => setTutorialExitConfirmationOpen(false)} className="min-h-11 rounded-full bg-emerald-400 px-7 py-2.5 text-sm font-black text-slate-950 shadow-lg transition hover:bg-emerald-300">
                Keep Playing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eventOverlay ? (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-hidden={inspectedCardData ? "true" : undefined}
          inert={inspectedCardData || undefined}
          aria-labelledby="seapals-event-title"
          aria-describedby={eventOverlay.message && !["condition-reveal", "opponent-status"].includes(eventOverlay.type) ? "seapals-event-message" : undefined}
        >
          <div className="seapals-event-card my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] border border-cyan-300/50 bg-slate-900 p-4 text-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:p-6">
            <div className={eventOverlay.sourceCardId ? "grid gap-6 md:grid-cols-[260px_1fr]" : "mx-auto max-w-3xl text-center"}>
              {eventOverlay.sourceCardId ? <div className={`rounded-3xl bg-white/10 p-4 ${eventOverlay.defenderCardId ? "grid grid-cols-2 gap-2 md:grid-cols-1" : ""}`}>
                {eventOverlay.sourceCardId ? <img src={cardsById[eventOverlay.sourceCardId]?.image} alt={cardsById[eventOverlay.sourceCardId]?.name} className="h-80 w-full rounded-2xl bg-white object-contain" /> : null}
                {eventOverlay.defenderCardId ? <img src={cardsById[eventOverlay.defenderCardId]?.image} alt={cardsById[eventOverlay.defenderCardId]?.name} className="h-80 w-full rounded-2xl bg-white object-contain" /> : null}
              </div> : null}
              <div className="flex flex-col justify-center">
                <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">{eventOverlay.type === "tutorial-final-round-milestone" ? "Aquarium Lesson Milestone" : isOpeningCoinEvent ? "Opening Flip" : "Game Event"}</div>
                <h2 id="seapals-event-title" className="mt-2 text-3xl font-black md:text-4xl">{eventOverlay.title}</h2>
                {!["condition-reveal", "opponent-status"].includes(eventOverlay.type) && eventOverlay.message ? <p id="seapals-event-message" className="mt-4 text-lg text-slate-200">{eventOverlay.message}</p> : null}
                {eventOverlay.type === OpeningCoinPhase.CALL ? (
                  <div className="mt-7">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-amber-200 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-5xl font-black text-amber-950 shadow-[0_0_45px_rgba(251,191,36,0.35)]" aria-hidden="true">?</div>
                    <p className="mt-5 text-sm text-slate-300">Make your call.</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <button type="button" autoFocus aria-label="Call heads" onClick={() => prepareOpeningCoinFlip("heads")} className="min-h-11 rounded-full bg-cyan-400 px-8 py-3 font-black text-slate-950 shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">Heads</button>
                      <button type="button" aria-label="Call tails" onClick={() => prepareOpeningCoinFlip("tails")} className="min-h-11 rounded-full bg-emerald-400 px-8 py-3 font-black text-slate-950 shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-emerald-200">Tails</button>
                    </div>
                  </div>
                ) : eventOverlay.type === OpeningCoinPhase.READY ? (
                  <div className="mt-6">
                    <button
                      type="button"
                      autoFocus
                      aria-keyshortcuts="Enter Space"
                      aria-label={`Flip the opening coin. You called ${formatOpeningCoinSide(eventOverlay.coinCall)}.`}
                      onClick={flipForOpeningTurn}
                      className="seapals-opening-coin-trigger"
                    >
                      <OpeningCoinVisual mode="ready" side={eventOverlay.coinCall} />
                      <strong className="text-lg font-black">Flip the Coin</strong>
                      <span className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-100/75">Press Enter or Space</span>
                    </button>
                    <div>
                      <button type="button" onClick={openOpeningCoinFlip} className="mt-4 min-h-11 rounded-full border border-slate-500 px-5 py-2 text-sm font-bold text-slate-300 transition hover:border-slate-300 hover:text-white">Change my call</button>
                    </div>
                  </div>
                ) : eventOverlay.type === OpeningCoinPhase.FLIPPING ? (
                  <div className="mt-5">
                    <OpeningCoinVisual
                      mode="flipping"
                      side={eventOverlay.coinLanded}
                      onAnimationEnd={() => completeOpeningCoinFlip(eventOverlay.flipId)}
                    />
                    <p className="font-black uppercase tracking-[0.18em] text-amber-200" role="status" aria-live="polite">Coin flipping&hellip;</p>
                  </div>
                ) : eventOverlay.type === OpeningCoinPhase.RESULT ? (
                  <div className="mt-7">
                    <OpeningCoinVisual mode="landed" side={eventOverlay.coinLanded} label={`Coin landed ${formatOpeningCoinSide(eventOverlay.coinLanded)}`} />
                    <p className="sr-only" role="status" aria-live="polite">{eventOverlay.title} {eventOverlay.message}</p>
                    {eventOverlay.coinWinner === OpeningPlayer.PLAYER ? (
                      <div className="mt-2">
                        <p className="text-sm text-slate-300">{tutorialUsesScriptedScenario ? `Nice call. You will take the first turn after setup, and ${tutorialGuide.name} will guide you through it.` : "You won, so choose who takes the first turn."}</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-3">
                          <button type="button" autoFocus onClick={() => chooseOpeningTurn(OpeningPlayer.PLAYER)} className="min-h-11 rounded-full bg-emerald-400 px-8 py-3 font-black text-slate-950 shadow-lg transition hover:brightness-110">{tutorialUsesScriptedScenario ? "Begin Setup" : "Go First"}</button>
                          {!tutorialUsesScriptedScenario ? <button type="button" onClick={() => chooseOpeningTurn(OpeningPlayer.OPPONENT)} className="min-h-11 rounded-full border border-cyan-300 px-8 py-3 font-black text-cyan-100 transition hover:bg-cyan-300/10">Let Opponent Go First</button> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-sm text-slate-300">The opponent chooses to take the first turn.</p>
                        <button type="button" autoFocus onClick={() => chooseOpeningTurn(OpeningPlayer.OPPONENT)} className="mt-5 min-h-11 rounded-full bg-rose-400 px-8 py-3 font-black text-slate-950 shadow-lg transition hover:brightness-110">Begin Setup</button>
                      </div>
                    )}
                  </div>
                ) : eventOverlay.type === "condition-reveal" ? (
                  <div className="mt-6 text-left">
                    <section className="rounded-2xl border border-violet-300/30 bg-violet-400/10 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">Round condition</div>
                      <h3 className="mt-1 text-xl font-black text-white">{eventOverlay.conditionName}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-violet-100/85">{eventOverlay.conditionText}</p>
                    </section>
                    {eventOverlay.openingOpponentTurn ? (
                      <section className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">Opening player</div>
                        <strong className="mt-1 block text-base text-white">The opponent takes the first turn.</strong>
                        <p className="mt-1 text-sm leading-relaxed text-rose-100/75">You will collect your RP and choose your draw when its opening turn is complete.</p>
                      </section>
                    ) : (
                      <section className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">Start of your turn</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <div className="rounded-xl bg-slate-950/45 px-3 py-3 text-center"><strong className="block text-3xl font-black tabular-nums text-emerald-200">+{eventOverlay.turnCollection?.collected ?? 0}</strong><span className="text-[10px] font-black uppercase tracking-wider text-emerald-100/60">RP</span></div>
                          <div className="rounded-xl bg-slate-950/45 px-3 py-3 text-center"><strong className="block text-3xl font-black tabular-nums text-cyan-100">{eventOverlay.turnCollection?.bank ?? 0}/{eventOverlay.turnCollection?.cap ?? playerRpCap}</strong><span className="text-[10px] font-black uppercase tracking-wider text-cyan-100/60">Bank</span></div>
                          <div className={`col-span-2 rounded-xl px-3 py-3 text-center sm:col-span-1 ${eventOverlay.turnCollection?.capped ? "bg-amber-400/15" : "bg-slate-950/45"}`}><strong className={`block text-3xl font-black tabular-nums ${eventOverlay.turnCollection?.capped ? "text-amber-200" : "text-slate-300"}`}>{eventOverlay.turnCollection?.capped ?? 0}</strong><span className="text-[10px] font-black uppercase tracking-wider text-slate-300/60">Capped</span></div>
                        </div>
                      </section>
                    )}
                    {eventOverlay.roundNotes?.length ? <ul className="mt-4 space-y-1 text-xs leading-relaxed text-slate-400">{eventOverlay.roundNotes.map((note) => <li key={note}>• {note}</li>)}</ul> : null}
                    {tutorialConditionHelpOpen ? (
                      <div className="mt-4">
                        <ProfessorGuideCard
                          guide={tutorialGuide}
                          help={tutorialConditionHelp}
                          step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                          total={tutorialContract.checkpoints.length}
                          inline
                          onDismiss={() => setTutorialHelpDismissedId(tutorialConditionHelpKey)}
                        />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeEventOverlay}
                      className={`mt-5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-7 py-3 font-black text-slate-950 shadow-lg${tutorialConditionHelpOpen ? " seapals-tutorial-target" : ""}`}
                      data-tutorial-target="condition-continue"
                    >
                      {eventOverlay.openingOpponentTurn ? "Continue to Opponent's Turn" : "Continue"}
                    </button>
                  </div>
                ) : eventOverlay.type === "opponent-status" ? (
                  <div className="mt-6 text-left">
                    <section className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">Start of opponent&apos;s turn</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl bg-slate-950/45 px-3 py-3 text-center">
                          <strong className="block text-3xl font-black tabular-nums text-emerald-200">+{eventOverlay.turnCollection?.collected ?? 0}</strong>
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100/60">RP</span>
                          <span className="mt-1 block text-[10px] text-slate-400">{eventOverlay.turnCollection?.available ?? 0} available</span>
                        </div>
                        <div className="rounded-xl bg-slate-950/45 px-3 py-3 text-center">
                          <strong className="block text-3xl font-black tabular-nums text-cyan-100">{eventOverlay.turnCollection?.bank ?? 0}/{eventOverlay.turnCollection?.cap ?? 0}</strong>
                          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-100/60">Bank</span>
                        </div>
                        <div className={`rounded-xl px-3 py-3 text-center ${eventOverlay.turnCollection?.capped ? "bg-amber-400/15" : "bg-slate-950/45"}`}>
                          <strong className={`block text-3xl font-black tabular-nums ${eventOverlay.turnCollection?.capped ? "text-amber-200" : "text-slate-300"}`}>{eventOverlay.turnCollection?.capped ?? 0}</strong>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300/60">Capped</span>
                        </div>
                        <div className={`rounded-xl px-3 py-3 text-center ${eventOverlay.turnCollection?.drawShortfall ? "bg-rose-400/15" : "bg-slate-950/45"}`}>
                          <strong className={`block text-3xl font-black tabular-nums ${eventOverlay.turnCollection?.drawShortfall ? "text-rose-200" : "text-violet-200"}`}>{eventOverlay.turnCollection?.drawn ?? 0}</strong>
                          <span className="text-[10px] font-black uppercase tracking-wider text-violet-100/60">Drawn</span>
                          <span className="mt-1 block text-[10px] text-slate-400">F {eventOverlay.turnCollection?.foundationDrawn ?? 0} · P {eventOverlay.turnCollection?.palsDrawn ?? 0}{Number(eventOverlay.turnCollection?.requestedDraws ?? 0) > 0 ? ` · ${eventOverlay.turnCollection.requestedDraws} due` : ""}</span>
                        </div>
                      </div>
                    </section>
                    {activeCondition ? (
                      <section className="mt-4 rounded-2xl border border-violet-300/25 bg-violet-400/10 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Condition this round</div>
                        <strong className="mt-1 block text-sm text-violet-100">{activeCondition.name}</strong>
                        {activeCondition.text ? <p className="mt-1 text-xs leading-relaxed text-violet-100/70">{activeCondition.text}</p> : null}
                      </section>
                    ) : null}
                    {eventOverlay.turnCollection?.drawShortfall ? <div className="mt-3 rounded-xl bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200">Missing {eventOverlay.turnCollection.drawShortfall} required draw{eventOverlay.turnCollection.drawShortfall === 1 ? "" : "s"}.</div> : null}
                    {eventOverlay.turnCollection?.handLimitDiscarded ? <div className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">{eventOverlay.turnCollection.handLimitDiscarded} excess card{eventOverlay.turnCollection.handLimitDiscarded === 1 ? " was" : "s were"} discarded at the hand limit.</div> : null}
                    <button type="button" onClick={closeEventOverlay} className="mt-5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-7 py-3 font-black text-slate-950 shadow-lg">Continue</button>
                  </div>
                ) : eventOverlay.type === "new-game-setup" ? (
                  isStoryMode ? (
                    <div className="mt-6 text-left">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-4">
                          <span className="block text-xs font-black uppercase tracking-wider text-emerald-300">Your Deck</span>
                          <strong className="mt-2 block text-xl text-white">{storyPlayerDeckName}</strong>
                        </div>
                        <div className="rounded-2xl border-2 border-rose-400 bg-rose-400/10 p-4">
                          <span className="block text-xs font-black uppercase tracking-wider text-rose-300">{storyOpponentName}</span>
                          <strong className="mt-2 block text-xl text-white">{storyOpponentDeckName}</strong>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                        <strong className="block text-base text-white">Story Duel</strong>
                        <span className="mt-1 block">{opponentDifficultyProfile.label} difficulty · First to {storyVictoryTarget} VP wins.</span>
                      </div>
                      {tutorialUsesScriptedScenario ? (
                        <div className="mt-4 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 p-4 text-sm leading-relaxed text-cyan-50">
                          <strong className="block text-base text-white">Guided Aquarium Lesson</strong>
                          <span className="mt-1 block">{tutorialGuide.name} has arranged the opening draws, round conditions, and enough compatible practice targets to teach economy, Support cards, card actions, attacks, Coral Reef, Predators, and an Apex finish in a deliberate order. The guided lesson may temporarily prepare cards missing from your selected starter, but your saved deck never changes.</span>
                        </div>
                      ) : null}
                      <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-slate-300"><strong className="text-white">How a turn works:</strong> reveal the round condition, collect and cap RP, choose your draw(s), play legal cards and actions, then end your turn.</div>
                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={exitStoryMode} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Return to {storyReturnLabel}</button>
                        <button type="button" onClick={() => restartStoryGame("begin")} className="rounded-full bg-emerald-500 px-7 py-3 font-black text-slate-950">{tutorialUsesScriptedScenario ? "Begin Aquarium Lesson" : "Begin Duel"}</button>
                      </div>
                    </div>
                  ) : (
                  <div className="mt-6 text-left">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-4"><span className="block text-xs font-black uppercase tracking-wider text-emerald-300">Your Deck</span><select value={selectedDeckId} onChange={(event) => setSelectedDeckId(event.target.value)} className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-3 font-bold text-white">{prebuiltDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label>
                      <label className="rounded-2xl border-2 border-rose-400 bg-rose-400/10 p-4"><span className="block text-xs font-black uppercase tracking-wider text-rose-300">Opponent Deck</span><select value={selectedOpponentDeckId} onChange={(event) => setSelectedOpponentDeckId(event.target.value)} className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-3 font-bold text-white">{prebuiltDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label>
                    </div>
                    <fieldset className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
                      <legend className="px-1 text-xs font-black uppercase tracking-wider text-amber-200">Opponent Difficulty</legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {OPPONENT_DIFFICULTY_OPTIONS.map((option) => {
                          const selected = pendingOpponentDifficulty === option.id;
                          return (
                            <button key={option.id} type="button" aria-pressed={selected} onClick={() => setPendingOpponentDifficulty(option.id)} className={`rounded-xl border-2 p-3 text-left transition ${selected ? "border-amber-300 bg-amber-300/20 shadow-[0_0_22px_rgba(252,211,77,0.2)]" : "border-white/10 bg-slate-950/35 hover:border-amber-300/45 hover:bg-amber-300/10"}`}>
                              <strong className={`block text-base ${selected ? "text-amber-100" : "text-white"}`}>{option.label}</strong>
                              <span className="mt-1 block text-xs leading-relaxed text-slate-300">{option.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <label className="mt-4 block rounded-2xl border border-cyan-400 bg-cyan-400/10 p-4"><span className="text-xs font-black uppercase tracking-wider text-cyan-300">Victory Target</span><select value={pendingVictoryTarget} onChange={(event) => setPendingVictoryTarget(Number(event.target.value))} className="ml-4 rounded-xl bg-slate-950 px-3 py-2 font-bold text-white"><option value={10}>10 VP — Quick Game</option><option value={26}>26 VP — Guided Strategy</option><option value={30}>30 VP — Full Game</option></select></label>
                    <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-slate-300"><strong className="text-white">How a turn works:</strong> reveal the round condition, collect and cap RP, choose your draw(s), play legal cards and actions, then end your turn. Every illegal play explains what is missing before you commit.</div>
                    <div className="mt-4 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 p-4 text-sm leading-relaxed text-cyan-50">
                      <strong className="block text-base text-white">New to SeaPals?</strong>
                      <span className="mt-1 block">Learn the board and each turn by playing Mr. Easterling&apos;s guided aquarium lesson. Your selected trial deck will still be waiting when you return.</span>
                      <Link
                        href={{
                          pathname: "/instructions/tutorial",
                          query: { returnDeck: selectedDeckId },
                        }}
                        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-100/70"
                      >
                        Start guided tutorial
                      </Link>
                    </div>
                    <div className="mt-5 flex flex-wrap justify-end gap-3">{!eventOverlay.initial ? <button type="button" onClick={closeEventOverlay} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Keep Current Game</button> : null}<button type="button" onClick={() => restartGame(selectedDeckId, selectedOpponentDeckId, pendingVictoryTarget, pendingOpponentDifficulty)} className="rounded-full bg-emerald-500 px-7 py-3 font-black text-slate-950">{eventOverlay.initial ? "Let's Begin!" : "Start New Game"}</button></div>
                  </div>
                  )
                ) : eventOverlay.type === "opponent-thinking" ? (
                  <div className="mt-8 flex flex-col items-center">
                    <div className="flex items-center gap-2" aria-label="Opponent is thinking">
                      {[0, 1, 2].map((index) => <span key={index} className="h-4 w-4 animate-pulse rounded-full bg-cyan-400" style={{ animationDelay: `${index * 180}ms` }} />)}
                    </div>
                    <div className="mt-5 w-full max-w-md overflow-hidden rounded-full bg-white/10"><div className="h-2 w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500" /></div>
                    <p className="mt-4 text-sm text-slate-400">{isStoryMode ? storyOpponentName : `${opponentDifficultyProfile.label} opponent`} is evaluating cards, available RP, targets, and victory points…</p>
                  </div>
                ) : eventOverlay.type === "turn-transition" ? (
                  <div className="mt-6">
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-cyan-300/30 bg-slate-950/60 p-3 text-left shadow-inner">
                      {(eventOverlay.actions?.length ? eventOverlay.actions : ["No actions were recorded."]).map((action, index) => (
                        <div key={`${index}-${action}`} className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-6 text-slate-200">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-black text-cyan-200">{index + 1}</span>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={closeEventOverlay} className="mt-5 rounded-full bg-cyan-600 px-7 py-3 font-black text-white">Continue</button>
                  </div>
                ) : eventOverlay.type === "choose-hand-limit-discard" ? (
                  <div className="mt-6">
                    <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-left text-sm leading-relaxed text-amber-50">
                      <strong className="block text-base">You decide what your hand keeps.</strong>
                      Select exactly {eventOverlay.handLimitChoice.requiredDiscardCount} card{eventOverlay.handLimitChoice.requiredDiscardCount === 1 ? "" : "s"}. Cards you do not select stay in your hand.
                    </div>
                    <div className="mt-4 grid max-h-[30rem] gap-3 overflow-y-auto p-1 sm:grid-cols-2">
                      {eventOverlay.handLimitChoice.entries.map((entry) => {
                        const card = cardsById[entry.cardId];
                        const selected = handLimitDiscardSelection.includes(entry.key);
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleHandLimitDiscard(entry.key)}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${selected ? "border-rose-300 bg-rose-400/25 shadow-[0_0_20px_rgba(251,113,133,0.2)]" : "border-slate-600 bg-white/5 hover:border-cyan-300/70 hover:bg-cyan-300/10"}`}
                          >
                            <img src={card?.image} alt="" className="h-24 w-16 shrink-0 rounded-lg bg-white object-contain" />
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-white">{card?.name ?? entry.cardId}</strong>
                              <span className="mt-1 block text-xs text-slate-300">{getCardClassLabel(card)} · {Number(card?.cost?.rp ?? 0)} RP</span>
                              <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${selected ? "bg-rose-300 text-rose-950" : "bg-emerald-300/15 text-emerald-200"}`}>{selected ? "Will discard" : "Will keep"}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <span role="status" aria-live="polite" className="font-bold text-cyan-100">
                        {handLimitDiscardSelection.length} of {eventOverlay.handLimitChoice.requiredDiscardCount} selected
                      </span>
                      <button
                        type="button"
                        disabled={handLimitDiscardSelection.length !== eventOverlay.handLimitChoice.requiredDiscardCount}
                        onClick={confirmHandLimitDiscard}
                        className="rounded-full bg-rose-500 px-7 py-3 font-black text-white shadow-lg transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Discard Selected &amp; Continue
                      </button>
                    </div>
                  </div>
                ) : eventOverlay.type === "choose-regenerate" ? (
                  <div className="mt-6">
                    <div className="rounded-2xl border border-emerald-400/50 bg-emerald-400/10 p-4 text-left text-sm text-emerald-100">Regenerate is optional. Spending is applied only after you choose it; declining will discard the defeated creature and resolve any Toxic effect.</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" disabled={rp < Number(eventOverlay.regenerate?.decision?.cost ?? 1)} onClick={() => resolvePlayerRegenerateChoice("regenerate")} className="rounded-full bg-emerald-500 px-6 py-3 font-black text-slate-950 disabled:opacity-40">Spend 1 RP &amp; Keep</button>
                      <button type="button" onClick={() => resolvePlayerRegenerateChoice("discard")} className="rounded-full border border-rose-400 px-6 py-3 font-black text-rose-100">Decline &amp; Discard</button>
                    </div>
                  </div>
                ) : eventOverlay.type === "choose-oceanic-sacrifice" ? (
                  <div className="mt-6">
                    <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                      {(searchContext?.choices ?? []).map((choice) => {
                        const card = cardsById[searchContext.cardId];
                        const required = getPlayerSchoolDensityRequirement(card).effectiveRequirement;
                        const opened = Math.max(0, playerSchoolDensity - playerSchoolDensityState.committed + getDensityFreedBySacrificeChoice(choice));
                        const densityLegal = required <= opened;
                        return (
                          <button key={choice.id} type="button" disabled={!densityLegal} onClick={() => completePlayerOceanicPlay(searchContext.cardId, choice.id)} className="rounded-2xl border-2 border-rose-400 bg-rose-400/10 p-4 text-left transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:border-slate-600 disabled:opacity-45">
                            <span className="mb-3 block text-xs font-black uppercase tracking-widest text-rose-200">{choice.kind === "predator" ? "Sacrifice one Predator" : "Sacrifice two Fish"}</span>
                            <span className="flex gap-3">{choice.candidates.map((candidate) => <span key={candidate.instanceId} className="min-w-0 flex-1"><img src={candidate.card?.image} alt={candidate.card?.name} className="h-32 w-full rounded-xl bg-white object-contain" /><strong className="mt-2 block truncate text-sm">{candidate.card?.name}</strong></span>)}</span>
                            <span className={`mt-3 block text-xs font-bold ${densityLegal ? "text-cyan-200" : "text-rose-200"}`}>{opened} School Density would be open; {required} needed.</span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setPlayError("Oceanic sacrifice canceled. No card or RP was spent."); }} className="mt-4 rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel — Spend Nothing</button>
                  </div>
                ) : eventOverlay.type === "choose-invasive-placement" ? (
                  <div className="mt-6">
                    <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                      {(searchContext?.candidates ?? []).map((candidate) => {
                        const coral = opponentCorals.find((entry) => entry.id === candidate.coralId);
                        const coralCard = cardsById[coral?.cardId];
                        const slot = coral?.slots.find((entry) => entry.id === candidate.slotId);
                        if (!coral || !slot || slot.cardId) return null;
                        return (
                          <button key={`${candidate.coralId}-${candidate.slotId}`} type="button" onClick={() => completeInvasivePlacement(candidate.coralId, candidate.slotId)} className="flex items-center gap-4 rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-3 text-left transition hover:bg-emerald-400/25">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-slate-950/70"><img src={getSlotIconPath(slot)} alt={`${slot.type} slot`} className="h-12 w-12 object-contain" /></span>
                            <span><strong className="block text-base text-white">{coralCard?.name}</strong><span className="mt-1 block text-sm capitalize text-emerald-200">Empty {slot.type} slot</span></span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setPlayError("Invasive placement canceled. No card or RP was spent."); }} className="mt-4 rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel &mdash; Spend Nothing</button>
                  </div>
                ) : eventOverlay.type === "choose-scientist-jes" ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => chooseScientistJes("search")} className="rounded-2xl border-2 border-amber-400 bg-amber-400/10 p-5 text-left hover:bg-amber-400/25"><strong className="block text-lg">Search for a Habitat</strong><span className="mt-1 block text-sm text-amber-100">Reveal one Habitat from either personal deck and add it to your hand.</span></button>
                    <button type="button" onClick={() => chooseScientistJes("draw")} className="rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 p-5 text-left hover:bg-cyan-400/25"><strong className="block text-lg">Draw Two Cards</strong><span className="mt-1 block text-sm text-cyan-100">Allocate both draws between Foundation and Pals.</span></button>
                    <button type="button" onClick={() => chooseScientistJes("cancel")} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">Cancel — Spend Nothing</button>
                  </div>
                ) : eventOverlay.type === "choose-impact-target" ? (
                  <div className="mt-6">
                    {scriptedTutorialOverlayHelpOpen && scriptedImpactTargetHelp ? (
                      <div className="mb-4">
                        <ProfessorGuideCard
                          guide={tutorialGuide}
                          help={scriptedTutorialOverlayHelp}
                          step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                          total={tutorialContract.checkpoints.length}
                          inline
                          onDismiss={() => setTutorialHelpDismissedId(scriptedTutorialOverlayHelpKey)}
                        />
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                    {opponentCorals.filter((coral) => eventOverlay.targetCoralIds.includes(coral.id)).map((coral) => {
                      const card = cardsById[coral.cardId];
                      return (
                        <button key={coral.id} type="button" data-tutorial-target={scriptedImpactTargetHelp ? "impact-target" : undefined} onClick={() => damageOpponentFoundation(coral.id, eventOverlay.amount, cardsById[eventOverlay.sourceCardId])} className={`flex items-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-3 text-left transition hover:bg-emerald-400/25${scriptedImpactTargetHelp ? " seapals-tutorial-target" : ""}`}>
                          <img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" />
                          <span><strong className="block">{card?.name}</strong><span className="text-sm text-emerald-200">{coral.health}/{coral.maxHealth} HP</span></span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                ) : eventOverlay.type === "choose-territorial-target" ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {playerCorals.filter((foundation) => searchContext?.candidates.includes(foundation.id)).map((foundation) => {
                      const card = cardsById[foundation.cardId];
                      return <button key={foundation.id} type="button" onClick={() => completeTerritorialTarget(foundation.id)} className="flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-amber-400/10 p-3 text-left transition hover:bg-amber-400/25"><img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" /><span><strong className="block">{card?.name}</strong><span className="text-sm text-amber-200">{foundation.health}/{foundation.maxHealth} HP before Territorial</span></span></button>;
                    })}
                  </div>
                ) : eventOverlay.type === "choose-neural-network-source" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {playerCoralCards.filter((coral) => searchContext?.candidates.includes(coral.id)).map((coral) => {
                      const card = cardsById[coral.cardId];
                      const counterHp = Number(searchContext?.counterHp ?? DAMAGE_COUNTER_HP);
                      return (
                        <button key={coral.id} type="button" onClick={() => chooseDamageCounterSource(coral.id)} className="flex items-center gap-3 rounded-2xl border-2 border-violet-400 bg-violet-400/10 p-3 text-left transition hover:bg-violet-400/25">
                          <img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" />
                          <span><strong className="block">{card?.name}</strong><span className="text-sm text-violet-200">{coral.health}/{coral.maxHealth} HP → {Number(coral.health) + counterHp}/{coral.maxHealth} HP</span></span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">Cancel — Move Nothing</button>
                  </div>
                ) : eventOverlay.type === "choose-neural-network-destination" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {playerCoralCards.filter((coral) => searchContext?.candidates.includes(coral.id)).map((coral) => {
                      const card = cardsById[coral.cardId];
                      const counterHp = Number(searchContext?.counterHp ?? DAMAGE_COUNTER_HP);
                      return (
                        <button key={coral.id} type="button" onClick={() => completeDamageCounterMove(coral.id)} className="flex items-center gap-3 rounded-2xl border-2 border-violet-400 bg-violet-400/10 p-3 text-left transition hover:bg-violet-400/25">
                          <img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" />
                          <span><strong className="block">{card?.name}</strong><span className="text-sm text-violet-200">{coral.health}/{coral.maxHealth} HP → {Number(coral.health) - counterHp}/{coral.maxHealth} HP</span></span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">Cancel — Move Nothing</button>
                  </div>
                ) : eventOverlay.type === "choose-symbiosis-card" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {(searchContext?.candidates ?? []).map((cardId, index) => { const card = cardsById[cardId]; return <button key={`${cardId}-${index}`} type="button" onClick={() => completeSymbiosis(cardId)} className="flex items-center gap-3 rounded-2xl border-2 border-fuchsia-400 bg-fuchsia-400/10 p-3 text-left hover:bg-fuchsia-400/25"><img src={card?.image} alt={card?.name} className="h-24 w-16 rounded-lg bg-white object-contain" /><span><strong className="block">{card?.name}</strong><span className="text-sm text-fuchsia-200">Host inside Anemone</span></span></button>; })}
                  </div>
                ) : eventOverlay.type === "choose-onplay-multi-search" ? (
                  <div className="mt-6">
                    <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                      {(searchContext?.candidates ?? []).map((cardId) => {
                        const card = cardsById[cardId];
                        const selectedCopies = searchContext.selected.filter((selectedId) => selectedId === cardId).length;
                        const availableCopies = [...foundationDeck, ...palsDeck].filter((candidateId) => candidateId === cardId).length;
                        return (
                          <DeckSearchChoice
                            key={cardId}
                            card={card}
                            onInspect={() => inspectSearchResult(cardId)}
                            onChoose={() => toggleOnPlaySearchCard(cardId)}
                            chooseLabel={selectedCopies ? `Selected ${selectedCopies}/${Math.min(availableCopies, searchContext.max)}` : "Select"}
                            chosen={selectedCopies > 0}
                            meta={availableCopies > 1 ? `${availableCopies} copies available` : getCardClassLabel(card)}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-3"><button type="button" onClick={() => completeOnPlayMultiSearch()} className="rounded-full bg-emerald-500 px-6 py-3 font-black">Confirm {searchContext?.selected.length ?? 0}/{searchContext?.max ?? 0}</button><button type="button" onClick={() => completeOnPlayMultiSearch([])} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Choose No Cards</button></div>
                  </div>
                ) : eventOverlay.type === "choose-school-momentum" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {(searchContext?.candidates ?? []).map((cardId) => {
                      const card = cardsById[cardId];
                      return <DeckSearchChoice key={cardId} card={card} onInspect={() => inspectSearchResult(cardId)} onChoose={() => completeSchoolMomentum(cardId)} meta={card?.stageLabel ?? getCardClassLabel(card)} />;
                    })}
                  </div>
                ) : eventOverlay.type === "choose-inspection-deck" ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[{ type: "foundation", count: foundationDeck.length }, { type: "pals", count: palsDeck.length }].map((deck) => <button key={deck.type} type="button" disabled={!deck.count} onClick={() => chooseInspectionDeck(deck.type)} className="rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 p-5 text-center font-black capitalize hover:bg-cyan-400/25 disabled:opacity-35">{deck.type} Deck<span className="mt-1 block text-sm font-semibold text-cyan-200">{deck.count} cards</span></button>)}
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setModal("hand"); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">Cancel Inspection</button>
                  </div>
                ) : eventOverlay.type === "reorder-deck" ? (
                  <div className="mt-6">
                    <div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{(searchContext?.topCards ?? []).map((cardId, index) => { const card = cardsById[cardId]; return <div key={`${cardId}-${index}`} className="rounded-2xl border border-cyan-400 bg-cyan-400/10 p-3 text-center"><img src={card?.image} alt={card?.name} className="h-40 w-full rounded-xl bg-white object-contain" /><strong className="mt-2 block truncate">{index + 1}. {card?.name}</strong><div className="mt-2 flex justify-center gap-2"><button type="button" disabled={!index} onClick={() => moveInspectedDeckCard(index, -1)} className="rounded-full border border-cyan-300 px-3 py-1 disabled:opacity-30">Earlier</button><button type="button" disabled={index === searchContext.topCards.length - 1} onClick={() => moveInspectedDeckCard(index, 1)} className="rounded-full border border-cyan-300 px-3 py-1 disabled:opacity-30">Later</button></div></div>; })}</div>
                    <div className="mt-4 flex gap-3"><button type="button" onClick={() => commitDeckInspection()} className="rounded-full bg-emerald-500 px-6 py-3 font-black">Confirm Order</button><button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setModal("hand"); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel</button></div>
                  </div>
                ) : eventOverlay.type === "choose-explorer-card" ? (
                  <div className="mt-6">
                    <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                      {(searchContext?.candidates ?? []).map((cardId, index) => {
                        const card = cardsById[cardId];
                        return <DeckSearchChoice key={`${cardId}-${index}`} card={card} onInspect={() => inspectSearchResult(cardId)} onChoose={() => commitDeckInspection(cardId)} meta={getCardClassLabel(card)} />;
                      })}
                    </div>
                    <div className="mt-4 flex gap-3"><button type="button" onClick={() => commitDeckInspection()} className="rounded-full bg-cyan-600 px-6 py-3 font-black">Choose No Card</button><button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setModal("hand"); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel</button></div>
                  </div>
                ) : eventOverlay.type === "choose-clear-status-target" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {playerCoralCards.filter((coral) => searchContext?.candidates.includes(coral.id)).map((coral) => { const card = cardsById[coral.cardId]; const effects = [...(coral.statuses ?? []).map((status) => status.type), Number(coral.rpPenaltyNextTurn ?? 0) > 0 ? "RP penalty" : null].filter(Boolean); return <button key={coral.id} type="button" onClick={() => completeCoralStatusClear(coral.id)} className="flex items-center gap-3 rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 p-3 text-left hover:bg-cyan-400/25"><img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" /><span><strong className="block">{card?.name}</strong><span className="text-sm text-cyan-200">Remove {effects.join(", ")}</span></span></button>; })}
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setModal("hand"); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">Cancel Support</button>
                  </div>
                ) : ["choose-coin-coral-target", "choose-coral-effect-target"].includes(eventOverlay.type) ? (
                  <div className="mt-6">
                    {scriptedTutorialOverlayHelpOpen && scriptedCoinActionHelp ? (
                      <ProfessorGuideCard
                        guide={tutorialGuide}
                        help={scriptedTutorialOverlayHelp}
                        step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                        total={tutorialContract.checkpoints.length}
                        inline
                        onDismiss={() => setTutorialHelpDismissedId(scriptedTutorialOverlayHelpKey)}
                      />
                    ) : null}
                    <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                      {opponentCorals.filter((coral) => pendingCreatureAction?.candidates.includes(coral.id)).map((coral) => { const card = cardsById[coral.cardId]; return <button key={coral.id} type="button" data-tutorial-target={scriptedCoinActionHelp ? "coin-coral-target" : undefined} onClick={() => completeCoinCoralEffect(coral.id)} className={`flex items-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-3 text-left hover:bg-emerald-400/25${scriptedCoinActionHelp ? " seapals-tutorial-target" : ""}`}><img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" /><span><strong className="block">{card?.name}</strong><span className="text-sm text-emerald-200">{coral.health}/{coral.maxHealth} HP</span></span></button>; })}
                      <button type="button" onClick={() => { const wasCommitted = pendingCreatureAction?.costCommitted; setPendingCreatureAction(null); setEventOverlay({ type: "utility-result", sourceCardId: pendingCreatureAction?.sourceCardId, title: wasCommitted ? "Effect Skipped" : "Action Canceled", message: wasCommitted ? "The effect was ready, but no coral was chosen. The already-paid action cost remains spent." : "No coral was chosen. No RP was spent and the action remains available.", success: false }); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">{pendingCreatureAction?.costCommitted ? "Skip Target" : "Cancel Action"}</button>
                    </div>
                  </div>
                ) : eventOverlay.type === "choose-onplay-heal-target" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {playerCorals.filter((coral) => searchContext?.candidates.includes(coral.id)).map((coral) => { const card = cardsById[coral.cardId]; return <button key={coral.id} type="button" onClick={() => completeOnPlayCoralHeal(coral.id)} className="flex items-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-3 text-left hover:bg-emerald-400/25"><img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" /><span><strong className="block">{card?.name}</strong><span className="text-sm text-emerald-200">{coral.health}/{coral.maxHealth} HP</span></span></button>; })}
                    <button type="button" onClick={() => { const sourceCardId = searchContext?.sourceCardId; setSearchContext(null); setEventOverlay({ type: "utility-result", sourceCardId, title: "Healing Skipped", message: "The creature remains in play, but its on-play healing was skipped.", success: false }); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">Skip Healing</button>
                  </div>
                ) : eventOverlay.type === "choose-whirlpool-target" ? (
                  <div className="mt-6 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
                    {opponentCorals.filter((coral) => searchContext?.candidates.includes(coral.id)).map((coral) => { const card = cardsById[coral.cardId]; return <button key={coral.id} type="button" onClick={() => completeWhirlpool(coral.id)} className="flex items-center gap-3 rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 p-3 text-left hover:bg-cyan-400/25"><img src={card?.image} alt={card?.name} className="h-28 w-20 rounded-xl bg-white object-contain" /><span><strong className="block">{card?.name}</strong><span className="text-sm text-cyan-200">Current penalty: {Number(coral.rpPenaltyNextTurn ?? 0)} RP</span></span></button>; })}
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setModal("hand"); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Effect</button>
                  </div>
                ) : eventOverlay.type === "choose-spearfishing-target" ? (
                  <div className="mt-6 max-h-80 space-y-2 overflow-y-auto">
                    {(searchContext?.candidates ?? []).map((candidate) => {
                      const card = cardsById[candidate.cardId];
                      const foreignInvader = candidate.owner && candidate.owner !== "player";
                      return <button key={`${candidate.coralId}-${candidate.slotId}`} type="button" onClick={() => completeSpearfishing(candidate)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-rose-400 bg-rose-400/10 p-3 text-left transition hover:bg-rose-400/25"><img src={card?.image} alt={card?.name} className="h-24 w-16 rounded-lg bg-white object-contain" /><span><strong className="block">{card?.name}{foreignInvader ? " — opponent's invader" : ""}</strong><span className="text-sm text-rose-200">Discard to recover {Number(card?.cost?.rp ?? 0)} RP{foreignInvader ? "; card returns to opponent" : ""}</span></span></button>;
                    })}
                    <button type="button" onClick={() => { setSearchContext(null); setEventOverlay(null); setModal("hand"); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Spearfishing</button>
                  </div>
                ) : eventOverlay.type === "choose-friendly-creature" ? (
                  <div className="mt-6 max-h-80 space-y-2 overflow-y-auto">
                    {(pendingCreatureAction?.candidates ?? []).map((candidate) => {
                      const card = cardsById[candidate.cardId];
                      return (
                        <button key={candidate.slotId} type="button" onClick={() => completeDefensiveBuff(candidate.slotId)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-3 text-left transition hover:bg-emerald-400/25">
                          <img src={card?.image} alt={card?.name} className="h-24 w-16 rounded-lg bg-white object-contain" />
                          <span><strong className="block">{card?.name}</strong><span className="text-sm text-emerald-200">Choose this creature</span></span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => { setPendingCreatureAction(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Action</button>
                  </div>
                ) : eventOverlay.type === "choose-action-hand-discard" ? (
                  <div className="mt-6">
                    {scriptedTutorialOverlayHelpOpen ? (
                      <ProfessorGuideCard
                        guide={tutorialGuide}
                        help={scriptedTutorialOverlayHelp}
                        step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                        total={tutorialContract.checkpoints.length}
                        inline
                        onDismiss={() => setTutorialHelpDismissedId(scriptedTutorialOverlayHelpKey)}
                      />
                    ) : null}
                    <div className="mt-4 max-h-[30rem] space-y-2 overflow-y-auto p-1">
                      {(pendingCreatureAction?.handEntries ?? []).map((entry) => {
                        const card = cardsById[entry.cardId];
                        const selected = pendingCreatureAction.selectedIndices.includes(entry.index);
                        const scriptedChoice = scriptedTutorialOverlayHelpOpen && scriptedDiscardCandidates.some((candidate) => candidate.index === entry.index);
                        const scriptedChoiceNeedsSelection = scriptedChoice && !selected && !scriptedDiscardReady;
                        return <button key={`${entry.cardId}-${entry.index}`} type="button" onClick={() => toggleActionHandDiscard(entry.index)} data-tutorial-target={scriptedChoiceNeedsSelection ? "script-discard-cards" : undefined} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${selected ? "border-rose-400 bg-rose-400/25" : "border-slate-500 bg-white/5"}${scriptedChoice ? " seapals-tutorial-target" : ""}`}><img src={card?.image} alt={card?.name} className="h-20 w-14 rounded-lg bg-white object-contain" /><strong className="flex-1">{card?.name}</strong><span className="text-sm">{selected ? "Selected" : scriptedChoice ? `${tutorialGuide.name}'s pick` : "Keep"}</span></button>;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 pt-3"><button type="button" disabled={(pendingCreatureAction?.selectedIndices.length ?? 0) < (pendingCreatureAction?.minDiscard ?? Number(pendingCreatureAction?.effect.discard?.amount ?? 0)) || (pendingCreatureAction?.selectedIndices.length ?? 0) > (pendingCreatureAction?.maxDiscard ?? Number(pendingCreatureAction?.effect.discard?.amount ?? 0))} onClick={confirmActionHandDiscard} data-tutorial-target="script-discard-confirm" className={`rounded-full bg-rose-500 px-6 py-3 font-black disabled:opacity-40${scriptedDiscardReady && scriptedTutorialOverlayHelpOpen ? " seapals-tutorial-target" : ""}`}>Discard &amp; Continue</button><button type="button" onClick={() => { setPendingCreatureAction(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Action</button></div>
                  </div>
                ) : eventOverlay.type === "choose-action-search-card" ? (
                  <div className="mt-6">
                    {scriptedTutorialOverlayHelpOpen ? (
                      <ProfessorGuideCard
                        guide={tutorialGuide}
                        help={scriptedTutorialOverlayHelp}
                        step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                        total={tutorialContract.checkpoints.length}
                        inline
                        onDismiss={() => setTutorialHelpDismissedId(scriptedTutorialOverlayHelpKey)}
                      />
                    ) : null}
                    <div className="mt-4 grid max-h-[30rem] gap-3 overflow-y-auto p-1 sm:grid-cols-2">
                      {(pendingCreatureAction?.searchCandidates ?? []).map((cardId) => {
                        const card = cardsById[cardId];
                        const scriptedChoice = scriptedTutorialOverlayHelpOpen && cardId === scriptedSearchTargetCardId;
                        return (
                          <DeckSearchChoice
                            key={cardId}
                            card={card}
                            onInspect={() => inspectSearchResult(cardId)}
                            onChoose={() => completeActionDeckSearch(cardId)}
                            meta={`${foundationDeck.includes(cardId) ? "Foundation" : "Pals"} Deck${scriptedChoice ? ` · ${tutorialGuide.name}'s lesson target` : ""}`}
                            tutorialTarget={scriptedChoice ? "script-search-card" : undefined}
                            className={scriptedChoice ? "seapals-tutorial-target" : ""}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : eventOverlay.type === "choose-creature-action-search" ? (
                  <div className="mt-6 max-h-80 space-y-2 overflow-y-auto">
                    {(pendingCreatureAction?.candidates ?? []).map((cardId) => {
                      const card = cardsById[cardId];
                      return <DeckSearchChoice key={cardId} card={card} onInspect={() => inspectSearchResult(cardId)} onChoose={() => completeCreatureActionSearch(cardId)} meta={getCardClassLabel(card)} />;
                    })}
                    <button type="button" onClick={() => { setPendingCreatureAction(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Action</button>
                  </div>
                ) : eventOverlay.type === "choose-action-discard" ? (
                  <div className="mt-6 max-h-80 space-y-2 overflow-y-auto">
                    {[...new Set(discardPile)].map((cardId) => {
                      const card = cardsById[cardId];
                      return <button key={cardId} type="button" onClick={() => completeCreatureRecovery(cardId)} className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400 bg-cyan-400/10 p-3 text-left hover:bg-cyan-400/20"><img src={card?.image} alt={card?.name} className="h-24 w-16 rounded-lg bg-white object-contain" /><span className="font-black">{card?.name}</span></button>;
                    })}
                    <button type="button" onClick={() => { setPendingCreatureAction(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Action</button>
                  </div>
                ) : eventOverlay.type === "choose-action-reorder-source" ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[{ type: "foundation", count: foundationDeck.length }, { type: "pals", count: palsDeck.length }].map((deck) => <button key={deck.type} type="button" disabled={!deck.count} onClick={() => chooseCreatureActionReorderDeck(deck.type)} className="rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 p-5 text-center font-black capitalize hover:bg-cyan-400/25 disabled:opacity-30">{deck.type} Deck<span className="block text-sm text-cyan-200">{deck.count} cards</span></button>)}
                    <button type="button" onClick={() => { setPendingCreatureAction(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold sm:col-span-2">{pendingCreatureAction?.committed ? "Skip Optional Reorder" : "Cancel Action"}</button>
                  </div>
                ) : eventOverlay.type === "reorder-creature-action-deck" ? (
                  <div className="mt-6"><div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-3">{(pendingCreatureAction?.topCards ?? []).map((cardId, index) => { const card = cardsById[cardId]; return <div key={`${cardId}-${index}`} className="rounded-2xl border border-cyan-400 bg-cyan-400/10 p-3 text-center"><img src={card?.image} alt={card?.name} className="h-40 w-full rounded-xl bg-white object-contain" /><strong className="mt-2 block truncate">{index + 1}. {card?.name}</strong><div className="mt-2 flex justify-center gap-2"><button type="button" disabled={!index} onClick={() => moveCreatureActionDeckCard(index, -1)} className="rounded-full border px-3 py-1 disabled:opacity-30">Earlier</button><button type="button" disabled={index === pendingCreatureAction.topCards.length - 1} onClick={() => moveCreatureActionDeckCard(index, 1)} className="rounded-full border px-3 py-1 disabled:opacity-30">Later</button></div></div>; })}</div><div className="mt-4 flex gap-3"><button type="button" onClick={commitCreatureActionReorder} className="rounded-full bg-emerald-500 px-6 py-3 font-black">Confirm Order</button><button type="button" onClick={() => { setPendingCreatureAction(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">{pendingCreatureAction?.committed ? "Skip Optional Reorder" : "Cancel"}</button></div></div>
                ) : eventOverlay.type === "choose-action-deck" ? (
                  <div className="mt-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[{ id: "foundation", count: foundationDeck.length }, { id: "pals", count: palsDeck.length }].map((deck) => <div key={deck.id} className="rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 p-5 text-center"><div className="font-black capitalize">{deck.id} Deck</div><div className="text-sm text-cyan-200">{deck.count} remaining</div><div className="mt-3 flex items-center justify-center gap-3"><button type="button" disabled={!turnDrawSelection?.[deck.id]} onClick={() => adjustTurnDraw(deck.id, -1)} className="h-9 w-9 rounded-full border border-cyan-300 disabled:opacity-30">−</button><span className="text-3xl font-black">{turnDrawSelection?.[deck.id] ?? 0}</span><button type="button" disabled={(turnDrawSelection?.[deck.id] ?? 0) >= deck.count || (turnDrawSelection?.foundation ?? 0) + (turnDrawSelection?.pals ?? 0) >= (turnDrawSelection?.target ?? 0)} onClick={() => adjustTurnDraw(deck.id, 1)} className="h-9 w-9 rounded-full bg-cyan-500 font-black disabled:opacity-30">+</button></div></div>)}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" disabled={!turnDrawSelection || turnDrawSelection.foundation + turnDrawSelection.pals !== turnDrawSelection.target} onClick={completeCreatureDrawAction} className="rounded-full bg-emerald-500 px-6 py-3 font-black disabled:opacity-40">Draw Selected Cards</button>
                      {!pendingCreatureAction?.committed ? <button type="button" onClick={() => { setPendingCreatureAction(null); setTurnDrawSelection(null); setEventOverlay(null); }} className="rounded-full border border-slate-500 px-5 py-2 text-sm font-bold">Cancel Action</button> : null}
                    </div>
                  </div>
                ) : eventOverlay.type === "faceoff-ready" || eventOverlay.type === "school-attack-ready" ? (
                  <div className="mt-7">
                    {tutorialFaceoffHelpOpen ? (
                      <ProfessorGuideCard
                        guide={tutorialGuide}
                        help={tutorialFaceoffHelp}
                        step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)}
                        total={tutorialContract.checkpoints.length}
                        inline
                        onDismiss={() => setTutorialHelpDismissedId(tutorialFaceoffHelpKey)}
                      />
                    ) : null}
                    <div className={`mb-5 grid max-w-md gap-4 ${eventOverlay.type === "faceoff-ready" ? "grid-cols-2" : "grid-cols-1"}`}>
                      <div className="rounded-2xl border border-rose-400 bg-rose-500/10 p-4 text-center"><div className="text-xs font-black uppercase tracking-widest text-rose-300">Attack {eventOverlay.attackDice}</div><div className={`mt-2 text-5xl font-black ${faceoffRolling ? "animate-pulse" : ""}`}>{faceoffPreview?.attack ?? "—"}</div></div>
                      {eventOverlay.type === "faceoff-ready" ? <div className="rounded-2xl border border-cyan-400 bg-cyan-500/10 p-4 text-center"><div className="text-xs font-black uppercase tracking-widest text-cyan-300">Defense {eventOverlay.defenseDice}</div><div className={`mt-2 text-5xl font-black ${faceoffRolling ? "animate-pulse" : ""}`}>{faceoffPreview?.defense ?? "—"}</div></div> : <div className="rounded-2xl border border-amber-400 bg-amber-500/10 p-4 text-center font-bold text-amber-200">Damage = stopped roll × 10</div>}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {!faceoffRolling ? (
                        <button type="button" onClick={() => setFaceoffRolling(true)} data-tutorial-target="faceoff-action" className={`rounded-full bg-rose-600 px-8 py-3 text-lg font-black text-white shadow-[0_0_30px_rgba(244,63,94,0.45)]${tutorialFaceoffHelpOpen ? " seapals-tutorial-target" : ""}`}>Start Rolling</button>
                      ) : (
                        <button type="button" disabled={!faceoffPreview} onClick={() => resolvePlayerAttack(eventOverlay.targetCoralId, eventOverlay.targetSlotId, true, faceoffPreview)} data-tutorial-target="faceoff-action" className={`rounded-full bg-emerald-500 px-8 py-3 text-lg font-black text-white shadow-[0_0_30px_rgba(16,185,129,0.45)]${tutorialFaceoffHelpOpen ? " seapals-tutorial-target" : ""}`}>Stop & Resolve</button>
                      )}
                      {!faceoffRolling && !attackContext?.costCommitted && !attackContext?.onPlay ? <button type="button" onClick={() => { setFaceoffPreview(null); setEventOverlay(null); setAttackContext(null); }} className="rounded-full border border-slate-500 px-5 py-3 text-sm font-bold">Cancel Faceoff</button> : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-7">
                    {eventOverlay.revealedCards?.length ? <div className="mb-5"><div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300">Revealed to You</div><div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">{eventOverlay.revealedCards.map((cardId, index) => { const card = cardsById[cardId]; return <div key={`${cardId}-${index}`} className="rounded-xl border-2 border-amber-400 bg-amber-400/10 p-2 text-center"><img src={card?.image} alt={card?.name} className="h-40 w-full rounded-lg bg-white object-contain" /><div className="mt-1 truncate text-xs font-black text-amber-100">{card?.name}</div><div className="text-[10px] font-bold uppercase text-amber-300">Revealed by opponent</div></div>; })}</div></div> : null}
                    {eventOverlay.drawnCards?.length ? <div className="mb-5 grid max-h-64 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">{eventOverlay.drawnCards.map((entry, index) => { const card = cardsById[entry.cardId]; return <div key={`${entry.cardId}-${index}`} className={`rounded-xl border p-2 text-center ${entry.discarded ? "border-rose-400 bg-rose-500/10" : "border-cyan-400 bg-cyan-500/10"}`}><img src={card?.image} alt={card?.name} className="h-32 w-full rounded-lg bg-white object-contain" /><div className="mt-1 truncate text-xs font-bold">{card?.name}</div><div className="text-[10px] uppercase text-slate-300">{entry.source}{entry.discarded ? " • discarded" : ""}</div></div>; })}</div> : null}
                    {eventOverlay.repeatDamageCounterAbilityId ? <button type="button" onClick={() => repeatDamageCounterMove(eventOverlay.repeatDamageCounterAbilityId)} className="mr-3 rounded-full bg-violet-600 px-7 py-3 font-black text-white">Move Another Counter</button> : null}
                    <button type="button" onClick={closeEventOverlay} className={`rounded-full px-7 py-3 font-black text-white ${eventOverlay.sourceCardId ? "self-start" : "self-center"} ${eventOverlay.success ? "bg-emerald-500" : "bg-cyan-600"}`}>
                      {eventOverlay.continueLabel ?? "Continue"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {roundFlash ? (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-cyan-950/45 backdrop-blur-sm animate-pulse">
          <div className="rounded-[2rem] border-4 border-cyan-300 bg-slate-950/90 px-12 py-8 text-center text-white shadow-2xl">
            <div className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">New Round</div>
            <div className="mt-2 text-5xl font-black">Round {round}</div>
            <div className="mt-3 max-w-lg text-lg font-semibold">{activeCondition?.name ?? "No condition"}</div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4 ${modal === "hand" ? "xl:hidden" : ""}`}
          aria-hidden={inspectedCardData ? "true" : undefined}
          inert={inspectedCardData || undefined}
        >
          <div className={`max-h-[calc(100dvh-1rem)] max-w-[56rem] w-full overflow-y-auto rounded-[2rem] border p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6 ${isDarkZoneModal ? "seapals-hud-panel border-cyan-300/25 text-slate-100" : "border-transparent bg-white text-slate-900"}`}>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold">{modalTitle}</h3>
                <p className={`text-sm ${isDarkZoneModal ? "text-cyan-100/60" : "text-slate-600"}`}>
                  {modal === "hand"
                    ? "Review the cards in your hand. Discard or lose them from here."
                    : modal === "discard"
                    ? "Cards sent to the discard pile are shown here."
                    : modal === "search"
                    ? `Select a card's artwork or name to read its full details. Use Add to Hand only after you have chosen a card for ${cardsById[searchContext?.supportCardId]?.name}. You may cancel without spending the card or RP.`
                    : modal === "recover"
                    ? "Heads! Choose one card that was in your discard pile before Recovery resolved."
                    : modal === "lost-recover"
                    ? "Choose a Lost card to return to your hand. You can inspect each card before choosing; the recovered card cannot be played this turn, and Ocean Jake moves to the Lost Zone after use."
                    : modal === "coral-target"
                    ? "Choose a damaged coral to heal. You may cancel without spending the Support card."
                    : modal === "restock"
                    ? "Select one to three Fish. Creature Schools return to Foundation; other Fish return to Pals."
                    : modal === "support-draw"
                    ? "Split the replacement draw between your Foundation and Pals decks. Your current hand is discarded only after you confirm."
                    : modal === "turn-draw"
                    ? `Choose where to draw ${turnDrawSelection?.target ?? 0} card(s). You may split them between both personal decks.`
                    : modal === "draw-result"
                    ? "Review every card drawn this turn before continuing to your actions."
                    : "Cards sent to the lost zone are shown here."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {modal === "hand" && (
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-bold text-emerald-700" role="status">
                    {rp} RP available
                  </div>
                )}
                {modal !== "turn-draw" ? <button
                  type="button"
                  onClick={() => {
                    if (modal === "search" || modal === "lost-recover" || modal === "coral-target" || modal === "restock" || modal === "support-draw") cancelSupportSearch();
                    else {
                      if (modal === "recover") setSearchContext(null);
                      if (modal === "draw-result") {
                        setModal(null);
                      } else setModal(null);
                    }
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${isDarkZoneModal ? "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10" : "border-slate-300 bg-slate-100 text-slate-700"}${tutorialTargetClass("close-modal")}`}
                  data-tutorial-target="close-modal"
                >
                  Close
                </button> : null}
              </div>
            </div>

            {tutorialHelpInline && modal ? (
              <ProfessorGuideCard guide={tutorialGuide} help={tutorialHelp} step={Math.min(tutorialStepNumber, tutorialContract.checkpoints.length)} total={tutorialContract.checkpoints.length} inline onDismiss={() => setTutorialHelpDismissedId(tutorialHelpDismissalKey)} />
            ) : null}

            {modal === "turn-draw" ? (
              <div className={`space-y-5${tutorialTargetClass("draw-controls")}`} data-tutorial-target="draw-controls">
                {turnDrawSelection?.shortfall > 0 ? <div role="alert" className="rounded-2xl border border-rose-300/40 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">Your personal decks contain only {turnDrawSelection.target} of the {turnDrawSelection.requested} required cards. Choose the remaining card{turnDrawSelection.target === 1 ? "" : "s"} to reveal it; the game will then end by deck depletion.</div> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      id: "foundation",
                      label: "Foundation",
                      count: foundationDeck.length,
                      selected: turnDrawSelection?.foundation ?? 0,
                      image: foundationDeckImg,
                      purpose: "Economy & play spaces",
                      guidance: "Corals and Creature Schools. Usually the strongest early-game draw.",
                    },
                    {
                      id: "pals",
                      label: "Pals",
                      count: palsDeck.length,
                      selected: turnDrawSelection?.pals ?? 0,
                      image: palsDeckImg,
                      purpose: "Creatures & tactical tools",
                      guidance: "Creatures, Habitats, and Support. Stronger once your economy is established.",
                    },
                  ].map((deck) => (
                    <div key={deck.id} data-tutorial-draw-deck={deck.id} className="rounded-3xl border border-cyan-300/20 bg-white/5 p-5 text-center shadow-inner">
                      <div className="mx-auto flex h-32 w-28 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45"><Image src={deck.image} alt={`${deck.label} Deck`} width={112} height={112} className="object-contain" /></div>
                      <div className="mt-3 text-lg font-black text-white">{deck.label} Deck</div>
                      <div className="text-sm text-cyan-100/60">{deck.count} remaining</div>
                      <div className="mt-3 min-h-20 rounded-2xl border border-cyan-300/15 bg-slate-950/35 px-3 py-2 text-left">
                        <strong className="block text-xs font-black uppercase tracking-wide text-emerald-300">{deck.purpose}</strong>
                        <span className="mt-1 block text-xs font-semibold leading-relaxed text-cyan-50/70">{deck.guidance}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-center gap-4">
                        <button type="button" disabled={!deck.selected} onClick={() => adjustTurnDraw(deck.id, -1)} data-tutorial-draw-remove={deck.id} className="h-10 w-10 rounded-full border border-white/15 bg-white/5 text-xl font-black text-white transition hover:bg-white/10 disabled:opacity-25">−</button>
                        <span className="min-w-10 text-3xl font-black text-cyan-200">{deck.selected}</span>
                        <button type="button" disabled={deck.selected >= deck.count || (turnDrawSelection?.foundation ?? 0) + (turnDrawSelection?.pals ?? 0) >= (turnDrawSelection?.target ?? 0) || Boolean(tutorialUsesScriptedScenario && !turnDrawSelection?.mode && getScriptedTutorialTurnDraw({ round })?.deckType !== deck.id)} onClick={() => adjustTurnDraw(deck.id, 1)} data-tutorial-draw-add={deck.id} className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-xl font-black text-slate-950 disabled:opacity-30">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" disabled={!turnDrawSelection || turnDrawSelection.foundation + turnDrawSelection.pals !== turnDrawSelection.target} onClick={confirmTurnDraw} className={`w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 font-black text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400${tutorialTargetClass("confirm-draw")}`} data-tutorial-target="confirm-draw">Draw Selected Cards</button>
              </div>
            ) : modal === "draw-result" ? (
              <div>
                <div className="grid max-h-[620px] gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {(turnDrawResult ?? []).map((entry, index) => {
                    const card = cardsById[entry.cardId];
                    return <div key={`${entry.cardId}-${index}`} className={`rounded-3xl border-2 p-3 text-center ${entry.discarded ? "border-rose-300/50 bg-rose-400/10" : "border-cyan-300/50 bg-cyan-400/10"}`}><img src={card?.image} alt={card?.name} className="h-72 w-full rounded-2xl bg-slate-950/45 object-contain" /><div className="mt-2 font-black text-white">{card?.name}</div><div className="text-xs font-bold uppercase tracking-wider text-cyan-100/60">{entry.source} Deck</div>{entry.discarded ? <div className="mt-1 text-xs font-bold text-rose-200">Discarded by hand limit</div> : null}</div>;
                  })}
                </div>
                <button type="button" onClick={() => setModal(null)} className={`mt-5 w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 font-black text-slate-950${tutorialTargetClass("continue-actions")}`} data-tutorial-target="continue-actions">Continue to Actions</button>
              </div>
            ) : modal === "support-draw" ? (
              <div>
                <p className="mb-4 text-sm text-cyan-100/65">Discard your current hand, then allocate {turnDrawSelection?.target ?? 0} draws between both personal decks.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { id: "foundation", label: "Foundation Deck", count: foundationDeck.length, image: foundationDeckImg },
                    { id: "pals", label: "Pals Deck", count: palsDeck.length, image: palsDeckImg },
                  ].map((deck) => (
                    <div key={deck.id} className="rounded-3xl border border-cyan-300/20 bg-white/5 p-5 text-center shadow-inner">
                      <div className="mx-auto flex h-32 w-28 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45"><Image src={deck.image} alt={deck.label} width={112} height={112} className="object-contain" /></div>
                      <div className="mt-3 text-lg font-bold text-white">{deck.label}</div>
                      <div className="text-sm text-cyan-100/60">{deck.count} remaining</div>
                      <div className="mt-3 flex items-center justify-center gap-4"><button type="button" onClick={() => adjustTurnDraw(deck.id, -1)} className="h-9 w-9 rounded-full border border-white/15 bg-white/5 font-black text-white">−</button><strong className="text-2xl tabular-nums text-cyan-200">{turnDrawSelection?.[deck.id] ?? 0}</strong><button type="button" onClick={() => adjustTurnDraw(deck.id, 1)} className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 font-black text-slate-950">+</button></div>
                    </div>
                  ))}
                </div>
                <button type="button" disabled={!turnDrawSelection || turnDrawSelection.foundation + turnDrawSelection.pals !== turnDrawSelection.target} onClick={completeDrEvans} className="mt-5 w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 font-black text-slate-950 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400">Discard Hand &amp; Draw Selected Cards</button>
              </div>
            ) : modal === "hand" ? (
              <div className="flex min-h-0 flex-col gap-3 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-4">
                <div className={`order-2 overflow-x-auto overflow-y-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/35 p-3 overscroll-contain lg:order-1 lg:max-h-[560px] lg:overflow-x-hidden lg:overflow-y-auto lg:p-4${tutorialTargetClass("hand")}`} style={{ minWidth: 180 }} data-tutorial-target="hand">
                  {modalCards.length ? (
                    <div className="flex w-max gap-2 lg:block lg:w-auto lg:space-y-3">
                      {modalCards.map((cardId, cardIndex) => {
                        const card = cardsById[cardId] || { name: cardId };
                        const selected = cardId === selectedHandCard;
                        return (
                          <button
                            key={`${cardId}-${cardIndex}`}
                            type="button"
                            data-card-id={cardId}
                            data-tutorial-hand-card-id={cardId}
                            onClick={() => {
                              setSelectedHandCard(cardId);
                              setPlayError("");
                            }}
                            className={`w-24 shrink-0 rounded-2xl border p-1.5 text-left transition lg:w-full lg:rounded-3xl lg:p-2 ${
                              isSetup && !getPlayError(card) ? "seapals-setup-playable-card border-emerald-300/60 bg-emerald-400/15" : selected ? "border-cyan-400 bg-cyan-400/15" : "border-white/10 bg-white/5 hover:border-cyan-300/40"
                            }${tutorialCardTargetClass(cardId)}`}
                          >
                            <img
                              src={card.image}
                              alt={card.name}
                              className="h-24 w-full rounded-xl object-contain lg:h-36 lg:rounded-2xl"
                            />
                            <span className="mt-1 block truncate px-1 text-center text-[10px] font-bold text-white lg:hidden">{card.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-400">
                      No cards yet.
                    </div>
                  )}
                </div>

                <div className="order-1 rounded-3xl border border-cyan-300/20 bg-slate-950/35 p-3 shadow-inner lg:order-2 lg:p-4">
                  {selectedHandCard ? (
                    <div className="space-y-3 lg:space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-2 shadow-sm lg:rounded-3xl lg:p-4">
                        <img
                          src={cardsById[selectedHandCard]?.image}
                          alt={cardsById[selectedHandCard]?.name}
                          className="h-[30dvh] min-h-[190px] max-h-[280px] w-full rounded-2xl object-contain lg:h-[560px] lg:max-h-none lg:rounded-[1.5rem]"
                        />
                      </div>
                      <div className="space-y-2 text-center">
                        <p className="text-lg font-semibold text-white">{cardsById[selectedHandCard]?.name}</p>
                        <div className="flex flex-wrap justify-center gap-2 text-xs font-bold">
                          <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-200">{cardsById[selectedHandCard]?.kind}</span>
                          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">{getPlayerCardPlayCost(cardsById[selectedHandCard])} RP</span>
                          {Number(cardsById[selectedHandCard]?.victoryPoints ?? 0) > 0 ? <span className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">{cardsById[selectedHandCard]?.victoryPoints} VP</span> : null}
                        </div>
                        {cardsById[selectedHandCard]?.text ? <p className="mx-auto max-w-xl rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">{cardsById[selectedHandCard].text}</p> : null}
                        <button
                          type="button"
                          disabled={Boolean(selectedHandPlayError)}
                          onClick={() => playCardFromHand(selectedHandCard)}
                          className={`mx-auto w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 lg:w-auto${tutorialTargetClass("play-card")}`}
                          data-tutorial-target="play-card"
                        >
                          Play Card
                        </button>
                        {visiblePlayError ? (
                          <div className="rounded-3xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                            {visiblePlayError}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-400">
                      Select a card to preview it here.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {modalCards.length ? (
                  modalCards.map((cardId, cardIndex) => {
                    const coralTarget = modal === "coral-target" ? playerCorals.find((coral) => coral.id === cardId) : null;
                    const card = cardsById[coralTarget?.cardId ?? cardId] || { name: cardId };
                    return (
                      <div key={`${cardId}-${cardIndex}`} data-tutorial-search-card-id={modal === "search" ? cardId : undefined} data-tutorial-target={modal === "search" && tutorialHelpTargetActive && tutorialHelp?.targetSearchCardId === cardId ? "search-card" : undefined} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isDarkZoneModal ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}${modal === "search" && tutorialHelpTargetActive && tutorialHelp?.targetSearchCardId === cardId ? " seapals-tutorial-target" : ""}`}>
                        {modal === "search" || modal === "lost-recover" ? (
                          <button type="button" aria-haspopup="dialog" aria-label={`Inspect ${card.name} details`} onClick={() => inspectSearchResult(cardId)} className="group flex min-w-0 flex-1 items-center gap-4 rounded-xl p-1 text-left outline-none transition hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300">
                            <img src={card.image} alt="" className="h-28 w-20 rounded-xl bg-white object-contain" />
                            <span className="min-w-0">
                              <strong className="block font-semibold">{card.name}</strong>
                              <span className={`block text-sm ${isDarkZoneModal ? "text-slate-400" : "text-slate-600"}`}>{getCardClassLabel(card)}</span>
                              <span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-cyan-300 group-hover:text-cyan-200">View card details</span>
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-4">
                            {["discard", "lost", "recover", "coral-target", "restock"].includes(modal) ? <img src={card.image} alt={card.name} className="h-28 w-20 rounded-xl bg-white object-contain" /> : null}
                            <div>
                              <p className="font-semibold">{card.name}</p>
                              <p className={`text-sm ${isDarkZoneModal ? "text-slate-400" : "text-slate-600"}`}>{getCardClassLabel(card)}</p>
                              {coralTarget ? <p className="text-sm font-bold text-emerald-300">{coralTarget.health}/{coralTarget.maxHealth} HP</p> : null}
                            </div>
                          </div>
                        )}
                        {modal === "search" || modal === "recover" || modal === "lost-recover" || modal === "coral-target" || modal === "restock" ? (
                          <button type="button" disabled={Boolean(modal === "search" && tutorialUsesScriptedScenario && scriptedFinishRoute?.searchTargetCardId && scriptedFinishRoute.searchTargetCardId !== cardId)} aria-pressed={modal === "search" && searchContext?.maxSelect > 1 ? searchContext?.selected.includes(cardId) : undefined} aria-label={modal === "search" ? `${searchContext?.maxSelect > 1 ? "Select" : "Add to hand"} ${card.name}` : undefined} onClick={() => modal === "recover" ? completeRecovery(cardId) : modal === "lost-recover" ? completeOceanJakeRecovery(cardId) : modal === "coral-target" ? completeCoralHeal(cardId) : modal === "restock" ? toggleRestockCard(cardIndex) : searchContext?.maxSelect > 1 ? toggleSupportSearchCard(cardId) : completeSupportSearch(cardId)} className={`rounded-full px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-45 ${(modal === "restock" ? searchContext?.selectedIndices?.includes(cardIndex) : modal === "search" && searchContext?.maxSelect > 1 && searchContext?.selected.includes(cardId)) ? "bg-emerald-600" : "bg-cyan-600 hover:bg-cyan-500"}`}>
                            {modal === "recover" ? "Recover Card" : modal === "lost-recover" ? "Return to Hand" : modal === "coral-target" ? "Heal 20 HP" : modal === "restock" ? (searchContext?.selectedIndices?.includes(cardIndex) ? "Selected" : "Select") : modal === "search" && searchContext?.maxSelect > 1 ? (searchContext?.selected.includes(cardId) ? `Selected ×${searchContext.selected.filter((selectedId) => selectedId === cardId).length}` : "Select") : "Add to Hand"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className={`rounded-3xl border border-dashed p-8 text-center text-sm ${isDarkZoneModal ? "border-white/15 bg-white/5 text-slate-400" : "border-slate-300 bg-slate-50 text-slate-500"}`}>
                    No cards yet.
                  </div>
                )}
                {modal === "restock" ? (
                  <div className="sticky bottom-0 flex items-center justify-between rounded-2xl border border-emerald-300/30 bg-slate-950/95 p-3 shadow-lg">
                    <span className="text-sm font-bold text-emerald-200">{searchContext?.selectedIndices?.length ?? 0} of 3 selected</span>
                    <button type="button" disabled={!searchContext?.selectedIndices?.length} onClick={completeRestocking} className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
                      Confirm Restocking
                    </button>
                  </div>
                ) : null}
                {modal === "search" && searchContext?.maxSelect > 1 ? (
                  <div className="sticky bottom-0 flex items-center justify-between rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-3 shadow-lg">
                    <span className="text-sm font-bold text-cyan-200">{searchContext.selected.length} of {searchContext.maxSelect} selected</span>
                    <button type="button" disabled={!searchContext.selected.length} onClick={completeMultipleSupportSearch} className="rounded-full bg-cyan-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-40">Add Selected Cards</button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
