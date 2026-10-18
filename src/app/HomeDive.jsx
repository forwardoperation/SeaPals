import Image from "next/image";
import Link from "next/link";
import imageManifest from "@/data/gallery-images.json";
import { getGalleryImageSrc } from "@/lib/cardImages.mjs";
import HomeDiveReveal from "./HomeDiveReveal";
import styles from "./HomeDive.module.css";

// Curated from each set, with finished artwork only even if the catalog changes.
const chapters = [
  {
    id: "ocean",
    title: "From the Ocean Surface",
    cardIds: ["blue-whale", "whale-shark", "killer-whale-oceanic", "oceanic-manta-ray"],
  },
  {
    id: "reef",
    title: "To the coral reefs",
    cardIds: ["clownfish", "elkhorn-coral-stage-2", "blue-tang", "french-angelfish"],
  },
  {
    id: "deep",
    title: "To the deep below",
    cardIds: ["colossal-squid", "pilot-whale-oceanic"],
  },
].map((chapter) => ({
  ...chapter,
  cards: chapter.cardIds
    .map((id) => imageManifest.cards.find((card) => card.cardId === id))
    .filter((card) => card && card.zone === chapter.id && card.prerelease === false && !card.hidden && getGalleryImageSrc(card)),
}));

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

      <HomeDiveReveal>
        <div id="dive-cards" className={styles.cardPassage}>
          {chapters.map((chapter) => (
            <section key={chapter.id} className={styles.chapter} aria-labelledby={`dive-${chapter.id}-heading`}>
              <h2 id={`dive-${chapter.id}-heading`} className={styles.chapterHeading} data-dive-reveal>
                {chapter.title}
              </h2>
              <div className={styles.cardGrid} data-card-count={chapter.cards.length}>
                {chapter.cards.map((card, index) => (
                  <figure className={styles.card} key={card.cardId} data-dive-reveal style={{ "--reveal-delay": `${(index % 2) * 100}ms` }}>
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
                        sizes="(max-width: 599px) 42vw, (max-width: 899px) 36vw, 256px"
                        className={styles.cardImage}
                      />
                    </Link>
                    <figcaption className={styles.cardName}>{card.name}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className={styles.tabletop} aria-labelledby="dive-creation-heading">
          <h2 id="dive-creation-heading" className={styles.chapterHeading} data-dive-reveal>
            Explore creation like never before
          </h2>
          <figure className={styles.tabletopFigure} data-dive-reveal>
            <Image
              src="/images/promo/searealm-tabletop.webp"
              alt="Top-down tabletop scene with SeaRealm cards played on two opposing ecosystem mats"
              width={1536}
              height={1024}
              sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1152px) calc(100vw - 80px), 1072px"
              className={styles.tabletopImage}
            />
          </figure>
        </section>
      </HomeDiveReveal>
    </>
  );
}
