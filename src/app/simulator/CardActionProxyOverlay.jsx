"use client";

import styles from "./CardActionProxyOverlay.module.css";

function actionAccessibleLabel(action) {
  const cost = Number(action.cost ?? 0);
  const costLabel = cost > 0 ? `, costs ${cost} RP` : "";
  const stateLabel = action.availability.ready
    ? ", ready to use"
    : `, unavailable: ${action.availability.reason}`;
  return `${action.label}${costLabel}${stateLabel}`;
}

export default function CardActionProxyOverlay({
  cardName,
  image,
  actions = [],
}) {
  return (
    <div className={styles.stage} data-card-action-stage>
      <img
        src={image}
        alt={cardName}
        className={`seapals-card-inspector-image ${styles.cardImage}`}
      />
      {actions.length ? (
        <section
          className={styles.proxyRail}
          aria-label={`${cardName} action controls`}
          data-card-action-proxy-rail
        >
          {actions.map((action) => {
            const ready = action.availability.ready;
            return (
              <button
                key={action.id}
                type="button"
                aria-disabled={!ready}
                aria-label={actionAccessibleLabel(action)}
                className={`${styles.proxy} ${ready ? styles.ready : styles.unavailable} ${action.kind === "attack" ? styles.attack : styles.utility}${action.tutorialClassName ?? ""}`}
                data-card-action-proxy={action.id}
                data-card-action-state={ready ? "ready" : action.availability.blockType}
                data-tutorial-target={action.tutorialTarget}
                data-tutorial-action-key={action.tutorialActionKey}
                onClick={() => {
                  if (ready) action.onActivate?.();
                }}
              >
                <span className={styles.topline}>
                  <span className={styles.kind}>{action.kind === "attack" ? "Attack" : "Action"}</span>
                  <span className={styles.status}>{action.availability.status}</span>
                </span>
                <span className={styles.nameRow}>
                  <strong>{action.label}</strong>
                  {Number(action.cost ?? 0) > 0 ? <span>{action.cost} RP</span> : null}
                </span>
                <span className={styles.description}>
                  {ready ? action.text : action.availability.reason}
                </span>
              </button>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
