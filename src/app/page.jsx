import Image from "next/image";
import Link from "next/link";
import {
  parentTestimonials,
  youngPlayerSurvey,
} from "@/data/homepage/proof";

export const metadata = {
  alternates: { canonical: "/" },
};

const heroCards = [
  {
    src: "/images/cards/fish/Reef/french-angelfish.png",
    alt: "French Angelfish SeaPals card",
    className: "-rotate-7 translate-y-7",
  },
  {
    src: "/images/cards/apex/Reef/bull-shark.png",
    alt: "Bull Shark SeaPals card",
    className: "relative z-10 -translate-y-2",
  },
  {
    src: "/images/cards/filter-feeders/Oceanic/blue-whale.png",
    alt: "Blue Whale SeaPals card",
    className: "rotate-7 translate-y-7",
  },
];

const heroCardStreams = [
  {
    src: "/images/promo/hero-card-stream-reef.jpg",
    width: 3400,
    height: 150,
    className: "seapals-hero-card-stream--reef",
  },
  {
    src: "/images/promo/hero-card-stream-oceanic.jpg",
    width: 5750,
    height: 150,
    className: "seapals-hero-card-stream--oceanic",
  },
  {
    src: "/images/promo/hero-card-stream-deep.jpg",
    width: 4246,
    height: 150,
    className: "seapals-hero-card-stream--deep",
  },
];

const familyBenefits = [
  {
    number: "01",
    title: "A worldview stated plainly",
    copy:
      "SeaPals explores real marine life as part of God’s creation. Parents know the theme, the boundaries, and the perspective before the first card is played.",
  },
  {
    number: "02",
    title: "Face time beats screen time",
    copy:
      "Siblings and friends sit down together to talk, laugh, trade, plan, and compete—no screen required.",
  },
  {
    number: "03",
    title: "Room for the whole sibling range",
    copy:
      "The core play is approachable for younger kids, while deck building and strategy give older kids and parents plenty to grow into.",
  },
  {
    number: "04",
    title: "Fits a full family schedule",
    copy:
      "Most games can be completed in under 30 minutes once players know the flow, making one more round an easy yes.",
  },
  {
    number: "05",
    title: "Easy to bring along",
    copy:
      "Minimal setup and teardown make SeaPals ready for the kitchen table, co-op, a friend’s house, or vacation.",
  },
];

const howItWorks = [
  {
    step: "Grow coral",
    copy: "Build the foundation of a living reef and the resource engine that keeps it growing.",
  },
  {
    step: "Bring in marine life",
    copy: "Add real ocean creatures whose traits and abilities shape the way your ecosystem plays.",
  },
  {
    step: "Build the strongest reef",
    copy: "Combine cards, adapt your strategy, and outplay the ecosystem across the table.",
  },
];

const questions = [
  {
    question: "What exactly is SeaPals?",
    answer:
      "SeaPals is an ocean-inspired trading card game. Players grow coral, add marine creatures to their ecosystem, and use card abilities and strategy to build the strongest reef.",
  },
  {
    question: "What worldview does it reflect?",
    answer:
      "SeaPals invites kids to discover marine life as part of God’s creation. Its world is grounded in real creatures, ocean habitats, strategic play, and a clearly Christian perspective.",
  },
  {
    question: "Can younger and older siblings enjoy it together?",
    answer:
      "SeaPals is being developed for families with kids ages 6–14, with an approachable core for younger players and strategy that older players can keep exploring.",
  },
  {
    question: "How long does a game take?",
    answer:
      "Most games can be completed in under 30 minutes by skilled players. In 13 survey responses with recorded ages 6–12, 8 reported a typical game time of 10–30 minutes.",
  },
  {
    question: "When can I buy it?",
    answer: (
      <>
        You can browse the complete launch collection in the{" "}
        <Link
          href="/store"
          className="font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950"
        >
          SeaPals Store
        </Link>
        . Online checkout will open after the final launch checks are complete.
        Join the crew below to hear when ordering begins.
      </>
    ),
  },
];

export default function HomePage() {
  return (
    <main className="pb-12 text-slate-900 md:pb-20">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#062f46] px-5 py-10 text-white shadow-2xl shadow-cyan-950/15 sm:px-8 md:rounded-[2.75rem] md:px-12 md:py-14 lg:px-16 lg:py-16">
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-40 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-48 -left-32 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-10">
          <div>
            <p className="inline-flex rounded-full border border-cyan-200/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
              Coming soon · Creation-focused family play
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold leading-[1.04] tracking-tight text-white sm:text-5xl md:text-6xl">
              A card game your kids will love, and you will too.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-50/90 md:text-xl">
              SeaPals turns the wonder of God’s creation into fast, face-to-face fun. Kids build living reefs, discover real ocean creatures, and make strategic choices with siblings and friends.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/store"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f7c948] px-6 py-3 text-base font-bold text-[#082f49] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
              >
                Explore the Store
              </Link>
              <Link
                href="/instructions"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
              >
                See how it plays
              </Link>
            </div>
            <p className="mt-4 text-sm text-cyan-100/75">
              Want launch news, card reveals, and early purchase updates?{" "}
              <a
                href="#signup"
                className="font-bold text-white underline decoration-cyan-200/60 underline-offset-4 hover:text-[#f7c948]"
              >
                Join the crew.
              </a>
            </p>

            <dl className="mt-9 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-white/15 pt-7 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Made for</dt>
                <dd className="mt-1 font-semibold text-white">Families with kids 6–14</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Play time</dt>
                <dd className="mt-1 font-semibold text-white">Under 30 min. for skilled players</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Setup</dt>
                <dd className="mt-1 font-semibold text-white">Quick to start and pack up</dd>
              </div>
            </dl>
          </div>

          <div className="seapals-hero-card-stage relative mx-auto min-h-[410px] w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-cyan-200/15 bg-[#062f46] shadow-inner sm:min-h-[460px] lg:-mr-8 lg:min-h-[500px]">
            <div aria-hidden="true" className="absolute inset-0">
              {heroCardStreams.map((stream) => (
                <div
                  key={stream.src}
                  className={`seapals-hero-card-stream ${stream.className}`}
                >
                  <div className="seapals-hero-card-stream-track">
                    <Image
                      src={stream.src}
                      alt=""
                      width={stream.width}
                      height={stream.height}
                      sizes="1800px"
                      className="seapals-hero-card-stream-image"
                    />
                    <Image
                      src={stream.src}
                      alt=""
                      width={stream.width}
                      height={stream.height}
                      sizes="1800px"
                      className="seapals-hero-card-stream-image"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div aria-hidden="true" className="seapals-hero-card-vignette absolute inset-0" />

            <div className="relative z-10 flex min-h-[410px] flex-col items-center justify-center px-5 py-9 sm:min-h-[460px] sm:px-8 lg:min-h-[500px]">
              <div className="grid w-full max-w-sm grid-cols-3 items-center gap-2 sm:max-w-md sm:gap-4">
                {heroCards.map((card) => (
                  <div
                    key={card.src}
                    className={`overflow-hidden rounded-xl bg-white p-1.5 shadow-2xl shadow-black/45 ring-1 ring-white/70 transition duration-300 hover:z-20 hover:-translate-y-2 sm:rounded-2xl sm:p-2 ${card.className}`}
                  >
                    <Image
                      src={card.src}
                      alt={card.alt}
                      width={375}
                      height={525}
                      priority
                      sizes="(max-width: 640px) 26vw, (max-width: 1024px) 150px, 140px"
                      className="h-auto w-full rounded-lg sm:rounded-xl"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-7 max-w-sm rounded-2xl border border-cyan-200/30 bg-[#082f49]/90 px-5 py-4 text-center shadow-xl backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">What kids are building</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-white">
                  A thriving reef—one coral, creature, and smart decision at a time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24" id="what-it-is">
        <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">Clarity for parents</p>
            <h2 className="mt-4 max-w-xl font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
              Know the world your kids are stepping into.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              SeaPals has a clear focus: exploring creation through a genuinely fun strategy game about marine life. The theme, content, and worldview are stated plainly—so you can make a confident yes.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {familyBenefits.map((benefit, index) => (
              <article
                key={benefit.number}
                className={`rounded-3xl border p-6 shadow-sm ${
                  index === 0
                    ? "border-cyan-800 bg-[#073d58] text-white sm:col-span-2 sm:grid sm:grid-cols-[auto_1fr] sm:gap-6"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p
                  className={`text-sm font-black tracking-[0.18em] ${
                    index === 0 ? "text-[#f7c948]" : "text-cyan-700"
                  }`}
                >
                  {benefit.number}
                </p>
                <div>
                  <h3 className={`mt-3 text-xl font-bold ${index === 0 ? "sm:mt-0" : "text-slate-950"}`}>
                    {benefit.title}
                  </h3>
                  <p className={`mt-3 leading-7 ${index === 0 ? "text-cyan-50/85" : "text-slate-600"}`}>
                    {benefit.copy}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-[#f5efe2] px-5 py-12 sm:px-8 md:rounded-[2.75rem] md:px-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-800">From one mom to another</p>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Why moms are glad they said yes to SeaPals.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {parentTestimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex h-full flex-col rounded-3xl border border-amber-900/10 bg-white p-6 shadow-sm sm:p-8"
            >
              <span aria-hidden="true" className="font-serif text-5xl leading-none text-cyan-600">“</span>
              <blockquote className="mt-2 flex-1 font-serif text-xl leading-8 text-slate-800">
                {testimonial.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-slate-200 pt-5">
                <span className="font-bold text-slate-950">{testimonial.name}</span>
                <span className="ml-2 text-sm text-slate-500">{testimonial.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">What young players think</p>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
              Fun first. Learning comes along for the ride.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              We asked the kids who have actually played SeaPals. Here is the small-sample result, with the numbers shown plainly.
            </p>

            <p className="mt-8 border-l-4 border-[#f7c948] pl-5 font-serif text-xl leading-8 text-slate-800">
              Their answers kept circling the same ideas: real creatures, strategy, learning, and getting to play with friends.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {youngPlayerSurvey.stats.map((stat) => (
              <article key={stat.value} className="rounded-3xl border border-cyan-100 bg-cyan-50 p-6">
                <p className="text-3xl font-black tracking-tight text-[#075b7d]">{stat.value}</p>
                <p className="mt-3 font-bold leading-6 text-slate-950">{stat.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{stat.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-500">
          Source: {youngPlayerSurvey.responseCount} SeaPals player survey responses. {youngPlayerSurvey.audienceNote} Counts reflect the exact wording described on each card.
        </p>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-cyan-100 bg-white shadow-xl shadow-cyan-950/5 md:rounded-[2.75rem]">
        <div className="grid lg:grid-cols-[.9fr_1.1fr]">
          <div className="bg-[#073d58] p-6 text-white sm:p-8 md:p-12">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200">A game in three moves</p>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Build a reef. Bring it to life. Outplay your friends.
            </h2>
            <div className="mt-8 space-y-7">
              {howItWorks.map((item, index) => (
                <div key={item.step} className="grid grid-cols-[auto_1fr] gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7c948] text-sm font-black text-[#073d58]">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-white">{item.step}</h3>
                    <p className="mt-1 leading-7 text-cyan-50/80">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/instructions"
              className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3 font-bold text-[#073d58] transition hover:-translate-y-0.5 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
            >
              Learn how to play
            </Link>
          </div>

          <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-100 via-sky-50 to-amber-50 p-8 sm:min-h-[480px]">
            <div aria-hidden="true" className="absolute h-72 w-72 rounded-full border-[32px] border-white/55" />
            <div className="relative grid w-full max-w-lg grid-cols-2 gap-4 sm:gap-6">
              <Image
                src="/images/cards/coral-reef.png"
                alt="Coral Reef habitat card"
                width={375}
                height={525}
                sizes="(max-width: 640px) 38vw, 220px"
                className="h-auto w-full -rotate-5 rounded-xl shadow-xl"
              />
              <Image
                src="/images/cards/apex/Oceanic/killer-whale.png"
                alt="Killer Whale SeaPals card"
                width={375}
                height={525}
                sizes="(max-width: 640px) 38vw, 220px"
                className="h-auto w-full translate-y-8 rotate-5 rounded-xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="try-seapals-heading"
        className="mt-16 overflow-hidden rounded-[2rem] bg-[#062f46] text-white shadow-2xl shadow-cyan-950/15 md:mt-24 md:rounded-[2.75rem]"
      >
        <div className="grid lg:grid-cols-[1.05fr_.95fr] lg:items-stretch">
          <div className="p-6 sm:p-9 md:p-12 lg:p-14">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f7c948]">
              Try before you buy
            </p>
            <h2
              id="try-seapals-heading"
              className="mt-4 max-w-2xl font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            >
              Meet the decks. Learn a round. Choose your reef.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50/80">
              Explore every ready-to-play deck and walk through a guided game
              before deciding which Starter Kit, deck, or accessory belongs at
              your table.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                href="/decks"
                className="group rounded-2xl border border-cyan-200/25 bg-white/10 p-5 transition hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
              >
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                  Step 1
                </span>
                <span className="mt-2 block text-lg font-bold text-white">
                  Compare the decks
                </span>
                <span className="mt-2 block text-sm leading-6 text-cyan-50/75">
                  See every 60-card list and the strategy behind it.
                </span>
              </Link>
              <Link
                href="/instructions/tutorial"
                className="group rounded-2xl border border-cyan-200/25 bg-white/10 p-5 transition hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
              >
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                  Step 2
                </span>
                <span className="mt-2 block text-lg font-bold text-white">
                  Try the guided tutorial
                </span>
                <span className="mt-2 block text-sm leading-6 text-cyan-50/75">
                  Learn the turn flow with a hands-on practice game.
                </span>
              </Link>
              <Link
                href="/store"
                className="group rounded-2xl bg-[#f7c948] p-5 text-[#082f49] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/50 sm:col-span-2"
              >
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-[#075b7d]">
                  Step 3
                </span>
                <span className="mt-2 block text-xl font-black">
                  Explore the Store
                </span>
                <span className="mt-2 block text-sm font-semibold leading-6 text-[#073d58]">
                  Shop the Starter Kit, individual decks, and the Accessories
                  Kit in one place.
                </span>
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center overflow-hidden bg-gradient-to-br from-cyan-100 via-sky-50 to-amber-50 p-6 sm:min-h-[340px] sm:p-9 lg:min-h-full lg:p-10">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/35 blur-3xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white p-3 shadow-2xl shadow-cyan-950/20 sm:p-4">
              <Image
                src="/images/promo/decks-promo.png"
                alt="The seven SeaPals ready-to-play deck designs"
                width={6596}
                height={1202}
                sizes="(max-width: 1024px) 90vw, 520px"
                className="h-auto w-full rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">Good to know</p>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            A short read before you say yes.
          </h2>
        </div>
        <div className="mx-auto mt-9 max-w-4xl divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {questions.map((item) => (
            <details key={item.question} className="group p-5 open:bg-cyan-50/50 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-bold text-slate-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/60">
                {item.question}
                <span aria-hidden="true" className="text-2xl font-light text-cyan-700 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-3xl pr-8 leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        id="signup"
        className="scroll-mt-6 overflow-hidden rounded-[2rem] bg-[#062f46] text-white shadow-2xl shadow-cyan-950/15 md:rounded-[2.75rem]"
      >
        <div className="grid lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative hidden min-h-[560px] overflow-hidden bg-gradient-to-br from-cyan-400/25 via-[#0b4e68] to-[#05283d] p-10 lg:block">
            <div className="absolute -left-24 top-10 h-72 w-72 rounded-full border-[38px] border-cyan-200/10" />
            <div className="relative flex h-full items-center justify-center">
              <Image
                src="/images/cards/filter-feeders/Oceanic/blue-whale.png"
                alt="Blue Whale SeaPals card"
                width={375}
                height={525}
                sizes="290px"
                className="w-[58%] -rotate-6 rounded-2xl shadow-2xl"
              />
              <Image
                src="/images/cards/apex/Reef/bull-shark.png"
                alt="Bull Shark SeaPals card"
                width={375}
                height={525}
                sizes="230px"
                className="absolute bottom-9 right-4 w-[46%] rotate-7 rounded-2xl shadow-2xl"
              />
            </div>
          </div>

          <div className="p-6 sm:p-9 md:p-12 lg:p-14">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f7c948]">Join the crew</p>
            <h2 className="mt-4 max-w-2xl font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Give family game night a world worth exploring.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-cyan-50/80">
              SeaPals is coming soon. Get launch news, early purchase updates, and new card reveals in your inbox.
            </p>

            <form
              action="https://app.kit.com/forms/9233650/subscriptions"
              method="post"
              className="mt-8 space-y-5"
            >
              <div>
                <label htmlFor="signup-first-name" className="mb-2 block text-sm font-bold text-cyan-50">
                  First name
                </label>
                <input
                  id="signup-first-name"
                  type="text"
                  name="fields[first_name]"
                  autoComplete="given-name"
                  className="min-h-13 w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/20"
                />
              </div>
              <div>
                <label htmlFor="signup-email" className="mb-2 block text-sm font-bold text-cyan-50">
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  name="email_address"
                  autoComplete="email"
                  required
                  className="min-h-13 w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/20"
                />
              </div>
              <div>
                <label htmlFor="signup-referral" className="mb-2 block text-sm font-bold text-cyan-50">
                  Who sent you? <span className="font-normal text-cyan-100/65">(optional)</span>
                </label>
                <input
                  id="signup-referral"
                  type="text"
                  name="fields[referred_by]"
                  className="min-h-13 w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/20"
                />
              </div>
              <button
                type="submit"
                className="inline-flex min-h-13 w-full items-center justify-center rounded-xl bg-[#f7c948] px-5 py-3.5 text-lg font-black text-[#082f49] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
              >
                Get SeaPals updates
              </button>
              <div className="rounded-xl border border-cyan-200/20 bg-cyan-950/35 px-4 py-3 text-sm leading-6 text-cyan-50/80">
                <strong className="text-white">For grown-ups:</strong> Sea Realm,
                LLC sends the email address and optional first name/referral to
                Kit only for the updates requested here. Do not put a child&apos;s
                name or personal details in the referral field. Unsubscribe at
                any time. Read our{" "}
                <Link
                  href="/privacy"
                  className="font-bold text-cyan-100 underline decoration-cyan-200/60 underline-offset-4 hover:text-white"
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms"
                  className="font-bold text-cyan-100 underline decoration-cyan-200/60 underline-offset-4 hover:text-white"
                >
                  Terms of Use
                </Link>
                .
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
