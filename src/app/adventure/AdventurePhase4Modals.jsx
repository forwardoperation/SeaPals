"use client";

import { useEffect, useRef } from "react";
import styles from "./adventure.module.css";
import { getAdventureObservationPreviewVariant } from "./adventureEcosystemChapters.mjs";

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

export function AdventureWorldMapModal({
  model,
  notice = null,
  blocked = false,
  autoSteerEnabled = true,
  onAutoSteer,
  onClose,
}) {
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
        <div className={styles.worldMapRoute} aria-label="Reefbound travel routes">
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
                  ? autoSteerEnabled
                    ? "You have piloted this route safely. Auto-steer is available at either dock."
                    : "You have piloted this route safely. Turn on Boat auto-steer in Settings to use assisted return travel."
                  : "The first crossing must be steered manually between the marked buoys."}</p>
              </div>
              {route.canAutoSteerNow ? (
                <button
                  type="button"
                  disabled={!autoSteerEnabled}
                  onClick={() => onAutoSteer(route.routeId, route.destinationDockId)}
                >
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

function formatMeasurementLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function AdventureFieldworkModal({
  activity,
  progress,
  definition,
  feedback = null,
  blocked = false,
  onChoose,
  onClose,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const observation = activity?.type === "observation"
    ? definition?.observationCopy?.[activity.observationId]
    : null;
  const choices = activity?.type === "interpretation"
    ? definition?.interpretationChoices ?? []
    : activity?.type === "response"
      ? definition?.responseChoices ?? []
      : [];
  const decision = activity?.type === "interpretation"
    ? progress?.interpretation
    : activity?.type === "response"
      ? progress?.response
      : null;
  const title = observation?.title
    ?? (activity?.type === "interpretation"
      ? definition?.interpretationTitle ?? "Interpret the evidence"
      : definition?.responseTitle ?? "Choose a response");
  const previewVariant = getAdventureObservationPreviewVariant(
    definition,
    activity?.observationId,
  );
  const previewClass = previewVariant ? styles[`observation${previewVariant}`] ?? "" : "";
  const contextualMeasurements = observation?.measurements
    ? Object.entries(observation.measurements).map(([label, detail]) => ({
        label: formatMeasurementLabel(label),
        detail,
      }))
    : definition?.measurementItems ?? [];
  const observationContext = observation?.context
    ? Object.entries(observation.context).map(([label, detail]) => ({
        label: label === "rainfall" ? "Recent rainfall" : formatMeasurementLabel(label),
        detail,
      }))
    : [];

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
            <span className={styles.panelEyebrow}>{definition?.surveyEyebrow ?? "Ecosystem field survey"}</span>
            <h2 id="fieldwork-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        {observation ? (
          <>
            <div className={`${styles.observationPreview} ${previewClass}`} aria-hidden="true">
              <span />
            </div>
            <p>{observation.feedback}</p>
            {observationContext.length ? (
              <div className={styles.measurementStrip} aria-label="Observation context">
                {observationContext.map((item) => (
                  <span key={item.label}><b>{item.label}</b><small>{item.detail}</small></span>
                ))}
              </div>
            ) : null}
            <div className={styles.measurementStrip}>
              {contextualMeasurements.map((measurement) => (
                <span key={measurement.label}><b>{measurement.label}</b><small>{measurement.detail}</small></span>
              ))}
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
              ? definition?.interpretationPrompt
              : definition?.responsePrompt}</p>
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
          <span>{progress?.observedObservationIds?.length ?? 0} / {progress?.requiredObservationIds?.length ?? 4} {definition?.observationNoun ?? "observations"}</span>
          <span>{progress?.completedResidentEncounterIds?.length ?? 0} / 2 resident duels</span>
          <span>{progress?.interpretation?.correct ? "Interpretation complete" : "Interpretation waiting"}</span>
          <span>{progress?.response?.correct ? "Response complete" : "Response waiting"}</span>
        </footer>
      </section>
    </div>
  );
}

export const SunpatchFieldworkModal = AdventureFieldworkModal;
