const CATEGORY_CONFIG = [
  {
    slug: "filter-feeders",
    title: "Filter Feeders",
    images: [
      {
        name: "Blue Whale",
        src: "/images/cards/filter-feeders/blue-whale.png",
      },
      {
        name: "Manta Ray",
        src: "/images/cards/filter-feeders/manta-ray.png",
      },
    ],
  },
  {
    slug: "apex",
    title: "Apex",
    images: [
      {
        name: "Bottlenose Dolphin",
        src: "/images/cards/apex/bottlenose-dolpin.png",
      },
      {
        name: "Bull Shark",
        src: "/images/cards/apex/bull-shark.png",
      },
      {
        name: "Great White",
        src: "/images/cards/apex/great-white.png",
      },
      {
        name: "Hammerhead",
        src: "/images/cards/apex/hammerhead.png",
      },
      {
        name: "Killer Whale",
        src: "/images/cards/apex/killer-whale.png",
      },
      {
        name: "Pilot Whale",
        src: "/images/cards/apex/pilot-whale.png",
      },
      {
        name: "Tiger Shark",
        src: "/images/cards/apex/tiger-shark.png",
      },
    ],
  },
  {
    slug: "predator",
    title: "Predator",
    images: [
      {
        name: "Moray Eel",
        src: "/images/cards/predator/moray-eel.png",
      },
      {
        name: "Spinner Dolphins",
        src: "/images/cards/predator/spinner-dolpins.png",
      },
      {
        name: "Thresher Shark",
        src: "/images/cards/predator/thresher-shark.png",
      },
    ],
  },
  {
    slug: "fish",
    title: "Fish",
    images: [
      {
        name: "Blue Tang",
        src: "/images/cards/fish/blue-tang.png",
      },
      {
        name: "Cleaner Wrasse",
        src: "/images/cards/fish/cleaner-wrasse.png",
      },
      {
        name: "French Angelfish",
        src: "/images/cards/fish/french-angelfish.png",
      },
      {
        name: "Picasso Triggerfish",
        src: "/images/cards/fish/picasso-triggerfish.png",
      },
      {
        name: "Spanish Hogfish",
        src: "/images/cards/fish/spanish-hogfish.png",
      },
      {
        name: "Spectacled Parrotfish",
        src: "/images/cards/fish/spectacled-parrotfish.png",
      },
    ],
  },
  {
    slug: "invertebrates",
    title: "Invertebrates",
    images: [
      {
        name: "Emerald Crab",
        src: "/images/cards/invertebrates/emerald-crab.png",
      },
    ],
  },
  { slug: "coral", title: "Coral", images: [] },
  {
    slug: "support",
    title: "Support",
    images: [
      {
        name: "Coral Cement",
        src: "/images/cards/support/coral-cement.png",
      },
    ],
  },
];

export async function getGalleryData() {
  return CATEGORY_CONFIG;
}
