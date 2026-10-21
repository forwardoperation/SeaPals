import Image from "next/image";
import Link from "next/link";
import { getStoreProductPath } from "@/lib/store/productDetails.mjs";

export default function HomeDeckShowcase({ products }) {
  return (
    <ul
      aria-label="SeaRealm ready-to-play decks"
      className="-mx-2 flex flex-wrap content-center justify-center gap-y-6 py-2 sm:gap-y-8"
    >
      {products.map((product) => (
        <li key={product.id} className="w-1/2 px-2 sm:w-1/3">
          <Link
            href={getStoreProductPath(product.id)}
            className="group flex h-full flex-col items-center rounded-xl text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={product.image}
                alt=""
                fill
                sizes="(max-width: 639px) 44vw, (max-width: 1023px) 29vw, 170px"
                className="object-contain transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
              />
            </div>
            <span className="mt-2 text-sm font-bold leading-snug text-cyan-50 transition-colors group-hover:text-[#f7c948] sm:text-base">
              {product.shortName || product.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
