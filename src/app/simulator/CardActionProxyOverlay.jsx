"use client";

import {
  getActionAccessibleLabel,
  getAttackActionPresentation,
} from "./attackActionPresentation.mjs";
import styles from "./CardActionProxyOverlay.module.css";

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
            const attackPresentation = action.kind === "attack"
              ? getAttackActionPresentation(action)
              : null;
            return (
              <button
                key={action.id}
                type="button"
                aria-disabled={!ready}
                aria-label={getActionAccessibleLabel(action, attackPresentation)}
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
                {ready && attackPresentation ? (
                  <span className={styles.attackFacts} aria-hidden="true">
                    <span className={styles.attackDie}>{attackPresentation.attackDice}</span>
                    <span className={styles.targetConnector}>→</span>
                    <span
                      className={styles.targetGroup}
                      title={`Can target ${attackPresentation.accessibleTargetSummary}`}
                    >
                      <span className={styles.targetCaption}>Can target</span>
                      <span className={styles.targetIcons}>
                        {attackPresentation.targets.map((target) => (
                          <span
                            key={target.category}
                            className={styles.targetIconChip}
                            title={target.label}
                          >
                            <img
                              src={target.icon}
                              alt=""
                              aria-hidden="true"
                              className={styles.targetIcon}
                            />
                          </span>
                        ))}
                      </span>
                      {attackPresentation.restrictionSummary ? (
                        <span className={styles.targetRestriction}>
                          {attackPresentation.restrictionSummary}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : (
                  <span className={styles.description}>
                    {ready ? action.text : action.availability.reason}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
