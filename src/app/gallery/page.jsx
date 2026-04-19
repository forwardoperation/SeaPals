import Image from "next/image";
import { getGalleryData } from "@/lib/gallery";

export const metadata = {
  title: "Gallery | SeaPals TCG",
  description: "Browse SeaPals creatures by category.",
};

function CategorySection({ title, slug, images }) {
  return (
    <section id={slug} className="scroll-mt-28">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">
            Creature Class
          </p>
          <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
        </div>

        <div className="rounded-full border border-cyan-200 bg-white/80 px-4 py-1 text-sm font-medium text-slate-600">
          {images.length} {images.length === 1 ? "image" : "images"}
        </div>
      </div>

      {images.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-cyan-200 bg-white/70 p-8 text-slate-500">
          Add images to{" "}
          <span className="font-semibold">public/images/cards/{slug}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <details
              key={image.src}
              className="group rounded-2xl"
            >
              <summary className="list-none cursor-pointer rounded-2xl outline-none">
                <div className="transition hover:-translate-y-1">
                  <Image
                    src={image.src}
                    alt={image.name}
                    width={400}
                    height={560}
                    loading={index < 4 ? "eager" : "lazy"}
                    className="h-auto w-full drop-shadow-lg"
                  />
                </div>
              </summary>

              {(image.description ||
                image.attribution ||
                image.habitat ||
                image.region ||
                image.diet ||
                image.size) && (
                <div className="mt-3 rounded-2xl border border-cyan-100 bg-white/90 p-4 text-sm shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">
                    {image.name}
                  </h3>

                  {image.description && (
                    <p className="mt-2 leading-relaxed text-slate-600">
                      {image.description}
                    </p>
                  )}

                  <div className="mt-3 space-y-1 text-slate-600">
                    {image.habitat && (
                      <p>
                        <span className="font-semibold text-slate-800">Habitat:</span>{" "}
                        {image.habitat}
                      </p>
                    )}

                    {image.region && (
                      <p>
                        <span className="font-semibold text-slate-800">Region:</span>{" "}
                        {image.region}
                      </p>
                    )}

                    {image.diet && (
                      <p>
                        <span className="font-semibold text-slate-800">Diet:</span>{" "}
                        {image.diet}
                      </p>
                    )}

                    {image.size && (
                      <p>
                        <span className="font-semibold text-slate-800">Size:</span>{" "}
                        {image.size}
                      </p>
                    )}
                  </div>

                  {image.attribution && (
                    <p className="mt-3 text-xs text-slate-500">
                      {image.source ? (
                        <a
                          href={image.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-slate-700"
                        >
                          {image.attribution}
                        </a>
                      ) : (
                        image.attribution
                      )}
                    </p>
                  )}
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function GalleryPage() {
  const categories = await getGalleryData();

  return (
    <main className="space-y-12 pb-16">
      <section className="rounded-[2rem] border border-cyan-100 bg-white/80 p-8 shadow-sm backdrop-blur">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          SeaPals Gallery
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Creature Gallery
        </h1>

        <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
          Browse SeaPals creatures by class. Add new PNGs to the category folders
          and they will appear here automatically.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {categories.map((category) => (
            <a
              key={category.slug}
              href={`#${category.slug}`}
              className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900 transition hover:bg-cyan-100"
            >
              {category.title}
            </a>
          ))}
        </div>
      </section>

      {categories.map((category) => (
        <CategorySection
          key={category.slug}
          title={category.title}
          slug={category.slug}
          images={category.images}
        />
      ))}
    </main>
  );
}