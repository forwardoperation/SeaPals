import Image from "next/image";
import Link from "next/link";
import imageManifest from "@/data/gallery-images.json";
import { getGalleryImageSrc } from "@/lib/cardImages.mjs";
import styles from "./HomeDive.module.css";

// Curated finished artwork only. Keep prerelease art out if the catalog changes.
const featuredIds = [
  "blue-whale", "great-white", "whale-shark",
  "hammerhead", "killer-whale-oceanic", "tiger-shark",
];
const cards = featuredIds
  .map((id) => imageManifest.cards.find((card) => card.cardId === id))
  .filter((card) => card && card.prerelease === false && !card.hidden && getGalleryImageSrc(card));
const pairs = Array.from({ length: Math.ceil(cards.length / 2) }, (_, index) =>
  cards.slice(index * 2, index * 2 + 2),
);

export default function HomeDive() {
  return (
    <>
      <section className={styles.intro} aria-labelledby="dive-heading">
        <h1 id="dive-heading" className={styles.headline}>
          <span>Have You Walked</span>{" "}
          <span>In the Recesses</span>{" "}
          <span>of The Deep?</span>
        </h1>
        <a href="#dive-cards" className={styles.invitation}>
          <span className={styles.subtitle}>Dive in to learn more</span>
          <span className={styles.arrow} aria-hidden="true">
            <svg viewBox="0 0 32 48" fill="none">
              <path d="M16 4v36M5 29l11 11 11-11" />
            </svg>
          </span>
        </a>
      </section>

      <section id="dive-cards" className={styles.cardPassage} aria-label="Discover SeaRealm whale and shark cards">
        {pairs.map((pair, index) => (
          <div className={styles.cardPair} key={pair[0].cardId} data-depth={index}>
            {pair.map((card) => (
              <figure className={styles.card} key={card.cardId}>
                <Link
                  href={`/gallery#card-${card.cardId}`}
                  className={styles.cardLink}
                  aria-label={`View the ${card.name} card in the gallery`}
                >
                  <Image
                    src={getGalleryImageSrc(card)}
                    alt={`${card.name} SeaRealm card`}
                    width={card.width}
                    height={card.height}
                    sizes="(max-width: 600px) 43vw, (max-width: 1023px) 32vw, 300px"
                    className={styles.cardImage}
                  />
                </Link>
                <figcaption className={styles.cardName}>{card.name}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
