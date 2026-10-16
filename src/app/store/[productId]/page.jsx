import { notFound } from "next/navigation";
import { getStoreConfiguration } from "@/lib/store/catalog";
import {
  getStoreProductById,
  getStoreProductPath,
} from "@/lib/store/productDetails.mjs";
import Storefront from "../Storefront";

export async function generateMetadata({ params }) {
  const { productId } = await params;
  const configuration = getStoreConfiguration();
  const product = getStoreProductById(configuration.products, productId);
  if (!product) notFound();

  return {
    title: `${product.name} | SeaRealm TCG`,
    description: product.description,
    alternates: { canonical: getStoreProductPath(product.id) },
  };
}

export default async function StoreProductPage({ params }) {
  const { productId } = await params;
  const configuration = getStoreConfiguration();
  const product = getStoreProductById(configuration.products, productId);
  if (!product) notFound();

  return <Storefront {...configuration} detailProductId={product.id} />;
}
