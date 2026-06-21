import Image from "next/image";

export default function HomePage() {
  const cards = [
    {
      src: "/images/cards/fish/Reef/french-angelfish.png",
      alt: "French Angelfish",
    },
    {
      src: "/images/cards/apex/Reef/bull-shark.png",
      alt: "Bull Shark",
    },
    {
      src: "/images/cards/filter-feeders/Oceanic/blue-whale.png",
      alt: "Blue Whale",
    },
    {
      src: "/images/cards/apex/Oceanic/killer-whale.png",
      alt: "Killer Whale",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-white text-slate-800">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 md:px-10">
        <div className="grid flex-1 items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
  
            <div className="flex flex-col justify-start -mt-8 md:-mt-12">
            <div className="inline-flex items-center rounded-full border border-cyan-300 bg-white/80 backdrop-blur px-6 py-2 text-2xl font-semibold text-cyan-700 shadow-md">
                Coming soon
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
                Collect SeaPals Build your Reef Play with Friends
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Discover a vibrant world of marine life through beautifully designed collectible
                cards. Join early to see new cards, artwork, and development updates before launch.
            </p>

            {/* NEW SECTION */}
            <div className="mt-10 max-w-xl">
                <h2 className="text-sm font-semibold tracking-widest text-cyan-600 uppercase">
                What is SeaPals?
                </h2>

                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                SeaPals is an ocean-inspired trading card game where you build your own living reef.
                </p>

                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                Grow coral, collect marine life, and shape a thriving underwater ecosystem as you compete against friends. Every card you play expands your reef and changes your strategy.
                </p>

                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                The goal is simple: build the strongest reef and win.
                </p>
            </div>
            </div>

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

                <input
                    type="text"
                    name="fields[referred_by]"
                    placeholder="Who sent you? (optional)"
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
            <p className="mt-2">Explore new marine creatures and habitats.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
