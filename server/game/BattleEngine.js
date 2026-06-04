class BattleEngine {
  constructor(state) {
    this.state = state;
  }

  startRound() {
    const s = this.state;

    if (s.phase !== "battle") return;
    if (s.battle.playerNeedsReplacement) return;

    s.resetBattleRound();

    this.chooseEnemyAction();

    s.addLog(`⚔️ Round ${s.battle.round} started.`);
  }

  createBattlePokemon(pokemon) {
    return {
      ...pokemon,
      battleStats: pokemon.battleStats || {
        currentHp: pokemon.stats.hp,
        maxHp: pokemon.stats.hp,
        currentStamina: 100,
        maxStamina: 100,
        attacksMade: 0
      }
    };
  }

  syncActiveToTeam(side) {
    const s = this.state;

    if (side === "player" && s.battle.playerActiveIndex !== null) {
      s.player.team[s.battle.playerActiveIndex] = {
        ...s.player.team[s.battle.playerActiveIndex],
        battleStats: s.battle.playerActive.battleStats
      };
    }

    if (side === "enemy" && s.battle.enemyActiveIndex !== null) {
      s.enemy.team[s.battle.enemyActiveIndex] = {
        ...s.enemy.team[s.battle.enemyActiveIndex],
        battleStats: s.battle.enemyActive.battleStats
      };
    }
  }

  choosePlayerMove(moveIndex) {
    const s = this.state;

    if (s.phase !== "battle") {
      return { error: "Battle has not started" };
    }

    if (s.battle.playerNeedsReplacement) {
      return { error: "Choose a replacement Pokémon first" };
    }

    if (!s.battle.playerActive || !s.battle.enemyActive) {
      return { error: "No active Pokémon selected" };
    }

    if (s.battle.playerHasChosen) {
      return { error: "You already chose an action this round" };
    }

    const move = s.battle.playerActive.moves[moveIndex];

    if (!move) {
      return { error: "Invalid move" };
    }

    s.battle.playerAction = {
      type: "attack",
      move
    };

    s.battle.playerHasChosen = true;

    s.addLog(`🟦 You selected ${move.name}.`);

    return this.tryResolveRound();
  }

  choosePlayerSwitch(index) {
    const s = this.state;

    if (s.phase !== "battle") {
      return { error: "Battle has not started" };
    }

    if (index === s.battle.playerActiveIndex) {
      return { error: "This Pokémon is already active" };
    }

    const pokemon = s.player.team[index];

    if (!pokemon) {
      return { error: "Invalid Pokémon" };
    }

    if (pokemon.battleStats && pokemon.battleStats.currentHp <= 0) {
      return { error: "That Pokémon has fainted" };
    }

    if (s.battle.playerNeedsReplacement) {
      return this.forcePlayerReplacement(index);
    }

    if (s.battle.playerHasChosen) {
      return { error: "You already chose an action this round" };
    }

    s.battle.playerAction = {
      type: "switch",
      index
    };

    s.battle.playerHasChosen = true;

    s.addLog(`🔁 You chose to switch to ${pokemon.name}.`);

    return this.tryResolveRound();
  }

  forcePlayerReplacement(index) {
    const s = this.state;
    const pokemon = s.player.team[index];

    if (!pokemon) {
      return { error: "Invalid Pokémon" };
    }

    if (pokemon.battleStats && pokemon.battleStats.currentHp <= 0) {
      return { error: "That Pokémon has fainted" };
    }

    s.battle.playerActiveIndex = index;
    s.battle.playerActive = this.createBattlePokemon(pokemon);

    s.battle.playerNeedsReplacement = false;
    s.battle.waitingForSwitch = false;

    s.addLog(`🟦 You sent out ${pokemon.name}.`);

    this.changeArenaAfterFaint();

    if (s.battle.enemyNeedsReplacement) {
      this.forceEnemyReplacement();
    }

    s.battle.status = "Replacement complete. Next round begins.";

    return this.nextRound();
  }

  forceEnemyReplacement() {
    const s = this.state;

    const index = this.chooseBestAliveEnemyIndex();

    if (index === null) {
      return this.endBattle("player");
    }

    const pokemon = s.enemy.team[index];

    s.battle.enemyActiveIndex = index;
    s.battle.enemyActive = this.createBattlePokemon(pokemon);

    s.battle.enemyNeedsReplacement = false;

    s.addLog(`🟥 Enemy sent out ${pokemon.name}.`);

    this.changeArenaAfterFaint();

    return { ok: true };
  }

  chooseEnemyAction() {
    const s = this.state;

    if (!s.battle.enemyActive) return;

    if (
      s.battle.enemyActive.battleStats.currentHp <= 0 ||
      s.battle.enemyNeedsReplacement
    ) {
      this.forceEnemyReplacement();
      return;
    }

    const moves = s.battle.enemyActive.moves || [];

    if (!moves.length) return;

    const usableMoves =
      moves.filter(move => {
        return move.staminaCost <=
          s.battle.enemyActive.battleStats.currentStamina;
      });

    const selectedMove =
      usableMoves.length
        ? usableMoves.sort((a, b) => b.power - a.power)[0]
        : moves[0];

    s.battle.enemyAction = {
      type: "attack",
      move: selectedMove
    };

    s.battle.enemyHasChosen = true;

    s.addLog(`🟥 Enemy selected ${selectedMove.name}.`);
  }

  forcePlayerTimeout() {
    const s = this.state;

    if (s.phase !== "battle") return;

    if (s.battle.playerNeedsReplacement) {
      const replacementIndex = this.chooseFirstAlivePlayerBenchIndex();

      if (replacementIndex === null) {
        return this.endBattle("enemy");
      }

      s.addLog("⏱️ You did not choose a replacement. Auto-selected first available Pokémon.");
      return this.forcePlayerReplacement(replacementIndex);
    }

    if (!s.battle.playerHasChosen) {
      s.battle.playerAction = null;
      s.battle.playerHasChosen = true;

      s.addLog("⏱️ You did not choose a move. You skip this round.");
    }

    return this.tryResolveRound();
  }

  tryResolveRound() {
    const s = this.state;

    if (!s.battle.playerHasChosen || !s.battle.enemyHasChosen) {
      return { waiting: true };
    }

    return this.resolveRound();
  }

  resolveRound() {
    const s = this.state;

    const playerAction = s.battle.playerAction;
    const enemyAction = s.battle.enemyAction;

    if (!playerAction && !enemyAction) {
      s.addLog("Both players skipped. Moving to next round.");
      return this.nextRound();
    }

    if (playerAction?.type === "switch") {
      this.executeSwitch("player", playerAction.index);
    }

    if (enemyAction?.type === "switch") {
      this.executeSwitch("enemy", enemyAction.index);
    }

    if (playerAction?.type === "switch" && enemyAction?.type === "switch") {
      return this.afterRoundDamageCheck();
    }

    if (playerAction?.type === "switch" && enemyAction?.type === "attack") {
      this.performAttack(
        s.battle.enemyActive,
        s.battle.playerActive,
        enemyAction.move,
        "enemy"
      );

      return this.afterRoundDamageCheck();
    }

    if (enemyAction?.type === "switch" && playerAction?.type === "attack") {
      this.performAttack(
        s.battle.playerActive,
        s.battle.enemyActive,
        playerAction.move,
        "player"
      );

      return this.afterRoundDamageCheck();
    }

    if (playerAction?.type === "attack" && !enemyAction) {
      this.performAttack(
        s.battle.playerActive,
        s.battle.enemyActive,
        playerAction.move,
        "player"
      );

      return this.afterRoundDamageCheck();
    }

    if (!playerAction && enemyAction?.type === "attack") {
      this.performAttack(
        s.battle.enemyActive,
        s.battle.playerActive,
        enemyAction.move,
        "enemy"
      );

      return this.afterRoundDamageCheck();
    }

    if (playerAction?.type === "attack" && enemyAction?.type === "attack") {
      const order =
        this.determineAttackOrder(
          s.battle.playerActive,
          playerAction.move,
          s.battle.enemyActive,
          enemyAction.move
        );

      if (order[0] === "player") {
        this.performAttack(
          s.battle.playerActive,
          s.battle.enemyActive,
          playerAction.move,
          "player"
        );

        if (s.battle.enemyActive.battleStats.currentHp > 0) {
          this.performAttack(
            s.battle.enemyActive,
            s.battle.playerActive,
            enemyAction.move,
            "enemy"
          );
        }
      } else {
        this.performAttack(
          s.battle.enemyActive,
          s.battle.playerActive,
          enemyAction.move,
          "enemy"
        );

        if (s.battle.playerActive.battleStats.currentHp > 0) {
          this.performAttack(
            s.battle.playerActive,
            s.battle.enemyActive,
            playerAction.move,
            "player"
          );
        }
      }
    }

    return this.afterRoundDamageCheck();
  }

  executeSwitch(side, index) {
    const s = this.state;

    if (side === "player") {
      this.syncActiveToTeam("player");

      const pokemon = s.player.team[index];

      s.battle.playerActiveIndex = index;
      s.battle.playerActive = this.createBattlePokemon(pokemon);

      s.addLog(`🔁 You switched to ${pokemon.name}.`);
    }

    if (side === "enemy") {
      this.syncActiveToTeam("enemy");

      const pokemon = s.enemy.team[index];

      s.battle.enemyActiveIndex = index;
      s.battle.enemyActive = this.createBattlePokemon(pokemon);

      s.addLog(`🔁 Enemy switched to ${pokemon.name}.`);
    }
  }

  performAttack(attacker, defender, move, side) {
    const s = this.state;

    if (!attacker || !defender) return;

    const stamina =
      attacker.battleStats.currentStamina;

    const attackerLabel =
      side === "player" ? "Your" : "Enemy";

    if (stamina < move.staminaCost) {
      s.addLog(`${attackerLabel} ${attacker.name} did not have enough stamina for ${move.name}.`);
      return;
    }

    attacker.battleStats.currentStamina =
      Math.max(0, stamina - move.staminaCost);

    attacker.battleStats.attacksMade =
      (attacker.battleStats.attacksMade || 0) + 1;

    if (attacker.battleStats.attacksMade % 2 === 0) {
      attacker.battleStats.currentStamina =
        Math.min(
          attacker.battleStats.maxStamina,
          attacker.battleStats.currentStamina + 10
        );

      s.addLog(`${attackerLabel} ${attacker.name} recovered 10 stamina after attacking twice.`);
    }

    const result =
      this.calculateDamage(attacker, defender, move);

    defender.battleStats.currentHp =
      Math.max(0, defender.battleStats.currentHp - result.damage);

    if (side === "player") {
      s.addLog(
        `💥 Your ${attacker.name} used ${move.name}. Enemy ${defender.name} took ${result.damage} damage.`
      );
    } else {
      s.addLog(
        `💢 Enemy ${attacker.name} used ${move.name}. Your ${defender.name} took ${result.damage} damage.`
      );
    }

    if (result.effectiveness === "super") {
      s.addLog("🔥 It was super effective!");
    }

    if (result.effectiveness === "not") {
      s.addLog("🛡️ It was not very effective.");
    }

    if (result.arenaBoost) {
      s.addLog(`🏟️ Arena boost activated for ${attacker.type}-type attack.`);
    }

    if (attacker.battleStats.currentStamina < 50) {
      s.addLog(`⚠️ ${attackerLabel} ${attacker.name}'s low stamina reduced attack power.`);
    }
  }

  calculateDamage(attacker, defender, move) {
    const arena =
      this.state.battle.arena;

    let power =
      move.power || 40;

    let attack =
      attacker.stats.attack;

    let defense =
      defender.stats.defense || 50;

    let arenaBoost = false;

    if (attacker.battleStats.currentStamina < 50) {
      power *= 0.75;
    }

    let damage =
      ((power * attack) / Math.max(1, defense)) * 0.45;

    const typeMultiplier =
      this.getTypeMultiplier(move.type || attacker.type, defender.type);

    damage *= typeMultiplier;

    if (arena && arena.type === attacker.type) {
      damage *= 1.25;
      arenaBoost = true;
    }

    let effectiveness = "normal";

    if (typeMultiplier > 1) {
      effectiveness = "super";
    } else if (typeMultiplier < 1) {
      effectiveness = "not";
    }

    return {
      damage: Math.max(1, Math.round(damage)),
      effectiveness,
      arenaBoost
    };
  }

  getTypeMultiplier(attackerType, defenderType) {
    const chart = {
      fire: { grass: 2, ice: 2, bug: 2, steel: 2, water: 0.5, rock: 0.5, dragon: 0.5 },
      water: { fire: 2, rock: 2, ground: 2, grass: 0.5, dragon: 0.5 },
      grass: { water: 2, rock: 2, ground: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
      electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5, dragon: 0.5, ground: 0.5 },
      ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
      fighting: { normal: 2, rock: 2, steel: 2, ice: 2, dark: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5 },
      poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
      ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0.5 },
      flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
      psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0.5 },
      bug: { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
      rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
      ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0.5 },
      dragon: { dragon: 2, steel: 0.5, fairy: 0.5 },
      dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
      steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
      fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 }
    };

    return chart[attackerType]?.[defenderType] || 1;
  }

  determineAttackOrder(playerPokemon, playerMove, enemyPokemon, enemyMove) {
    const playerSpeed =
      this.getModifiedSpeed(playerPokemon);

    const enemySpeed =
      this.getModifiedSpeed(enemyPokemon);

    if (playerSpeed > enemySpeed) return ["player", "enemy"];
    if (enemySpeed > playerSpeed) return ["enemy", "player"];

    const playerScore =
      this.tieBreakerScore(playerPokemon);

    const enemyScore =
      this.tieBreakerScore(enemyPokemon);

    if (playerScore >= enemyScore) {
      return ["player", "enemy"];
    }

    return ["enemy", "player"];
  }

  getModifiedSpeed(pokemon) {
    const arena =
      this.state.battle.arena;

    let speed =
      pokemon.stats.speed;

    if (arena?.type === "ice") {
      speed *= 0.8;
    }

    if (arena?.type === "water" && pokemon.body?.weight > 700) {
      speed *= 0.7;
    }

    if (arena?.type === pokemon.type) {
      speed *= 1.1;
    }

    return speed;
  }

  tieBreakerScore(pokemon) {
    const arena =
      this.state.battle.arena;

    let score =
      pokemon.stats.hp +
      pokemon.stats.attack +
      pokemon.stats.defense +
      pokemon.stats.specialAttack +
      pokemon.stats.specialDefense +
      pokemon.stats.speed +
      pokemon.battleStats.currentStamina;

    if (arena?.type === pokemon.type) {
      score *= 1.15;
    }

    if (arena?.type === "electric" && pokemon.body?.weight < 500) {
      score *= 1.1;
    }

    if (arena?.type === "rock" && pokemon.body?.weight > 700) {
      score *= 1.1;
    }

    return score;
  }

  afterRoundDamageCheck() {
    const s = this.state;

    this.syncActiveToTeam("player");
    this.syncActiveToTeam("enemy");

    if (s.battle.enemyActive.battleStats.currentHp <= 0) {
      s.addLog(`💀 Enemy ${s.battle.enemyActive.name} fainted.`);
      s.battle.enemyNeedsReplacement = true;

      if (this.aliveEnemyIndexes().length === 0) {
        return this.endBattle("player");
      }

      this.forceEnemyReplacement();
    }

    if (s.battle.playerActive.battleStats.currentHp <= 0) {
      s.addLog(`💀 Your ${s.battle.playerActive.name} fainted.`);
      s.battle.playerNeedsReplacement = true;
      s.battle.waitingForSwitch = true;

      if (this.alivePlayerIndexes().length === 0) {
        return this.endBattle("enemy");
      }

      s.battle.status = "Your Pokémon fainted. Choose a replacement.";
      return { replacement: true };
    }

    return this.nextRound();
  }

  nextRound() {
    const s = this.state;

    s.battle.round++;

    if (s.battle.round > s.battle.maxRounds) {
      return this.checkRoundLimitWinner();
    }

    s.resetBattleRound();
    this.chooseEnemyAction();

    s.addLog(`⚔️ Round ${s.battle.round} started.`);

    return { nextRound: true };
  }

  checkRoundLimitWinner() {
    const s = this.state;

    const playerTotalHp =
      this.totalAliveHp("player");

    const enemyTotalHp =
      this.totalAliveHp("enemy");

    if (playerTotalHp > enemyTotalHp) {
      return this.endBattle("player", "You win by higher total team HP.");
    }

    if (enemyTotalHp > playerTotalHp) {
      return this.endBattle("enemy", "Enemy wins by higher total team HP.");
    }

    s.battle.maxRounds += 5;
    s.battle.overtimeRounds += 5;
    s.addLog("⚖️ Total HP tied. 5 extra rounds added.");

    s.resetBattleRound();
    this.chooseEnemyAction();

    return { overtime: true };
  }

  totalAliveHp(side) {
    const s = this.state;
    const team = side === "player" ? s.player.team : s.enemy.team;

    return team.reduce((total, pokemon, index) => {
      const isActive =
        side === "player"
          ? index === s.battle.playerActiveIndex
          : index === s.battle.enemyActiveIndex;

      if (isActive) {
        const active =
          side === "player"
            ? s.battle.playerActive
            : s.battle.enemyActive;

        return total + Math.max(0, active.battleStats.currentHp);
      }

      if (pokemon.battleStats) {
        return total + Math.max(0, pokemon.battleStats.currentHp);
      }

      return total + pokemon.stats.hp;
    }, 0);
  }

  alivePlayerIndexes() {
    const s = this.state;

    return s.player.team
      .map((pokemon, index) => ({ pokemon, index }))
      .filter(item => {
        if (item.index === s.battle.playerActiveIndex) {
          return false;
        }

        return !item.pokemon.battleStats ||
          item.pokemon.battleStats.currentHp > 0;
      })
      .map(item => item.index);
  }

  aliveEnemyIndexes() {
    const s = this.state;

    return s.enemy.team
      .map((pokemon, index) => ({ pokemon, index }))
      .filter(item => {
        if (item.index === s.battle.enemyActiveIndex) {
          return false;
        }

        return !item.pokemon.battleStats ||
          item.pokemon.battleStats.currentHp > 0;
      })
      .map(item => item.index);
  }

  chooseFirstAlivePlayerBenchIndex() {
    const alive = this.alivePlayerIndexes();
    return alive.length ? alive[0] : null;
  }

  chooseBestAliveEnemyIndex() {
    const s = this.state;

    const alive = this.aliveEnemyIndexes();

    if (!alive.length) return null;

    let bestIndex = alive[0];
    let bestScore = -Infinity;

    alive.forEach(index => {
      const pokemon = s.enemy.team[index];

      const score =
        pokemon.stats.hp +
        pokemon.stats.attack * 1.4 +
        pokemon.stats.speed * 1.2 +
        pokemon.stats.defense;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  changeArenaAfterFaint() {
    const s = this.state;

    const arenas = [
      {
        name: "Volcano Arena",
        type: "fire",
        description: "A burning battlefield filled with heat waves and molten rock.",
        effects: ["Fire-type damage: 1.5x", "Grass-type defense: 0.75x", "All Pokémon stamina drain: 1.2x"]
      },
      {
        name: "Ocean Arena",
        type: "water",
        description: "A flooded arena where waves slow heavy movement.",
        effects: ["Water-type damage: 1.5x", "Fire-type damage: 0.75x", "Heavy Pokémon speed: 0.7x"]
      },
      {
        name: "Electric Storm Arena",
        type: "electric",
        description: "Lightning strikes randomly across the battlefield.",
        effects: ["Electric-type damage: 1.5x", "Electric Pokémon speed: 1.25x", "Light Pokémon gain speed tie advantage"]
      },
      {
        name: "Glacier Arena",
        type: "ice",
        description: "A frozen battlefield where movement becomes slippery.",
        effects: ["Ice-type damage: 1.5x", "All Pokémon speed: 0.8x", "Light Pokémon evasion: 1.2x"]
      },
      {
        name: "Forest Arena",
        type: "grass",
        description: "A dense forest that helps natural Pokémon recover.",
        effects: ["Grass Pokémon healing: +5 HP per round", "Fire-type damage: 1.25x", "Ground-type defense: 1.2x"]
      }
    ];

    const available = arenas.filter(
      arena => arena.name !== s.battle.arena?.name
    );

    const selected =
      available[Math.floor(Math.random() * available.length)];

    s.battle.arena = selected;
    s.battle.lastArenaName = selected.name;

    s.addLog(`🏟️ Arena changed after faint: ${selected.name}`);
  }

  endBattle(winner, message = null) {
    const s = this.state;

    s.battle.winner = winner;
    s.phase = "end";

    if (winner === "player") {
      s.battle.status = message || "You win the team battle!";
      s.addLog(`🏆 ${s.battle.status}`);
    } else {
      s.battle.status = message || "Enemy wins the team battle.";
      s.addLog(`🏆 ${s.battle.status}`);
    }

    return { winner };
  }
}

module.exports = BattleEngine;