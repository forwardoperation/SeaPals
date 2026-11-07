import Image from "next/image";
import Link from "next/link";
import AskFinnButton from "./AskFinnButton";
import Faq from "./Faq";
import InstructionsNav from "./InstructionsNav";
import { FIRST_PLAYER_RULE, CONDITIONS_DECK_RULE, SIMULTANEOUS_VICTORY_RULE, TABLETOP_PROCEDURES } from "@/data/rules/tabletopProcedures.mjs";

export const metadata = {
  title: "How to Play SeaRealm | Beginner Guide & Complete Rules",
  description:
    "Learn SeaRealm TCG through guided interactive simulator lessons, then use the complete rules, examples, glossary, and FAQ as a reference.",
  alternates: { canonical: "/instructions" },
};

const iconBase = "/images/icons";

const turnSteps = [
  {
    number: "1",
    name: "Choose",
    prompt: "Which deck helps me most?",
    description:
      "Draw 1 card from either your Foundation Deck or your Main Deck. You do not draw from both unless a card effect says so.",
    color: "border-blue-300/30 bg-blue-950/15 text-blue-100",
  },
  {
    number: "2",
    name: "Collect",
    prompt: "How much RP do I gain?",
    description:
      "Gain 1 RP plus the RP produced by your active Foundations. Apply card and Condition modifiers. You can normally keep up to 8 RP; discard any extra unless an effect changes your cap.",
    color: "border-amber-300/35 bg-amber-950/20 text-amber-100",
  },
  {
    number: "3",
    name: "Build",
    prompt: "What can I add to my ocean?",
    description:
      "Play cards, upgrade Foundations, and use Actions. Check requirements, then pay the costs. You may play up to 1 Aide per turn and any number of Items. New cards can use their Actions right away unless their text says otherwise.",
    color: "border-emerald-300/30 bg-emerald-950/15 text-emerald-100",
  },
  {
    number: "4",
    name: "Attack",
    prompt: "What can my Pals target?",
    description:
      "Use available attacks one at a time. Choose a legal target and completely resolve that attack before beginning another.",
    color: "border-rose-300/35 bg-rose-950/20 text-rose-100",
  },
];

const glossary = [
  ["VP", "Victory Points — your score. Only VP on cards currently in your ecosystem counts."],
  ["RP", "Resource Points — the currency used to play cards and pay Action costs."],
  ["Ecosystem", "All of your cards currently in play. Your hand, decks, and discard are not part of it."],
  ["Foundation", "The base of an ecosystem. Coral and Creature Schools are Foundation cards."],
  ["Pal", "A creature you play, such as a Fish, Predator, Apex, Invertebrate, or Filter Feeder."],
  ["Condition", "A shared card revealed at the start of a round that affects every player."],
  ["Habitat", "A persistent card, such as Open Ocean or Abyss, that enables or changes an ecosystem."],
  ["Slot", "A space supplied by Coral or another rule that accepts specific habitats and creature classes."],
  ["Requirement", "Something that must already be true to play a card. It is separate from paying RP or another printed cost; School Density specifically commits capacity while its creature stays in play."],
  ["Cost", "What you pay to play a card or use an Action, usually RP or a printed additional cost."],
  ["Passive", "An ability that stays active while its card is in play and its printed condition is true."],
  ["On Play", "An ability that resolves once when the card is successfully played."],
  ["Action", "An ability you choose to use at its printed timing after paying its cost and choosing legal targets."],
  ["Defense", "The target's roll against a normal attack. A tied total means the defender stays in play."],
  ["School Density", "Oceanic capacity supplied by Creature Schools. Density requirements add together and stay committed while those creatures remain in play."],
  ["Discard", "Cards that are spent, discarded, or destroyed unless another rule gives them a different destination."],
  ["Lost Zone", "A separate area for destroyed Apex, Filter Feeders, and any other card whose text sends it there, such as Lionfish. These cards are no longer in play."],
];

const faqQuestions = [
  {
    question: "What do we need for a first game?",
    answer:
      "SeaRealm is for 2–4 players. Each player needs a legal 60-card deck separated into a Foundation Deck and a Main Deck. Share one Conditions Deck, and gather RP counters, damage or HP counters, a coin, and the dice named on your cards (D4, D6, D8, D10, D12, and D20).",
  },
  {
    question: "Should beginners play to 10 VP or 30 VP?",
    answer:
      "Use 10 VP for a learning game and 30 VP for the recommended full game. Agree on the target before setup. In either version, only VP currently in play counts.",
  },
  {
    question: "Who goes first?",
    answer: FIRST_PLAYER_RULE.text,
  },
  {
    question: "What happens when the Conditions Deck runs out?",
    answer: CONDITIONS_DECK_RULE.text,
  },
  {
    question: "What if players reach the VP target at the same time?",
    answer: SIMULTANEOUS_VICTORY_RULE.text,
  },
  {
    question: "What are the four steps of a turn?",
    answer:
      "At the table, follow Choose, Collect, Build, then Attack, followed by end-of-turn effects. The simulator collects RP before its draw prompt and lets you build and attack in one combined action phase. Use the tabletop order when playing with physical cards.",
  },
  {
    question: "Which deck do I draw from?",
    answer:
      "During Choose, draw 1 card from either your Foundation Deck or your Main Deck. Choose only one of those decks unless a card or Condition grants another draw.",
  },
  {
    question: "How much RP do I collect, and how much can I keep?",
    answer:
      "During Collect, gain 1 RP plus the RP produced by your active Foundations, then apply card and Condition modifiers. The default RP bank cap is 8. Discard anything above the active cap.",
  },
  {
    question: "How do I know where a creature can go?",
    answer:
      "Check two things: habitat and class. Reef and Deep creatures need a compatible slot in their own habitat. A Fish slot takes Fish, a Predator slot takes Fish or Predators, and an Apex slot takes Fish, Predators, or Apex. Specific card text can create an exception.",
  },
  {
    question: "Where do Oceanic creatures go?",
    answer:
      "Oceanic creatures live in open water rather than on Reef or Deep Coral slots. Creature Schools are Oceanic Foundations and supply School Density; other Oceanic cards often require enough School Density or an enabling Habitat such as Open Ocean.",
  },
  {
    question: "How does School Density capacity work?",
    answer:
      "Each Creature School adds School Density capacity. After any valid reduction, a creature with a School Density requirement commits that much available capacity while it remains in play, so multiple requirements add together. The capacity becomes available again when that creature leaves. If losing or changing a Creature School puts you over capacity, your existing creatures stay, but you cannot play another creature with a positive School Density requirement until you restore enough capacity.",
  },
  {
    question: "Who wins when an attack and defense tie?",
    answer:
      "The defender wins a tie and stays in play. A normal attack succeeds only when the final attack total is higher than the final defense total.",
  },
  {
    question: "Can a Deep creature attack a Reef or Oceanic creature?",
    answer:
      "Yes, if its attack icons allow that target family and all printed restrictions are met. Habitat matching controls where a creature is placed; it does not automatically limit its attacks to that habitat. An attack that explicitly targets only Deep creatures cannot hit Reef or Oceanic creatures. A Predator target icon allows Predators, not Fish or Apex, unless those families are also listed.",
  },
  {
    question: "What does ×2, ×3, or ×4 on an attack mean?",
    answer:
      "It is the attack count. Resolve that many separate attacks, each with its own legal target and rolls. The same physical target cannot be selected twice during that repeated sequence.",
  },
  {
    question: "How are Creature Schools and bait balls attacked?",
    answer:
      "They do not make a defense roll. Instead, they take damage equal to the attack roll multiplied by 10. Discard the Creature School when its HP reaches 0.",
  },
  {
    question: "What happens to VP when a card leaves play?",
    answer:
      "Subtract that card's VP from your current total immediately. Conditional VP also stops counting whenever its printed requirement is no longer true.",
  },
  {
    question: "Which cards go to the Lost Zone when destroyed?",
    answer:
      "Destroyed Apex and Filter Feeder cards go to their owner's Lost Zone instead of the discard pile. Destroying Lionfish sends it to its original owner's Lost Zone. Spearfishing explicitly discards it to its original owner's discard pile. Other discard effects still use discard unless they explicitly name the Lost Zone.",
  },
  {
    question: "When does Lionfish's Invader trigger, and whose Fish can it attack?",
    answer:
      "Invader triggers at the start of the turn of the player whose ecosystem physically contains Lionfish. Targets stay relative to the Lionfish owner: heads attacks a Fish controlled by that owner's opponent, normally the ecosystem holder; tails attacks another Fish controlled by the Lionfish owner. The triggering Lionfish is excluded. If the rolled branch has no legal Fish, the attack fizzles instead of switching branches.",
  },
  {
    question: "How many Aides and Items can I play in a turn?",
    answer:
      "You may play up to 1 Aide per turn and any number of Items, including after an Aide. You still need to pay each card's cost and follow any active restrictions. Aides and Items are both Support cards.",
  },
  {
    question: "Do Support cards stay in play?",
    answer:
      "Normally, no. Resolve the Support card's printed effect and put it in discard. It remains in play only if its own text explicitly says that it does.",
  },
  {
    question: "Is there a hand limit?",
    answer:
      "There is no fixed hand limit by default. A Condition can set a temporary limit. If a draw, search, or recovery takes your hand above that limit, add the cards to your hand first, then choose and discard enough cards from your entire hand to return to the limit.",
  },
  {
    question: "Does upgrading a Coral heal its damage?",
    answer:
      "No. Have the next printed stage in hand, meet its requirement, and pay its RP cost. Place it over the current stage. Existing damage stays, while the upgrade increases maximum HP as printed. A Coral normally upgrades only once per turn.",
  },
  {
    question: "What happens when both of my decks are empty?",
    answer:
      "You lose when you must draw and both your Foundation Deck and Main Deck are depleted. Simply having an empty deck is not the loss trigger if no draw is currently required.",
  },
  {
    question: "Do Conditions affect everyone?",
    answer:
      "Yes. Reveal a shared Condition at the start of the round and apply its printed effect to every player for the stated duration. A Condition matching a Coral weakness stops that Coral's RP production for the round; it does not destroy the Coral by itself.",
  },
  {
    question: "What if a card and this guide seem to disagree?",
    answer:
      "Follow the more specific printed card text when it clearly creates an exception to a general rule. For help with a card or timing question, check this page's Complete rules section or ask Finn. If the rules leave a situation unresolved, agree on a ruling together before continuing.",
  },
];

function SectionHeading({ number, title, children }) {
  return (
    <div className="max-w-3xl">
      <h2 className="flex items-start gap-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
        <span className="mt-0.5 flex h-10 min-w-10 items-center justify-center rounded-full border border-cyan-200/25 bg-cyan-950/20 px-2 text-sm font-black text-cyan-100">
          {number}
        </span>
        <span>{title}</span>
      </h2>
      {children ? (
        <p className="mt-4 text-base leading-7 text-cyan-100 md:text-lg">
          {children}
        </p>
      ) : null}
    </div>
  );
}

function RuleDetails({ id, title, summary, children, open = false }) {
  return (
    <details
      id={id}
      open={open}
      className="group scroll-mt-24 border-b border-white/15 open:border-cyan-200/40"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 [&::-webkit-details-marker]:hidden md:px-6 md:py-5">
        <div>
          <h3 className="text-lg font-bold text-white md:text-xl">{title}</h3>
          {summary ? (
            <p className="mt-1 text-sm leading-6 text-cyan-100/80">{summary}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-950/25 text-xl font-bold text-cyan-100 transition group-open:rotate-45 group-open:bg-cyan-700/40 group-open:text-white"
        >
          +
        </span>
      </summary>
      <div className="border-t border-white/10 px-5 py-5 text-sm leading-7 text-cyan-100/90 md:px-6 md:text-base">
        {children}
      </div>
    </details>
  );
}

function CheckItem({ children }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950/30 text-xs font-black text-emerald-200"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function CardIcon({ src, alt, size = 46 }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="block shrink-0 object-contain"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

export default function InstructionsPage() {
  return (
    <main className="pb-20 text-white">
      <section className="relative overflow-hidden px-1 py-8 text-white md:py-12 lg:py-14">
        <div className="relative grid gap-9 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl md:leading-[1.05]">
              Learn How to Play SeaRealm
            </h1>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/instructions/tutorial"
                className="inline-flex items-center justify-center rounded-full bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-amber-200"
              >
                Start Interactive Tutorial
              </Link>
              <a
                href="#start-here"
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-300/10 px-6 py-3 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/20"
              >
                Read the Rules Yourself
              </a>
            </div>
          </div>

          <div className="relative border-l border-cyan-200/25 py-5 pl-5 md:py-7 md:pl-7">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
              SeaRealm at a glance
            </p>
            <p className="mt-4 text-xl font-bold leading-8 text-white md:text-2xl md:leading-9">
              Build an ocean ecosystem with Foundations and Pals. Cards in your
              ecosystem earn Victory Points. Aim for 10 VP in a learning game,
              or 30 VP in a full game.
            </p>
            <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-cyan-100">
              Each turn, choose a deck, collect RP, play cards, and attack. Learn the
              special rules as they come up.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-10">
        <InstructionsNav />

        <article className="min-w-0 space-y-16 md:space-y-20">
          <section id="start-here" className="scroll-mt-24">
            <SectionHeading number="START" title="Four things to know before you play">
              These terms appear throughout the game. Learn them first, and the cards
              and rules will be much easier to understand.
            </SectionHeading>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                ["VP", "Victory Points: your score", "VP only counts while the card is in your ecosystem."],
                ["RP", "Resource Points: your spending money", "Use RP to play cards and pay Action costs."],
                ["Foundation", "Your ocean's base", "Coral and Creature Schools help support what you can play."],
                ["Pals", "The creatures you play", "Fish, Predators, Apex, Invertebrates, and Filter Feeders."],
              ].map(([term, label, description], index) => (
                <div
                  key={term}
                  className="border-t border-white/15 py-5"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-12 min-w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl px-3 text-sm font-black ${
                        index === 0
                          ? "bg-amber-950/25 text-amber-100"
                          : index === 1
                            ? "bg-cyan-950/25 text-cyan-100"
                            : index === 2
                              ? "bg-emerald-950/25 text-emerald-100"
                              : "bg-blue-950/25 text-blue-100"
                      }`}
                    >
                      {term}
                    </span>
                    <div>
                      <h3 className="font-bold text-white">{label}</h3>
                      <p className="mt-1 text-sm leading-6 text-cyan-100/90">{description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <a
                href="#goal"
                className="group border-t border-cyan-200/30 px-1 py-5 text-white transition hover:-translate-y-0.5 hover:bg-cyan-950/20"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Brand new?</p>
                <h3 className="mt-2 text-lg font-bold">Follow the next 4 sections</h3>
                <p className="mt-2 text-sm leading-6 text-cyan-50">Goal, setup, one turn, then your first round.</p>
              </a>
              <a
                href="#faq"
                className="group border-t border-cyan-200/30 px-1 py-5 transition hover:-translate-y-0.5 hover:bg-cyan-950/20"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Already playing?</p>
                <h3 className="mt-2 text-lg font-bold text-white">Jump to the FAQ</h3>
                <p className="mt-2 text-sm leading-6 text-cyan-100/90">Search the questions that stop games most often.</p>
              </a>
            </div>
          </section>

          <section id="goal" className="scroll-mt-24">
            <SectionHeading number="01" title="How to win">
              Build an ecosystem whose cards add up to the agreed Victory Point
              target. Protecting your points matters as much as gaining them.
            </SectionHeading>

            <div className="mt-7 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="border-t border-cyan-200/25 py-6 text-white md:py-8">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">The winning rule</p>
                <p className="mt-3 text-2xl font-black leading-9 md:text-3xl">
                  Reach the VP target and lead the table with points currently in play.
                </p>
                <p className="mt-3 text-sm leading-6 text-cyan-100/90">
                  Finish resolving the play or effect first. If players reach the
                  target together, the highest VP wins. An equal lead means play
                  continues until one player leads at or above the target.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="border-t border-white/15 py-4">
                    <p className="text-3xl font-black text-amber-300">10 VP</p>
                    <p className="mt-1 text-sm text-cyan-100/90">Best for a first or quick game</p>
                  </div>
                  <div className="border-t border-white/15 py-4">
                    <p className="text-3xl font-black text-cyan-300">30 VP</p>
                    <p className="mt-1 text-sm text-cyan-100/90">Recommended full game</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-l-2 border-amber-300/50 bg-amber-950/20 p-5">
                  <h3 className="font-bold text-amber-100">VP can go back down</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-100/90">
                    If a VP card leaves your ecosystem—or a conditional VP requirement
                    stops being true—subtract those points.
                  </p>
                </div>
                <div className="border-l-2 border-rose-300/50 bg-rose-950/20 p-5">
                  <h3 className="font-bold text-rose-100">The deck-out loss</h3>
                  <p className="mt-2 text-sm leading-6 text-rose-100/90">
                    If you must draw and both of your personal decks are depleted,
                    you lose.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="setup" className="scroll-mt-24">
            <SectionHeading number="02" title="Set up the table">
              Each player’s 60 cards become two personal decks. The Conditions Deck
              is separate and shared by everyone.
            </SectionHeading>

            <div className="mt-7 border-y border-white/15 py-5 md:py-7">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Foundation Deck", "Coral, Creature Schools, and their stages", "bg-amber-950/20 text-amber-100"],
                  ["Main Deck", "Creatures, Support cards, and Habitat cards", "bg-cyan-950/20 text-cyan-100"],
                  ["Conditions Deck", "One separate shared deck; affects everybody", "bg-violet-950/20 text-violet-100"],
                ].map(([name, description, color]) => (
                  <div key={name} className={`rounded-2xl p-5 ${color}`}>
                    <h3 className="text-lg font-bold">{name}</h3>
                    <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm leading-6 text-cyan-100/90">
                The <strong>Main Deck</strong> is also called the <strong>Pals Deck</strong> on some cards and in the simulator. Both names mean the same pile.
              </p>

              <div className="mt-5 rounded-2xl border border-cyan-200/20 bg-cyan-950/15 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">Simple table map</p>
                <div className="mt-4 grid gap-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-cyan-50 sm:grid-cols-[0.7fr_1.6fr_0.7fr]">
                  <div className="rounded-xl border-2 border-dashed border-amber-300/50 bg-amber-950/15 px-3 py-5">Foundation Deck</div>
                  <div className="rounded-xl border-2 border-cyan-300/50 bg-cyan-950/15 px-3 py-5">Your ecosystem</div>
                  <div className="rounded-xl border-2 border-dashed border-blue-300/50 bg-blue-950/15 px-3 py-5">Main Deck</div>
                </div>
                <div className="mt-3 grid gap-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-cyan-50 sm:grid-cols-3">
                  <div className="rounded-xl border border-amber-200/20 bg-amber-950/20 px-3 py-3 text-amber-100">RP bank</div>
                  <div className="rounded-xl border border-violet-200/20 bg-violet-950/20 px-3 py-3 text-violet-100">Shared Conditions</div>
                  <div className="rounded-xl border border-white/15 bg-cyan-950/15 px-3 py-3">Discard</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-t border-white/15 py-6">
                <h3 className="text-xl font-bold text-white">Bring to the table</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-cyan-100/90">
                  <CheckItem>One legal deck per player, separated into two piles</CheckItem>
                  <CheckItem>One shared Conditions Deck</CheckItem>
                  <CheckItem>RP counters plus damage or HP counters</CheckItem>
                  <CheckItem>A coin; a D20 for 3–4 players; and the dice named on your cards</CheckItem>
                </ul>
              </div>

              <div className="border-t border-cyan-200/25 py-6 text-white">
                <h3 className="text-xl font-bold">Opening setup, in order</h3>
                <ol className="mt-5 space-y-4 text-sm leading-6 text-cyan-50">
                  {[
                    "Choose the first player using the coin toss or dice rule below.",
                    "Draw 4 cards from your Foundation Deck.",
                    "Draw 4 cards from your Main Deck. You now have 8 cards.",
                    "Place 3 RP in your RP bank.",
                    "Check your Foundation hand for a base Foundation you can play with 3 RP. If you cannot play one, redraw that Foundation hand.",
                    "Pay the starting Foundation's RP cost and place it in your ecosystem.",
                    "Once everyone has a starting Foundation, begin round one.",
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-300 text-xs font-black text-slate-950">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <p className="mt-4 border-l-2 border-amber-300/50 bg-amber-950/20 px-5 py-4 text-sm leading-6 text-amber-100">
              <strong>Who goes first?</strong> {FIRST_PLAYER_RULE.text}
            </p>
          </section>

          <section id="turn" className="scroll-mt-24">
            <SectionHeading number="03" title="Take a turn: Choose, Collect, Build, Attack">
              Say the four words out loud for the first few turns. The rhythm becomes
              automatic quickly.
            </SectionHeading>

            <ol className="mt-7 grid gap-4 md:grid-cols-2">
              {turnSteps.map((step) => (
                <li key={step.name} className={`border-t p-5 ${step.color}`}>
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/20 bg-cyan-950/25 text-sm font-black">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="text-xl font-black">{step.name}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] opacity-85">{step.prompt}</p>
                      <p className="mt-3 text-sm leading-6 opacity-85">{step.description}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 border-l-2 border-amber-300/50 bg-amber-950/20 p-5">
              <h3 className="font-bold text-amber-100">Before you pass the turn</h3>
              <p className="mt-2 text-sm leading-6 text-amber-100/90">
                Resolve end-of-turn effects and check any Habitat cards you have in
                play. Coral Reef, Open Ocean, and Abyss each lose 10 HP if their
                required mix of cards is missing.
                Then the next player takes a turn. After everyone has taken a turn,
                start the next round with a new shared Condition.
              </p>
            </div>

            <div data-rules-ignore className="mt-5 border-t border-cyan-200/25 py-5">
              <h3 className="font-bold text-white">Playing in the simulator?</h3>
              <p className="mt-2 text-sm leading-6 text-cyan-100/90">
                At the table, follow Choose → Collect → Build → Attack. The
                simulator collects RP before the draw prompt, then lets you play
                cards, use abilities, and attack in one combined action phase.
                When you play with physical cards, finish Build before Attack.
              </p>
            </div>
          </section>

          <section id="first-round" className="scroll-mt-24">
            <SectionHeading number="04" title="Play the first round together">
              A round starts with one shared Condition. Then each player takes a
              complete turn.
            </SectionHeading>

            <div className="mt-7 overflow-hidden border-y border-white/15">
              <div className="border-b border-violet-200/25 bg-violet-950/20 px-6 py-5 text-white">
                <h3 className="text-xl font-bold">Start of round: reveal a Condition</h3>
                <p className="mt-2 text-sm leading-6 text-violet-100">
                  Read it aloud and apply its printed effect to everyone for the stated duration.
                </p>
                <p className="mt-2 text-sm leading-6 text-violet-100">
                  If the Conditions Deck is empty, shuffle its discarded cards into
                  a new deck. Keep persistent Conditions aside, with used benefits
                  still marked as used.
                </p>
              </div>
              <div className="grid gap-0 md:grid-cols-2">
                <div className="p-6">
                  <h3 className="font-bold text-white">The table-talk script</h3>
                  <ol className="mt-4 space-y-3 text-sm leading-6 text-cyan-100/90">
                    <li><strong>1.</strong> “Which deck are you choosing?”</li>
                    <li><strong>2.</strong> “Add 1 RP. What do your Foundations produce?”</li>
                    <li><strong>3.</strong> “What can you afford, and where can it legally go?”</li>
                    <li><strong>4.</strong> “Does one of your cards have a legal attack?”</li>
                  </ol>
                </div>
                <div className="border-t border-cyan-200/20 bg-cyan-950/15 p-6 md:border-l md:border-t-0">
                  <h3 className="font-bold text-white">Pause only for these checks</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-cyan-100/90">
                    <CheckItem>Can the player pay the full RP and additional cost?</CheckItem>
                    <CheckItem>Does the Pal match its habitat and legal space?</CheckItem>
                    <CheckItem>Does the attack icon allow that target?</CheckItem>
                    <CheckItem>Did the current Condition change the rule?</CheckItem>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-start justify-between gap-4 border-y border-cyan-200/25 py-6 text-white sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xl font-bold">You now know enough to start.</h3>
                <p className="mt-2 text-sm text-cyan-50">Use the sections below only when the game asks for them.</p>
              </div>
              <Link href="/simulator" className="shrink-0 rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-amber-200">
                Practice a turn →
              </Link>
            </div>
          </section>

          <section id="read-a-card" className="scroll-mt-24">
            <SectionHeading number="05" title="Read a card without reading every word">
              Start with the corners and labels. Read the full rules box only when
              you are about to play or use the card.
            </SectionHeading>

            <div className="mt-7 grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div className="p-4">
                <Image
                  src="/images/cards/fish/Reef/picasso-triggerfish.webp"
                  alt="Picasso Triggerfish SeaRealm card used as a reading example"
                  width={500}
                  height={700}
                  className="mx-auto h-auto w-full max-w-sm rounded-2xl shadow-lg"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["1", "VP", "Top-left score. It counts only while this card is in play."],
                  ["2", "Name, kind & habitat", "Identify what the card is and whether it is Reef, Oceanic, or Deep."],
                  ["3", "RP cost", "Top-right amount paid when the card is played."],
                  ["4", "Requirements", "Checks that must already be true before you pay the cost."],
                  ["5", "Rules labels", "Passive is ongoing, On Play happens once, and Action is chosen and paid."],
                  ["6", "Attack & Defense", "The attack lists die, legal targets, and count; Defense is the opposing roll."],
                ].map(([number, title, text]) => (
                  <div key={title} className="border-t border-white/15 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-700 text-xs font-black text-white">{number}</span>
                      <h3 className="font-bold text-white">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-cyan-100/90">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-y border-white/15 py-6 text-white">
              <h3 className="text-xl font-bold">Four different labels answer four different questions</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Card kind", "Creature, Coral, Support, Habitat, or Condition"],
                  ["Habitat zone", "Reef, Oceanic, or Deep"],
                  ["Creature class", "Fish, Predator, Apex, Invertebrate, or Filter Feeder"],
                  ["Subtype", "A narrower printed identity, such as Baitball"],
                ].map(([title, text]) => (
                  <div key={title} className="border-t border-white/15 py-4">
                    <h3 className="font-bold text-cyan-200">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-cyan-100/90">{text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-cyan-100/90">
                A Deep Predator and a Reef Predator share the Predator class, but
                their habitat zones are different. Both labels matter.
              </p>
            </div>
          </section>

          <section id="slots" className="scroll-mt-24">
            <SectionHeading number="06" title="Place cards: match habitat first, then class">
              A legal play must satisfy both checks unless specific card text creates
              an exception.
            </SectionHeading>

            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <div className="border-t border-cyan-200/25 py-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Check 1</p>
                <h3 className="mt-2 text-xl font-bold text-white">Does the habitat match?</h3>
                <p className="mt-3 text-sm leading-6 text-cyan-100/90">
                  Reef creatures use compatible Reef slots. Deep creatures use
                  compatible Deep slots. They do not cross between those habitats
                  unless a printed rule says they can.
                </p>
              </div>
              <div className="border-t border-emerald-200/25 py-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Check 2</p>
                <h3 className="mt-2 text-xl font-bold text-white">Does the class fit?</h3>
                <p className="mt-3 text-sm leading-6 text-cyan-100/90">
                  A slot’s icon tells you the largest class it can hold. The hierarchy
                  applies only inside the matching habitat.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden border-y border-white/15">
              {[
                ["Fish slot", `${iconBase}/fish-any.png`, ["Fish"]],
                ["Predator slot", `${iconBase}/predator-any.png`, ["Fish", "Predator"]],
                ["Apex slot", `${iconBase}/apex-any.png`, ["Fish", "Predator", "Apex"]],
                ["Invertebrate slot", `${iconBase}/invertebrate_any.png`, ["Invertebrate"]],
                ["Filter Feeder slot", `${iconBase}/filter-feeder-any.png`, ["Filter Feeder"]],
              ].map(([slot, icon, accepts]) => (
                <div key={slot} className="grid gap-4 border-b border-white/10 p-5 last:border-0 sm:grid-cols-[190px_1fr] sm:items-center">
                  <div className="flex items-center gap-3">
                    <CardIcon src={icon} alt="" size={42} />
                    <h3 className="font-bold text-white">{slot}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100/75">Can hold</span>
                    {accepts.map((item) => (
                      <span key={item} className="rounded-full bg-cyan-950/20 px-3 py-1.5 text-sm font-bold text-cyan-100 ring-1 ring-cyan-200/20">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="border-l-2 border-blue-300/40 bg-blue-950/15 p-6 text-white">
                <div className="flex items-center gap-3">
                  <CardIcon src={`${iconBase}/oceanic-fish-icon.png`} alt="Oceanic Fish icon" size={48} />
                  <h3 className="text-xl font-bold">Oceanic creatures use open water</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-blue-100">
                  Non-school Oceanic creatures are not placed into Reef or Deep Coral
                  slots. Creature Schools form the Oceanic Foundation and supply School
                  Density; cards may also require an enabling Habitat such as Open Ocean.
                </p>
              </div>
              <div className="border-l-2 border-amber-300/50 bg-amber-950/20 p-6">
                <h3 className="text-xl font-bold text-amber-100">Upgrading Coral</h3>
                <p className="mt-3 text-sm leading-6 text-amber-100/90">
                  Have the next stage in hand, meet its requirement, and pay its RP
                  cost. Place it over the current stage. Existing damage stays, and a
                  Coral normally upgrades only once per turn.
                </p>
              </div>
            </div>
          </section>

          <section id="combat" className="scroll-mt-24">
            <SectionHeading number="07" title="Attack and defend">
              Read the attack indicator from left to right: die, legal target icons,
              then attack count.
            </SectionHeading>

            <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="border-t border-cyan-200/25 py-6">
                <h3 className="text-xl font-bold text-white">The attack indicator</h3>
                <div className="mt-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
                  <Image
                    src={`${iconBase}/attack-icon.png`}
                    alt="SeaRealm attack indicator showing attack die, legal target icons, and repeated attack count"
                    width={520}
                    height={260}
                    className="mx-auto h-auto w-full max-w-md"
                  />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Die", "D8 means roll an 8-sided die."],
                    ["Targets", "Every icon is a legal target family."],
                    ["Count", "×2 means two separate attacks."],
                  ].map(([title, text]) => (
                    <div key={title} className="border-t border-cyan-200/20 py-4">
                      <h3 className="font-bold text-cyan-50">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-cyan-100">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-cyan-200/25 py-6 text-white">
                <h3 className="text-xl font-bold">Resolve a normal attack</h3>
                <ol className="mt-5 space-y-4 text-sm leading-6 text-cyan-100/90">
                  {[
                    "Choose a target allowed by the target icons and every printed restriction.",
                    "Roll the printed attack die. The target rolls its Defense die.",
                    "Apply valid + or − modifiers. A modified total cannot go below 0.",
                    "The attacker succeeds only if its final total is higher. A tie goes to the defender.",
                    "A successful normal attack destroys the defending creature unless an effect saves it. Put a destroyed Apex or Filter Feeder in its owner's Lost Zone; put other destroyed creatures in discard unless their text says otherwise.",
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-y border-white/15 py-5 text-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Attack</p>
                    <p className="mt-2 text-4xl font-black text-white">7</p>
                  </div>
                  <p className="text-2xl font-black text-amber-300">&gt;</p>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Defense</p>
                    <p className="mt-2 text-4xl font-black text-white">5</p>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm leading-6 text-cyan-100/90">
                  <strong className="text-white">7 beats 5: the attack succeeds.</strong>{" "}
                  If both totals were 5, the defender would stay in play.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="border-l-2 border-amber-300/50 bg-amber-950/20 p-6">
                <div className="flex items-center gap-3">
                  <CardIcon src={`${iconBase}/bait-ball-icon.png`} alt="Creature School icon" size={46} />
                  <h3 className="text-lg font-bold text-amber-100">Creature Schools take damage</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-amber-100/90">
                  Attacks that can target Fish can target Creature Schools, subject
                  to the attack&apos;s other restrictions. Schools do not roll Defense.
                  Damage equals the attack roll ×10. Discard the School at 0 HP.
                </p>
              </div>
              <div className="border-l-2 border-rose-300/50 bg-rose-950/20 p-6">
                <h3 className="text-lg font-bold text-rose-100">Repeated attacks use distinct targets</h3>
                <p className="mt-3 text-sm leading-6 text-rose-100/90">
                  Resolve each attack separately. During one repeated sequence, the
                  same physical target cannot be selected twice.
                </p>
              </div>
            </div>
          </section>

          <section id="advanced" className="scroll-mt-24">
            <div className="border-t border-cyan-200/25 py-6 text-white md:py-9">
              <p data-rules-ignore className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Complete reference</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Complete rules: look up a situation</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-cyan-100/90 md:text-lg">
                Open the topic you need when a question comes up. A card’s more
                specific printed text wins when it
                clearly creates an exception.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <RuleDetails
                open
                title="Deck construction and card routing"
                summary="60 cards, copy limits, printed VP, and which personal deck holds each card"
              >
                <ul className="space-y-2">
                  <li>• A standard personal deck contains exactly <strong>60 cards</strong>, no more than <strong>4 copies</strong> of one card, at least one base Foundation, and at least <strong>30 total printed VP</strong>.</li>
                  <li>• “30 printed VP in your deck” is a construction rule. “30 current VP in play” is the recommended full-game win target.</li>
                  <li>• Coral, Creature Schools, and their stages go in the Foundation Deck.</li>
                  <li>• Regular creatures, Support cards, and playable Habitat cards go in the Main Deck.</li>
                  <li>• Conditions use a separate shared deck and are not part of either player’s 60 cards.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Coral, Foundations, damage, and destruction"
                summary="Upgrades, Stunned Coral, weaknesses, and creatures displaced by destruction"
              >
                <ul className="space-y-2">
                  <li>• Upgrade only to the next printed stage during Build. Meet its requirement, pay its RP cost, and place it over the current card.</li>
                  <li>• Existing damage remains through an upgrade. The higher stage changes maximum HP as printed; it does not fully heal the Coral.</li>
                  <li>• A Coral normally upgrades only once per turn.</li>
                  <li>• When a Condition matches a Coral weakness, that Coral does not produce RP for the round. The weakness alone does not remove or damage it.</li>
                  <li>• A destroyed Foundation leaves play for discard and its VP immediately stops counting.</li>
                  <li>• Move creatures from a destroyed Foundation into compatible empty slots when possible. Creatures with no legal slot remain displaced until a compatible slot becomes available or another rule moves them.</li>
                  <li>• A <strong>Stunned</strong> Coral produces no RP, cannot use its own Actions or Passives, and cannot be upgraded through the end of its controller&apos;s next turn. Coral Heal removes Stunned early because it removes all effects from the chosen Coral.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Oceanic ecosystems and School Density"
                summary="Creature Schools supply capacity; creatures commit it while in play"
              >
                <ul className="space-y-2">
                  <li>• Creature Schools are Oceanic Foundations with School Density and HP.</li>
                  <li>• Add the School Density on your Creature Schools to find your total capacity. After reductions, each density-using creature commits its effective requirement while it remains in play, so those requirements add together.</li>
                  <li>• Committed capacity becomes available again when that creature leaves. School Density is not permanently spent like RP: the capacity remains on the Creature School instead of leaving a bank.</li>
                  <li>• If a Creature School leaves or changes and your commitments exceed the new capacity, keep the creatures already in play. You cannot play another creature with a positive School Density requirement until enough capacity is restored.</li>
                  <li>• Non-school Oceanic creatures live in open water rather than Reef or Deep Coral slots. Obey any printed School Density and Habitat requirements.</li>
                  <li>• Creature Schools do not roll Defense. An attack deals the attack roll ×10 as damage, and the School is discarded at 0 HP.</li>
                  <li>• Oceanic Apex requirements are card-specific. Shortfin Mako, Sperm Whale, Pilot Whale, and Killer Whale require Open Ocean and 2 Oceanic Predators already in your ecosystem; those Predators stay in play. Bluefin Tuna requires Open Ocean, while Swordfish allows Open Ocean or Abyss.</li>
                  <li>• Ocean Triggerfish&apos;s Territorial gives 1 chosen Creature School +30 HP while that Triggerfish remains in play. The choice is not transferable.</li>
                  <li>• Thresher Shark requires 3 Oceanic Fish. Its Stun Strike adds +2 when the attack roll is 4 or higher; that bonus does not require Open Ocean.</li>
                  <li>• Sardine Run and Krill Bloom can reduce the next qualifying School Density requirement once per player as printed.</li>
                </ul>
                <p className="mt-4 border-l-2 border-cyan-200/30 bg-cyan-950/20 p-4 text-cyan-100">
                  <strong>Density example:</strong> your Schools supply 100 Density.
                  A creature requiring 70 leaves 30 available for other creatures.
                  When that creature leaves play, its 70 becomes available again,
                  as long as your Schools still supply the same capacity.
                </p>
              </RuleDetails>

              <RuleDetails
                title="Abilities, timing, and Support cards"
                summary="Passive, On Play, Action, Special Rules, searching, and recovery"
              >
                <ul className="space-y-2">
                  <li>• A <strong>Passive</strong> is active while its card remains in play and its printed condition is true.</li>
                  <li>• An <strong>On Play</strong> ability resolves when a card is successfully played. It does not repeat each turn.</li>
                  <li>• An <strong>Action</strong> is chosen at its printed timing: pay its cost, choose legal targets, and resolve its instructions in order.</li>
                  <li>• <strong>Special Rules</strong> has no universal effect. Apply the exact text on that card.</li>
                  <li>• A Support normally resolves and goes to discard unless it explicitly remains in play. You may play one Aide per turn and any number of Items, including after an Aide.</li>
                  <li>• Search the named deck or zone for a matching card, reveal or move it as instructed, and shuffle when required. Recovery moves an eligible card from discard to its stated destination.</li>
                  <li>• Moving a physical card does not reset its identity or a once-per-turn use that belongs to it.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Lost Zone"
                summary="Destroyed Apex and Filter Feeder cards do not enter the discard pile"
              >
                <ul className="space-y-2">
                  <li>• When an <strong>Apex</strong> or <strong>Filter Feeder</strong> is destroyed, place that physical card in its owner's Lost Zone instead of the discard pile.</li>
                  <li>• A card in the Lost Zone is no longer in play, so its VP and in-play abilities stop applying immediately.</li>
                  <li>• Destroying Lionfish sends it to its original owner's Lost Zone. Spearfishing explicitly discards it to its original owner's discard pile.</li>
                  <li>• An Apex or Filter Feeder discarded as a cost, sacrifice, hand-limit overflow, or card effect goes to discard unless that instruction explicitly names the Lost Zone.</li>
                  <li>• Other destroyed cards go to discard unless their own printed text gives them another destination.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Lionfish Invader"
                summary="The host starts the trigger; the Lionfish owner determines target perspective"
              >
                <ul className="space-y-2">
                  <li>• Invader triggers at the start of the turn of the player whose ecosystem physically contains Lionfish.</li>
                  <li>• Ownership does not change when Lionfish invades another ecosystem. Resolve “opponent” and “your own” from the Lionfish owner's perspective.</li>
                  <li>• On heads, perform the D4 attack against a Fish controlled by the Lionfish owner's opponent, normally the ecosystem holder. On tails, attack another Fish controlled by the Lionfish owner.</li>
                  <li>• The triggering Lionfish is not a legal target. Flip before choosing a target; if the rolled branch has no legal Fish, that attack fizzles and you do not switch branches.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Combat keywords and dice"
                summary="Advantage, disadvantage, Toxic, Regenerate, Cloak, Transparency, and Massive"
              >
                <ul className="space-y-2">
                  <li>• D4, D6, D8, D10, D12, and D20 name dice with that many sides. Apply a written + or − after rolling; modified totals cannot fall below 0.</li>
                  <li>• <strong>Advantage</strong> rolls twice and keeps the higher result. <strong>Disadvantage</strong> rolls twice and keeps the lower result.</li>
                  <li>• <strong>Toxic When Eaten</strong> triggers only when a creature successfully consumes that Toxic card, unless explicit immunity or protection applies.</li>
                  <li>• <strong>Regenerate</strong> is optional. When a creature with Regenerate is successfully attacked, its controller may pay the printed RP cost to keep it in play.</li>
                  <li>• <strong>Cloak</strong> does not make a creature untargetable; current Cloak cards grant their printed +3 Defense benefit.</li>
                  <li>• <strong>Transparency</strong> checks the attack’s printed die size, not the modified result.</li>
                  <li>• <strong>Massive</strong> is not identical on every card. Read whether that card changes the attack roll or Defense roll.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Habitats, hosted cards, and continuous HP"
                summary="Persistent Habitats, attachments, capacity, and health bonuses"
              >
                <ul className="space-y-2">
                  <li>• Habitat cards are played from the Main Deck and remain as independent cards in the ecosystem. Each physical copy tracks its own HP and effects.</li>
                  <li>• Coral Reef, Open Ocean, and Abyss each have 40 HP. Check each copy at the end of its controller&apos;s turn; a copy whose full composition is not met takes 10 damage and is destroyed at 0 HP. Follow other Habitats&apos; own printed rules.</li>
                  <li>• Coral Reef requires 4 Reef Corals, 2 Reef Fish, and 2 Reef Invertebrates.</li>
                  <li>• Open Ocean requires 4 Creature Schools, 2 Oceanic Fish, and 2 Oceanic Invertebrates.</li>
                  <li>• Abyss requires 4 Deep Corals, 2 Deep Fish, and 2 Deep Invertebrates.</li>
                  <li>• Open Ocean and Abyss enable their related strategies. A Deep creature can attack targets in other habitats when its target icons allow it; only an explicit Deep-only restriction limits it to Deep targets.</li>
                  <li>• Hosted or attached cards are legal only when printed text permits the host, tag, and capacity. The hosted card keeps its own physical identity.</li>
                  <li>• A hosted card moves with its primary host only when the applicable rule says it does.</li>
                  <li>• Continuous HP bonuses raise current and maximum HP while active without erasing damage. Removing the bonus reduces both; a card at 0 HP is destroyed.</li>
                </ul>
              </RuleDetails>

              <RuleDetails
                title="Conditions, limits, and overflow"
                summary="Shared round effects, the RP cap, hand limits, and mandatory draws"
              >
                <ul className="space-y-2">
                  <li>• Reveal and apply a shared Condition at the start of each round. Read its printed duration; some effects last for the round and some are persistent until used.</li>
                  <li>• Conditions can prevent card types from being played, change RP costs or bank caps, add draws, set a hand limit, suppress Coral RP, or reduce School Density requirements.</li>
                  <li>• The default RP bank cap is 8. When the active cap becomes lower, discard RP above it as instructed.</li>
                  <li>• There is no default hand limit. If a Condition sets one, complete the draw, search, or recovery first; then, if your hand is over the limit, choose and discard enough cards from your entire hand to meet it.</li>
                  <li>• A required draw causes a loss when both personal decks are depleted.</li>
                  <li>• VP counts only while its card is in the ecosystem and any printed VP condition remains true.</li>
                </ul>
              </RuleDetails>

              {TABLETOP_PROCEDURES.map((rule) => (
                <RuleDetails
                  key={rule.id}
                  id={rule.sourceHref.split("#")[1]}
                  title={rule.title}
                  summary={rule.summary}
                >
                  <p>{rule.text}</p>
                </RuleDetails>
              ))}
            </div>

          </section>

          <section id="glossary" className="scroll-mt-24">
            <SectionHeading number="REF" title="Glossary">
              Short definitions for the words most likely to come up during a game.
            </SectionHeading>

            <dl className="mt-7 grid gap-3 sm:grid-cols-2">
              {glossary.map(([term, definition]) => (
                <div key={term} className="border-t border-white/15 py-5">
                  <dt className="font-black text-cyan-100">{term}</dt>
                  <dd className="mt-2 text-sm leading-6 text-cyan-100/90">{definition}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 border-t border-cyan-200/25 py-6">
              <h3 className="text-lg font-bold text-white">Target icon shortcut</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  ["Any Fish", `${iconBase}/fish-any.png`],
                  ["Any Predator", `${iconBase}/predator-any.png`],
                  ["Any Apex", `${iconBase}/apex-any.png`],
                  ["Any Creature", `${iconBase}/any-creature.png`],
                ].map(([label, icon]) => (
                  <div key={label} className="flex items-center gap-2 rounded-full bg-cyan-950/15 py-2 pl-2 pr-4 ring-1 ring-white/15">
                    <CardIcon src={icon} alt="" size={36} />
                    <span className="text-sm font-bold text-cyan-50">{label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-cyan-100/90">
                A colored circle with a star means any subtype in the pictured family.
                The target must still satisfy habitat, controller, visibility, and
                specific card-text restrictions.
              </p>
            </div>
          </section>

          <section id="faq" className="scroll-mt-24">
            <SectionHeading number="FAQ" title="Questions that stop games most often">
              Search a word, open one answer, and get everyone back to playing.
            </SectionHeading>

            <div className="mt-7">
              <Faq questions={faqQuestions} />
            </div>

            <div className="mt-7 border-t border-white/15 py-7 text-white md:flex md:items-center md:justify-between md:gap-8">
              <div>
                <h3 className="text-2xl font-black">Still not sure?</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-100/90">
                  Ask Finn in plain language. Finn uses this guide and the structured
                  SeaRealm rules knowledge to answer without guessing.
                </p>
              </div>
              <AskFinnButton className="mt-5 shrink-0 rounded-full bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-200 md:mt-0">
                Ask Finn now
              </AskFinnButton>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
