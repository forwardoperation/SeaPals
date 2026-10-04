export const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Holo Rare"];

export const RARITY_SYMBOLS = {
  Common: "●",
  Uncommon: "◆",
  Rare: "★",
  "Holo Rare": "★",
};

const CATEGORY_LABELS = {
  "filter-feeder": "Filter Feeder",
  apex: "Apex",
  predator: "Predator",
  fish: "Fish",
  baitball: "Baitball",
  invertebrate: "Invertebrate",
  coral: "Coral",
  habitat: "Habitat",
  support: "Support",
};

export function buildSetListData(gallery) {
  const rows = gallery.flatMap((set) => set.images.flatMap((card) =>
    card.printings.map((printing) => ({
      id: `${set.zone}-${printing.number}`,
      zone: set.zone,
      setTitle: set.title,
      number: printing.number,
      totalPrintings: card.totalPrintings,
      cardId: card.cardId,
      name: card.name,
      stageLabel: card.stageLabel ?? "",
      category: CATEGORY_LABELS[card.category] ?? card.category,
      rarity: printing.rarity,
      artwork: !card.hasImage ? "Coming soon" : card.prerelease ? "Prerelease" : "Complete",
    }))
  ).sort((a, b) => a.number - b.number));

  const sets = gallery.map((set) => {
    const setRows = rows.filter((row) => row.zone === set.zone);
    return {
      zone: set.zone,
      title: set.title,
      totalPrintings: setRows.length,
      uniqueCards: set.images.length,
      rarities: Object.fromEntries(RARITY_ORDER.map((rarity) => [
        rarity, setRows.filter((row) => row.rarity === rarity).length,
      ])),
    };
  });

  return { rows, sets };
}

function normalizeSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function filterSetListRows(rows, { query = "", zone = "all", rarity = "all" } = {}) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (zone !== "all" && row.zone !== zone) return false;
    if (rarity !== "all" && row.rarity !== rarity) return false;
    const text = normalizeSearch([
      row.name, row.stageLabel, row.category, row.setTitle,
      `${row.number}/${row.totalPrintings}`, row.rarity,
    ].join(" "));
    return words.every((word) => text.includes(word));
  });
}
