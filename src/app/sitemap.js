import { encyclopediaCreatures } from "@/data/encyclopedia";
import { CANONICAL_SITE_ORIGIN } from "@/lib/siteIdentity.mjs";

const PUBLIC_PATHS = Object.freeze([
  "/",
  "/adventure",
  "/companion",
  "/decks",
  "/encyclopedia",
  "/gallery",
  "/instructions",
  "/instructions/tutorial",
  "/privacy",
  "/simulator",
  "/store",
  "/surveys",
  "/terms",
]);

export default function sitemap() {
  const paths = [
    ...PUBLIC_PATHS,
    ...encyclopediaCreatures.map(
      (creature) => `/encyclopedia/${creature.slug}`,
    ),
  ];

  return paths.map((path) => ({
    url: new URL(path, CANONICAL_SITE_ORIGIN).toString(),
  }));
}
