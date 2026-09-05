import styles from "./CoralUpgradeCelebration.module.css";

const GOLD_SPARKS = Object.freeze([
  { angle: 0, distance: 80, delay: 40, size: 8 },
  { angle: 24, distance: 104, delay: 120, size: 5 },
  { angle: 48, distance: 88, delay: 10, size: 7 },
  { angle: 72, distance: 112, delay: 190, size: 6 },
  { angle: 96, distance: 84, delay: 80, size: 9 },
  { angle: 120, distance: 108, delay: 230, size: 5 },
  { angle: 144, distance: 92, delay: 140, size: 7 },
  { angle: 168, distance: 116, delay: 30, size: 6 },
  { angle: 192, distance: 86, delay: 210, size: 8 },
  { angle: 216, distance: 110, delay: 100, size: 5 },
  { angle: 240, distance: 94, delay: 260, size: 7 },
  { angle: 264, distance: 114, delay: 60, size: 6 },
  { angle: 288, distance: 82, delay: 180, size: 9 },
  { angle: 312, distance: 106, delay: 20, size: 5 },
  { angle: 336, distance: 90, delay: 240, size: 7 },
]);

export default function CoralUpgradeCelebration({ celebration, reducedMotion = false, zoom = 1 }) {
  if (!celebration) return null;
  const inverseZoom = Math.min(2.5, Math.max(0.8, 1 / Math.max(0.2, Number(zoom) || 1)));

  return (
    <span
      className={`${styles.celebration} seapals-coral-upgrade-celebration${reducedMotion ? ` ${styles.reduced}` : ""}`}
      data-coral-upgrade-celebration
      data-coral-upgrade-owner={celebration.owner}
      data-coral-upgrade-instance={celebration.cardInstanceId}
      style={{ "--coral-upgrade-label-scale": inverseZoom }}
      aria-hidden="true"
    >
      <span className={styles.flash} />
      <span className={styles.rays} />
      <span className={`${styles.ring} ${styles.ringOuter}`} />
      <span className={`${styles.ring} ${styles.ringInner}`} />
      <span className={styles.cardSheen} />
      <span className={styles.sparkField}>
        {GOLD_SPARKS.map((spark, index) => (
          <span
            key={index}
            className={styles.spark}
            style={{
              "--coral-upgrade-angle": `${spark.angle}deg`,
              "--coral-upgrade-distance": `${spark.distance}px`,
              "--coral-upgrade-delay": `${spark.delay}ms`,
              "--coral-upgrade-size": `${spark.size}px`,
            }}
          />
        ))}
      </span>
      <span className={styles.badge}>
        <span className={styles.badgeContent}>
          <span className={styles.badgeStar}>&#9733;</span>
          Upgraded!
          <span className={styles.badgeStar}>&#9733;</span>
        </span>
      </span>
    </span>
  );
}
