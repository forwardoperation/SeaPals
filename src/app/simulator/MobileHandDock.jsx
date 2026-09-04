"use client";

import { useEffect, useRef } from "react";

const MOBILE_HAND_DRAG_THRESHOLD = 10;
const MOBILE_HAND_DRAG_AXIS_RATIO = 1.15;

export default function MobileHandDock({
  entries,
  selectedIndex,
  draggingIndex = null,
  arrivingIndexes = [],
  interactionDisabled = false,
  playingCardId,
  tutorialTargetClass = "",
  onInspect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}) {
  const placementPending = Boolean(playingCardId || interactionDisabled);
  const handRailRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressDragClickRef = useRef(null);
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, onDragCancel });
  callbacksRef.current = { onDragStart, onDragMove, onDragEnd, onDragCancel };

  function releaseGestureCapture(gesture) {
    if (!gesture?.sourceElement || gesture.pointerId == null) return;
    try {
      if (gesture.sourceElement.hasPointerCapture?.(gesture.pointerId)) {
        gesture.sourceElement.releasePointerCapture(gesture.pointerId);
      }
    } catch (error) {
      // Pointer capture may already have been released by the browser.
    }
  }

  function clearHandDragGesture({ cancel = false, event = null } = {}) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    releaseGestureCapture(gesture);
    if (cancel && gesture.phase === "dragging") {
      callbacksRef.current.onDragCancel?.({
        cardId: gesture.cardId,
        index: gesture.index,
        pointerId: gesture.pointerId,
        clientX: event?.clientX ?? gesture.clientX,
        clientY: event?.clientY ?? gesture.clientY,
      });
    }
  }

  function suppressNextDragClick(index) {
    suppressDragClickRef.current = { index, expiresAt: Date.now() + 700 };
  }

  function captureGesturePointer(gesture, event) {
    try {
      if (!gesture.sourceElement.hasPointerCapture?.(event.pointerId)) {
        gesture.sourceElement.setPointerCapture?.(event.pointerId);
      }
    } catch (error) {
      // Continue without capture if the platform rejects it.
    }
  }

  function scrollMouseGesture(gesture, deltaX) {
    const rail = gesture.railElement;
    if (!rail) return;
    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    rail.scrollLeft = Math.max(0, Math.min(maxScrollLeft, gesture.originScrollLeft - deltaX));
  }

  function handleHandWheel(event) {
    const rail = handRailRef.current;
    if (!rail || event.ctrlKey) return;

    const rawDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!rawDelta) return;

    const deltaScale = event.deltaMode === 1
      ? 20
      : event.deltaMode === 2
        ? Math.max(rail.clientWidth, 1)
        : 1;
    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, rail.scrollLeft + rawDelta * deltaScale));
    if (Math.abs(nextScrollLeft - rail.scrollLeft) < 0.5) return;

    event.preventDefault();
    rail.scrollLeft = nextScrollLeft;
  }

  useEffect(() => {
    return () => clearHandDragGesture({ cancel: true });
  }, []);

  function handleCardPointerDown(entry, event) {
    if (gestureRef.current && gestureRef.current.pointerId !== event.pointerId) {
      clearHandDragGesture({ cancel: true, event });
      return;
    }
    if (placementPending || gestureRef.current || event.button !== 0 || event.isPrimary === false) return;
    gestureRef.current = {
      phase: "candidate",
      pointerId: event.pointerId,
      cardId: entry.cardId,
      index: entry.index,
      originX: event.clientX,
      originY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
      railElement: handRailRef.current,
      originScrollLeft: handRailRef.current?.scrollLeft ?? 0,
      sourceElement: event.target,
    };
  }

  function handleCardPointerMove(entry, event) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.index !== entry.index) return;

    const dx = event.clientX - gesture.originX;
    const dy = event.clientY - gesture.originY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    gesture.clientX = event.clientX;
    gesture.clientY = event.clientY;

    if (gesture.phase === "candidate") {
      if (absX >= MOBILE_HAND_DRAG_THRESHOLD && absX > absY) {
        gesture.phase = "scrolling";
        suppressNextDragClick(entry.index);
        if (gesture.pointerType === "mouse") {
          event.preventDefault();
          captureGesturePointer(gesture, event);
          scrollMouseGesture(gesture, dx);
        }
        return;
      }
      if (dy <= -MOBILE_HAND_DRAG_THRESHOLD && absY >= absX * MOBILE_HAND_DRAG_AXIS_RATIO) {
        event.preventDefault();
        try {
          if (!gesture.sourceElement.hasPointerCapture?.(event.pointerId)) {
            gesture.sourceElement.setPointerCapture?.(event.pointerId);
          }
        } catch (error) {
          // Continue without capture if the platform rejects it.
        }
        const accepted = callbacksRef.current.onDragStart?.({
          cardId: entry.cardId,
          index: entry.index,
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        suppressNextDragClick(entry.index);
        if (accepted === false) {
          gesture.phase = "blocked";
          return;
        }
        gesture.phase = "dragging";
        callbacksRef.current.onDragMove?.({
          cardId: entry.cardId,
          index: entry.index,
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      } else if (absY >= MOBILE_HAND_DRAG_THRESHOLD) {
        gesture.phase = "blocked";
        suppressNextDragClick(entry.index);
      }
      return;
    }

    if (gesture.phase === "scrolling") {
      if (gesture.pointerType === "mouse") {
        event.preventDefault();
        scrollMouseGesture(gesture, dx);
      }
      return;
    }

    if (gesture.phase === "dragging") {
      event.preventDefault();
      callbacksRef.current.onDragMove?.({
        cardId: entry.cardId,
        index: entry.index,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
  }

  function handleCardPointerUp(entry, event) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.index !== entry.index) return;
    const completedPhase = gesture.phase;
    const wasDragging = completedPhase === "dragging";
    const payload = {
      cardId: gesture.cardId,
      index: gesture.index,
      pointerId: gesture.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    clearHandDragGesture();
    if (completedPhase !== "candidate") suppressNextDragClick(entry.index);
    if (wasDragging) {
      event.preventDefault();
      callbacksRef.current.onDragEnd?.(payload);
    }
  }

  function handleCardPointerCancel(entry, event) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.index !== entry.index) return;
    clearHandDragGesture({ cancel: true, event });
  }

  function handleCardLostPointerCapture(entry, event) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.index !== entry.index) return;
    if (event.target !== gesture.sourceElement) return;
    clearHandDragGesture({ cancel: true, event });
  }

  function handleCardClick(entry, event) {
    const suppressedClick = suppressDragClickRef.current;
    suppressDragClickRef.current = null;
    if (suppressedClick?.index === entry.index && Date.now() <= suppressedClick.expiresAt) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onInspect(entry.cardId, entry.index, event.currentTarget);
  }

  return (
    <section
      className={`seapals-mobile-hand-dock${interactionDisabled ? " is-draw-sequencing" : ""}${tutorialTargetClass}`}
      aria-label="Your hand"
      aria-busy={interactionDisabled || undefined}
      inert={interactionDisabled ? true : undefined}
      data-mobile-hand-dock
      data-tutorial-target="hand"
    >
      <div className="seapals-mobile-hand-panel">
        <div
          ref={handRailRef}
          className="seapals-mobile-hand-rail"
          data-simulator-hand-card-rail
          aria-label={`${entries.length} cards in your hand. Drag upward to play, scroll sideways to browse, or press Enter to inspect.`}
          onWheel={handleHandWheel}
        >
          {entries.length ? (
            <ul className="seapals-mobile-hand-list" role="list">
              {entries.map((entry) => {
                const selected = entry.index === selectedIndex;
                const dragging = entry.index === draggingIndex;
                const arriving = arrivingIndexes.includes(entry.index);
                return (
                  <li
                    key={`${entry.cardId}-${entry.index}`}
                    className={arriving ? "is-arriving" : undefined}
                    data-mobile-hand-card-index={entry.index}
                    onPointerDown={(event) => handleCardPointerDown(entry, event)}
                    onPointerMove={(event) => handleCardPointerMove(entry, event)}
                    onPointerUp={(event) => handleCardPointerUp(entry, event)}
                    onPointerCancel={(event) => handleCardPointerCancel(entry, event)}
                    onLostPointerCapture={(event) => handleCardLostPointerCapture(entry, event)}
                  >
                    <button
                      type="button"
                      disabled={placementPending && !dragging}
                      aria-haspopup="dialog"
                      aria-expanded={selected}
                      aria-pressed={selected}
                      aria-label={`${entry.card?.name ?? entry.cardId}. ${entry.setupPlayable ? "Legal setup card. " : ""}${entry.playError || `${entry.cost} RP, ready to play`}. Drag upward to play or press Enter to inspect.`}
                      data-card-id={entry.cardId}
                      data-setup-playable={entry.setupPlayable ? "true" : undefined}
                      data-tutorial-hand-card-id={entry.cardId}
                      onClick={(event) => handleCardClick(entry, event)}
                      className={`seapals-mobile-hand-card${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}${entry.playError ? " is-unavailable" : " is-ready"}${entry.setupPlayable ? " seapals-setup-playable-card" : ""}${entry.tutorialClass ?? ""}`}
                    >
                      <img src={entry.card?.image} alt="" draggable={false} />
                      {entry.setupPlayable ? <span className="seapals-mobile-hand-card-setup-badge">Setup</span> : null}
                      <span className="seapals-mobile-hand-card-name">{entry.card?.name ?? entry.cardId}</span>
                      <span className="seapals-mobile-hand-card-cost">{entry.cost} RP</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="seapals-mobile-hand-empty">Your hand is empty.</div>
          )}
        </div>
      </div>
    </section>
  );
}
