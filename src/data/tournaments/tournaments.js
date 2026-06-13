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
    deckSize: 60,
    maxCopiesPerCard: 4,
    bannedCardIds: [],
    restrictedCardIds: [],
  },
];
