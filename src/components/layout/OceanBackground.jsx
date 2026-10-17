import styles from "./OceanBackground.module.css";
import OceanSurface from "./OceanSurface";

export default function OceanBackground() {
  return (
    <div className={styles.ocean} aria-hidden="true">
      <div className={styles.surface}>
        <OceanSurface />
      </div>
      <div className={styles.shafts}>
        <div className={`${styles.beam} ${styles.beamOne}`} />
        <div className={`${styles.beam} ${styles.beamTwo}`} />
        <div className={`${styles.beam} ${styles.beamThree}`} />
        <div className={`${styles.beam} ${styles.beamFour}`} />
        <div className={`${styles.beam} ${styles.beamFive}`} />
      </div>
      <div className={styles.floor}>
        <div className={styles.caustics} />
      </div>
    </div>
  );
}
