import Image from "next/image";
import styles from "./StoreHero.module.css";

export default function StoreHero({ cards = [] }) {
  return (
    <section aria-labelledby="store-hero-heading" className={styles.hero}>
      <div aria-hidden="true" className={styles.backdrop}>
        <div className={styles.cards}>
          {cards.map((card, index) => (
            <div key={card.id} className={styles.card}>
              <Image
                src={card.src}
                alt=""
                width={card.width}
                height={card.height}
                sizes="180px"
                loading={index < 6 ? "eager" : "lazy"}
                className={styles.image}
              />
            </div>
          ))}
        </div>
        <div className={styles.shade} />
      </div>

      <div className={styles.content}>
        <h1 id="store-hero-heading" className={styles.headline}>
          Collect all the Cards and Become a{" "}
          <span className={styles.accent}>Master of the Sea!</span>
        </h1>
      </div>
    </section>
  );
}
