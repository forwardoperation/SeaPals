import { getStoreConfiguration } from "@/lib/store/catalog";
import Storefront from "./Storefront";

export const metadata = {
  title: "Store | SeaPals TCG",
  description:
    "Shop SeaPals starter kits, expansion decks, game accessories, apparel, storage, and plush gear.",
};

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
