export function buildLeaderboard({ decks, matches, tournamentId }) {
  const approvedDecks = decks.filter((deck) => {
    return (
      deck.status === "approved" &&
      (!tournamentId || deck.tournamentId === tournamentId)
    );
  });

  const relevantMatches = matches.filter((match) => {
    return !tournamentId || match.tournamentId === tournamentId;
  });

  const rows = approvedDecks.map((deck) => ({
    deckId: deck.id,
    playerName: deck.playerName,
    deckName: deck.deckName,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    winRate: 0,
  }));

  const rowsByDeckId = Object.fromEntries(rows.map((row) => [row.deckId, row]));

  for (const match of relevantMatches) {
    const deckA = rowsByDeckId[match.deckAId];
    const deckB = rowsByDeckId[match.deckBId];

    if (!deckA || !deckB || !match.winnerDeckId) continue;

    deckA.gamesPlayed += 1;
    deckB.gamesPlayed += 1;

    if (match.winnerDeckId === match.deckAId) {
      deckA.wins += 1;
      deckB.losses += 1;
    }

    if (match.winnerDeckId === match.deckBId) {
      deckB.wins += 1;
      deckA.losses += 1;
    }
  }

  return rows
    .map((row) => ({
      ...row,
      winRate: row.gamesPlayed ? row.wins / row.gamesPlayed : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
}