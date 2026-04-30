export const DeckStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CHANGES_REQUESTED: "changesRequested",
};

export const deckSubmissions = [
  {
    id: "deck-001",
    tournamentId: "genesis-test-tournament",
    playerName: "Example Player",
    deckName: "Starter Reef",
    status: DeckStatus.PENDING,
    adminNotes: "",
    cards: [
      { cardId: "elkhorn-coral-base", quantity: 3 },
      { cardId: "bull-shark", quantity: 2 },
    ],
  },
];