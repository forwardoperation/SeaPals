import Image from "next/image";
import Link from "next/link";
import HomeDive from "./HomeDive";
import HomeDiveReveal from "./HomeDiveReveal";
import HomeIntroduction from "./HomeIntroduction";
import HomeStarterKit from "./HomeStarterKit";
import { getStoreConfiguration } from "@/lib/store/catalog";
import {
  parentTestimonials,
  youngPlayerSurvey,
} from "@/data/homepage/proof";

export const metadata = {
  alternates: { canonical: "/" },
};

// Price and purchase availability must reflect the current store configuration.
export const dynamic = "force-dynamic";

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
    question: "What exactly is SeaRealm?",
    answer:
      "SeaRealm is an ocean-inspired trading card game. Players grow coral, add marine creatures to their ecosystem, and use card abilities and strategy to build the strongest reef.",
  },
  {
    question: "What worldview does it reflect?",
    answer:
      "SeaRealm invites kids to discover marine life as part of God’s creation. Its world is grounded in real creatures, ocean habitats, strategic play, and a clearly Christian perspective.",
  },
  {
    question: "Can younger and older siblings enjoy it together?",
    answer:
      "SeaRealm is being developed for families with kids ages 8–14, with an approachable core for younger players and strategy that older players can keep exploring.",
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
          className="font-bold text-cyan-100 underline decoration-cyan-300/60 underline-offset-4 hover:text-white"
        >
          SeaRealm Store
        </Link>
        . Each product page shows current availability and pre-order details.
        Join the crew below for new releases and updates.
      </>
    ),
  },
];

export default function HomePage() {
  const configuration = getStoreConfiguration();
  const starterKit = configuration.products.find((product) => product.id === "starter-kit");

  return (
    <main className="pb-12 text-white md:pb-20">
      <HomeDive />

      <HomeDiveReveal>
        <HomeIntroduction />
        <HomeStarterKit
          product={starterKit}
          cartProducts={configuration.products.map(({ id, available }) => ({ id, available }))}
          currency={configuration.currency}
          checkoutEnabled={configuration.checkoutEnabled}
          preorderCampaign={configuration.preorderCampaign}
          paymentMode={configuration.paymentMode}
        />

        <section id="parent-feedback" aria-labelledby="parent-feedback-heading" className="border-y border-white/15 py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center" data-dive-reveal>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f7c948]">From parents who play</p>
            <h2 id="parent-feedback-heading" className="mt-4 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
              What parents are saying.
            </h2>
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
            {parentTestimonials.map((testimonial) => (
              <figure
                key={testimonial.name}
                data-dive-reveal
                className="flex h-full flex-col border-l border-cyan-200/25 py-2 pl-6 sm:pl-8"
              >
                <span aria-hidden="true" className="font-serif text-5xl leading-none text-cyan-200/70">“</span>
                <blockquote className="mt-2 flex-1 font-serif text-xl leading-8 text-white">
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-6 border-t border-white/15 pt-5">
                  <span className="font-bold text-white">{testimonial.name}</span>
                  <span className="ml-2 text-sm text-cyan-100/80">{testimonial.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </HomeDiveReveal>

      <section className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-100">What young players think</p>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Fun first. Learning comes along for the ride.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50">
              We asked the kids who have actually played SeaRealm, previously called SeaPals. Here is the small-sample result, with the numbers shown plainly.
            </p>

            <p className="mt-8 border-l-4 border-[#f7c948] pl-5 font-serif text-xl leading-8 text-white">
              Their answers kept circling the same ideas: real creatures, strategy, learning, and getting to play with friends.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {youngPlayerSurvey.stats.map((stat) => (
              <article key={stat.value} className="border-t border-cyan-200/25 py-6">
                <p className="text-3xl font-black tracking-tight text-cyan-100">{stat.value}</p>
                <p className="mt-3 font-bold leading-6 text-white">{stat.label}</p>
                <p className="mt-2 text-sm leading-6 text-cyan-100/90">{stat.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <p className="mt-8 border-t border-white/15 py-4 text-sm leading-6 text-cyan-100/80">
          Source: {youngPlayerSurvey.responseCount} SeaPals player survey responses, collected before the SeaRealm name change. {youngPlayerSurvey.audienceNote} Counts reflect the exact wording described on each card.
        </p>
      </section>

      <section className="overflow-hidden border-y border-white/15 py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div className="py-2 text-white lg:pr-8">
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
              className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-[#f7c948] px-6 py-3 font-bold text-[#073d58] transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
            >
              Learn how to play
            </Link>
          </div>

          <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden p-8 sm:min-h-[480px]">
            <div aria-hidden="true" className="absolute h-72 w-72 rounded-full border-[32px] border-cyan-200/10" />
            <div className="relative grid w-full max-w-lg grid-cols-2 gap-4 sm:gap-6">
              <Image
                src="/images/cards/habitats/coral-reef.webp"
                alt="Coral Reef habitat card"
                width={750}
                height={1050}
                sizes="(max-width: 640px) 38vw, 220px"
                className="h-auto w-full -rotate-5 rounded-xl shadow-xl"
              />
              <Image
                src="/images/cards/apex/Oceanic/killer-whale.png"
                alt="Killer Whale SeaRealm card"
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
        className="mt-16 overflow-hidden border-b border-white/15 pb-16 text-white md:mt-24 md:pb-24"
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-stretch">
          <div className="py-2 lg:pr-8">
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
                className="group border-t border-cyan-200/25 px-1 py-5 transition hover:-translate-y-0.5 hover:border-cyan-100 hover:bg-cyan-950/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
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
                className="group border-t border-cyan-200/25 px-1 py-5 transition hover:-translate-y-0.5 hover:border-cyan-100 hover:bg-cyan-950/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
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
                  Shop the Starter Kit, individual decks, set-specific Dive
                  Packs, and the Accessories Kit in one place.
                </span>
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center overflow-hidden py-6 sm:min-h-[340px] sm:p-6 lg:min-h-full">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"
            />
            <div className="relative overflow-hidden rounded-2xl">
              <Image
                src="/images/promo/decks-promo.png"
                alt="The seven SeaRealm ready-to-play deck designs"
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
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-100">Good to know</p>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A short read before you say yes.
          </h2>
        </div>
        <div className="mx-auto mt-9 max-w-4xl divide-y divide-white/15 border-y border-white/15">
          {questions.map((item) => (
            <details key={item.question} className="group px-1 py-5 open:bg-cyan-950/15 sm:px-2 sm:py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/60">
                {item.question}
                <span aria-hidden="true" className="text-2xl font-light text-cyan-200 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-3xl pr-8 leading-7 text-cyan-50/90">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        id="signup"
        className="scroll-mt-6 border-t border-white/15 pt-12 text-white md:pt-16"
      >
        <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative hidden min-h-[560px] overflow-hidden p-10 lg:block">
            <div className="absolute -left-24 top-10 h-72 w-72 rounded-full border-[38px] border-cyan-200/10" />
            <div className="relative flex h-full items-center justify-center">
              <Image
                src="/images/cards/filter-feeders/Oceanic/blue-whale.png"
                alt="Blue Whale SeaRealm card"
                width={375}
                height={525}
                sizes="290px"
                className="w-[58%] -rotate-6 rounded-2xl shadow-2xl"
              />
              <Image
                src="/images/cards/apex/Reef/bull-shark.png"
                alt="Bull Shark SeaRealm card"
                width={375}
                height={525}
                sizes="230px"
                className="absolute bottom-9 right-4 w-[46%] rotate-7 rounded-2xl shadow-2xl"
              />
            </div>
          </div>

          <div className="py-2 lg:pr-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f7c948]">Join the crew</p>
            <h2 className="mt-4 max-w-2xl font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Give family game night a world worth exploring.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-cyan-50/80">
              SeaRealm is coming soon. Get launch news, early purchase updates, and new card reveals in your inbox.
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
                Get SeaRealm updates
              </button>
              <div className="border-t border-cyan-200/20 pt-4 text-sm leading-6 text-cyan-50/80">
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
