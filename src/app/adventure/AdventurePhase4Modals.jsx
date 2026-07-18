"use client";

import { useEffect, useRef } from "react";
import {
  SUNPATCH_CORRECT_INTERPRETATION_ID,
  SUNPATCH_CORRECT_RESPONSE_ID,
  SUNPATCH_OBSERVATION_COPY,
} from "./adventureSunpatch.mjs";
import styles from "./adventure.module.css";

function useDialogFocusTrap(active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const dialog = ref.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const selector = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
    (dialog.querySelector(selector) ?? dialog).focus({ preventScroll: true });

    function keepFocusInside(event) {
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const focusable = [...dialog.querySelectorAll(selector)].filter((element) => (
        !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true"
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", keepFocusInside);
    return () => {
      dialog.removeEventListener("keydown", keepFocusInside);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [active]);
  return ref;
}

export function AdventureWorldMapModal({ model, notice = null, blocked = false, onAutoSteer, onClose }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.worldMapLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-map-title"
    >
      <section className={styles.worldMapCard}>
        <header className={styles.phase4ModalHeader}>
          <div>
            <span className={styles.panelEyebrow}>Personal boat chart</span>
            <h2 id="world-map-title">Reefbound World Map</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <p className={styles.worldMapIntro}>
          Sail a marked route yourself once. After you have docked safely, auto-steer can repeat that route from either end.
        </p>
        {notice ? (
          <div className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </div>
        ) : null}
        <div className={styles.worldMapRoute} aria-label="Shellshore to Sunpatch route">
          {(model?.towns ?? []).map((town, index) => (
            <div key={town.townId} className={`${styles.worldMapTown} ${town.current ? styles.worldMapTownCurrent : ""} ${!town.discovered ? styles.worldMapTownHidden : ""}`}>
              <span>{town.current ? "You are here" : town.visited ? "Visited" : town.available ? "Charted" : "Uncharted"}</span>
              <strong>{town.displayName}</strong>
              {town.discovered ? <small>{town.settlementType === "floating" ? "Floating town" : "Island town"}</small> : null}
              {index < (model?.towns?.length ?? 0) - 1 ? <i aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
        <div className={styles.worldMapRoutesList}>
          {(model?.routes ?? []).filter((route) => route.discovered).map((route) => {
            const sailingFromOrigin = model.currentLocation?.townId === route.fromTownId;
            const destinationName = sailingFromOrigin ? route.toTownName : route.fromTownName;
            return (
            <article key={route.routeId} className={`${styles.worldMapRouteCard} ${route.active ? styles.worldMapRouteActive : ""}`}>
              <div>
                <span>{route.active
                  ? "Voyage in progress"
                  : route.completed
                    ? "Route mastered"
                    : route.unlocked && !route.runtimeReady
                      ? "Charted — opens in a future phase"
                      : route.unlocked
                        ? "Manual voyage ready"
                        : "Route locked"}</span>
                <strong>{route.fromTownName ?? "Shellshore"} to {route.toTownName ?? "charted waters"}</strong>
                <p>{!route.runtimeReady
                  ? "This destination is on your chart, but its navigable route and dock are not open yet."
                  : route.completed
                  ? "You have piloted this route safely. Auto-steer is now available at either dock."
                  : "The first crossing must be steered manually between the marked buoys."}</p>
              </div>
              {route.canAutoSteerNow ? (
                <button type="button" onClick={() => onAutoSteer(route.routeId, route.destinationDockId)}>
                  Auto-steer to {destinationName ?? "the opposite dock"}
                </button>
              ) : null}
            </article>
          );})}
        </div>
        <small className={styles.worldMapSafety}>Wear a life jacket, stay in marked water, slow near wildlife, and use established docks and moorings.</small>
      </section>
    </div>
  );
}

const INTERPRETATION_CHOICES = Object.freeze([
  {
    id: SUNPATCH_CORRECT_INTERPRETATION_ID,
    label: "Describe stress and lesions, then gather more evidence",
    detail: "Pale living tissue may be bleached; visible tissue loss is a lesion, not a diagnosis.",
  },
  {
    id: "all-white-coral-is-dead",
    label: "Mark every pale or white coral as dead",
    detail: "Color by itself tells us whether the whole colony is alive.",
  },
  {
    id: "visible-damage-proves-disease",
    label: "Diagnose coral disease from the photographs",
    detail: "Any visible tissue loss proves which disease caused it.",
  },
]);

const RESPONSE_CHOICES = Object.freeze([
  {
    id: SUNPATCH_CORRECT_RESPONSE_ID,
    label: "Monitor, protect the site, and reduce supported local stress",
    detail: "Report repeat images and trends, use moorings, and address demonstrated sediment or nutrient sources.",
  },
  {
    id: "replace-every-pale-coral",
    label: "Replace every pale coral immediately",
    detail: "Nursery coral can instantly cure the reef before more evidence is collected.",
  },
  {
    id: "wait-without-reporting",
    label: "Wait and do not report the change",
    detail: "The reef will recover on its own, so monitoring and local protection are unnecessary.",
  },
]);

export function SunpatchFieldworkModal({
  activity,
  progress,
  feedback = null,
  blocked = false,
  onChoose,
  onClose,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const observation = activity?.type === "observation"
    ? SUNPATCH_OBSERVATION_COPY[activity.observationId]
    : null;
  const choices = activity?.type === "interpretation"
    ? INTERPRETATION_CHOICES
    : activity?.type === "response"
      ? RESPONSE_CHOICES
      : [];
  const decision = activity?.type === "interpretation"
    ? progress?.interpretation
    : activity?.type === "response"
      ? progress?.response
      : null;
  const title = observation?.title
    ?? (activity?.type === "interpretation" ? "Interpret the reef evidence" : "Choose a reef response");

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.fieldworkLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fieldwork-title"
    >
      <section className={styles.fieldworkCard}>
        <header className={styles.phase4ModalHeader}>
          <div>
            <span className={styles.panelEyebrow}>Sunpatch reef survey</span>
            <h2 id="fieldwork-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        {observation ? (
          <>
            <div className={`${styles.observationPreview} ${styles[`observation${activity.observationId.split("-")[0]}`]}`} aria-hidden="true">
              <span />
            </div>
            <p>{observation.feedback}</p>
            <div className={styles.measurementStrip}>
              <span><b>Repeat photo</b><small>Same marked position</small></span>
              <span><b>Temperature trend</b><small>Compare with local seasonal baseline</small></span>
              <span><b>Water clarity</b><small>Record, but do not diagnose from one reading</small></span>
            </div>
            {feedback ? <p className={styles.fieldworkFeedback} role="status">{feedback.message}</p> : null}
            <button
              type="button"
              disabled={progress?.observedObservationIds?.includes(activity.observationId)}
              onClick={() => onChoose(activity.observationId)}
            >
              {progress?.observedObservationIds?.includes(activity.observationId) ? "Observation recorded" : "Record this observation"}
            </button>
          </>
        ) : (
          <>
            <p>{activity?.type === "interpretation"
              ? "Compare all four monitoring stations. Choose the statement that separates observation from diagnosis."
              : "Choose a response supported by the evidence and honest about what local action can and cannot change."}</p>
            <div className={styles.fieldworkChoices}>
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  disabled={decision?.correct}
                  aria-pressed={decision?.lastChoiceId === choice.id}
                  onClick={() => onChoose(choice.id)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.detail}</span>
                </button>
              ))}
            </div>
            {feedback ? (
              <div className={`${styles.fieldworkFeedback} ${feedback.correct ? styles.fieldworkFeedbackCorrect : styles.fieldworkFeedbackRetry}`} role="status">
                <strong>{feedback.correct ? "Evidence-supported" : "Let’s check the evidence again"}</strong>
                <p>{feedback.message}</p>
              </div>
            ) : null}
          </>
        )}

        <footer className={styles.fieldworkProgress}>
          <span>{progress?.observedObservationIds?.length ?? 0} / 4 observations</span>
          <span>{progress?.completedResidentEncounterIds?.length ?? 0} / 2 resident duels</span>
          <span>{progress?.interpretation?.correct ? "Interpretation complete" : "Interpretation waiting"}</span>
          <span>{progress?.response?.correct ? "Response complete" : "Response waiting"}</span>
        </footer>
      </section>
    </div>
  );
}
