"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ADVENTURE_TEXT_SPEEDS,
  DEFAULT_ADVENTURE_SETTINGS,
  normalizeAdventureSettings,
  updateAdventureSettings,
} from "./adventureSettings.mjs";
import styles from "./AdventureSettingsModal.module.css";

const TEXT_SPEED_COPY = Object.freeze({
  slow: {
    label: "Slow",
    detail: "Gives each line extra time to appear.",
  },
  normal: {
    label: "Normal",
    detail: "A comfortable pace for most readers.",
  },
  fast: {
    label: "Fast",
    detail: "Shows each line quickly.",
  },
  instant: {
    label: "Instant",
    detail: "Shows the whole line at once.",
  },
});

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function useSettingsDialogFocusTrap(active, onRequestClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    (dialog.querySelector(FOCUSABLE_SELECTOR) ?? dialog).focus({ preventScroll: true });

    function handleKeyboard(event) {
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
        (element) => !element.hasAttribute("hidden")
          && element.getAttribute("aria-hidden") !== "true",
      );
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", handleKeyboard);
    return () => {
      dialog.removeEventListener("keydown", handleKeyboard);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return dialogRef;
}

function BooleanSetting({ checked, description, disabled, label, onChange }) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleCopy}>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.switchControl}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

export default function AdventureSettingsModal({
  save,
  notice = null,
  blocked = false,
  onCommit,
  onClose,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const initialSettings = useMemo(
    () => normalizeAdventureSettings(save?.settings),
    [save?.settings],
  );
  const [draft, setDraft] = useState(initialSettings);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useSettingsDialogFocusTrap(
    !blocked,
    saving ? null : onClose,
  );

  useEffect(() => {
    setDraft(initialSettings);
    setMessage(null);
  }, [initialSettings]);

  const changed = Object.keys(DEFAULT_ADVENTURE_SETTINGS).some(
    (key) => draft[key] !== initialSettings[key],
  );
  const disabled = blocked || saving;

  function setSetting(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      if (typeof onCommit !== "function") {
        throw new TypeError("Settings cannot be saved right now.");
      }
      const result = updateAdventureSettings(save, draft);
      await onCommit(result.save, {
        checkpointId: "adventure-settings-updated",
        message: result.applied ? "Adventure settings saved." : "Adventure settings are already up to date.",
      });
      onClose?.();
    } catch (error) {
      setMessage(error?.message ?? "Adventure settings could not be saved.");
      setSaving(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.layer}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-adventure-settings-modal="true"
    >
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <span>Adventure options</span>
            <h2 id={titleId}>Settings</h2>
          </div>
          <button type="button" disabled={disabled} onClick={onClose}>
            Close
          </button>
        </header>

        <p id={descriptionId} className={styles.intro}>
          Choose how dialogue, movement, and navigation feel. These choices are saved with this adventure.
        </p>

        {notice || message ? (
          <p
            className={message || notice?.kind === "error" ? styles.error : styles.notice}
            role={message || notice?.kind === "error" ? "alert" : "status"}
          >
            {message ?? notice?.message ?? String(notice)}
          </p>
        ) : null}

        <fieldset className={styles.settingsList} disabled={disabled}>
          <legend className={styles.visuallyHidden}>Adventure settings</legend>

          <label className={styles.selectRow} htmlFor={`${titleId}-text-speed`}>
            <span>
              <strong>Dialogue reading pace</strong>
              <small>{TEXT_SPEED_COPY[draft.textSpeed].detail}</small>
            </span>
            <select
              id={`${titleId}-text-speed`}
              value={draft.textSpeed}
              onChange={(event) => setSetting("textSpeed", event.target.value)}
            >
              {ADVENTURE_TEXT_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>{TEXT_SPEED_COPY[speed].label}</option>
              ))}
            </select>
          </label>

          <BooleanSetting
            label="Reduce motion"
            description="Stops decorative bobbing and removes nonessential movement."
            checked={draft.reducedMotion}
            disabled={disabled}
            onChange={(value) => setSetting("reducedMotion", value)}
          />
          <BooleanSetting
            label="High contrast"
            description="Strengthens important outlines, focus rings, and interface colors."
            checked={draft.highContrast}
            disabled={disabled}
            onChange={(value) => setSetting("highContrast", value)}
          />
          <BooleanSetting
            label="Boat auto-steer"
            description="Allow auto-steer on routes you have already sailed manually. First voyages still require steering."
            checked={draft.boatAutoSteer}
            disabled={disabled}
            onChange={(value) => setSetting("boatAutoSteer", value)}
          />
        </fieldset>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={disabled}
            onClick={() => {
              setDraft({ ...DEFAULT_ADVENTURE_SETTINGS });
              setMessage(null);
            }}
          >
            Restore defaults
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={disabled || !changed}
            onClick={saveSettings}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </footer>
      </section>
    </div>
  );
}
