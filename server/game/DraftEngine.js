class DraftEngine {
  constructor(state) {
    this.state = state;
  }

  bidPlayer(amount) {
    const s = this.state;

    if (s.phase === "end" || s.phase === "battle") {
      return { error: "Draft already ended" };
    }

    if (s.player.passed) {
      return { error: "You already passed this Pokémon" };
    }

    if (s.player.team.length >= s.player.maxTeam) {
      return { error: "Your team is full" };
    }

    if (s.player.tokens <= 0) {
      return { error: "You have no tokens left" };
    }

    const newBid = s.currentBid + amount;

    if (newBid > s.player.tokens) {
      return { error: "Not enough tokens" };
    }

    s.currentBid = newBid;
    s.highestBidder = "player";
    s.player.passed = false;
    s.timeLeft = 10;

    s.addLog(`🟦 You bid ${s.currentBid}`);

    return { ok: true };
  }

  passPlayer() {
    const s = this.state;

    if (s.phase === "end" || s.phase === "battle") {
      return { error: "Draft already ended" };
    }

    if (s.player.passed) {
      return { error: "You already passed" };
    }

    s.player.passed = true;
    s.addLog("🟦 You passed. You cannot bid again on this Pokémon.");

    if (s.highestBidder === "enemy") {
      s.addLog(`🤖 Enemy was the last bidder and wins ${s.currentPokemon.name} for ${s.currentBid} tokens.`);
      s.enemy.team.push(s.currentPokemon);
      s.enemy.tokens -= s.currentBid;
      return this.nextPokemon();
    }

    return this.aiDecisionAfterPlayerPass();
  }

  aiTurnAfterPlayerBid() {
    const s = this.state;

    if (!s.currentPokemon || s.phase !== "draft") {
      return { error: "No active Pokémon" };
    }

    if (s.enemy.team.length >= s.enemy.maxTeam || s.enemy.tokens <= 0) {
      s.enemy.passed = true;
      s.enemy.comment = "I cannot bid anymore.";
      s.addLog("🟥 Enemy passed because team is full or tokens are empty");
      return this.resolve();
    }

    const analysis = this.analyzePokemonForAI();

    if (!analysis.shouldBid) {
      s.enemy.passed = true;
      s.enemy.comment = analysis.reason;
      s.addLog(`🟥 Enemy passed: ${analysis.reason}`);
      return this.resolve();
    }

    const raise = this.calculateAiRaise(analysis);

    if (raise <= 0) {
      s.enemy.passed = true;
      s.enemy.comment = "I cannot afford this bid.";
      s.addLog("🟥 Enemy passed because of low tokens");
      return this.resolve();
    }

    s.currentBid += raise;
    s.highestBidder = "enemy";
    s.enemy.passed = false;
    s.timeLeft = 10;

    s.enemy.comment = `I analyzed my team and raised to ${s.currentBid}.`;
    s.addLog(`🟥 Enemy bid ${s.currentBid} after analysis`);

    return { ok: true, action: "enemy_bid_waiting_player" };
  }

  aiDecisionAfterPlayerPass() {
    const s = this.state;

    if (!s.currentPokemon || s.phase !== "draft") {
      return { error: "No active Pokémon" };
    }

    if (s.enemy.team.length >= s.enemy.maxTeam || s.enemy.tokens <= 0) {
      s.enemy.passed = true;
      s.enemy.comment = "I cannot bid anymore, so I pass too.";
      s.addLog("🟥 Enemy passed because team is full or tokens are empty");
      return this.resolve();
    }

    const analysis = this.analyzePokemonForAI();

    if (!analysis.shouldBid) {
      s.enemy.passed = true;
      s.enemy.comment = analysis.reason;
      s.addLog(`🟥 Enemy passed too: ${analysis.reason}`);
      return this.resolve();
    }

    const raise = this.calculateAiRaise(analysis);

    if (raise <= 0) {
      s.enemy.passed = true;
      s.enemy.comment = "I cannot afford it, so I pass too.";
      s.addLog("🟥 Enemy passed because of low tokens");
      return this.resolve();
    }

    s.currentBid += raise;
    s.highestBidder = "enemy";
    s.enemy.passed = false;

    s.enemy.comment =
      `You passed, and my analysis says this helps my team. I take it for ${s.currentBid}.`;

    s.addLog(`🧠 Enemy analysis: ${analysis.reason}`);
    s.addLog(`🟥 Enemy bid ${s.currentBid} after your pass`);
    s.addLog(`🤖 Enemy acquired ${s.currentPokemon.name} for ${s.currentBid} tokens.`);

    s.enemy.team.push(s.currentPokemon);
    s.enemy.tokens -= s.currentBid;

    return this.nextPokemon();
  }

  analyzePokemonForAI() {
    const s = this.state;
    const p = s.currentPokemon;

    const enemyTeam = s.enemy.team;
    const playerTeam = s.player.team;

    const rawPower =
      p.stats.hp +
      p.stats.attack * 1.6 +
      p.stats.speed * 1.2 +
      (p.stats.defense || 0) * 0.8;

    const duplicatePenalty =
      enemyTeam.some(mon => mon.type === p.type) ? 0.82 : 1;

    const newTypeBonus =
      enemyTeam.some(mon => mon.type === p.type) ? 1 : 1.18;

    const weakTeamBonus =
      enemyTeam.length < s.enemy.minTeam ? 1.25 : 1;

    const speedNeedBonus =
      this.teamAverage(enemyTeam, "speed") < 60 && p.stats.speed > 75
        ? 1.18
        : 1;

    const attackNeedBonus =
      this.teamAverage(enemyTeam, "attack") < 65 && p.stats.attack > 80
        ? 1.18
        : 1;

    const counterBonus =
      this.countersPlayerTeam(p, playerTeam) ? 1.22 : 1;

    const pressure =
      s.currentBid / Math.max(1, s.enemy.tokens);

    const budgetPenalty =
      pressure > 0.5 ? 0.72 : pressure > 0.35 ? 0.88 : 1;

    const teamAlmostFullPenalty =
      enemyTeam.length >= 5 ? 0.75 : 1;

    const finalScore =
      rawPower *
      duplicatePenalty *
      newTypeBonus *
      weakTeamBonus *
      speedNeedBonus *
      attackNeedBonus *
      counterBonus *
      budgetPenalty *
      teamAlmostFullPenalty;

    const shouldBid =
      finalScore > 210 &&
      s.currentBid < s.enemy.tokens &&
      Math.random() > 0.18;

    let reason = "";

    if (shouldBid) {
      if (counterBonus > 1) {
        reason = `${p.name} helps counter your team.`;
      } else if (newTypeBonus > 1) {
        reason = `${p.name} adds a new type to my team.`;
      } else if (speedNeedBonus > 1) {
        reason = `${p.name} improves my team's speed.`;
      } else if (attackNeedBonus > 1) {
        reason = `${p.name} improves my team's attack power.`;
      } else {
        reason = `${p.name} has strong overall value.`;
      }
    } else {
      if (pressure > 0.5) {
        reason = "Too expensive compared to my remaining tokens.";
      } else if (duplicatePenalty < 1) {
        reason = "I already have this type covered.";
      } else if (enemyTeam.length >= 5) {
        reason = "My team is nearly full, so I must be selective.";
      } else {
        reason = "It does not improve my team enough.";
      }
    }

    return {
      shouldBid,
      score: finalScore,
      reason
    };
  }

  teamAverage(team, stat) {
    if (!team.length) return 0;

    const total = team.reduce((sum, p) => {
      return sum + (p.stats?.[stat] || 0);
    }, 0);

    return total / team.length;
  }

  countersPlayerTeam(candidate, playerTeam) {
    if (!playerTeam.length) return false;

    const chart = {
      fire: ["grass", "ice", "bug", "steel"],
      water: ["fire", "rock", "ground"],
      grass: ["water", "rock", "ground"],
      electric: ["water", "flying"],
      ice: ["grass", "ground", "flying", "dragon"],
      fighting: ["normal", "rock", "steel", "ice", "dark"],
      ground: ["fire", "electric", "poison", "rock", "steel"],
      psychic: ["fighting", "poison"],
      rock: ["fire", "ice", "flying", "bug"],
      ghost: ["psychic", "ghost"],
      dragon: ["dragon"],
      dark: ["psychic", "ghost"]
    };

    const targets = chart[candidate.type] || [];

    return playerTeam.some(p => targets.includes(p.type));
  }

  calculateAiRaise(analysis) {
    const s = this.state;

    let maxRaise = analysis.score > 300 ? 3 : analysis.score > 240 ? 2 : 1;

    let raise = 1 + Math.floor(Math.random() * maxRaise);

    if (s.currentBid + raise > s.enemy.tokens) {
      raise = s.enemy.tokens - s.currentBid;
    }

    return raise;
  }

  resolve() {
    const s = this.state;

    if (!s.currentPokemon || s.phase !== "draft") {
      return { error: "Nothing to resolve" };
    }

    if (s.player.passed && s.enemy.passed) {
      s.bin.push(s.currentPokemon);
      s.addLog(`⚫ Both passed. ${s.currentPokemon.name} went to BIN.`);
      return this.nextPokemon();
    }

    if (s.highestBidder === "player" && s.enemy.passed) {
      s.player.team.push(s.currentPokemon);
      s.player.tokens -= s.currentBid;
      s.addLog(`✅ You acquired ${s.currentPokemon.name} for ${s.currentBid} tokens.`);
      return this.nextPokemon();
    }

    if (s.highestBidder === "enemy" && s.player.passed) {
      s.enemy.team.push(s.currentPokemon);
      s.enemy.tokens -= s.currentBid;
      s.addLog(`🤖 Enemy acquired ${s.currentPokemon.name} for ${s.currentBid} tokens.`);
      return this.nextPokemon();
    }

    return { result: "continue" };
  }

  forceTimeoutResolve() {
    const s = this.state;

    if (s.phase !== "draft") return;
    if (s.player.passed) return;

    s.player.passed = true;
    s.addLog("⏱️ Timer ended. You auto-passed and cannot bid on this Pokémon.");

    if (s.highestBidder === "enemy") {
      s.addLog(`🤖 Enemy was the last bidder and wins ${s.currentPokemon.name} for ${s.currentBid} tokens.`);
      s.enemy.team.push(s.currentPokemon);
      s.enemy.tokens -= s.currentBid;
      return this.nextPokemon();
    }

    return this.aiDecisionAfterPlayerPass();
  }

  nextPokemon() {
    const s = this.state;

    if (s.bothDraftDone()) {
      return this.startBattlePhase();
    }

    s.index++;

    if (s.index >= s.pool.length) {
      if (s.canStartBattle()) {
        return this.startBattlePhase();
      }

      s.phase = "end";
      s.addLog("🎉 Draft ended, but one side does not have enough Pokémon.");
      return { end: true };
    }

    s.currentPokemon = s.pool[s.index];

    if (s.playerDraftDone() && !s.enemyDraftDone()) {
      return this.autoEnemyDraft();
    }

    if (s.enemyDraftDone() && !s.playerDraftDone()) {
      s.enemy.passed = true;
      s.enemy.comment = "I am done drafting.";
    }

    s.resetRound();

    s.addLog(`🎯 New Pokémon appeared: ${s.currentPokemon.name}`);

    return { next: s.currentPokemon };
  }

  autoEnemyDraft() {
    const s = this.state;

    if (
      !s.currentPokemon ||
      s.enemyDraftDone() ||
      s.phase !== "draft"
    ) {
      return this.nextPokemon();
    }

    const cost = Math.min(
      s.enemy.tokens,
      Math.floor(Math.random() * 3) + 1
    );

    if (cost <= 0) {
      return this.nextPokemon();
    }

    s.enemy.team.push(s.currentPokemon);
    s.enemy.tokens -= cost;

    s.addLog(`🤖 Enemy auto-acquired ${s.currentPokemon.name} for ${cost} tokens because you are done drafting.`);

    if (s.bothDraftDone()) {
      return this.startBattlePhase();
    }

    return this.nextPokemon();
  }

  startBattlePhase() {
    const s = this.state;

    if (!s.canStartBattle()) {
      s.phase = "end";
      s.addLog("❌ Battle cannot start. One player has no Pokémon.");
      return { end: true };
    }

    s.phase = "battle";
    s.timeLeft = 0;
    s.currentPokemon = null;
    s.currentBid = 0;
    s.highestBidder = null;

    s.battle.started = true;
    s.battle.waitingForPlayerSelection = true;
    s.battle.status = "Choose your first Pokémon";
    s.battle.arena = this.generateArena();

    s.addLog("⚔️ Draft complete. Battle phase started.");
    s.addLog(`🏟️ Arena generated: ${s.battle.arena.name}`);

    return {
      battle: true,
      arena: s.battle.arena
    };
  }

  generateArena() {
    const s = this.state;

    const arenas = [
      {
        name: "Volcano Arena",
        type: "fire",
        description: "A burning battlefield filled with heat waves and molten rock.",
        effects: [
          "Fire-type damage: 1.5x",
          "Grass-type defense: 0.75x",
          "All Pokémon stamina drain: 1.2x"
        ]
      },
      {
        name: "Ocean Arena",
        type: "water",
        description: "A flooded arena where waves slow heavy movement.",
        effects: [
          "Water-type damage: 1.5x",
          "Fire-type damage: 0.75x",
          "Heavy Pokémon speed: 0.7x"
        ]
      },
      {
        name: "Electric Storm Arena",
        type: "electric",
        description: "Lightning strikes randomly across the battlefield.",
        effects: [
          "Electric-type damage: 1.5x",
          "Electric Pokémon speed: 1.25x",
          "Light Pokémon gain speed tie advantage"
        ]
      },
      {
        name: "Glacier Arena",
        type: "ice",
        description: "A frozen battlefield where movement becomes slippery.",
        effects: [
          "Ice-type damage: 1.5x",
          "All Pokémon speed: 0.8x",
          "Light Pokémon evasion: 1.2x"
        ]
      },
      {
        name: "Forest Arena",
        type: "grass",
        description: "A dense forest that helps natural Pokémon recover.",
        effects: [
          "Grass Pokémon healing: +5 HP per round",
          "Fire-type damage: 1.25x",
          "Ground-type defense: 1.2x"
        ]
      },
      {
        name: "Crystal Cave Arena",
        type: "rock",
        description: "A glowing crystal battlefield that strengthens defensive Pokémon.",
        effects: [
          "Rock-type defense: 1.3x",
          "Steel-type damage: 1.2x",
          "Light Pokémon speed: 0.9x"
        ]
      },
      {
        name: "Shadow Realm Arena",
        type: "ghost",
        description: "A dark arena where ghostly energy distorts movement.",
        effects: [
          "Ghost-type damage: 1.4x",
          "Psychic-type accuracy: 0.85x",
          "Speed ties favor lighter Pokémon"
        ]
      },
      {
        name: "Sky Temple Arena",
        type: "flying",
        description: "A floating arena high above the clouds.",
        effects: [
          "Flying-type speed: 1.3x",
          "Ground-type damage: 0.75x",
          "Light Pokémon speed: 1.15x"
        ]
      },
      {
        name: "Poison Swamp Arena",
        type: "poison",
        description: "A toxic battlefield that slowly drains stamina.",
        effects: [
          "Poison-type damage: 1.35x",
          "All Pokémon stamina recovery: 0.8x",
          "Grass-type speed: 0.85x"
        ]
      },
      {
        name: "Dragon Ruins Arena",
        type: "dragon",
        description: "Ancient ruins filled with powerful dragon energy.",
        effects: [
          "Dragon-type damage: 1.45x",
          "All Pokémon attack: 1.1x",
          "Speed ties favor higher total stats"
        ]
      }
    ];

    let available = arenas;

    if (s.battle.lastArenaName) {
      available = arenas.filter(
        arena => arena.name !== s.battle.lastArenaName
      );
    }

    const selected =
      available[Math.floor(Math.random() * available.length)];

    s.battle.lastArenaName = selected.name;

    return selected;
  }
}

module.exports = DraftEngine;