export const CUSTOM_DECK_OPTION = "custom";
// Keep the legacy ID for saved games, store inventory, and existing links.
export const DEFAULT_PREBUILT_DECK_ID = "blue-water";

// Deck order and card counts follow the Figma print sheets; Darkness Shroud and Open Ocean verified 2026-10-05.
// https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx
// Count card components (including the detached Anemone), excluding reference cards.
export const prebuiltDecks = [
  {
    id: "coral-garden",
    name: "Coral Garden",
    image: "/images/cards/fish/Reef/french-angelfish.png",
    description:
      "Grow a thriving reef with coral upgrades, Bluestriped Grunt searches, and Cleaner Shrimp support. Restocking keeps your reef creatures coming back while dolphins and Goliath Grouper apply pressure.",
    // Figma page 2310:498819
    cards: [
      { cardId: "coral-gardener", quantity: 2 },
      { cardId: "coral-cement", quantity: 1 },
      { cardId: "scientist-jes", quantity: 2 },
      { cardId: "dr-evans", quantity: 1 },
      { cardId: "restocking", quantity: 3 },
      { cardId: "remote-search", quantity: 2 },
      { cardId: "fishing", quantity: 2 },
      { cardId: "recovery", quantity: 1 },
      { cardId: "manta-ray", quantity: 1 },
      { cardId: "bottlenose-dolphin", quantity: 1 },
      { cardId: "spinner-dolphins", quantity: 2 },
      { cardId: "cleaner-shrimp", quantity: 3 },
      { cardId: "emerald-crab", quantity: 1 },
      { cardId: "goliath-grouper", quantity: 2 },
      { cardId: "arrow-crab", quantity: 2 },
      { cardId: "blue-crab", quantity: 1 },
      { cardId: "spectacled-parrotfish", quantity: 2 },
      { cardId: "french-angelfish", quantity: 2 },
      { cardId: "bluestriped-grunt", quantity: 3 },
      { cardId: "spotfin-butterflyfish", quantity: 2 },
      { cardId: "boulder-star-coral-base", quantity: 3 },
      { cardId: "boulder-star-coral-stage-1", quantity: 2 },
      { cardId: "boulder-star-coral-stage-2", quantity: 1 },
      { cardId: "elkhorn-coral-base", quantity: 3 },
      { cardId: "elkhorn-coral-stage-1", quantity: 2 },
      { cardId: "elkhorn-coral-stage-2", quantity: 1 },
      { cardId: "lettuce-coral-base", quantity: 2 },
      { cardId: "lettuce-coral-stage-1", quantity: 2 },
      { cardId: "clubfinger-coral-base", quantity: 3 },
      { cardId: "mustard-hill-coral-base", quantity: 2 },
      { cardId: "coral-reef", quantity: 1 },
      { cardId: "clubfinger-coral-stage-1", quantity: 2 },
    ],
  },
  {
    id: "blue-water",
    name: "Drop Off",
    image: "/images/cards/fish/Reef/picasso-triggerfish.png",
    description:
      "Build a strong Boulder Star and Lettuce Coral economy, then pressure your opponent with Picasso Triggerfish, Winter Flounder, and Green Moray Eels. Blue Tang expands your RP bank while crabs recover spent cards.",
    // Figma page 2224:257782
    cards: [
      { cardId: "coral-gardener", quantity: 2 },
      { cardId: "capt-dani", quantity: 1 },
      { cardId: "deep-sea-fishing", quantity: 2 },
      { cardId: "dr-evans", quantity: 2 },
      { cardId: "robotic-survey", quantity: 2 },
      { cardId: "coral-cement", quantity: 1 },
      { cardId: "remote-search", quantity: 2 },
      { cardId: "scientist-jes", quantity: 1 },
      { cardId: "crab-trap", quantity: 2 },
      { cardId: "tiger-shark", quantity: 1 },
      { cardId: "manta-ray", quantity: 1 },
      { cardId: "poison-heal", quantity: 1 },
      { cardId: "green-moray-eel", quantity: 2 },
      { cardId: "arrow-crab", quantity: 2 },
      { cardId: "octopus", quantity: 2 },
      { cardId: "oysters", quantity: 1 },
      { cardId: "blue-crab", quantity: 2 },
      { cardId: "spanish-hogfish", quantity: 3 },
      { cardId: "picasso-triggerfish", quantity: 3 },
      { cardId: "winter-flounder", quantity: 3 },
      { cardId: "fairy-parrotfish", quantity: 3 },
      { cardId: "lettuce-coral-base", quantity: 4 },
      { cardId: "blue-tang", quantity: 3 },
      { cardId: "boulder-star-coral-base", quantity: 4 },
      { cardId: "boulder-star-coral-stage-1", quantity: 3 },
      { cardId: "lettuce-coral-stage-1", quantity: 2 },
      { cardId: "coral-reef", quantity: 1 },
      { cardId: "mustard-hill-coral-base", quantity: 2 },
      { cardId: "boulder-star-coral-stage-2", quantity: 2 },
    ],
  },
  {
    id: "darkness-shroud",
    name: "Darkness Shroud",
    image: "/images/cards/apex/Deep/giant-squid.png",
    description:
      "Grow Bamboo and Deep Mushroom Corals, then establish Abyss to strengthen your deep-sea creatures with Darkness Shroud. Pairs of Owlfish, Goblin Sharks, and Chimeras keep attacks coming, with Giant Squid as your finisher.",
    // Figma page 2068:245383
    cards: [
      { cardId: "abyss", quantity: 1 },
      { cardId: "chimera", quantity: 2 },
      { cardId: "giant-squid", quantity: 1 },
      { cardId: "goblin-shark", quantity: 2 },
      { cardId: "cookie-cutter-shark", quantity: 2 },
      { cardId: "giant-red-shrimp", quantity: 2 },
      { cardId: "giant-isopod", quantity: 2 },
      { cardId: "deep-cucumber", quantity: 2 },
      { cardId: "deep-sea-jelly", quantity: 2 },
      { cardId: "fangtooth-fish", quantity: 2 },
      { cardId: "vampire-squid", quantity: 2 },
      { cardId: "humpback-anglerfish", quantity: 2 },
      { cardId: "black-swallower", quantity: 2 },
      { cardId: "bristlemouth", quantity: 2 },
      { cardId: "barrel-eye-fish", quantity: 2 },
      { cardId: "owlfish", quantity: 2 },
      { cardId: "fishing", quantity: 1 },
      { cardId: "dr-evans", quantity: 2 },
      { cardId: "deep-sea-fishing", quantity: 2 },
      { cardId: "remote-search", quantity: 3 },
      { cardId: "coral-gardener", quantity: 2 },
      { cardId: "crab-trap", quantity: 2 },
      { cardId: "bamboo_coral_base", quantity: 4 },
      { cardId: "bamboo_coral_stage1", quantity: 2 },
      { cardId: "bamboo_coral_stage2", quantity: 2 },
      { cardId: "scientist-jes", quantity: 2 },
      { cardId: "deep_mushroom_base", quantity: 4 },
      { cardId: "deep_mushroom_stage1", quantity: 2 },
      { cardId: "deep_mushroom_stage2", quantity: 2 },
    ],
  },
  {
    id: "open-ocean-hunt",
    name: "Open Ocean",
    image: "/images/cards/apex/Oceanic/killer-whale.png",
    description:
      "Grow Sardine and Herring schools to unlock Open Ocean, Oceanic Manta Ray, and Killer Whale. Three Mahi-Mahi and three Market Squid build pressure and your RP economy while Cast Net, Remote Search, and Crab Trap find the next piece.",
    // Figma page 2296:82568
    cards: [
      { cardId: "cast-net", quantity: 2 },
      { cardId: "deep-sea-fishing", quantity: 2 },
      { cardId: "fishing", quantity: 2 },
      { cardId: "remote-search", quantity: 3 },
      { cardId: "spearfishing", quantity: 2 },
      { cardId: "crab-trap", quantity: 2 },
      { cardId: "scientist-jes", quantity: 1 },
      { cardId: "dr-evans", quantity: 1 },
      { cardId: "sardine-ball-base", quantity: 4 },
      { cardId: "sardine-ball-stage1", quantity: 2 },
      { cardId: "herring-ball-base", quantity: 4 },
      { cardId: "sardine-ball-stage2", quantity: 2 },
      { cardId: "remora", quantity: 1 },
      { cardId: "herring-ball-stage2", quantity: 2 },
      { cardId: "herring-ball-stage1", quantity: 3 },
      { cardId: "halfbeak", quantity: 3 },
      { cardId: "bluefin-tuna-juvenile", quantity: 1 },
      { cardId: "ocean-triggerfish", quantity: 1 },
      { cardId: "frigate-tuna", quantity: 1 },
      { cardId: "bonito-tuna", quantity: 2 },
      { cardId: "pompano", quantity: 1 },
      { cardId: "mahi-mahi", quantity: 3 },
      { cardId: "market-squid", quantity: 3 },
      { cardId: "man-o-war", quantity: 2 },
      { cardId: "blue-sea-dragon", quantity: 2 },
      { cardId: "oceanic-manta-ray", quantity: 1 },
      { cardId: "killer-whale-oceanic", quantity: 1 },
      { cardId: "yellowfin-tuna", quantity: 1 },
      { cardId: "open-ocean", quantity: 1 },
      { cardId: "silky-shark", quantity: 1 },
      { cardId: "sailfish", quantity: 1 },
      { cardId: "loggerhead-sea-turtle", quantity: 2 },
    ],
  },
  {
    id: "murky-water",
    name: "Murky Water",
    image: "/images/cards/apex/Reef/bull-shark.png",
    description:
      "Build around Brain and Pillar Corals, protect your reef with Sergeant Majors and Cleaner Wrasses, and strike with Reef Sharks, Barracudas, and Bull Shark. Crabs and Recovery keep useful cards in reach.",
    // Figma page 2241:259772
    cards: [
      { cardId: "spearfishing", quantity: 2 },
      { cardId: "coral-gardener", quantity: 3 },
      { cardId: "robotic-survey", quantity: 2 },
      { cardId: "dr-evans", quantity: 2 },
      { cardId: "deep-sea-fishing", quantity: 2 },
      { cardId: "remote-search", quantity: 2 },
      { cardId: "poison-heal", quantity: 2 },
      { cardId: "crab-trap", quantity: 1 },
      { cardId: "recovery", quantity: 2 },
      { cardId: "scientist-jes", quantity: 1 },
      { cardId: "manta-ray", quantity: 1 },
      { cardId: "bull-shark", quantity: 1 },
      { cardId: "reef-shark", quantity: 2 },
      { cardId: "great-barracuda", quantity: 2 },
      { cardId: "arrow-crab", quantity: 2 },
      { cardId: "blue-crab", quantity: 2 },
      { cardId: "sea-urchin", quantity: 3 },
      { cardId: "giant-triton", quantity: 2 },
      { cardId: "cleaner-wrasse", quantity: 3 },
      { cardId: "pillar-coral-base", quantity: 4 },
      { cardId: "brain-coral-base", quantity: 4 },
      { cardId: "sargeant-major", quantity: 3 },
      { cardId: "brain-coral-stage-1", quantity: 3 },
      { cardId: "brain-coral-stage-2", quantity: 2 },
      { cardId: "lettuce-coral-base", quantity: 3 },
      { cardId: "lettuce-coral-stage-1", quantity: 2 },
      { cardId: "mustard-hill-coral-base", quantity: 1 },
      { cardId: "coral-reef", quantity: 1 },
    ],
  },
  {
    id: "stinging-fortress",
    name: "Stinging Fortress",
    image: "/images/cards/invertebrates/Reef/anemone.png",
    description:
      "Shelter Clownfish in Anemones and punish attacks with venomous Sea Kraits, Box Jellyfish, and Lionfish. Longhorn Cowfish and Crown of Thorns add defensive threats around a growing coral reef.",
    // Figma page 2363:215185
    cards: [
      { cardId: "coral-gardener", quantity: 3 },
      { cardId: "dr-evans", quantity: 3 },
      { cardId: "remote-search", quantity: 2 },
      { cardId: "fishing", quantity: 3 },
      { cardId: "crab-trap", quantity: 2 },
      { cardId: "recovery", quantity: 2 },
      { cardId: "yellow-lipped-sea-krait", quantity: 2 },
      { cardId: "manta-ray", quantity: 1 },
      { cardId: "anemone", quantity: 3 },
      { cardId: "box-jellyfish", quantity: 2 },
      { cardId: "crown-of-thorns", quantity: 2 },
      { cardId: "arrow-crab", quantity: 2 },
      { cardId: "clownfish", quantity: 4 },
      { cardId: "lionfish", quantity: 2 },
      { cardId: "blue-crab", quantity: 1 },
      { cardId: "longhorn-cowfish", quantity: 3 },
      { cardId: "lettuce-coral-base", quantity: 4 },
      { cardId: "lettuce-coral-stage-1", quantity: 3 },
      { cardId: "porcupine-fish", quantity: 3 },
      { cardId: "staghorn-coral-base", quantity: 4 },
      { cardId: "clubfinger-coral-base", quantity: 3 },
      { cardId: "clubfinger-coral-stage-1", quantity: 2 },
      { cardId: "mustard-hill-coral-base", quantity: 3 },
      { cardId: "coral-reef", quantity: 1 },
    ],
  },
  {
    id: "disruption",
    name: "Disruption",
    image: "/images/cards/predator/reef/nurse-shark.png",
    description:
      "Disrupt opposing reefs with Nurse Sharks, Mantis Shrimp, Lionfish, and Nudibranchs. Grow Elkhorn Corals while stuns, hand disruption, and reduced RP income limit your opponent's options.",
    // Figma page 2404:505077
    cards: [
      { cardId: "spearfishing", quantity: 1 },
      { cardId: "coral-gardener", quantity: 3 },
      { cardId: "dr-evans", quantity: 1 },
      { cardId: "scientist-jes", quantity: 2 },
      { cardId: "remote-search", quantity: 2 },
      { cardId: "fishing", quantity: 2 },
      { cardId: "crab-trap", quantity: 2 },
      { cardId: "recovery", quantity: 1 },
      { cardId: "hammerhead", quantity: 1 },
      { cardId: "nurse-shark", quantity: 3 },
      { cardId: "manta-ray", quantity: 1 },
      { cardId: "mantis-shrimp", quantity: 3 },
      { cardId: "crown-of-thorns", quantity: 1 },
      { cardId: "goliath-grouper", quantity: 1 },
      { cardId: "arrow-crab", quantity: 1 },
      { cardId: "blue-crab", quantity: 1 },
      { cardId: "emerald-crab", quantity: 1 },
      { cardId: "lionfish", quantity: 2 },
      { cardId: "picasso-triggerfish", quantity: 2 },
      { cardId: "frogfish", quantity: 3 },
      { cardId: "nudibranch", quantity: 3 },
      { cardId: "elkhorn-coral-base", quantity: 4 },
      { cardId: "spectacled-parrotfish", quantity: 3 },
      { cardId: "french-angelfish", quantity: 2 },
      { cardId: "porcupine-fish", quantity: 2 },
      { cardId: "lettuce-coral-base", quantity: 3 },
      { cardId: "elkhorn-coral-stage-2", quantity: 2 },
      { cardId: "elkhorn-coral-stage-1", quantity: 3 },
      { cardId: "lettuce-coral-stage-1", quantity: 2 },
      { cardId: "mustard-hill-coral-base", quantity: 1 },
      { cardId: "coral-reef", quantity: 1 },
    ],
  },
];

function createStoryDeckVariant({ id, name, sourceDeckId, quantityChanges }) {
  const sourceDeck = prebuiltDecks.find((deck) => deck.id === sourceDeckId);
  if (!sourceDeck) throw new Error(`Unknown story deck source: ${sourceDeckId}`);

  const changes = new Map(Object.entries(quantityChanges));
  const cards = sourceDeck.cards.flatMap((entry) => {
    const quantity = entry.quantity + (changes.get(entry.cardId) ?? 0);
    changes.delete(entry.cardId);
    if (quantity < 0 || !Number.isInteger(quantity)) {
      throw new Error(`Invalid ${id} quantity for ${entry.cardId}.`);
    }
    return quantity === 0 ? [] : [{ ...entry, quantity }];
  });
  if (changes.size) {
    throw new Error(`${id} changes reference unknown source cards: ${[...changes.keys()].join(", ")}`);
  }
  const sourceSize = sourceDeck.cards.reduce((total, entry) => total + entry.quantity, 0);
  const variantSize = cards.reduce((total, entry) => total + entry.quantity, 0);
  if (variantSize !== sourceSize) {
    throw new Error(`${id} must preserve its source deck's ${sourceSize}-card size.`);
  }

  return { id, name, storyOnly: true, cards };
}

/** Legal opponent variants used by Adventure encounters but not sold as retail deck products. */
export const storyOpponentDecks = [
  createStoryDeckVariant({
    id: "the-abyss",
    name: "The Abyss",
    sourceDeckId: "darkness-shroud",
    quantityChanges: {
      owlfish: 1,
      "fangtooth-fish": 1,
      "deep-cucumber": 1,
      "remote-search": -1,
      fishing: -1,
      "dr-evans": -1,
    },
  }),
  createStoryDeckVariant({
    id: "deep-waters",
    name: "Deep Waters",
    sourceDeckId: "darkness-shroud",
    quantityChanges: {
      bristlemouth: 1,
      "barrel-eye-fish": 1,
      "deep-sea-jelly": 1,
      bamboo_coral_stage1: 1,
      "giant-squid": -1,
      "goblin-shark": -1,
      "remote-search": -1,
      "coral-gardener": -1,
    },
  }),
  createStoryDeckVariant({
    id: "pelagic-zone",
    name: "Pelagic Zone",
    sourceDeckId: "open-ocean-hunt",
    quantityChanges: {
      "sardine-ball-stage2": 1,
      "herring-ball-stage2": 1,
      halfbeak: 1,
      "bonito-tuna": 1,
      "blue-sea-dragon": 1,
      "killer-whale-oceanic": -1,
      "oceanic-manta-ray": -1,
      "mahi-mahi": -1,
      "silky-shark": -1,
      "deep-sea-fishing": -1,
    },
  }),
];

export const playableDecks = [...prebuiltDecks, ...storyOpponentDecks];

export function getPrebuiltDeckById(deckId) {
  return prebuiltDecks.find((deck) => deck.id === deckId) ?? null;
}

export function getPlayableDeckById(deckId) {
  return playableDecks.find((deck) => deck.id === deckId) ?? null;
}
