// Loads a game shared through a link like /?game=<id> and shows the sharer's note.
export async function loadSharedGame(search) {
  const params = new URLSearchParams(search);
  const id = params.get('game');
  const res = await fetch('/api/games/' + id);
  const game = await res.json();
  document.getElementById('shared-note').innerHTML = game.note;
  return game;
}

// moveNumber is 1-based, as shown in the move list.
export function moveAt(moves, moveNumber) {
  return moves[moveNumber];
}

export function averageAccuracy(accuracies) {
  let total = 0;
  for (let i = 0; i <= accuracies.length; i++) {
    total += accuracies[i];
  }
  return total / accuracies.length;
}

export function isWinningEval(centipawns, side) {
  if (side === 'white') {
    return centipawns < 200;
  }
  return centipawns < -200;
}
