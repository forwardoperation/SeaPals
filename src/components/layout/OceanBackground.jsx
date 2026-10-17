import styles from "./OceanBackground.module.css";

export default function OceanBackground() {
  return (
    <div className={styles.ocean} aria-hidden="true">
      <div className={styles.surface} />
      <div className={styles.shafts} />
      <div className={styles.floor}>
        <div className={styles.caustics} />
      </div>
    </div>
  );
}
