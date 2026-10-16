import { getStoreConfiguration } from "@/lib/store/catalog";
import galleryImages from "@/data/gallery-images.json";
import masterSetList from "@/data/gallery-set-list.json";
import { getStoreBannerCards } from "@/lib/store/bannerCards.mjs";
import Storefront from "./Storefront";

export function generateMetadata() {
  const { checkoutEnabled } = getStoreConfiguration();

  return {
    title: checkoutEnabled
      ? "Shop | SeaRealm TCG"
      : "Store Preview | SeaRealm TCG",
    description: checkoutEnabled
      ? "Shop Oceanic, Reef, and Deep Dive Packs, game accessories, and Christmas pre-orders for the SeaRealm Starter Kit and expansion decks."
      : "Preview Oceanic, Reef, and Deep Dive Packs, game accessories, and Christmas pre-orders for the SeaRealm Starter Kit and expansion decks.",
    alternates: { canonical: "/store" },
  };
}

function getRequestedProduct(searchParams) {
  const product = searchParams?.product ?? searchParams?.deck;
  return typeof product === "string" ? product : null;
}

export default async function StorePage({ searchParams }) {
  const [params, configuration] = await Promise.all([
    searchParams,
    getStoreConfiguration(),
  ]);

  return (
    <Storefront
      {...configuration}
      heroCards={getStoreBannerCards(galleryImages, masterSetList)}
      highlightedProductId={getRequestedProduct(params)}
    />
  );
}
