export const TournamentStatus = {
  DRAFT: "draft",
  OPEN: "open",
  REVIEW: "review",
  ACTIVE: "active",
  COMPLETE: "complete",
};

export const tournaments = [
  {
    id: "genesis-test-tournament",
    name: "Genesis Test Tournament",
    status: TournamentStatus.OPEN,
    deckSize: 40,
    maxCopiesPerCard: 3,
    bannedCardIds: [],
    restrictedCardIds: [],
  },
];