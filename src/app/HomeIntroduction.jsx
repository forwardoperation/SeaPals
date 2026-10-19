import Image from "next/image";
import styles from "./HomeIntroduction.module.css";

const gameStats = [
  { label: "Ages", value: "8–14" },
  { label: "Players", value: "2–4" },
  { label: "Play time", value: "Under 30 min", note: "for skilled players", className: styles.playTime },
  { label: "Setup", value: "Minimal setup required" },
  { label: "Take it along", value: "Travels easy" },
];

export default function HomeIntroduction() {
  return (
    <section id="introducing" className={styles.introduction} aria-labelledby="introducing-heading">
      <h2 id="introducing-heading" className={styles.heading} data-dive-reveal>
        <span className={styles.eyebrow}>Introducing</span>
        <Image
          src="/images/brand/SeaPalsTCGLogoWhite.svg"
          alt="Sea Pals Trading Card Game"
          width={2680}
          height={740}
          sizes="(max-width: 599px) calc(100vw - 48px), 520px"
          className={styles.logo}
        />
      </h2>
      <dl className={styles.stats} aria-label="Game at a glance">
        {gameStats.map((stat) => (
          <div key={stat.label} className={stat.className} data-dive-reveal>
            <dt>{stat.label}</dt>
            <dd>
              {stat.value}
              {stat.note ? <span>{stat.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
