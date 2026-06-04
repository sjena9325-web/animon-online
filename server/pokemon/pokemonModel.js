class PokemonModel {
  constructor(data) {
    this.id = data.id;

    this.name = data.name;

    this.image = data.sprites.other["official-artwork"].front_default;

    this.types = data.types.map(t => t.type.name);

    this.stats = {
      hp: data.stats.find(s => s.stat.name === "hp").base_stat,

      attack: data.stats.find(s => s.stat.name === "attack").base_stat,

      defense: data.stats.find(s => s.stat.name === "defense").base_stat,

      speed: data.stats.find(s => s.stat.name === "speed").base_stat,

      stamina: 100
    };

    this.moves = data.moves
      .slice(0, 4)
      .map(m => m.move.name);
  }
}

module.exports = PokemonModel;