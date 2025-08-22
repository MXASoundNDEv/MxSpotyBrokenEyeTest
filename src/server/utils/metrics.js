import client from 'prom-client';

const register = new client.Registry();

const collectDefaultMetrics = () => client.collectDefaultMetrics({ register });

const playerGuessesCounter = new client.Counter({
  name: 'player_guesses_total',
  help: 'Total number of guesses made by players',
  registers: [register]
});

const correctGuessesCounter = new client.Counter({
  name: 'correct_guesses_total',
  help: 'Total number of correct guesses made by players',
  registers: [register]
});

const uniquePlayers = new Set();

const uniquePlayersCounter = new client.Counter({
  name: 'unique_players_total',
  help: 'Number of unique players',
  registers: [register]
});

const trackUniquePlayer = (playerId) => {
  if (!uniquePlayers.has(playerId)) {
    uniquePlayers.add(playerId);
    uniquePlayersCounter.inc();
  }
};

export {
  register,
  collectDefaultMetrics,
  playerGuessesCounter,
  correctGuessesCounter,
  uniquePlayersCounter,
  trackUniquePlayer
};
