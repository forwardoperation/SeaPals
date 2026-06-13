import Image from "next/image";

export const metadata = {
  title: "How to Play | SeaPals TCG",
  description: "Learn the core rules, setup, card types, and attack flow for SeaPals TCG.",
};

const docId = "1k7GxLQC_imLxc6d9n_dxsq0CqQtJ0lPzwARsrBNLifA";
const fullUrl = `https://docs.google.com/document/d/${docId}/edit?tab=t.0`;

const iconBase = "/images/icons";

const creatureTypes = [
  {
    name: "Filter Feeders",
    icon: `${iconBase}/filter-feeder-any.png`,
    color: "bg-blue-50 text-blue-800 ring-blue-200",
    description:
      "Rare open-water giants that are expensive to play and highly rewarding when feeding conditions are met.",
    subtypes: [
      {
        name: "Filter Feeder",
        icon: `${iconBase}/filter-feeder-icon.png`,
        description:
          "A specific filter-feeder icon. These Pals usually require a feeding event or enough school density before they can enter play.",
      },
      {
        name: "Any Filter Feeder",
        icon: `${iconBase}/filter-feeder-any.png`,
        description:
          "A target icon that means this effect can choose any Filter Feeder subtype now or in future sets.",
      },
    ],
  },
  {
    name: "Apex Predators",
    icon: `${iconBase}/apex-any.png`,
    color: "bg-rose-50 text-rose-800 ring-rose-200",
    description:
      "The most powerful hunters, usually expensive to play and able to swing the board with major attacks.",
    subtypes: [
      {
        name: "Reef Apex",
        icon: `${iconBase}/reef-apex_icon.png`,
        description:
          "Apex Pals that live in reef habitats and usually depend on coral slots.",
      },
      {
        name: "Oceanic Apex",
        icon: `${iconBase}/oceanic-apex-icon.png`,
        description:
          "Open-water apex hunters that usually depend on school density or oceanic play requirements.",
      },
      {
        name: "Deep Apex",
        icon: `${iconBase}/deep-apex-icon.png`,
        description:
          "Deep-sea apex creatures that interact with Abyss, darkness, and deep targeting rules.",
      },
      {
        name: "Any Apex",
        icon: `${iconBase}/apex-any.png`,
        description:
          "A red star target icon. It can target any Apex subtype.",
      },
    ],
  },
  {
    name: "Predators",
    icon: `${iconBase}/predator-any.png`,
    color: "bg-lime-50 text-lime-800 ring-lime-200",
    description:
      "Tactical attackers that pressure fish, predators, and key targets while balancing the ecosystem.",
    subtypes: [
      {
        name: "Reef Predator",
        icon: `${iconBase}/reef-predator-icon.png`,
        description:
          "Predators played into reef slots. They often hunt Fish or other Predators.",
      },
      {
        name: "Oceanic Predator",
        icon: `${iconBase}/oceanic-predator-icon.png`,
        description:
          "Fast open-water predators that often care about school density, Creature Schools, or Open Ocean.",
      },
      {
        name: "Deep Predator",
        icon: `${iconBase}/deep-predator-icon.png`,
        description:
          "Deep predators that may gain power from Abyss or interact with hidden deep creatures.",
      },
      {
        name: "Any Predator",
        icon: `${iconBase}/predator-any.png`,
        description:
          "A target icon that can choose any Predator subtype.",
      },
    ],
  },
  {
    name: "Fish",
    icon: `${iconBase}/fish-any.png`,
    color: "bg-teal-50 text-teal-800 ring-teal-200",
    description:
      "Low-cost ecosystem builders that fill many slots, create tempo, and become common attack targets.",
    subtypes: [
      {
        name: "Reef Fish",
        icon: `${iconBase}/reef-fish-icon.png`,
        description:
          "Fish that live on coral reefs and are usually placed into Fish, Predator, or Apex slots.",
      },
      {
        name: "Oceanic Fish",
        icon: `${iconBase}/oceanic-fish-icon.png`,
        description:
          "Open-water fish that help support school-density strategies and oceanic food chains.",
      },
      {
        name: "Deep Fish",
        icon: `${iconBase}/deep-fish-icon.png`,
        description:
          "Deep-sea fish that often use Abyss, darkness, visibility, or deep-only targeting.",
      },
      {
        name: "Bait Ball",
        icon: `${iconBase}/bait-ball-icon.png`,
        description:
          "An oceanic Fish foundation. Creature Schools create school density and take attack-roll damage times 10.",
      },
      {
        name: "Any Fish",
        icon: `${iconBase}/fish-any.png`,
        description:
          "A target icon that can choose any Fish subtype, including Creature Schools when the attack can target fish.",
      },
    ],
  },
  {
    name: "Invertebrates",
    icon: `${iconBase}/invertebrate_any.png`,
    color: "bg-amber-50 text-amber-900 ring-amber-200",
    description:
      "Efficient utility creatures with defensive tricks, poison, RP boosts, and other tactical effects.",
    subtypes: [
      {
        name: "Reef Invertebrate",
        icon: `${iconBase}/reef-invertebrate-icon.png`,
        description:
          "Reef utility creatures that usually occupy invertebrate slots and create tactical effects.",
      },
      {
        name: "Oceanic Invertebrate",
        icon: `${iconBase}/oceanic-invertebrate-icon.png`,
        description:
          "Open-water invertebrates that support oceanic decks with disruption, poison, or school-density plays.",
      },
      {
        name: "Deep Invertebrate",
        icon: `${iconBase}/deep-invertebrate-icon.png`,
        description:
          "Deep invertebrates that often provide RP boosts, search effects, or Abyss interactions.",
      },
      {
        name: "Any Invertebrate",
        icon: `${iconBase}/invertebrate_any.png`,
        description:
          "A target icon that can choose any Invertebrate subtype.",
      },
    ],
  },
  {
    name: "Coral",
    icon: `${iconBase}/coral-any.png`,
    color: "bg-yellow-50 text-yellow-900 ring-yellow-200",
    description:
      "The foundation of reef habitats. Coral generates RP, provides HP, and creates slots for reef creatures.",
    subtypes: [
      {
        name: "Reef Coral",
        icon: `${iconBase}/reef-coral-icon.png`,
        description:
          "The main reef foundation. Reef coral creates slots, produces RP, and can often be upgraded.",
      },
      {
        name: "Deep Coral",
        icon: `${iconBase}/deep-coral-icon.png`,
        description:
          "A deep foundation that supports deep ecosystems and may interact with Abyss or deep creatures.",
      },
      {
        name: "Any Coral",
        icon: `${iconBase}/coral-any.png`,
        description:
          "A target icon that can choose any Coral subtype.",
      },
    ],
  },
  {
    name: "Habitat",
    icon: `${iconBase}/environment_icon.png`,
    color: "bg-slate-50 text-slate-800 ring-slate-200",
    description:
      "Playable habitat cards that change what your ecosystem can support, such as Marine Sanctuary, Open Ocean, or Abyss.",
    subtypes: [
      {
        name: "Reef Habitat",
        icon: `${iconBase}/environment_icon.png`,
        description:
          "Reef-focused habitat cards and structures that support coral reef strategies.",
      },
      {
        name: "Open Ocean",
        icon: `${iconBase}/environment_icon.png`,
        description:
          "An oceanic habitat signal that enables open-water Pals and school-density strategies.",
      },
      {
        name: "Abyss",
        icon: `${iconBase}/environment_icon.png`,
        description:
          "A deep habitat signal that enables deep Pals and special darkness or visibility rules.",
      },
    ],
  },
];

const deckTypes = [
  {
    name: "Foundation Deck",
    accent: "border-amber-300 bg-amber-50",
    description:
      "Your habitat engine. Reef play uses coral here; oceanic play can use Creature Schools and school-density foundations.",
    examples: "Base coral, coral upgrades, bait ball stages",
  },
  {
    name: "Pals Deck",
    accent: "border-cyan-300 bg-cyan-50",
    description:
      "Your active plays: creatures, support cards, playable habitat cards, and the tools that shape your board.",
    examples: "Fish, predators, support cards, Open Ocean, Abyss",
  },
  {
    name: "Conditions Deck",
    accent: "border-violet-300 bg-violet-50",
    description:
      "A shared deck revealed round by round. Conditions affect all players and can reshape the ecosystem.",
    examples: "Hurricane, Red Tide, Krill Ball, Sardine Run",
  },
];

const slotRows = [
  {
    slot: "Reef Fish Slot",
    icon: `${iconBase}/reef-fish-icon.png`,
    accepts: [
      { label: "Reef Fish", icon: `${iconBase}/reef-fish-icon.png` },
    ],
  },
  {
    slot: "Reef Predator Slot",
    icon: `${iconBase}/reef-predator-icon.png`,
    accepts: [
      { label: "Reef Predator", icon: `${iconBase}/reef-predator-icon.png` },
      { label: "Reef Fish", icon: `${iconBase}/reef-fish-icon.png` },
    ],
  },
  {
    slot: "Reef Apex Slot",
    icon: `${iconBase}/reef-apex_icon.png`,
    accepts: [
      { label: "Reef Apex", icon: `${iconBase}/reef-apex_icon.png` },
      { label: "Reef Predator", icon: `${iconBase}/reef-predator-icon.png` },
      { label: "Reef Fish", icon: `${iconBase}/reef-fish-icon.png` },
    ],
  },
  {
    slot: "Reef Invertebrate Slot",
    icon: `${iconBase}/reef-invertebrate-icon.png`,
    accepts: [
      {
        label: "Reef Invertebrate",
        icon: `${iconBase}/reef-invertebrate-icon.png`,
      },
    ],
  },
  {
    slot: "Deep Fish Slot",
    icon: `${iconBase}/deep-fish-icon.png`,
    accepts: [
      { label: "Deep Fish", icon: `${iconBase}/deep-fish-icon.png` },
    ],
  },
  {
    slot: "Deep Predator Slot",
    icon: `${iconBase}/deep-predator-icon.png`,
    accepts: [
      { label: "Deep Predator", icon: `${iconBase}/deep-predator-icon.png` },
      { label: "Deep Fish", icon: `${iconBase}/deep-fish-icon.png` },
    ],
  },
  {
    slot: "Deep Apex Slot",
    icon: `${iconBase}/deep-apex-icon.png`,
    accepts: [
      { label: "Deep Apex", icon: `${iconBase}/deep-apex-icon.png` },
      { label: "Deep Predator", icon: `${iconBase}/deep-predator-icon.png` },
      { label: "Deep Fish", icon: `${iconBase}/deep-fish-icon.png` },
    ],
  },
  {
    slot: "Deep Invertebrate Slot",
    icon: `${iconBase}/deep-invertebrate-icon.png`,
    accepts: [
      {
        label: "Deep Invertebrate",
        icon: `${iconBase}/deep-invertebrate-icon.png`,
      },
    ],
  },
];

const turnSteps = [
  {
    name: "Choose",
    description: "Draw from your Foundation Deck or Pals Deck.",
  },
  {
    name: "Collect",
    description: "Gain 1 RP, then collect from your active foundations.",
  },
  {
    name: "Build",
    description: "Play cards, upgrade foundations, and use paid actions.",
  },
  {
    name: "Attack",
    description: "Resolve attacks one at a time against legal targets.",
  },
];

const coralUpgradeCards = [
  {
    label: "Base",
    image: "/images/cards/coral/Deep/bamboo-coral-base.png",
  },
  {
    label: "Stage 1",
    image: "/images/cards/coral/Deep/bamboo-coral-stage-1.png",
  },
  {
    label: "Stage 2",
    image: "/images/cards/coral/Deep/bamboo-coral-stage-2.png",
  },
];

const coralWeaknessExamples = [
  {
    condition: "Hurricane",
    weakness: "Storm",
    icon: `${iconBase}/conditions-storm-icon.png`,
    effect: "Corals with storm weakness do not produce RP this round.",
  },
  {
    condition: "Severe Coral Bleaching",
    weakness: "High Temperature",
    icon: `${iconBase}/conditions-heat-icon.png`,
    effect: "Corals with high-temperature weakness do not produce RP this round.",
  },
  {
    condition: "Coral Disease",
    weakness: "Disease",
    icon: `${iconBase}/conditions-disease-icon.png`,
    effect: "Corals with disease weakness do not produce RP this round.",
  },
];

function Icon({ src, alt, size = 48 }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="block shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: "contain",
      }}
    />
  );
}

function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      {children ? (
        <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
          {children}
        </p>
      ) : null}
    </div>
  );
}

export default function InstructionsPage() {
  return (
    <main className="pb-16">
      <section className="py-8 md:py-12">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-700">
            SeaPals TCG
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
            How to Play
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Build an ecosystem, grow your foundation, play Pals into legal habitats,
            and use attacks, actions, and conditions to reach the Victory Point goal.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="border-l-4 border-amber-400 bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-slate-950">30 VP</div>
              <p className="mt-1 text-sm text-slate-600">Recommended full game</p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-slate-950">10 VP</div>
              <p className="mt-1 text-sm text-slate-600">Quick game target</p>
            </div>
            <div className="border-l-4 border-rose-400 bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-slate-950">2-4</div>
              <p className="mt-1 text-sm text-slate-600">Players per game</p>
            </div>
          </div>
        </div>
      </section>

      <section className="my-10 border-y border-cyan-200 bg-white/75 px-5 py-8 md:px-8">
        <SectionHeader eyebrow="Game Goal" title="Win With VP In Play">
          The first player to reach the agreed Victory Point target wins. VP only
          counts while the card is in play; if a VP card leaves your ecosystem, you
          lose those points.
        </SectionHeader>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-slate-950 p-5 text-white">
            <h3 className="text-lg font-bold">Win</h3>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Reach the game target with VP currently in play. Use a higher target
              for a sprawling ecosystem or a lower target for a fast match.
            </p>
          </div>
          <div className="rounded-lg bg-rose-50 p-5 ring-1 ring-rose-200">
            <h3 className="text-lg font-bold text-rose-950">Lose</h3>
            <p className="mt-2 text-sm leading-6 text-rose-900">
              If you must draw and both your Foundation Deck and Pals Deck are
              depleted, you lose the game.
            </p>
          </div>
        </div>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Setup" title="Three Decks Drive the Game">
          Each player splits their 60-card deck into two personal decks. A separate
          shared Conditions Deck changes the round for everyone.
        </SectionHeader>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {deckTypes.map((deck) => (
            <article
              key={deck.name}
              className={`rounded-lg border-2 p-5 ${deck.accent}`}
            >
              <h3 className="text-xl font-bold text-slate-950">{deck.name}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {deck.description}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Examples
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {deck.examples}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-lg bg-white p-5 shadow-sm ring-1 ring-cyan-100">
          <h3 className="text-xl font-bold text-slate-950">Starting a Game</h3>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
            <li>1. Draw 4 cards from your Foundation Deck.</li>
            <li>2. Draw 4 cards from your Pals Deck.</li>
            <li>3. Start with 3 RP in your RP Bank.</li>
            <li>4. Spend setup RP to play valid starting foundation cards.</li>
            <li>5. If you cannot play a valid foundation, redraw your Foundation hand.</li>
            <li>6. Begin the first round once every player has a starting foundation.</li>
          </ol>
        </div>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Cards" title="How to Read a Card">
          Most cards use the same visual language: type icon, name, RP cost,
          Victory Points, abilities, and defense or foundation details.
        </SectionHeader>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-950">Pal Card</h3>
            <Image
              src={`${iconBase}/how-to-read-fish-icon.png`}
              alt="Diagram explaining how to read a Pal card"
              width={1200}
              height={900}
              className="mt-5 h-auto w-full rounded-lg bg-white"
            />
          </article>

          <article className="rounded-lg bg-amber-50 p-5 shadow-sm ring-1 ring-amber-200">
            <h3 className="text-xl font-bold text-amber-950">Coral Card</h3>
            <Image
              src={`${iconBase}/how-to-read-coral-icon.png`}
              alt="Diagram explaining how to read a Coral card"
              width={1200}
              height={900}
              className="mt-5 h-auto w-full rounded-lg bg-white"
            />
          </article>
        </div>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Turn Flow" title="Choose, Collect, Build, Attack">
          Each turn follows the same rhythm. Conditions happen at the start of the
          round, then each player moves through these four decisions.
        </SectionHeader>

        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {turnSteps.map((step, index) => (
            <li
              key={step.name}
              className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-xl font-bold text-slate-950">
                {step.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Attack" title="Read the Card, Pick a Target, Roll">
          The attack indicator shows the attack die, legal target types, and how
          many attacks are performed.
        </SectionHeader>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-950">
              Attack Indicator
            </h3>
            <div className="mt-5 rounded-lg bg-slate-50 p-5 ring-1 ring-slate-100">
              <Image
                src={`${iconBase}/attack-icon.png`}
                alt="Attack indicator showing attack die, target icons, and attack count"
                width={520}
                height={260}
                className="mx-auto h-auto w-full max-w-md"
              />
            </div>

            <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-slate-100">
              <div className="text-sm font-bold text-slate-950">
                Dice Reference
              </div>
              <Image
                src={`${iconBase}/dice-icons.png`}
                alt="Dice reference showing D4, D6, D8, D10, D12, D20, and percentile dice"
                width={640}
                height={360}
                className="mt-3 h-auto w-full"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                <div className="text-sm font-bold text-slate-950">Die</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Match the D-number on the attack icon to the dice reference.
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                <div className="text-sm font-bold text-slate-950">Targets</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Choose a legal target matching the target icons.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3 text-white">
                <div className="text-sm font-bold">Count</div>
                <p className="mt-1 text-xs leading-5 text-slate-200">
                  Resolve repeated attacks separately.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-950">
              Example Attack
            </h3>
            <div className="mt-5 grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-lg bg-blue-50 p-3 ring-1 ring-blue-100">
                <Image
                  src="/images/cards/predator/reef/spinner-dolphins.png"
                  alt="Spinner Dolphins card"
                  width={240}
                  height={336}
                  className="mx-auto h-auto max-h-[360px] w-auto"
                />
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm font-bold text-slate-800">
                  <span>Attack</span>
                  <span className="text-xl text-blue-800">D8</span>
                </div>
              </div>

              <div className="grid justify-items-center gap-3">
                <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  legal target
                </div>
                <div className="flex items-center gap-2">
                  <Icon src={`${iconBase}/predator-any.png`} alt="" size={38} />
                  <Icon src={`${iconBase}/fish-any.png`} alt="" size={38} />
                </div>
                <div className="text-4xl font-bold text-slate-950">vs</div>
              </div>

              <div className="rounded-lg bg-cyan-50 p-3 ring-1 ring-cyan-100">
                <Image
                  src="/images/cards/fish/Reef/picasso-triggerfish.png"
                  alt="Picasso Triggerfish card"
                  width={240}
                  height={336}
                  className="mx-auto h-auto max-h-[360px] w-auto"
                />
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm font-bold text-slate-800">
                  <span>Defense</span>
                  <span className="text-xl text-cyan-800">D6</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                Attacker must roll higher.
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                Ties go to the defender.
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                Success discards the defender.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-amber-50 p-5 ring-1 ring-amber-200">
            <div className="flex items-center gap-3">
              <Icon src={`${iconBase}/bait-ball-icon.png`} alt="" size={48} />
              <h3 className="text-lg font-bold text-amber-950">
                Bait balls take damage
              </h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-950">
              No defense roll. Damage equals attack roll x 10. At 0 HP, discard
              the bait ball.
            </p>
          </div>

          <div className="rounded-lg bg-slate-950 p-5 text-white">
            <h3 className="text-lg font-bold">Repeated attacks</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Resolve each attack separately. Modifiers apply to each attack, and
              the same target cannot be chosen twice in the sequence.
            </p>
          </div>
        </div>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Creature Language" title="Types and Target Icons">
          Type icons tell you the broad family of a card. Subtype icons tell you
          which habitat version it belongs to, such as reef, oceanic, deep, or bait ball.
        </SectionHeader>

        <div className="mt-8 grid gap-5">
          {creatureTypes.map((type) => (
            <article
              key={type.name}
              className={`rounded-lg p-5 ring-1 ${type.color}`}
            >
              <div className="flex gap-4">
                <div className="shrink-0">
                  <Icon src={type.icon} alt={`${type.name} icon`} size={72} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{type.name}</h3>
                  <p className="mt-2 text-sm leading-6">{type.description}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {type.subtypes.map((subtype) => (
                  <div
                    key={`${type.name}-${subtype.name}`}
                    className="flex gap-3 rounded-lg bg-white/80 p-4 ring-1 ring-black/5"
                  >
                    <div className="shrink-0">
                      <Icon
                        src={subtype.icon}
                        alt={`${subtype.name} icon`}
                        size={48}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{subtype.name}</h4>
                      <p className="mt-1 text-xs leading-5">
                        {subtype.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg bg-slate-950 p-6 text-white">
            <h3 className="text-2xl font-bold">Star Icons</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              A colored star is shorthand for any subtype in that family. It keeps
              targeting rules scalable as reef, oceanic, deep, and future subtypes
              are added.
            </p>
          </div>
          <div className="grid gap-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
            {[
              {
                label: "Any Filter Feeder",
                icon: `${iconBase}/filter-feeder-any.png`,
              },
              {
                label: "Any Apex",
                icon: `${iconBase}/apex-any.png`,
              },
              {
                label: "Any Creature",
                icon: `${iconBase}/any-creature.png`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100"
              >
                <Icon src={item.icon} alt={`${item.label} icon`} size={42} />
                <span className="text-sm font-bold text-slate-800">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Slots" title="Slots Are Habitat-Specific">
          Slots are strongly typed to their habitat. A reef slot accepts reef Pals,
          and a deep slot accepts deep Pals. Larger slots can also accept smaller
          eligible classes within that same habitat.
        </SectionHeader>

        <div className="mt-8 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          {slotRows.map((row) => (
            <div
              key={row.slot}
              className="grid gap-4 border-b border-slate-200 p-5 last:border-b-0 md:grid-cols-[220px_1fr]"
            >
              <div className="flex items-center gap-3">
                <Icon src={row.icon} alt={`${row.slot} icon`} size={54} />
                <h3 className="text-lg font-bold text-slate-950">{row.slot}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Can hold
                </span>
                {row.accepts.map((accepted) => (
                  <div
                    key={accepted.label}
                    className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    <Icon src={accepted.icon} alt="" size={34} />
                    {accepted.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="my-14">
        <SectionHeader eyebrow="Coral" title="Grow, Slot, and Protect Your Foundation">
          Coral is the foundation of reef and deep ecosystems. It produces RP,
          unlocks habitat slots, and can be upgraded into stronger stages.
        </SectionHeader>

        <div className="mt-8 grid gap-5">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-cyan-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-xl font-bold text-slate-950">
                Upgrade Coral by Stages
              </h3>
              <p className="text-sm font-semibold text-slate-500">
                One stage per coral each turn
              </p>
            </div>

            <div className="mt-5 grid items-start gap-4 md:grid-cols-3">
              {coralUpgradeCards.map((card, index) => (
                <div key={card.label} className="relative">
                  <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                    <Image
                      src={card.image}
                      alt={`Bamboo Coral ${card.label}`}
                      width={260}
                      height={364}
                      className="mx-auto h-auto max-h-[360px] w-auto"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-3 ring-1 ring-slate-100">
                    <span className="text-sm font-bold text-slate-950">
                      {card.label}
                    </span>
                    {index < coralUpgradeCards.length - 1 ? (
                      <span className="text-sm font-bold text-cyan-700">
                        next stage
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-400">
                        final stage
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-cyan-50 p-4 text-sm font-semibold leading-6 text-cyan-950">
                You must have the next stage card in hand.
              </div>
              <div className="rounded-lg bg-cyan-50 p-4 text-sm font-semibold leading-6 text-cyan-950">
                You must pay the RP upgrade cost.
              </div>
              <div className="rounded-lg bg-cyan-50 p-4 text-sm font-semibold leading-6 text-cyan-950">
                Each coral can upgrade only once per turn.
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-cyan-100">
              <h3 className="text-xl font-bold text-slate-950">
                Slot Pals Onto Matching Coral Slots
              </h3>

              <div className="mt-5 grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Image
                    src="/images/cards/coral/Deep/bamboo-coral-stage-1.png"
                    alt="Bamboo Coral Stage 1"
                    width={240}
                    height={336}
                    className="mx-auto h-auto max-h-[360px] w-auto"
                  />
                </div>

                <div className="grid justify-items-center gap-3">
                  <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                    matching slot
                  </div>
                  <Icon src={`${iconBase}/deep-fish-icon.png`} alt="Deep Fish slot" size={54} />
                  <div className="text-4xl font-bold text-slate-950">+</div>
                </div>

                <div className="rounded-lg bg-teal-50 p-3 ring-1 ring-teal-100">
                  <Image
                    src="/images/cards/fish/Deep/bristlemouth.png"
                    alt="Bristlemouth card"
                    width={240}
                    height={336}
                    className="mx-auto h-auto max-h-[360px] w-auto"
                  />
                </div>
              </div>

              <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                A Deep Fish can be played into a Deep Fish slot. A Reef Fish would
                not fit this slot, even though both cards are Fish.
              </p>
            </div>

            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-cyan-100">
              <div className="flex items-center gap-3">
                <Icon src={`${iconBase}/conditions-icon.png`} alt="" size={44} />
                <h3 className="text-xl font-bold text-slate-950">
                  Conditions Trigger Coral Weaknesses
                </h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                At the start of each round, reveal a Conditions card. If the
                condition matches a coral weakness, that coral does not produce RP
                for the round.
              </p>

              <div className="mt-5 grid gap-3">
                {coralWeaknessExamples.map((example) => (
                  <div
                    key={example.condition}
                    className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        src={example.icon}
                        alt={`${example.weakness} condition icon`}
                        size={44}
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-950">
                          {example.condition}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
                          Checks {example.weakness}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {example.effect}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg bg-slate-950 p-4 text-sm font-semibold leading-6 text-white">
                Weaknesses do not remove the coral. They temporarily shut off RP
                production when the matching condition is active.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="my-14 rounded-lg bg-white p-6 shadow-sm ring-1 ring-cyan-100">
        <SectionHeader eyebrow="Reference" title="Current Rules Document">
          This page is now the working player-facing version. The original rules
          document is still linked for comparison while the new format evolves.
        </SectionHeader>
        <a
          href={fullUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex rounded-full bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-800"
        >
          Open full rules document
        </a>
      </section>
    </main>
  );
}
