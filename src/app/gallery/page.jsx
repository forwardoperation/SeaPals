import Image from "next/image";
import { getGalleryData } from "@/lib/gallery";

export const metadata = {
  title: "Gallery | SeaPals TCG",
  description: "Browse SeaPals creatures by category.",
};

function CategorySection({ title, slug, images }) {
  // 🔹 Hide empty categories entirely
  if (!images || images.length === 0) return null;

  return (
    <section id={slug} className="scroll-mt-28">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <details key={image.src} className="group">
            <summary className="list-none cursor-pointer outline-none">
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
          Browse SeaPals creatures by class.
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