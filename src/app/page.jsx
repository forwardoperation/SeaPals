import Image from "next/image";

export default function HomePage() {
  const cards = [
    {
      src: "/images/cards/french-angelfish.png",
      alt: "Reef Fish",
    },
    {
      src: "/images/cards/bull-shark.png",
      alt: "Apex Predator",
    },
    {
      src: "/images/cards/blue-whale.png",
      alt: "Blue Whale",
    },
    {
      src: "/images/cards/killer-whales.png",
      alt: "Killer Whales",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-white text-slate-800">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 md:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/brand/sea-pals-tcg-logo.png"
              alt="SeaPals Logo"
              width={300}
              height={120}
              className="h-12 w-auto"
            />
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">
                SeaPals TCG
              </div>
              <div className="mt-1 text-sm text-slate-500">
                An ocean-inspired trading card game
              </div>
            </div>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-medium text-cyan-700 shadow-sm">
              Coming soon
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
              Build your reef. Collect your crew. Dive into SeaPals.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Discover a vibrant world of marine life through beautifully designed collectible
              cards. Join early to see new cards, artwork, and development updates before launch.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">Card reveals</span>
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">Artwork drops</span>
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">Playtest updates</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {cards.map((card) => (
              <div
                key={card.src}
                className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-cyan-100 transition hover:-translate-y-1"
              >
                <Image
                  src={card.src}
                  alt={card.alt}
                  width={400}
                  height={560}
                  className="w-full h-auto"
                />
              </div>
            ))}
          </div>
        </div>

        <section className="mx-auto w-full max-w-5xl py-8" id="signup">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-cyan-100 md:grid md:grid-cols-[1.05fr_1.2fr]">
            <div
            className="relative min-h-[420px] p-8 text-white md:min-h-[500px] md:p-10"
            style={{
                backgroundImage:
                "url('https://embed.filekitcdn.com/e/7HpFVZHEqyc462h22bHWSx/pZewdRjZRGFfrXE69BrL5v')",
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
            />

            <div className="flex items-center p-8 md:p-10">
            <div className="w-full">
                <div className="mb-6">
                <h3 className="text-3xl font-bold uppercase text-slate-900">
                    JOIN THE CREW
                </h3>
                <p className="mt-2 text-base text-slate-500">
                    Be the first to see new cards and get launch updates.
                </p>
                </div>

                <form
                action="https://app.kit.com/forms/9233650/subscriptions"
                method="post"
                className="space-y-4"
                >
                <input
                    type="text"
                    name="fields[first_name]"
                    placeholder="First Name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-4 text-lg outline-none transition focus:border-cyan-500"
                />

                <input
                    type="email"
                    name="email_address"
                    placeholder="Email Address"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-4 text-lg outline-none transition focus:border-cyan-500"
                />

                <button
                    type="submit"
                    className="w-full rounded-2xl bg-[#07507D] px-4 py-4 text-lg font-bold text-white shadow-lg transition hover:brightness-110"
                >
                    Subscribe
                </button>

                <p className="text-sm text-slate-500">
                    We respect your privacy. Unsubscribe at any time.
                </p>
                </form>
            </div>
            </div>
        </div>
        </section>

        <section className="grid gap-4 border-t border-slate-200 py-8 text-sm text-slate-500 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="font-semibold text-slate-800">Collect</div>
            <p className="mt-2">Build your deck from a diverse ocean ecosystem.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="font-semibold text-slate-800">Strategize</div>
            <p className="mt-2">Use abilities and synergies to outplay your opponent.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="font-semibold text-slate-800">Discover</div>
            <p className="mt-2">Explore new marine creatures and environments.</p>
          </div>
        </section>
      </section>
    </main>
  );
}