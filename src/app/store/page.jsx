import { getStoreConfiguration } from "@/lib/store/catalog";
import Storefront from "./Storefront";

export function generateMetadata() {
  const { checkoutEnabled } = getStoreConfiguration();

  return {
    title: checkoutEnabled
      ? "Shop | SeaPals TCG"
      : "Store Preview | SeaPals TCG",
    description: checkoutEnabled
      ? "Shop made-to-order SeaPals starter kits, ready-to-play decks, and accessories with five-business-day standard production or optional one-business-day production."
      : "Preview made-to-order SeaPals starter kits, ready-to-play decks, and accessories before ordering opens.",
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
      highlightedProductId={getRequestedProduct(params)}
    />
  );
}
