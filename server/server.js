const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const GameState = require("./game/GameState");
const DraftEngine = require("./game/DraftEngine");
const TurnManager = require("./game/TurnManager");
const TimeManager = require("./game/TimeManager");
const BattleEngine = require("./game/BattleEngine");
const RoomManager = require("./multiplayer/RoomManager");
const { getMoveMeta } = require("./game/MoveDatabase");
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const battleTimers = {};
const roomManager = new RoomManager();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

const state = new GameState();
const engine = new DraftEngine(state);
const turnManager = new TurnManager(state, engine);
const timeManager = new TimeManager(state, engine);
const battleEngine = new BattleEngine(state);

function createFastMoves(data) {
  return data.moves
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(m => {
      const moveName = m.move.name;
      const meta = getMoveMeta(moveName);

      const randomPower =
        meta.power !== undefined
          ? meta.power
          : Math.floor(Math.random() * 80) + 30;

      return {
        name: moveName,
        type: data.types[0].type.name,
        power: randomPower,
        accuracy: meta.accuracy ?? 96,
        staminaCost: Math.max(8, Math.ceil((randomPower || 30) / 4)),

        category: meta.category || "damage",
        priorityBonus: meta.priorityBonus || 0,

        statusEffect: meta.statusEffect || null,
        statusChance: meta.statusChance || 0,
        selfStatusEffect: meta.selfStatusEffect || null,

        delayedStatus: meta.delayedStatus || null,

        selfStatChange: meta.selfStatChange || null,
        enemyStatChange: meta.enemyStatChange || null,

        protect: meta.protect || false,
        endure: meta.endure || false,

        healPercent: meta.healPercent || null,
        drainPercent: meta.drainPercent || null,
        requiresTargetStatus: meta.requiresTargetStatus || null,

        chargeTurns: meta.chargeTurns || 0,
        avoidState: meta.avoidState || null,

        effectText: meta.effectText || "Basic damage move."
      };
    });
}

async function fetchPokemon(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const data = await res.json();

  return {
    id: data.id,
    name: data.name,

    image:
      data.sprites.other["official-artwork"].front_default ||
      data.sprites.front_default,

    animatedImage:
      data.sprites.versions?.["generation-v"]?.["black-white"]?.animated?.front_default ||
      data.sprites.front_default,

    stats: {
      hp: data.stats[0].base_stat,
      attack: data.stats[1].base_stat,
      defense: data.stats[2].base_stat,
      specialAttack: data.stats[3].base_stat,
      specialDefense: data.stats[4].base_stat,
      speed: data.stats[5].base_stat,
      stamina: 100
    },

    body: {
      height: data.height,
      weight: data.weight
    },

    type: data.types[0].type.name,
    types: data.types.map(t => t.type.name),

    moves: createFastMoves(data)
  };
}

async function loadPool() {
  state.resetGame();

  for (let i = 0; i < 20; i++) {
    const id = Math.floor(Math.random() * 150) + 1;
    const pokemon = await fetchPokemon(id);
    state.pool.push(pokemon);
  }

  state.index = 0;
  state.currentPokemon = state.pool[0];
  state.resetRound();

  state.addLog(`🎯 New Pokémon appeared: ${state.currentPokemon.name}`);
}

app.get("/api/start", async (req, res) => {
  try {
    await loadPool();

    timeManager.start();

    res.json({
      message: "Game started",
      room: state.room,
      pokemon: state.currentPokemon
    });
  } catch (err) {
    console.error("START ERROR:", err);

    res.status(500).json({
      error: "Failed to start game",
      details: err.message
    });
  }
});

app.get("/api/state", (req, res) => {
  res.json(state);
});

app.get("/api/generate", async (req, res) => {
  try {
    const id = Math.floor(Math.random() * 150) + 1;
    const pokemon = await fetchPokemon(id);

    res.json(pokemon);
  } catch (err) {
    res.status(500).json({
      error: "Failed to generate Pokémon",
      details: err.message
    });
  }
});

app.post("/api/bid", (req, res) => {
  const amount = Number(req.body.amount || 1);
  res.json(turnManager.bid(amount));
});

app.post("/api/pass", (req, res) => {
  res.json(turnManager.pass());
});

app.post("/api/next", (req, res) => {
  const next = engine.nextPokemon();
  res.json(next);
});

app.post("/api/battle/select", (req, res) => {
  const index = Number(req.body.index);

  if (state.phase !== "battle") {
    return res.json({
      error: "Battle has not started"
    });
  }

  if (
    Number.isNaN(index) ||
    index < 0 ||
    index >= state.player.team.length
  ) {
    return res.json({
      error: "Invalid Pokémon selection"
    });
  }

  const playerPokemon = state.player.team[index];

  const enemyIndex = chooseEnemyStartingPokemon(state.enemy.team);
  const enemyPokemon = state.enemy.team[enemyIndex];

  state.battle.playerActiveIndex = index;
  state.battle.playerActive = battleEngine.createBattlePokemon(playerPokemon);

  state.battle.enemyActiveIndex = enemyIndex;
  state.battle.enemyActive = battleEngine.createBattlePokemon(enemyPokemon);

  state.battle.waitingForPlayerSelection = false;
  state.battle.status = "Battle started. Choose a move.";

  state.addLog(`🟦 You sent out ${playerPokemon.name}.`);
  state.addLog(`🟥 Enemy sent out ${enemyPokemon.name}.`);

  battleEngine.startRound();

  res.json({
    ok: true,
    battle: state.battle
  });
});

function chooseEnemyStartingPokemon(team) {
  let bestIndex = 0;
  let bestScore = -Infinity;

  team.forEach((pokemon, index) => {
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

app.post("/api/battle/move", (req, res) => {
  const moveIndex = Number(req.body.moveIndex);
  const result = battleEngine.choosePlayerMove(moveIndex);

  res.json(result);
});

app.post("/api/battle/switch", (req, res) => {
  const index = Number(req.body.index);
  const result = battleEngine.choosePlayerSwitch(index);

  res.json(result);
});

app.post("/api/battle/timeout", (req, res) => {
  const result = battleEngine.forcePlayerTimeout();

  res.json(result);
});

app.post("/api/room/create", (req, res) => {
  res.json({
    message: "Room system foundation ready",
    room: state.room
  });
});

app.post("/api/room/join", (req, res) => {
  res.json({
    message: "Join room placeholder ready for multiplayer upgrade",
    room: state.room
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    poolSize: state.pool.length,
    phase: state.phase,
    room: state.room
  });
});

/* =========================
   MULTIPLAYER SOCKET ROOMS
========================= */
async function createMultiplayerDraftGame() {
  const pool = [];

  for (let i = 0; i < 20; i++) {
    const id = Math.floor(Math.random() * 150) + 1;
    const pokemon = await fetchPokemon(id);
    pool.push(pokemon);
  }

  return {
    phase: "draft",
    pool,
    index: 0,
    currentPokemon: pool[0],
    currentBid: 0,
    highestBidder: null,
activeBidder: "player1",

    players: {
      player1: {
        tokens: 20,
        team: [],
        passed: false
      },
      player2: {
        tokens: 20,
        team: [],
        passed: false
      }
    },

    bin: [],
    logs: [`🎯 Multiplayer draft started. First Pokémon: ${pool[0].name}`]
  };
}

function addRoomLog(game, message) {
  game.logs.push(message);

  if (game.logs.length > 150) {
    game.logs.shift();
  }
}
function getNextActiveBidder(game) {
  const p1Done =
    game.players.player1.team.length >= 6 ||
    game.players.player1.tokens <= 0;

  const p2Done =
    game.players.player2.team.length >= 6 ||
    game.players.player2.tokens <= 0;

  if (p1Done && !p2Done) return "player2";
  if (p2Done && !p1Done) return "player1";
  if (!p1Done && !p2Done) return "player1";

  return null;
}
function canPlayerRaise(game, role) {
  const player = game.players[role];

  if (!player) return false;

  if (player.team.length >= 6) {
    return false;
  }

  if (player.tokens <= game.currentBid) {
    return false;
  }

  return true;
}
function resetMultiplayerRound(game) {
  game.currentBid = 0;
  game.highestBidder = null;
  game.activeBidder = getNextActiveBidder(game);

  game.players.player1.passed = false;
  game.players.player2.passed = false;
}
function createMultiplayerBattleReady(game, message) {
  game.phase = "battle-ready";

  game.battle = {
    player1Starter: null,
    player2Starter: null,

    player1Move: null,
    player2Move: null,

    player1Ready: false,
    player2Ready: false,

    player1Action: null,
    player2Action: null,

    player1Active: null,
    player2Active: null,

    player1SwitchesLeft: 3,
    player2SwitchesLeft: 3,

    activeStarterPicker: "player1",

  round: 1,

battleTimer: 30,
stats: {
  player1: {
    damageDealt: 0,
    criticalHits: 0,
    movesUsed: 0,
    pokemonFainted: 0,
    switchesUsed: 0
  },
  player2: {
    damageDealt: 0,
    criticalHits: 0,
    movesUsed: 0,
    pokemonFainted: 0,
    switchesUsed: 0
  }
},

logs: []
  };

  game.currentPokemon = null;

  addRoomLog(game, message);
}

function shouldEndMultiplayerDraft(game) {
  const p1 = game.players.player1;
  const p2 = game.players.player2;

  const p1Done =
    p1.team.length >= 6 || p1.tokens <= 0;

  const p2Done =
    p2.team.length >= 6 || p2.tokens <= 0;

  return (
    (p1Done && p2Done) ||
    game.index >= game.pool.length
  );
}

function nextMultiplayerPokemon(game) {
  if (shouldEndMultiplayerDraft(game)) {
    createMultiplayerBattleReady(
      game,
      "⚔️ Draft complete. Choose your starter Pokémon."
    );
    return;
  }

  game.index++;

  if (shouldEndMultiplayerDraft(game)) {
    createMultiplayerBattleReady(
      game,
      "⚔️ Draft complete. Choose your starter Pokémon."
    );
    return;
  }

  game.currentPokemon = game.pool[game.index];
  resetMultiplayerRound(game);

  addRoomLog(
    game,
    `🎯 New Pokémon appeared: ${game.currentPokemon.name}`
  );
}

function resolveMultiplayerDraft(game) {
  const p1 = game.players.player1;
  const p2 = game.players.player2;

  if (p1.passed && p2.passed && !game.highestBidder) {
    game.bin.push(game.currentPokemon);
    addRoomLog(game, `⚫ Both players passed. ${game.currentPokemon.name} went to BIN.`);
    nextMultiplayerPokemon(game);
    return;
  }

  if (p1.passed && game.highestBidder === "player2") {
    p2.team.push(game.currentPokemon);
    p2.tokens -= game.currentBid;

    addRoomLog(
      game,
      `✅ Player 2 won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
    );

    nextMultiplayerPokemon(game);
    return;
  }

  if (p2.passed && game.highestBidder === "player1") {
    p1.team.push(game.currentPokemon);
    p1.tokens -= game.currentBid;

    addRoomLog(
      game,
      `✅ Player 1 won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
    );

    nextMultiplayerPokemon(game);
    return;
  }

  if (p1.passed && p2.passed) {
    game.bin.push(game.currentPokemon);
    addRoomLog(game, `⚫ Both players passed. ${game.currentPokemon.name} went to BIN.`);
    nextMultiplayerPokemon(game);
  }
}

function emitRoomGame(roomCode) {
  const game = roomManager.getGame(roomCode);

  io.to(roomCode).emit("multiplayerGameUpdate", {
    roomCode,
    game
  });
}
function prepareBattlePokemon(pokemon) {
  return {
    ...pokemon,
    battleStats: pokemon.battleStats || {
      currentHp: pokemon.stats.hp,
      maxHp: pokemon.stats.hp,
      currentStamina: pokemon.stats.stamina || 100,
      maxStamina: pokemon.stats.stamina || 100
    },
    battleStatus: pokemon.battleStatus || null,
    battleCounters: pokemon.battleCounters || null
  };
}
function getTypeMultiplier(moveType, defenderTypes) {
  const typeChart = {
    fire: {
      grass: 2,
      ice: 2,
      bug: 2,
      steel: 2,
      water: 0.5,
      fire: 0.5,
      rock: 0.5,
      dragon: 0.5
    },
    water: {
      fire: 2,
      ground: 2,
      rock: 2,
      water: 0.5,
      grass: 0.5,
      dragon: 0.5
    },
    grass: {
      water: 2,
      ground: 2,
      rock: 2,
      fire: 0.5,
      grass: 0.5,
      poison: 0.5,
      flying: 0.5,
      bug: 0.5,
      dragon: 0.5,
      steel: 0.5
    },
    electric: {
      water: 2,
      flying: 2,
      electric: 0.5,
      grass: 0.5,
      dragon: 0.5,
      ground: 0
    },
    ice: {
      grass: 2,
      ground: 2,
      flying: 2,
      dragon: 2,
      fire: 0.5,
      water: 0.5,
      ice: 0.5,
      steel: 0.5
    },
    fighting: {
      normal: 2,
      ice: 2,
      rock: 2,
      dark: 2,
      steel: 2,
      poison: 0.5,
      flying: 0.5,
      psychic: 0.5,
      bug: 0.5,
      fairy: 0.5,
      ghost: 0
    },
    poison: {
      grass: 2,
      fairy: 2,
      poison: 0.5,
      ground: 0.5,
      rock: 0.5,
      ghost: 0.5,
      steel: 0
    },
    ground: {
      fire: 2,
      electric: 2,
      poison: 2,
      rock: 2,
      steel: 2,
      grass: 0.5,
      bug: 0.5,
      flying: 0
    },
    flying: {
      grass: 2,
      fighting: 2,
      bug: 2,
      electric: 0.5,
      rock: 0.5,
      steel: 0.5
    },
    psychic: {
      fighting: 2,
      poison: 2,
      psychic: 0.5,
      steel: 0.5,
      dark: 0
    },
    bug: {
      grass: 2,
      psychic: 2,
      dark: 2,
      fire: 0.5,
      fighting: 0.5,
      poison: 0.5,
      flying: 0.5,
      ghost: 0.5,
      steel: 0.5,
      fairy: 0.5
    },
    rock: {
      fire: 2,
      ice: 2,
      flying: 2,
      bug: 2,
      fighting: 0.5,
      ground: 0.5,
      steel: 0.5
    },
    ghost: {
      psychic: 2,
      ghost: 2,
      dark: 0.5,
      normal: 0
    },
    dragon: {
      dragon: 2,
      steel: 0.5,
      fairy: 0
    },
    dark: {
      psychic: 2,
      ghost: 2,
      fighting: 0.5,
      dark: 0.5,
      fairy: 0.5
    },
    steel: {
      ice: 2,
      rock: 2,
      fairy: 2,
      fire: 0.5,
      water: 0.5,
      electric: 0.5,
      steel: 0.5
    },
    fairy: {
      fighting: 2,
      dragon: 2,
      dark: 2,
      fire: 0.5,
      poison: 0.5,
      steel: 0.5
    }
  };

  const types =
    Array.isArray(defenderTypes)
      ? defenderTypes
      : [defenderTypes];

  return types.reduce((multiplier, defenderType) => {
    const value =
      typeChart[moveType]?.[defenderType] ?? 1;

    return multiplier * value;
  }, 1);
}
function getMoveDamage(attacker, defender, move) {
  const power = move.power || 40;
  const attack = attacker.stats.attack || 50;
  const defense = defender.stats.defense || 50;

  const defenderTypes =
    defender.types || [defender.type];

  const typeMultiplier =
    getTypeMultiplier(move.type || attacker.type, defenderTypes);

  const rawDamage =
    ((power * attack) / Math.max(1, defense)) * 0.45;

  let finalDamage =
    Math.max(1, Math.round(rawDamage * typeMultiplier));

  const critical =
    Math.random() < 0.10;

  if (critical) {
    finalDamage =
      Math.max(1, Math.round(finalDamage * 1.5));
  }

  return {
    damage: finalDamage,
    typeMultiplier,
    critical
  };
}
function canHitAvoidingTarget(move, avoidState) {
  const name = String(move.name || "").toLowerCase();

  const exceptions = {
    underground: ["earthquake", "magnitude", "fissure"],
    airborne: ["thunder", "gust", "twister"],
    underwater: ["surf", "whirlpool"],
    vanished: []
  };

  return exceptions[avoidState]?.includes(name) || false;
}

function beginChargeMove(game, role, pokemon, move) {
  ensureBattleStatus(pokemon);

  pokemon.battleStatus.charging = {
    move,
    avoidState: move.avoidState || null
  };

  const stateText =
    move.avoidState
      ? ` and became ${move.avoidState}`
      : "";

  addRoomLog(
    game,
    `⏳ ${role} ${pokemon.name} began charging ${move.name}${stateText}.`
  );
}

function releaseChargeMove(pokemon) {
  ensureBattleStatus(pokemon);

  const chargeData =
    pokemon.battleStatus.charging;

  if (!chargeData) return null;

  pokemon.battleStatus.charging = null;

  return chargeData.move;
}
function ensureBattleStatus(pokemon) {
  if (!pokemon.battleStatus) {
    pokemon.battleStatus = {};
  }

  pokemon.battleStatus.poison ??= false;
  pokemon.battleStatus.paralysis ??= false;
  pokemon.battleStatus.burn ??= false;
  pokemon.battleStatus.sleep ??= false;
  pokemon.battleStatus.confusion ??= false;
  pokemon.battleStatus.protected ??= false;
  pokemon.battleStatus.endure ??= false;

  pokemon.battleStatus.charging ??= null;

  pokemon.battleStatus.statModifiers ??= {
    attack: 0,
    defense: 0,
    speed: 0,
    accuracy: 0,
    evasion: 0,
    critChance: 0
  };
}

function applyStatusEffect(game, target, statusEffect, chance, targetLabel) {
  if (!statusEffect || chance <= 0) return;

  ensureBattleStatus(target);

  const roll = Math.random() * 100;

  if (roll > chance) return;

  if (target.battleStatus[statusEffect]) return;

  target.battleStatus[statusEffect] = true;

  addRoomLog(
    game,
    `💫 ${targetLabel} ${target.name} is now ${statusEffect}!`
  );
}

function applyStatChange(game, pokemon, statChange, label) {
  if (!statChange) return;

  ensureBattleStatus(pokemon);

  const stat =
    statChange.stat;

  const amount =
    statChange.amount || 0;

  pokemon.battleStatus.statModifiers[stat] =
    (pokemon.battleStatus.statModifiers[stat] || 0) + amount;

  addRoomLog(
    game,
    `📊 ${label} ${pokemon.name}'s ${stat} changed by ${amount}.`
  );
}

function getModifiedStat(pokemon, stat) {
  ensureBattleStatus(pokemon);

  const base =
    pokemon.stats[stat] || 50;

  const modifier =
    pokemon.battleStatus.statModifiers[stat] || 0;

  return Math.max(1, base + modifier);
}

function applyStartOfRoundStatus(game) {
  ["player1", "player2"].forEach(role => {
    const pokemon =
      game.battle[`${role}Active`];

    if (!pokemon) return;

    ensureBattleStatus(pokemon);

    if (pokemon.battleStatus.poison) {
      const damage =
        Math.max(1, Math.round(pokemon.battleStats.maxHp * 0.06));

      pokemon.battleStats.currentHp =
        Math.max(0, pokemon.battleStats.currentHp - damage);

      addRoomLog(
        game,
        `☠️ ${role} ${pokemon.name} took ${damage} poison damage.`
      );
    }

    if (pokemon.battleStatus.burn) {
      const damage =
        Math.max(1, Math.round(pokemon.battleStats.maxHp * 0.04));

      pokemon.battleStats.currentHp =
        Math.max(0, pokemon.battleStats.currentHp - damage);

      addRoomLog(
        game,
        `🔥 ${role} ${pokemon.name} took ${damage} burn damage.`
      );
    }
  });
}
function getEffectiveSpeed(pokemon, move) {
  let speed =
    getModifiedStat(pokemon, "speed");

  if (pokemon.battleStatus?.paralysis) {
    speed = Math.floor(speed * 0.65);
  }

  return speed + (move.priorityBonus || 0);
}

function didMoveHit(attacker, defender, move) {
  ensureBattleStatus(attacker);
  ensureBattleStatus(defender);

  let accuracy =
    move.accuracy ?? 100;

  accuracy +=
    attacker.battleStatus.statModifiers.accuracy || 0;

  accuracy -=
    defender.battleStatus.statModifiers.evasion || 0;

  if (attacker.battleStatus.paralysis) {
    accuracy -= 10;
  }

  accuracy = Math.max(45, Math.min(100, accuracy));

  const roll =
    Math.random() * 100;

  return roll <= accuracy;
}
function healPokemon(game, pokemon, move, label) {
  if (!move.healPercent) return false;

  const healAmount =
    Math.round(pokemon.battleStats.maxHp * (move.healPercent / 100));

  pokemon.battleStats.currentHp =
    Math.min(
      pokemon.battleStats.maxHp,
      pokemon.battleStats.currentHp + healAmount
    );

  addRoomLog(
    game,
    `💚 ${label} ${pokemon.name} healed ${healAmount} HP.`
  );

  if (move.selfStatusEffect) {
    ensureBattleStatus(pokemon);
    pokemon.battleStatus[move.selfStatusEffect] = true;

    addRoomLog(
      game,
      `💤 ${label} ${pokemon.name} became ${move.selfStatusEffect}.`
    );
  }

  return true;
}

function applyDrainHealing(game, attacker, damage, move, label) {
  if (!move.drainPercent) return;

  const heal =
    Math.max(1, Math.round(damage * (move.drainPercent / 100)));

  attacker.battleStats.currentHp =
    Math.min(
      attacker.battleStats.maxHp,
      attacker.battleStats.currentHp + heal
    );

  addRoomLog(
    game,
    `🌿 ${label} ${attacker.name} drained ${heal} HP.`
  );
}

function checkConfusion(game, pokemon, label) {
  if (!pokemon.battleStatus?.confusion) return false;

  const roll = Math.random() * 100;

  if (roll <= 25) {
    const damage =
      Math.max(1, Math.round(pokemon.battleStats.maxHp * 0.05));

    pokemon.battleStats.currentHp =
      Math.max(0, pokemon.battleStats.currentHp - damage);

    addRoomLog(
      game,
      `💫 ${label} ${pokemon.name} hurt itself in confusion for ${damage} damage.`
    );

    return true;
  }

  return false;
}

function checkSleep(game, pokemon, label) {
  if (!pokemon.battleStatus?.sleep) return false;

  const roll = Math.random() * 100;

  if (roll <= 60) {
    addRoomLog(
      game,
      `💤 ${label} ${pokemon.name} is asleep and could not move.`
    );

    return true;
  }

  pokemon.battleStatus.sleep = false;

  addRoomLog(
    game,
    `🌅 ${label} ${pokemon.name} woke up!`
  );

  return false;
}

function checkEndure(game, defender, incomingDamage, label) {
  if (!defender.battleStatus?.endure) return incomingDamage;

  if (incomingDamage >= defender.battleStats.currentHp) {
    addRoomLog(
      game,
      `🛡️ ${label} ${defender.name} endured the hit!`
    );

    return defender.battleStats.currentHp - 1;
  }

  return incomingDamage;
}

function getOpponentRole(role) {
  return role === "player1" ? "player2" : "player1";
}

function bothPlayersChoseMove(game) {
  return (
    game.battle.player1Ready === true &&
    game.battle.player2Ready === true
  );
}

function resetMultiplayerBattleRound(game, roomCode = null) {
  game.battle.player1Move = null;
  game.battle.player2Move = null;

  game.battle.player1Ready = false;
  game.battle.player2Ready = false;

  game.battle.player1Action = null;
  game.battle.player2Action = null;

  game.battle.round++;

  addRoomLog(
    game,
    `⚔️ Round ${game.battle.round} started. Choose your move.`
  );
if (roomCode) {
  startBattleTimer(roomCode, game);
}
}

function handleMultiplayerSwitch(game, role) {
  const action = game.battle[`${role}Action`];

  if (!action || action.type !== "switch") return;

  const pokemonIndex = action.pokemonIndex;
  const team = game.players[role].team;
  const pokemon = team[pokemonIndex];

  if (!pokemon) return;

  const currentActive = game.battle[`${role}Active`];
  const currentIndex = game.battle[`${role}Starter`];

  if (
    currentActive &&
    currentIndex !== null &&
    team[currentIndex]
  ) {
    team[currentIndex].battleStats = currentActive.battleStats;
    team[currentIndex].battleStatus = currentActive.battleStatus;
    team[currentIndex].battleCounters = currentActive.battleCounters;
  }

  const nextPokemon = structuredClone(pokemon);

  nextPokemon.battleStats =
    nextPokemon.battleStats || {
      currentHp: nextPokemon.stats.hp,
      maxHp: nextPokemon.stats.hp,
      currentStamina: nextPokemon.stats.stamina || 100,
      maxStamina: nextPokemon.stats.stamina || 100
    };

  game.battle[`${role}Starter`] = pokemonIndex;
  game.battle[`${role}Active`] = nextPokemon;

  game.battle[`${role}SwitchesLeft`] =
    Math.max(
      0,
      (game.battle[`${role}SwitchesLeft`] || 0) - 1
    );

  addRoomLog(
    game,
    `🔄 ${role === "player1" ? "Player 1" : "Player 2"} switched to ${pokemon.name}.`
  );
  clearOneTurnBattleEffects(game.battle[`${role}Active`]);
}
function countBattleActionAndRecoverStamina(game, pokemon) {
  ensureBattleCounters(pokemon);

  pokemon.battleCounters.actionsMade++;

  if (pokemon.battleCounters.actionsMade % 2 === 0) {
    pokemon.battleStats.currentStamina = Math.min(
      pokemon.battleStats.maxStamina,
      pokemon.battleStats.currentStamina + 20
    );

    addRoomLog(
      game,
      `⚡ ${pokemon.name} recovered 20 stamina.`
    );
  }
}
function clearOneTurnBattleEffects(pokemon) {
  ensureBattleStatus(pokemon);

  pokemon.battleStatus.protected = false;
  pokemon.battleStatus.endure = false;
}

function resolveMultiplayerBattleRound(game, roomCode = null) {
  const p1 = game.battle.player1Active;
  const p2 = game.battle.player2Active;

  const p1Action = game.battle.player1Action;
  const p2Action = game.battle.player2Action;

  if (!p1 || !p2 || !p1Action || !p2Action) return;

  ensureBattleStatus(p1);
ensureBattleStatus(p2);
ensureBattleCounters(p1);
ensureBattleCounters(p2);

clearOneTurnBattleEffects(p1);
clearOneTurnBattleEffects(p2);

applyStartOfRoundStatus(game);

  handleMultiplayerSwitch(game, "player1");
  handleMultiplayerSwitch(game, "player2");

  const p1AfterSwitch = game.battle.player1Active;
  const p2AfterSwitch = game.battle.player2Active;

  const p1Move =
    game.battle.player1Action?.type === "move"
      ? game.battle.player1Action.move
      : null;

  const p2Move =
    game.battle.player2Action?.type === "move"
      ? game.battle.player2Action.move
      : null;

  const attackOrder = [];

  if (p1Move) attackOrder.push("player1");
  if (p2Move) attackOrder.push("player2");

  attackOrder.sort((a, b) => {
    const pokemonA = game.battle[`${a}Active`];
    const pokemonB = game.battle[`${b}Active`];

    const moveA = game.battle[`${a}Action`].move;
    const moveB = game.battle[`${b}Action`].move;

    return (
      getEffectiveSpeed(pokemonB, moveB) -
      getEffectiveSpeed(pokemonA, moveA)
    );
  });

  attackOrder.forEach(attackerRole => {
    const defenderRole = getOpponentRole(attackerRole);

    const attacker = game.battle[`${attackerRole}Active`];
    const defender = game.battle[`${defenderRole}Active`];
    const move = game.battle[`${attackerRole}Action`]?.move;

    if (!attacker || !defender || !move) return;
    if (attacker.battleStats.currentHp <= 0) return;
    if (defender.battleStats.currentHp <= 0) return;

    if (attacker.battleStats.currentStamina < move.staminaCost) {
      addRoomLog(
        game,
        `${attackerRole} did not have enough stamina for ${move.name}.`
      );
      return;
    }

    attacker.battleStats.currentStamina = Math.max(
      0,
      attacker.battleStats.currentStamina - move.staminaCost
    );
  countBattleActionAndRecoverStamina(game, attacker);

    if (checkSleep(game, attacker, attackerRole)) return;
    if (checkConfusion(game, attacker, attackerRole)) return;

    if (!didMoveHit(attacker, defender, move)) {
      addRoomLog(
        game,
        `❌ ${attackerRole} ${attacker.name} used ${move.name}, but it missed!`
      );
      return;
    }
if (defender.battleStatus?.charging?.avoidState) {
  const avoidState =
    defender.battleStatus.charging.avoidState;

  if (!canHitAvoidingTarget(move, avoidState)) {
    addRoomLog(
      game,
      `💨 ${defenderRole} ${defender.name} avoided the attack while ${avoidState}!`
    );
    return;
  }
}

if (move.category === "charge" && !game.battle[`${attackerRole}Action`]?.chargedRelease) {
  if (move.selfStatChange) {
    applyStatChange(game, attacker, move.selfStatChange, attackerRole);
  }

  beginChargeMove(game, attackerRole, attacker, move);
  return;
}

if (game.battle[`${attackerRole}Action`]?.chargedRelease) {
  releaseChargeMove(attacker);
}

 if (move.category === "heal") {
  healPokemon(game, attacker, move, attackerRole);
  return;
}

if (move.endure) {
  ensureBattleStatus(attacker);
  attacker.battleStatus.endure = true;

  addRoomLog(
    game,
    `🛡️ ${attackerRole} ${attacker.name} is enduring this turn.`
  );

  return;
}

if (move.protect) {
  ensureBattleStatus(attacker);
  attacker.battleStatus.protected = true;

  addRoomLog(
    game,
    `🛡️ ${attackerRole} ${attacker.name} protected itself!`
  );

  return;
}

    if (move.selfStatChange) {
      applyStatChange(game, attacker, move.selfStatChange, attackerRole);
    }

    if (move.enemyStatChange) {
      applyStatChange(game, defender, move.enemyStatChange, defenderRole);
    }

    if (move.category !== "damage" && move.power === 0) {
      return;
    }

    if (defender.battleStatus?.protected) {
      addRoomLog(
        game,
        `🛡️ ${defenderRole} ${defender.name} blocked the attack!`
      );
      return;
    }

    const result = getMoveDamage(attacker, defender, move);

    const finalDamage =
      checkEndure(game, defender, result.damage, defenderRole);

    defender.battleStats.currentHp =
      Math.max(
        0,
        defender.battleStats.currentHp - finalDamage
      );
game.battle.stats[attackerRole]
  .damageDealt += finalDamage;

game.battle.stats[attackerRole]
  .movesUsed++;
    addRoomLog(
      game,
      `💥 ${attackerRole} ${attacker.name} used ${move.name}. ${defenderRole} ${defender.name} took ${finalDamage} damage.`
    );

    applyDrainHealing(
      game,
      attacker,
      finalDamage,
      move,
      attackerRole
    );

    applyStatusEffect(
      game,
      defender,
      move.statusEffect,
      move.statusChance,
      defenderRole
    );

 if (result.critical) {
  addRoomLog(game, "💢 CRITICAL HIT!");

  game.battle.stats[attackerRole]
    .criticalHits++;
}

if (result.typeMultiplier > 1) {
  addRoomLog(game, "🔥 It's super effective!");
}

if (result.typeMultiplier > 0 && result.typeMultiplier < 1) {
  addRoomLog(game, "🛡️ It's not very effective...");
}

if (result.typeMultiplier === 0) {
  addRoomLog(game, "❌ It had no effect!");
}
  });

  syncActiveToTeam(game, "player1");
  syncActiveToTeam(game, "player2");

  if (p1AfterSwitch.battleStats.currentHp <= 0 && p2AfterSwitch.battleStats.currentHp <= 0) {
  stopBattleTimer(roomCode);
    game.phase = "battle-ended";
    game.battle.winner = "draw";
    addRoomLog(game, "⚖️ Both Pokémon fainted. Battle ended in a draw.");
    return;
  }

  if (game.battle.player1Active.battleStats.currentHp <= 0) {
    stopBattleTimer(roomCode);
    addRoomLog(game, `💀 Player 1's ${game.battle.player1Active.name} fainted.`);

    const alive = getAliveTeamIndexes(game, "player1");

    if (alive.length === 0) {
      endMultiplayerBattle(game, "player2");
      return;
    }

    game.phase = "pokemon-fainted";
    game.battle.faintedPlayer = "player1";
    addRoomLog(game, "🔁 Player 1 must choose a replacement Pokémon.");
    return;
  }

  if (game.battle.player2Active.battleStats.currentHp <= 0) {
    stopBattleTimer(roomCode);
    addRoomLog(game, `💀 Player 2's ${game.battle.player2Active.name} fainted.`);

    const alive = getAliveTeamIndexes(game, "player2");

    if (alive.length === 0) {
      endMultiplayerBattle(game, "player1");
      return;
    }

    game.phase = "pokemon-fainted";
    game.battle.faintedPlayer = "player2";
    addRoomLog(game, "🔁 Player 2 must choose a replacement Pokémon.");
    return;
  }

  resetMultiplayerBattleRound(game, roomCode);
}

function ensureBattleCounters(pokemon) {
  if (!pokemon.battleCounters) {
    pokemon.battleCounters = {
      actionsMade: 0
    };
  }
}
function getAliveTeamIndexes(game, role) {
  return game.players[role].team
    .map((pokemon, index) => ({ pokemon, index }))
    .filter(item => {
      const activeIndex =
        game.battle[`${role}Starter`];

      if (item.index === activeIndex) return false;

      return !item.pokemon.battleStats ||
        item.pokemon.battleStats.currentHp > 0;
    })
    .map(item => item.index);
}

function syncActiveToTeam(game, role) {
  const activeIndex =
    game.battle[`${role}Starter`];

  const activePokemon =
    game.battle[`${role}Active`];

  if (
    activeIndex !== null &&
    activePokemon &&
    game.players[role].team[activeIndex]
  ) {
    game.players[role].team[activeIndex].battleStats =
      activePokemon.battleStats;

    game.players[role].team[activeIndex].battleStatus =
      activePokemon.battleStatus;

    game.players[role].team[activeIndex].battleCounters =
      activePokemon.battleCounters;
  }
}

function endMultiplayerBattle(game, winnerRole) {

  game.phase = "battle-ended";
  game.battle.winner = winnerRole;

  addRoomLog(
    game,
    `🏆 ${winnerRole === "player1" ? "Player 1" : "Player 2"} wins the full team battle!`
  );
}
function startBattleTimer(roomCode, game) {
  stopBattleTimer(roomCode);

  game.battle.battleTimer = 30;

  battleTimers[roomCode] = setInterval(() => {
    if (!game || game.phase !== "battle") {
      stopBattleTimer(roomCode);
      return;
    }

    game.battle.battleTimer--;

    emitRoomGame(roomCode);

    if (game.battle.battleTimer <= 0) {
      stopBattleTimer(roomCode);
      forceTimerActions(roomCode, game);
    }
  }, 1000);
}

function stopBattleTimer(roomCode) {
  if (battleTimers[roomCode]) {
    clearInterval(battleTimers[roomCode]);
    delete battleTimers[roomCode];
  }
}
function forceTimerActions(roomCode, game) {
  ["player1", "player2"].forEach(role => {
    if (game.battle[`${role}Ready`]) return;

    const active =
      game.battle[`${role}Active`];

    if (!active) return;

    const move =
      active.moves.find(
        m =>
          active.battleStats.currentStamina >=
          m.staminaCost
      );

    if (!move) {
      game.battle[`${role}Ready`] = true;

      addRoomLog(
        game,
        `⏰ ${role} skipped the turn.`
      );

      return;
    }

    game.battle[`${role}Move`] = move;

    game.battle[`${role}Action`] = {
      type: "move",
      move
    };

    game.battle[`${role}Ready`] = true;

    addRoomLog(
      game,
      `⏰ ${role} timed out. ${move.name} was selected automatically.`
    );
  });

  if (bothPlayersChoseMove(game)) {
   resolveMultiplayerBattleRound(game, roomCode);
  }

  emitRoomGame(roomCode);
}
const MULTIPLAYER_ARENAS = [
  {
    name: "🌋 Volcano Arena",
    type: "fire",
    description: "A burning battlefield filled with heat and pressure."
  },
  {
    name: "🌊 Ocean Arena",
    type: "water",
    description: "A wave-covered arena surrounded by deep water."
  },
  {
    name: "🌲 Forest Arena",
    type: "grass",
    description: "A natural arena full of trees, roots, and wild energy."
  },
  {
    name: "⚡ Thunder Arena",
    type: "electric",
    description: "A charged arena where lightning flashes around the fighters."
  },
  {
    name: "🌑 Shadow Arena",
    type: "dark",
    description: "A dark battlefield made for intense rival battles."
  }
];

function chooseMultiplayerArena() {
  return MULTIPLAYER_ARENAS[
    Math.floor(Math.random() * MULTIPLAYER_ARENAS.length)
  ];
}
function createReconnectToken() {
  return Math.random().toString(36).substring(2, 15);
}
function getReconnectSafeRole(roomCode, socketId) {
  const game =
    roomManager.getGame(roomCode);

  if (game?.players?.player1?.socketId === socketId) {
    return "player1";
  }

  if (game?.players?.player1?.oldSocketId === socketId) {
    return "player1";
  }

  if (game?.players?.player2?.socketId === socketId) {
    return "player2";
  }

  if (game?.players?.player2?.oldSocketId === socketId) {
    return "player2";
  }

  return roomManager.getPlayerRole(roomCode, socketId);
}
io.on("connection", socket => {
  console.log("🟢 Player connected:", socket.id);

  socket.emit("connected", {
    socketId: socket.id,
    message: "Connected to multiplayer server"
  });
  socket.on("reconnectBattle", data => {
  const roomCode =
    String(data.roomCode || "").trim().toUpperCase();

  const reconnectToken =
    String(data.reconnectToken || "");

  const game =
    roomManager.getGame(roomCode);
console.log("ROOM:", roomCode);
console.log("GAME EXISTS:", !!game);
if (game) {
  console.log("PHASE:", game.phase);
  console.log("PLAYERS:", Object.keys(game.players || {}));
  console.log("Player1 token:", game.players?.player1?.reconnectToken);
  console.log("Player2 token:", game.players?.player2?.reconnectToken);
}

console.log("Reconnect token received:", reconnectToken);
  if (!game) {
    socket.emit("roomError", {
      message: "No reconnectable game found"
    });
    return;
  }

  console.log(
    "Player1 token:",
    game.players?.player1?.reconnectToken
  );

  console.log(
    "Player2 token:",
    game.players?.player2?.reconnectToken
  );

  let role = null;

  if (
    game.players.player1.reconnectToken ===
    reconnectToken
  ) {
    role = "player1";
  }

  if (
    game.players.player2.reconnectToken ===
    reconnectToken
  ) {
    role = "player2";
  }

  if (!role) {
    socket.emit("roomError", {
      message: "Invalid reconnect token"
    });
    return;
  }

  socket.join(roomCode);

const room =
  roomManager.getRoom(roomCode);

if (room && room.players) {
  const roomPlayer =
    room.players.find(player => player.role === role);

  if (roomPlayer) {
    roomPlayer.id = socket.id;
  }
}

game.players[role].oldSocketId =
  game.players[role].socketId;

game.players[role].socketId =
  socket.id;

game.players[role].disconnected =
  false;

  addRoomLog(
    game,
    `✅ ${
      role === "player1"
        ? "Player 1"
        : "Player 2"
    } reconnected.`
  );

  if (
    !game.players.player1.disconnected &&
    !game.players.player2.disconnected
  ) {
    if (
      game.phase === "waiting-reconnect"
    ) {
      game.phase =
        game.previousPhase || "draft";
    }
  }

 socket.emit("reconnectSuccess", {
  roomCode,
  role
});

emitRoomGame(roomCode);
});
socket.on("createRoom", () => {
  const room =
    roomManager.createRoom(socket.id);

  const reconnectToken =
    createReconnectToken();

  room.player1ReconnectToken =
    reconnectToken;

  socket.reconnectToken =
    reconnectToken;

  socket.join(room.code);

  socket.emit("roomCreated", {
    roomCode: room.code,
    role: "player1",
    players: room.players.length,
    reconnectToken
  });

  io.to(room.code).emit("roomUpdate", {
    roomCode: room.code,
    players: room.players.length,
    room
  });
});
 socket.on("joinRoom", roomCode => {
  const code =
    String(roomCode || "").trim().toUpperCase();

  const room =
    roomManager.joinRoom(code, socket.id);

  if (room.error) {
    socket.emit("roomError", {
      message: room.error
    });
    return;
  }

  const reconnectToken =
    createReconnectToken();

  room.player2ReconnectToken =
    reconnectToken;

  socket.reconnectToken =
    reconnectToken;

  socket.join(code);

  socket.emit("roomJoined", {
    roomCode: code,
    role: "player2",
    players: room.players.length,
    reconnectToken
  });

  io.to(code).emit("roomUpdate", {
    roomCode: code,
    players: room.players.length,
    room
  });
});
socket.on("startMultiplayerDraft", async roomCode => {
  const code = String(roomCode || "").trim().toUpperCase();

  const room = roomManager.getRoom(code);

  if (!room) {
    socket.emit("roomError", {
      message: "Room not found"
    });
    return;
  }

const role =
  getReconnectSafeRole(roomCode, socket.id);

  if (role !== "player1") {
    socket.emit("roomError", {
      message: "Only Player 1 can start the multiplayer draft"
    });
    return;
  }

  if (room.players.length < 2) {
    socket.emit("roomError", {
      message: "Need 2 players to start multiplayer draft"
    });
    return;
  }
io.to(code).emit("multiplayerDraftLoading", {
  message: "Creating multiplayer draft arena..."
});
  const game =
    await createMultiplayerDraftGame();

  if (room && room.players) {
   game.players.player1.socketId =
  room.players.find(p => p.role === "player1")?.id;

game.players.player2.socketId =
  room.players.find(p => p.role === "player2")?.id;

    game.players.player1.reconnectToken =
      room.player1ReconnectToken;

    game.players.player2.reconnectToken =
      room.player2ReconnectToken;

    game.players.player1.disconnected = false;
    game.players.player2.disconnected = false;
  }

  roomManager.setGame(code, game);

  io.to(code).emit("multiplayerDraftStarted", {
    roomCode: code,
    game
  });

  emitRoomGame(code);
});
function canPlayerRaise(game, role) {
  const player = game.players[role];

  if (!player) return false;
  if (player.team.length >= 6) return false;
  if (player.tokens <= game.currentBid) return false;

  return true;
}

function forceAwardToHighestBidder(game) {
  if (!game.highestBidder) return false;

  const winnerRole = game.highestBidder;
  const winner = game.players[winnerRole];
  const winnerLabel = winnerRole === "player1" ? "Player 1" : "Player 2";

  if (winner.team.length < 6) {
    winner.team.push(game.currentPokemon);
    winner.tokens -= game.currentBid;
  }

  addRoomLog(
    game,
    `✅ ${winnerLabel} won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
  );

  nextMultiplayerPokemon(game);
  return true;
}
socket.on("multiplayerBid", data => {
  const code = String(data.roomCode || "").trim().toUpperCase();
  const amount = Number(data.amount || 1);

  const room = roomManager.getRoom(code);
  const game = roomManager.getGame(code);

  if (!room || !game) {
    socket.emit("roomError", { message: "No active multiplayer game" });
    return;
  }

  if (game.phase !== "draft") {
    socket.emit("roomError", { message: "Draft is not active" });
    return;
  }

  const role =
  getReconnectSafeRole(code, socket.id);

  if (!role) {
    socket.emit("roomError", { message: "You are not in this room" });
    return;
  }

  if (role !== game.activeBidder) {
    socket.emit("roomError", {
      message: "Wait for the other player's action"
    });
    return;
  }

  const player = game.players[role];
  const otherRole = role === "player1" ? "player2" : "player1";
  const label = role === "player1" ? "Player 1" : "Player 2";
  const otherLabel = otherRole === "player1" ? "Player 1" : "Player 2";

  if (player.team.length >= 6 || player.tokens <= game.currentBid) {
    player.passed = true;

    addRoomLog(
      game,
      `${label} cannot raise the bid and is forced to pass.`
    );

    if (game.highestBidder) {
      const winnerRole = game.highestBidder;
      const winner = game.players[winnerRole];
      const winnerLabel =
        winnerRole === "player1" ? "Player 1" : "Player 2";

      if (winner.team.length < 6) {
        winner.team.push(game.currentPokemon);
        winner.tokens -= game.currentBid;
      }

      addRoomLog(
        game,
        `✅ ${winnerLabel} won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
      );

      nextMultiplayerPokemon(game);
      emitRoomGame(code);
      return;
    }

    game.activeBidder = otherRole;
    emitRoomGame(code);
    return;
  }

  if (player.passed) {
    socket.emit("roomError", {
      message: "You already passed this Pokémon"
    });
    return;
  }

  const newBid = game.currentBid + amount;

  if (newBid > player.tokens) {
    player.passed = true;

    addRoomLog(
      game,
      `${label} cannot raise the bid and is forced to pass.`
    );

    if (game.highestBidder) {
      const winnerRole = game.highestBidder;
      const winner = game.players[winnerRole];
      const winnerLabel =
        winnerRole === "player1" ? "Player 1" : "Player 2";

      if (winner.team.length < 6) {
        winner.team.push(game.currentPokemon);
        winner.tokens -= game.currentBid;
      }

      addRoomLog(
        game,
        `✅ ${winnerLabel} won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
      );

      nextMultiplayerPokemon(game);
      emitRoomGame(code);
      return;
    }

    game.activeBidder = otherRole;
    emitRoomGame(code);
    return;
  }

  game.currentBid = newBid;
  game.highestBidder = role;

  addRoomLog(game, `💰 ${label} bid ${game.currentBid}`);

  if (game.players[otherRole].passed) {
    if (player.team.length < 6) {
      player.team.push(game.currentPokemon);
      player.tokens -= game.currentBid;
    }

    addRoomLog(
      game,
      `✅ ${label} won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
    );

    nextMultiplayerPokemon(game);
    emitRoomGame(code);
    return;
  }

  if (!canPlayerRaise(game, otherRole)) {
    game.players[otherRole].passed = true;

    addRoomLog(
      game,
      `${otherLabel} cannot raise the bid and is forced to pass.`
    );

    if (player.team.length < 6) {
      player.team.push(game.currentPokemon);
      player.tokens -= game.currentBid;
    }

    addRoomLog(
      game,
      `✅ ${label} won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
    );

    nextMultiplayerPokemon(game);
    emitRoomGame(code);
    return;
  }

  game.activeBidder = otherRole;

  emitRoomGame(code);
});

socket.on("multiplayerPass", roomCode => {
  const code = String(roomCode || "").trim().toUpperCase();

  const room = roomManager.getRoom(code);
  const game = roomManager.getGame(code);

  if (!room || !game) {
    socket.emit("roomError", { message: "No active multiplayer game" });
    return;
  }

  if (game.phase !== "draft") {
    socket.emit("roomError", { message: "Draft is not active" });
    return;
  }

  const role =
  getReconnectSafeRole(code, socket.id);

  if (!role) {
    socket.emit("roomError", { message: "You are not in this room" });
    return;
  }

  if (role !== game.activeBidder) {
    socket.emit("roomError", {
      message: "Wait for the other player's action"
    });
    return;
  }

  const player = game.players[role];

  if (player.passed) {
    socket.emit("roomError", {
      message: "You already passed"
    });
    return;
  }

  player.passed = true;

  const otherRole =
    role === "player1" ? "player2" : "player1";

  const label = role === "player1" ? "Player 1" : "Player 2";

  addRoomLog(game, `🙅 ${label} passed.`);

  if (!game.highestBidder) {
    const otherPlayer = game.players[otherRole];

const otherDone =
  otherPlayer.team.length >= 6 ||
  otherPlayer.tokens <= 0;

if (otherDone) {
  game.bin.push(game.currentPokemon);

  addRoomLog(
    game,
    `⚫ No available bidder. ${game.currentPokemon.name} went to BIN.`
  );

  nextMultiplayerPokemon(game);
  emitRoomGame(code);
  return;
}

game.activeBidder = otherRole;

resolveMultiplayerDraft(game);

emitRoomGame(code);
    return;
  }

  if (game.highestBidder === otherRole) {
    const winner = game.players[otherRole];
    const winnerLabel = otherRole === "player1" ? "Player 1" : "Player 2";

if (winner.team.length < 6) {
  winner.team.push(game.currentPokemon);
  winner.tokens -= game.currentBid;
}
    addRoomLog(
      game,
      `✅ ${winnerLabel} won ${game.currentPokemon.name} for ${game.currentBid} tokens.`
    );

    nextMultiplayerPokemon(game);
    emitRoomGame(code);
    return;
  }

  game.activeBidder = otherRole;

  resolveMultiplayerDraft(game);

  emitRoomGame(code);
});

socket.on("selectBattleStarter", data => {
  const roomCode =
    String(data.roomCode || "").trim().toUpperCase();

  const pokemonIndex =
    Number(data.pokemonIndex);

  const game =
    roomManager.getGame(roomCode);

  if (!game) {
    socket.emit("roomError", {
      message: "No active multiplayer game"
    });
    return;
  }

  if (game.phase !== "battle-ready") {
    socket.emit("roomError", {
      message: "Starter selection is not active"
    });
    return;
  }

  const role =
    getReconnectSafeRole(roomCode, socket.id);

  if (!role) {
    socket.emit("roomError", {
      message: "You are not in this room"
    });
    return;
  }

  if (role !== game.battle.activeStarterPicker) {
    socket.emit("roomError", {
      message: "Wait for the other player to choose first"
    });
    return;
  }

  const team =
    game.players[role].team;

  if (
    Number.isNaN(pokemonIndex) ||
    pokemonIndex < 0 ||
    pokemonIndex >= team.length
  ) {
    socket.emit("roomError", {
      message: "Invalid starter Pokémon"
    });
    return;
  }

  if (game.battle[`${role}Starter`] !== null) {
    socket.emit("roomError", {
      message: "You already selected your starter"
    });
    return;
  }

  game.battle[`${role}Starter`] =
    pokemonIndex;

  addRoomLog(
    game,
    `${role === "player1" ? "Player 1" : "Player 2"} selected ${team[pokemonIndex].name} as starter.`
  );

  if (role === "player1") {
    game.battle.activeStarterPicker = "player2";
  } else {
    game.battle.activeStarterPicker = "done";
  }

  if (
    game.battle.player1Starter !== null &&
    game.battle.player2Starter !== null
  ) {
    game.phase = "battle";

    game.battle.player1Active =
      prepareBattlePokemon(
        game.players.player1.team[
          game.battle.player1Starter
        ]
      );

    game.battle.player2Active =
      prepareBattlePokemon(
        game.players.player2.team[
          game.battle.player2Starter
        ]
      );

    game.battle.round = 1;
    game.battle.arena = chooseMultiplayerArena();

    game.battle.player1Move = null;
    game.battle.player2Move = null;

    game.battle.player1Ready = false;
    game.battle.player2Ready = false;

    game.battle.player1Action = null;
    game.battle.player2Action = null;

    game.battle.player1SwitchesLeft = 3;
    game.battle.player2SwitchesLeft = 3;

    addRoomLog(
      game,
      `🏟️ Arena selected: ${game.battle.arena.name}`
    );

    addRoomLog(
      game,
      "⚔️ Multiplayer battle started!"
    );

    startBattleTimer(roomCode, game);
  }

  emitRoomGame(roomCode);
});
socket.on("multiplayerBattleMove", data => {
  const roomCode =
    String(data.roomCode || "").trim().toUpperCase();

  const moveIndex =
    Number(data.moveIndex);

  const game =
    roomManager.getGame(roomCode);

  if (!game) return;

  if (game.phase !== "battle") {
    socket.emit("roomError", {
      message: "Battle is not active"
    });
    return;
  }

   const role =
  getReconnectSafeRole(roomCode, socket.id);

  if (!role) return;

  if (game.battle[`${role}Ready`] === true) {
    socket.emit("roomError", {
      message: "You already chose an action this round"
    });
    return;
  }

 const activePokemon =
  game.battle[`${role}Active`];

ensureBattleStatus(activePokemon);

if (activePokemon.battleStatus.charging) {
  const chargedMove =
    activePokemon.battleStatus.charging.move;

  game.battle[`${role}Move`] = chargedMove;

  game.battle[`${role}Action`] = {
    type: "move",
    move: chargedMove,
    chargedRelease: true
  };

  game.battle[`${role}Ready`] = true;

  addRoomLog(
    game,
    `${role === "player1" ? "Player 1" : "Player 2"} is ready to release ${chargedMove.name}.`
  );

  if (bothPlayersChoseMove(game)) {
    resolveMultiplayerBattleRound(game, roomCode);
  }

  emitRoomGame(roomCode);
  return;
}
  if (!activePokemon) {
    socket.emit("roomError", {
      message: "No active Pokémon"
    });
    return;
  }

  const move =
    activePokemon.moves[moveIndex];

  if (!move) {
    socket.emit("roomError", {
      message: "Invalid move"
    });
    return;
  }

  game.battle[`${role}Move`] = move;

  game.battle[`${role}Action`] = {
    type: "move",
    move
  };

  game.battle[`${role}Ready`] = true;

  addRoomLog(
    game,
    `${role === "player1" ? "Player 1" : "Player 2"} selected ${move.name}.`
  );

  if (bothPlayersChoseMove(game)) {
   resolveMultiplayerBattleRound(game, roomCode);
  }

  emitRoomGame(roomCode);
});
socket.on("multiplayerSwitchPokemon", data => {
  const roomCode =
    String(data.roomCode || "").trim().toUpperCase();

  const pokemonIndex =
    Number(data.pokemonIndex);

  const game =
    roomManager.getGame(roomCode);

  if (!game) return;

  if (game.phase !== "battle") {
    socket.emit("roomError", {
      message: "Battle is not active"
    });
    return;
  }

const role =
  getReconnectSafeRole(roomCode, socket.id);

  if (!role) return;

  if (game.battle[`${role}Ready`] === true) {
    socket.emit("roomError", {
      message: "You already chose an action this round"
    });
    return;
  }

  const switchesLeftKey =
    `${role}SwitchesLeft`;

  if ((game.battle[switchesLeftKey] || 0) <= 0) {
    socket.emit("roomError", {
      message: "You have no switches left"
    });
    return;
  }

  const activeIndex =
    game.battle[`${role}Starter`];

  if (pokemonIndex === activeIndex) {
    socket.emit("roomError", {
      message: "This Pokémon is already active"
    });
    return;
  }

  const team =
    game.players[role].team;

  const pokemon =
    team[pokemonIndex];

  if (!pokemon) {
    socket.emit("roomError", {
      message: "Invalid Pokémon"
    });
    return;
  }

  if (
    pokemon.battleStats &&
    pokemon.battleStats.currentHp <= 0
  ) {
    socket.emit("roomError", {
      message: "That Pokémon has fainted"
    });
    return;
  }

  game.battle[`${role}Action`] = {
    type: "switch",
    pokemonIndex
  };

  game.battle[`${role}Move`] = null;
  game.battle[`${role}Ready`] = true;

  addRoomLog(
    game,
    `${role === "player1" ? "Player 1" : "Player 2"} chose to switch Pokémon.`
  );

  if (bothPlayersChoseMove(game)) {
    resolveMultiplayerBattleRound(game, roomCode);
  }

  emitRoomGame(roomCode);
});
socket.on("multiplayerReplacePokemon", data => {
  const roomCode =
    String(data.roomCode || "").trim().toUpperCase();

  const pokemonIndex =
    Number(data.pokemonIndex);

  const game =
    roomManager.getGame(roomCode);

  if (!game) {
    socket.emit("roomError", {
      message: "No active multiplayer game"
    });
    return;
  }

  if (game.phase !== "pokemon-fainted") {
    socket.emit("roomError", {
      message: "No replacement is needed"
    });
    return;
  }

  const role =
    getReconnectSafeRole(roomCode, socket.id);

  if (!role) {
    socket.emit("roomError", {
      message: "You are not in this room"
    });
    return;
  }

  if (role !== game.battle.faintedPlayer) {
    socket.emit("roomError", {
      message: "Waiting for opponent replacement"
    });
    return;
  }

  const team =
    game.players[role].team;

  if (
    Number.isNaN(pokemonIndex) ||
    pokemonIndex < 0 ||
    pokemonIndex >= team.length
  ) {
    socket.emit("roomError", {
      message: "Invalid Pokémon"
    });
    return;
  }

  const activeIndex =
    game.battle[`${role}Starter`];

  if (pokemonIndex === activeIndex) {
    socket.emit("roomError", {
      message: "That Pokémon already fainted"
    });
    return;
  }

  const pokemon =
    team[pokemonIndex];

  const currentHp =
    pokemon.battleStats
      ? pokemon.battleStats.currentHp
      : pokemon.stats.hp;

  if (currentHp <= 0) {
    socket.emit("roomError", {
      message: "This Pokémon has fainted"
    });
    return;
  }

  game.battle[`${role}Starter`] =
    pokemonIndex;

  game.battle[`${role}Active`] =
    prepareBattlePokemon(pokemon);

  game.phase = "battle";
  game.battle.faintedPlayer = null;

  game.battle.player1Move = null;
  game.battle.player2Move = null;

  game.battle.player1Ready = false;
  game.battle.player2Ready = false;

  game.battle.player1Action = null;
  game.battle.player2Action = null;

  game.battle.round++;

  addRoomLog(
    game,
    `🔁 ${role === "player1" ? "Player 1" : "Player 2"} sent out ${pokemon.name}.`
  );

  addRoomLog(
    game,
    `⚔️ Round ${game.battle.round} started. Choose your move.`
  );

  startBattleTimer(roomCode, game);

  emitRoomGame(roomCode);
});
socket.on("disconnect", () => {
  console.log("🔴 Player disconnected:", socket.id);

  const rooms =
    roomManager.rooms || {};

  for (const roomCode in rooms) {
    const game =
      roomManager.getGame(roomCode);

    if (!game || !game.players) continue;

   const role =
  game.players.player1.socketId === socket.id ||
  game.players.player1.oldSocketId === socket.id
    ? "player1"
    : game.players.player2.socketId === socket.id ||
      game.players.player2.oldSocketId === socket.id
        ? "player2"
        : null;
    if (!role) continue;
if (game.players[role].oldSocketId === socket.id) {
  game.players[role].oldSocketId = null;
  return;
}
    game.players[role].disconnected = true;

    addRoomLog(
      game,
      `⚠️ ${role === "player1" ? "Player 1" : "Player 2"} disconnected. Waiting for reconnect...`
    );

    if (
  game.phase === "draft" ||
  game.phase === "battle-ready" ||
  game.phase === "pokemon-fainted"
) {
  game.previousPhase = game.phase;
}

if (game.phase === "battle") {
  addRoomLog(
    game,
    "⏳ Battle timer continues while player reconnects."
  );
}

    emitRoomGame(roomCode);
    return;
  }

  roomManager.removePlayer(socket.id);

  io.emit("playerDisconnected", {
    socketId: socket.id
  });
});

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🎮 Socket.IO multiplayer ready");
});