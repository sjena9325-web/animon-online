const PokemonModel = require("./pokemonModel");

async function generateRandomPokemon() {

  const randomId = Math.floor(Math.random() * 1025) + 1;

  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${randomId}`
  );

  const data = await response.json();

  return new PokemonModel(data);
}

module.exports = {
  generateRandomPokemon
};