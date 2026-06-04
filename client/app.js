const socket = io();

let multiplayerRoom = null;
let multiplayerRole = null;
let multiplayerGame = null;

socket.on("connected", data => {
  console.log("Connected:", data.socketId);
});
socket.on("connect", () => {
  const roomCode =
    localStorage.getItem("animonRoom");

  const reconnectToken =
    localStorage.getItem("animonReconnectToken");

  const shouldReconnect =
    localStorage.getItem("animonShouldReconnect");

  console.log("AUTO RECONNECT CHECK:", {
    roomCode,
    reconnectToken,
    shouldReconnect
  });

  if (
    roomCode &&
    reconnectToken &&
    shouldReconnect === "true"
  ) {
    console.log("🔄 Sending reconnect request...");

    const status =
      document.getElementById("roomStatus");

    if (status) {
      status.innerText = "🔄 Reconnecting to multiplayer room...";
    }

    socket.emit("reconnectBattle", {
      roomCode,
      reconnectToken
    });
  }
});
socket.on("roomCreated", data => {
  multiplayerRoom = data.roomCode;
  multiplayerRole = data.role;

  document.getElementById("draftScreen").classList.add("hidden");
  document.getElementById("battleScreen").classList.add("hidden");
  document.getElementById("multiplayerDraftControls").classList.remove("hidden");

  document.getElementById("roomStatus").innerText =
    `Room Created: ${data.roomCode} | You are ${data.role}`;

  localStorage.setItem("animonRoom", data.roomCode);
  localStorage.setItem("animonRole", data.role);

  if (data.reconnectToken) {
    localStorage.setItem("animonReconnectToken", data.reconnectToken);
  }

  localStorage.setItem("animonShouldReconnect", "false");
});
socket.on("roomJoined", data => {
  multiplayerRoom = data.roomCode;
  multiplayerRole = data.role;

  document.getElementById("draftScreen").classList.add("hidden");
  document.getElementById("battleScreen").classList.add("hidden");
  document.getElementById("multiplayerDraftControls").classList.remove("hidden");

  localStorage.setItem("animonRoom", data.roomCode);
  localStorage.setItem("animonRole", data.role);

  if (data.reconnectToken) {
    localStorage.setItem("animonReconnectToken", data.reconnectToken);
  }

  localStorage.setItem("animonShouldReconnect", "false");

  document.getElementById("roomStatus").innerText =
    `Joined Room: ${data.roomCode} | You are ${data.role}`;
});
socket.on("roomUpdate", data => {
  document.getElementById("draftScreen").classList.add("hidden");
  document.getElementById("battleScreen").classList.add("hidden");
  document.getElementById("roomStatus").innerText =
    `Room: ${data.roomCode} | Players: ${data.players}/2`;

  if (data.players === 2) {
    document.getElementById("multiplayerDraftControls").classList.remove("hidden");
  }
});
socket.on("multiplayerDraftStarted", data => {
  hideMultiplayerLoading();

  multiplayerRoom = data.roomCode;
  multiplayerGame = data.game;

  localStorage.setItem("animonRoom", data.roomCode);
  localStorage.setItem("animonShouldReconnect", "true");

  document.getElementById("multiplayerDraftControls").classList.remove("hidden");
  document.getElementById("multiplayerDraftActions").classList.remove("hidden");

  renderMultiplayerDraft();
});

socket.on("multiplayerGameUpdate", data => {
  multiplayerRoom = data.roomCode;
  multiplayerGame = data.game;

  if (data.roomCode) {
    localStorage.setItem("animonRoom", data.roomCode);
  }

  if (
    data.game &&
    (
      data.game.phase === "draft" ||
      data.game.phase === "battle-ready" ||
      data.game.phase === "battle" ||
      data.game.phase === "pokemon-fainted"
    )
  ) {
    localStorage.setItem("animonShouldReconnect", "true");
  }

  const draftScreen =
    document.getElementById("draftScreen");

  const battleScreen =
    document.getElementById("battleScreen");

  const multiplayerDraftControls =
    document.getElementById("multiplayerDraftControls");

  const multiplayerDraftActions =
    document.getElementById("multiplayerDraftActions");

  if (draftScreen) draftScreen.classList.add("hidden");
  if (battleScreen) battleScreen.classList.add("hidden");
  if (multiplayerDraftControls) multiplayerDraftControls.classList.remove("hidden");
  if (multiplayerDraftActions) multiplayerDraftActions.classList.remove("hidden");

  renderMultiplayerDraft();

  hideMultiplayerLoading();
});

socket.on("roomError", data => {
  const reconnectErrors = [
    "Invalid reconnect token",
    "No reconnectable game found"
  ];

  const isInActiveGame =
    multiplayerGame &&
    (
      multiplayerGame.phase === "draft" ||
      multiplayerGame.phase === "battle-ready" ||
      multiplayerGame.phase === "battle" ||
      multiplayerGame.phase === "pokemon-fainted"
    );

  if (reconnectErrors.includes(data.message)) {
    if (!isInActiveGame) {
      localStorage.removeItem("animonRoom");
      localStorage.removeItem("animonRole");
      localStorage.removeItem("animonReconnectToken");
      localStorage.removeItem("animonShouldReconnect");

      multiplayerRoom = null;
      multiplayerRole = null;
      multiplayerGame = null;

      const roomStatus =
        document.getElementById("roomStatus");

      if (roomStatus) {
        roomStatus.innerText =
          "Not connected to room";
      }
    }

    hideMultiplayerLoading();
    return;
  }

  alert(data.message);
});
socket.on("reconnectSuccess", data => {
  multiplayerRoom = data.roomCode;
  multiplayerRole = data.role;

  localStorage.setItem("animonRoom", data.roomCode);
  localStorage.setItem("animonRole", data.role);
  localStorage.setItem("animonShouldReconnect", "true");

  document.getElementById("roomStatus").innerText =
    `Reconnected to Room: ${data.roomCode} | You are ${data.role}`;

  console.log("✅ Reconnected as", data.role);

  showMultiplayerLoading("Restoring game...");
});
socket.on("multiplayerDraftLoading", data => {
  showMultiplayerLoading(
    data.message || "Creating multiplayer draft arena..."
  );
});
function createRoom() {
  localStorage.clear();
  socket.emit("createRoom");
}

function joinRoom() {
  const savedRoom =
    localStorage.getItem("animonRoom");

  const savedToken =
    localStorage.getItem("animonReconnectToken");

  const shouldReconnect =
    localStorage.getItem("animonShouldReconnect");

  if (savedRoom && savedToken && shouldReconnect === "true") {
    socket.emit("reconnectBattle", {
      roomCode: savedRoom,
      reconnectToken: savedToken
    });

    return;
  }

  const code = document.getElementById("roomCodeInput").value;

  if (!code.trim()) {
    alert("Enter a room code");
    return;
  }

  socket.emit("joinRoom", code);
}
let state = null;
let pollInterval = null;
let battleTimerInterval = null;

setHomeBackground();

function setHomeBackground() {
  const backgrounds = [
    "assets/backgrounds/bg1.jpg",
    "assets/backgrounds/bg2.jpg",
    "assets/backgrounds/bg3.jpg",
  ];

  const randomBg =
    backgrounds[Math.floor(Math.random() * backgrounds.length)];

  document.body.style.backgroundImage =
    `linear-gradient(rgba(2,6,23,0.55), rgba(2,6,23,0.85)), url('${randomBg}')`;

  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundAttachment = "fixed";
}

function startMultiplayerDraft() {
  if (!multiplayerRoom) {
    alert("Create or join a room first");
    return;
  }

  showMultiplayerLoading("Creating draft arena...");

  socket.emit("startMultiplayerDraft", multiplayerRoom);
}
function showMultiplayerLoading(text = "Loading...") {
  const box = document.getElementById("mpLoadingScreen");
  const label = document.getElementById("mpLoadingText");

  if (label) label.innerText = text;
  if (box) box.classList.remove("hidden");
}

function hideMultiplayerLoading() {
  const box = document.getElementById("mpLoadingScreen");

  if (box) box.classList.add("hidden");
}
function multiplayerBid(amount) {
  const activeRoom =
    getActiveMultiplayerRoom();

  if (!activeRoom) {
    alert("Not connected to room");
    return;
  }

  if (!multiplayerGame || multiplayerGame.phase !== "draft") return;

  socket.emit("multiplayerBid", {
    roomCode: activeRoom,
    amount
  });
}

function multiplayerPass() {
  const activeRoom =
    getActiveMultiplayerRoom();

  if (!activeRoom) {
    alert("Not connected to room");
    return;
  }

  if (!multiplayerGame || multiplayerGame.phase !== "draft") return;

  socket.emit("multiplayerPass", activeRoom);
}
function getActiveMultiplayerRoom() {
  const savedRoom =
    localStorage.getItem("animonRoom");

  if (multiplayerRoom) {
    return multiplayerRoom;
  }

  if (savedRoom) {
    multiplayerRoom = savedRoom;
    return savedRoom;
  }

  return null;
}
function renderMultiplayerDraft() {
  if (!multiplayerGame) return;

  document.getElementById("multiplayerDraftActions").classList.remove("hidden");

  const winnerBox = document.getElementById("winnerBox");

  if (winnerBox) {
    winnerBox.classList.add("hidden");
    winnerBox.classList.remove("you-win", "you-lose");
  }

  if (multiplayerGame.phase === "battle-ended") {
    const didWin =
      multiplayerGame.battle.winner === multiplayerRole;

    document.getElementById("mpPokeName").innerText =
      didWin ? "🏆 YOU WIN!" : "💀 YOU LOSE!";

    document.getElementById("mpPokeImage").src = "";

    document.getElementById("mpPokeStats").innerText =
      didWin
        ? "You defeated the opponent's full team."
        : "All your Pokémon fainted.";

    document.getElementById("mpPokeType").innerText = "";

    const starterBox = document.getElementById("mpStarterSelect");
    if (starterBox) starterBox.classList.add("hidden");

    if (winnerBox) {
      winnerBox.classList.remove("hidden");
      winnerBox.innerText = didWin ? "🏆 YOU WIN!" : "💀 YOU LOSE!";
      winnerBox.classList.add(didWin ? "you-win" : "you-lose");
    }
renderBattleStatistics();
    renderMultiplayerBattle();
    renderMultiplayerTeams();
    updateMultiplayerDraftButtons();
    return;
  }

  if (multiplayerGame.phase === "pokemon-fainted") {
    const faintedPlayer =
      multiplayerGame.battle?.faintedPlayer;

    document.getElementById("mpPokeName").innerText =
      "POKÉMON FAINTED";

    document.getElementById("mpPokeImage").src = "";

    document.getElementById("mpPokeStats").innerText =
      faintedPlayer === multiplayerRole
        ? "Your Pokémon fainted. Choose a different Pokémon."
        : "Opponent's Pokémon fainted. Waiting for replacement.";

    document.getElementById("mpPokeType").innerText = "";

    renderMultiplayerBattle();
    renderReplacementSelect();
    renderMultiplayerTeams();
    updateMultiplayerDraftButtons();
    return;
  }

  if (multiplayerGame.phase === "battle") {
    document.getElementById("mpPokeName").innerText =
      "BATTLE STARTED";

    document.getElementById("mpPokeImage").src = "";

    document.getElementById("mpPokeStats").innerText =
      "Both players selected their starters.";

    document.getElementById("mpPokeType").innerText = "";

    const starterBox = document.getElementById("mpStarterSelect");
    if (starterBox) starterBox.classList.add("hidden");

    renderMultiplayerTeams();
    renderMultiplayerBattle();
  } else if (multiplayerGame.phase === "battle-ready") {
    const picker =
      multiplayerGame.battle?.activeStarterPicker;

    document.getElementById("mpPokeName").innerText =
      "CHOOSE STARTER";

    document.getElementById("mpPokeImage").src = "";

    document.getElementById("mpPokeStats").innerText =
      picker === multiplayerRole
        ? "Your turn: select one Pokémon."
        : "Waiting for the other player to select.";

    document.getElementById("mpPokeType").innerText = "";

    renderMultiplayerStarterSelect();
  } else {
    const p = multiplayerGame.currentPokemon;

    document.getElementById("mpPokeName").innerText =
      p.name.toUpperCase();

    document.getElementById("mpPokeImage").src =
      p.image;

    document.getElementById("mpPokeStats").innerText =
      `HP:${p.stats.hp} | ATK:${p.stats.attack} | DEF:${p.stats.defense} | SPD:${p.stats.speed}`;

    document.getElementById("mpPokeType").innerText =
      `Type: ${p.type}`;
  }

  document.getElementById("mpCurrentBid").innerText =
    multiplayerGame.currentBid || 0;

  const turnText =
    multiplayerGame.phase === "draft"
      ? (
          multiplayerGame.activeBidder === multiplayerRole
            ? "Your turn"
            : "Opponent's turn"
        )
      : multiplayerGame.phase === "battle-ready"
        ? "Starter selection"
        : "Battle phase";

  const mpTurn =
    document.getElementById("mpTurn");

  if (mpTurn) {
    mpTurn.innerText = turnText;
  }

  document.getElementById("mpP1Tokens").innerText =
    multiplayerGame.players.player1.tokens;

  document.getElementById("mpP2Tokens").innerText =
    multiplayerGame.players.player2.tokens;

  document.getElementById("mpP1Count").innerText =
    multiplayerGame.players.player1.team.length;

  document.getElementById("mpP2Count").innerText =
    multiplayerGame.players.player2.team.length;

  renderMultiplayerTeams();

  const mpLog =
    document.getElementById("mpGameLog");

  mpLog.innerHTML =
    multiplayerGame.logs
      .map(log => `<div class="log-item">${log}</div>`)
      .join("");

  mpLog.scrollTop =
    mpLog.scrollHeight;

  updateMultiplayerDraftButtons();
}
let lastMpLogCount = 0;

function showMpFloatingText(targetPrefix, text, type = "damage") {
  const image =
    document.getElementById(`${targetPrefix}PokemonImage`);

  if (!image) return;

  const parent =
    image.parentElement;

  if (!parent) return;

  const float =
    document.createElement("div");

  float.className = `mp-floating-text ${type}`;
  float.innerText = text;

  parent.appendChild(float);

  setTimeout(() => {
    float.remove();
  }, 900);
}

function detectMpBattleEffects() {
  if (!multiplayerGame?.logs) return;

  const newLogs =
    multiplayerGame.logs.slice(lastMpLogCount);

  newLogs.forEach(log => {
    const lower =
      log.toLowerCase();

    if (lower.includes("took") && lower.includes("damage")) {
      const damageMatch =
        log.match(/took (\d+) damage/i);

      if (!damageMatch) return;

      const damage =
        damageMatch[1];

      playSound("hit");
      updateBattleAnnouncer("💥 DIRECT HIT!");

      if (
        lower.includes("player1") &&
        multiplayerRole === "player1"
      ) {
        shakePokemon("mpMy");
        showMpFloatingText("mpMy", `-${damage}`, "damage");
      }
      else if (
        lower.includes("player2") &&
        multiplayerRole === "player2"
      ) {
        shakePokemon("mpMy");
        showMpFloatingText("mpMy", `-${damage}`, "damage");
      }
      else {
        shakePokemon("mpEnemy");
        showMpFloatingText("mpEnemy", `-${damage}`, "damage");
      }
    }

    if (lower.includes("critical hit")) {
      playSound("super");
      updateBattleAnnouncer("💢 CRITICAL HIT!");
      showMpFloatingText("mpEnemy", "CRIT!", "super");
    }

    if (lower.includes("missed")) {
      playSound("miss");
      updateBattleAnnouncer("💨 ATTACK MISSED!");
      showMpFloatingText("mpEnemy", "MISS!", "miss");
    }

    if (lower.includes("super effective")) {
      playSound("super");
      updateBattleAnnouncer("🔥 SUPER EFFECTIVE!");
      showMpFloatingText("mpEnemy", "SUPER!", "super");
    }

    if (lower.includes("not very effective")) {
      updateBattleAnnouncer("🛡️ NOT VERY EFFECTIVE");
      showMpFloatingText("mpEnemy", "WEAK", "weak");
    }

    if (lower.includes("fainted")) {
      playSound("faint");
      updateBattleAnnouncer("💀 POKÉMON FAINTED!");
    }

    if (lower.includes("protected itself")) {
      playSound("miss");
      updateBattleAnnouncer("🛡️ PROTECTED!");
    }

    if (lower.includes("blocked the attack")) {
      playSound("miss");
      updateBattleAnnouncer("🛡️ ATTACK BLOCKED!");
    }

    if (lower.includes("switched to")) {
      playSound("click");
      updateBattleAnnouncer("🔄 POKÉMON SWITCHED!");
    }

    if (lower.includes("wins the full team battle")) {
      if (
        lower.includes("player 1") &&
        multiplayerRole === "player1"
      ) {
        playSound("win");
      }
      else if (
        lower.includes("player 2") &&
        multiplayerRole === "player2"
      ) {
        playSound("win");
      }
      else {
        playSound("lose");
      }
    }
  });

  lastMpLogCount =
    multiplayerGame.logs.length;
}
function updateBattleAnnouncer(text) {
  const announcer =
    document.getElementById("battleAnnouncer");

  if (!announcer) return;

  announcer.innerText = text;
}

function renderMultiplayerBattle() {
  const timer =
  document.getElementById("battleTimer");

if (
  timer &&
  multiplayerGame?.battle
) {
  timer.textContent =
    `⏰ ${multiplayerGame.battle.battleTimer}s`;
}
  const battleBox = document.getElementById("mpBattleBox");

  if (!battleBox || !multiplayerGame?.battle) return;

  battleBox.classList.remove("hidden");

  const myRole = multiplayerRole;
  const enemyRole =
    myRole === "player1" ? "player2" : "player1";

  const myPokemon =
    multiplayerGame.battle[`${myRole}Active`];

  const enemyPokemon =
    multiplayerGame.battle[`${enemyRole}Active`];

  if (!myPokemon || !enemyPokemon) return;

  renderMpFighter("mpMy", myPokemon);
  renderMpFighter("mpEnemy", enemyPokemon);

  document.getElementById("mpBattleRound").innerText =
    `Round ${multiplayerGame.battle.round}`;
renderMultiplayerArena();
  renderMpMoveButtons(myPokemon);
 const switchPanel =
  document.getElementById("mpSwitchPanel");

if (
  switchPanel &&
  !switchPanel.classList.contains("hidden")
) {
  renderMultiplayerSwitchPanel();
}
  detectMpBattleEffects();
}
function shakePokemon(targetPrefix) {
  const image =
    document.getElementById(`${targetPrefix}PokemonImage`);

  if (!image) return;

  image.classList.remove("attack-shake");

  void image.offsetWidth;

  image.classList.add("attack-shake");

  setTimeout(() => {
    image.classList.remove("attack-shake");
  }, 400);
}
function getMpStatusText(pokemon) {
  const s = pokemon.battleStatus;

  if (!s) return "None";

  const statuses = [];

  if (s.poison) statuses.push("☠️ Poison");
  if (s.burn) statuses.push("🔥 Burn");
  if (s.paralysis) statuses.push("⚡ Paralysis");
  if (s.sleep) statuses.push("💤 Sleep");
  if (s.confusion) statuses.push("💫 Confusion");
  if (s.protected) statuses.push("🛡️ Protected");
  if (s.endure) statuses.push("🧱 Endure");
  if (s.charging) statuses.push(`⏳ Charging ${s.charging.move.name}`);

  return statuses.length ? statuses.join(" | ") : "None";
}

function getMpModifierText(pokemon) {
  const mods = pokemon.battleStatus?.statModifiers;

  if (!mods) return "No stat changes";

  const parts = [];

  Object.entries(mods).forEach(([stat, value]) => {
    if (value > 0) parts.push(`${stat.toUpperCase()} +${value}`);
    if (value < 0) parts.push(`${stat.toUpperCase()} ${value}`);
  });

  return parts.length ? parts.join(" | ") : "No stat changes";
}
function renderMpFighter(prefix, pokemon) {
  const hpPercent =
    (pokemon.battleStats.currentHp / pokemon.battleStats.maxHp) * 100;

  const staminaPercent =
    (pokemon.battleStats.currentStamina / pokemon.battleStats.maxStamina) * 100;

  const image = document.getElementById(`${prefix}PokemonImage`);
  const name = document.getElementById(`${prefix}PokemonName`);
  const type = document.getElementById(`${prefix}PokemonType`);

  if (image) {
    image.src = pokemon.animatedImage || pokemon.image;
    image.classList.remove("pokemon-fainted");

    if (pokemon.battleStats.currentHp <= 0) {
      image.classList.add("pokemon-fainted");
    }
  }

  if (name) {
    name.innerText = pokemon.name.toUpperCase();
  }

  if (type) {
    type.innerHTML = `
      <div class="mp-battle-card-info">
        <div><strong>Type:</strong> ${pokemon.type}</div>
        <div><strong>ATK:</strong> ${pokemon.stats.attack}</div>
        <div><strong>DEF:</strong> ${pokemon.stats.defense}</div>
        <div><strong>SPD:</strong> ${pokemon.stats.speed}</div>
        <div><strong>Status:</strong> ${getMpStatusText(pokemon)}</div>
        <div><strong>Modifiers:</strong> ${getMpModifierText(pokemon)}</div>
      </div>
    `;
  }

  document.getElementById(`${prefix}HpBar`).style.width =
    `${Math.max(0, hpPercent)}%`;

  document.getElementById(`${prefix}HpText`).innerText =
    `HP: ${pokemon.battleStats.currentHp} / ${pokemon.battleStats.maxHp}`;

  document.getElementById(`${prefix}StaminaBar`).style.width =
    `${Math.max(0, staminaPercent)}%`;

  document.getElementById(`${prefix}StaminaText`).innerText =
    `Stamina: ${pokemon.battleStats.currentStamina} / ${pokemon.battleStats.maxStamina}`;
}
function estimateMultiplayerMoveDamage(attacker, defender, move) {
  if (!attacker || !defender || !move) return 0;

  const power = move.power || 40;
  const attack = attacker.stats.attack || 50;
  const defense = defender.stats.defense || 50;

  const rawDamage =
    ((power * attack) / Math.max(1, defense)) * 0.45;

  return Math.max(1, Math.round(rawDamage));
}
function renderMpMoveButtons(myPokemon) {
  const movePanel =
    document.getElementById("mpMovePanel");

  if (!movePanel) return;
if (myPokemon.battleStatus?.charging) {
  const chargedMove =
    myPokemon.battleStatus.charging.move;

  movePanel.innerHTML = `
    <button onclick="chooseMultiplayerMove(0)">
      <strong>RELEASE ${chargedMove.name.toUpperCase()}</strong>
      <br>
      Continue the charged attack.
    </button>
  `;

  return;
}
  if (multiplayerGame.phase !== "battle") {
    movePanel.innerHTML = "";
    return;
  }

  const enemyRole =
    multiplayerRole === "player1" ? "player2" : "player1";

  const enemyPokemon =
    multiplayerGame.battle[`${enemyRole}Active`];

  const alreadyMoved =
  multiplayerGame.battle[`${multiplayerRole}Ready`] === true;

  movePanel.innerHTML =
    myPokemon.moves
      .map((move, index) => {
        const notEnoughStamina =
          move.staminaCost >
          myPokemon.battleStats.currentStamina;

        const estimatedDamage =
          estimateMultiplayerMoveDamage(
            myPokemon,
            enemyPokemon,
            move
          );

        const priorityText =
          move.priorityBonus && move.priorityBonus > 0
            ? `Priority +${move.priorityBonus}`
            : "Normal priority";

        const accuracyText =
          `${move.accuracy ?? 100}% accuracy`;

        const effectText =
          move.effectText || "Basic damage move.";

return `
  <button
    class="mp-move-card ${notEnoughStamina ? "no-stamina" : ""}"
    onclick="chooseMultiplayerMove(${index})"
    ${alreadyMoved || notEnoughStamina ? "disabled" : ""}
  >
    <div class="move-card-top">
      <strong>${move.name.toUpperCase()}</strong>
      <span>${move.type}</span>
    </div>

    <div class="move-card-main">
      <div>💥 ${estimatedDamage}</div>
      <div>🎯 ${move.accuracy ?? 100}%</div>
      <div>⚡ ${move.staminaCost}</div>
    </div>

    <small>${effectText}</small>
  </button>
`;
      })
      .join("");
}
const SOUND_ENABLED = true;

const gameSounds = {
  click: new Audio("assets/sounds/click.mp3"),
  hit: new Audio("assets/sounds/hit.mp3"),
  miss: new Audio("assets/sounds/miss.mp3"),
  faint: new Audio("assets/sounds/faint.mp3"),
  win: new Audio("assets/sounds/win.mp3"),
  lose: new Audio("assets/sounds/lose.mp3")
};

function playSound(name) {
  if (!SOUND_ENABLED) return;

  const sound = gameSounds[name];

  if (!sound) return;

  sound.currentTime = 0;
  sound.volume = 0.55;
  sound.play().catch(() => {});
}
document.addEventListener("click", event => {
  if (event.target.closest("button")) {
    playSound("click");
  }
});

function updateMultiplayerDraftButtons() {
  const bidButtons = [
    document.getElementById("mpBid1Btn"),
    document.getElementById("mpBid2Btn"),
    document.getElementById("mpBid3Btn")
  ];

  const passBtn =
    document.getElementById("mpPassBtn");

  if (!multiplayerGame || multiplayerGame.phase !== "draft") {
    bidButtons.forEach(btn => {
      if (btn) btn.disabled = true;
    });

    if (passBtn) passBtn.disabled = true;
    return;
  }

  const myPlayer =
    multiplayerGame.players[multiplayerRole];

  const isMyTurn =
    multiplayerGame.activeBidder === multiplayerRole;

  const canRaise =
    myPlayer.tokens > multiplayerGame.currentBid &&
    myPlayer.team.length < 6 &&
    !myPlayer.passed;

  bidButtons.forEach(btn => {
    if (btn) {
      btn.disabled = !isMyTurn || !canRaise;
    }
  });

  if (passBtn) {
    passBtn.disabled =
      !isMyTurn ||
      myPlayer.passed;
  }
}

function renderMultiplayerTeams() {
  const p1Box = document.getElementById("mpP1Team");
  const p2Box = document.getElementById("mpP2Team");

  if (!p1Box || !p2Box || !multiplayerGame) return;

  p1Box.innerHTML =
    multiplayerGame.players.player1.team
      .map(pokemon => multiplayerTeamCard(pokemon))
      .join("");

  p2Box.innerHTML =
    multiplayerGame.players.player2.team
      .map(pokemon => multiplayerTeamCard(pokemon))
      .join("");
}

function multiplayerTeamCard(pokemon) {
  return `
    <div class="mp-team-card">
      <img src="${pokemon.image}">
      <strong>${pokemon.name.toUpperCase()}</strong>
      <small>${pokemon.type}</small>
      <small>HP ${pokemon.stats.hp} | ATK ${pokemon.stats.attack} | SPD ${pokemon.stats.speed}</small>
    </div>
  `;
}
function renderMultiplayerStarterSelect() {
  const starterBox = document.getElementById("mpStarterSelect");

  if (!starterBox || !multiplayerGame || !multiplayerRole) return;

  const myTeam = multiplayerGame.players[multiplayerRole].team;

  const canChoose =
    multiplayerGame.phase === "battle-ready" &&
    multiplayerGame.battle &&
    multiplayerGame.battle.activeStarterPicker === multiplayerRole &&
    multiplayerGame.battle[`${multiplayerRole}Starter`] === null;

  starterBox.classList.remove("hidden");

  starterBox.innerHTML =
    myTeam
      .map((pokemon, index) => {
        return `
          <button
            class="mp-starter-card"
            onclick="selectMultiplayerStarter(${index})"
            ${canChoose ? "" : "disabled"}
          >
            <img src="${pokemon.animatedImage || pokemon.image}">
            <span>${pokemon.name.toUpperCase()}</span>
            <small>
              HP ${pokemon.stats.hp} |
              ATK ${pokemon.stats.attack} |
              SPD ${pokemon.stats.speed}
            </small>
          </button>
        `;
      })
      .join("");
}
function renderMultiplayerTeams() {
  const p1Box = document.getElementById("mpP1Team");
  const p2Box = document.getElementById("mpP2Team");

  if (!p1Box || !p2Box || !multiplayerGame) return;

  p1Box.innerHTML =
    multiplayerGame.players.player1.team
      .map(pokemon => multiplayerTeamCard(pokemon))
      .join("");

  p2Box.innerHTML =
    multiplayerGame.players.player2.team
      .map(pokemon => multiplayerTeamCard(pokemon))
      .join("");
}
function renderMultiplayerArena() {
  const arena = multiplayerGame?.battle?.arena;
  const box = document.getElementById("mpArenaBox");

  if (!box || !arena) return;

  box.innerHTML = `
    <h3>${arena.name}</h3>
    <p>${arena.description}</p>
  `;
applyMultiplayerArenaVisuals(arena.type);
  setBackground(arena.type);
}
function applyMultiplayerArenaVisuals(type) {
  const stage = document.getElementById("mpArenaStage");
  if (!stage) return;

  stage.className = `arena-stage arena-${type || "default"}`;
}
function multiplayerTeamCard(pokemon) {
  return `
    <div class="mp-team-card">
      <img src="${pokemon.image}">
      <strong>${pokemon.name.toUpperCase()}</strong>
      <small>${pokemon.type}</small>
      <small>HP ${pokemon.stats.hp} | ATK ${pokemon.stats.attack} | SPD ${pokemon.stats.speed}</small>
    </div>
  `;
}
function selectMultiplayerStarter(index) {
  const activeRoom =
    getActiveMultiplayerRoom();

  console.log(
    "Starter clicked:",
    index,
    activeRoom,
    multiplayerRole,
    multiplayerGame?.phase,
    multiplayerGame?.battle?.activeStarterPicker
  );

  if (!activeRoom) {
    alert("No multiplayer room found");
    return;
  }

  if (!multiplayerGame) {
    alert("No multiplayer game found");
    return;
  }

  if (multiplayerGame.phase !== "battle-ready") {
    alert("Starter selection is not active");
    return;
  }

  if (
    multiplayerGame.battle?.activeStarterPicker !== multiplayerRole
  ) {
    alert("Wait for the other player to choose first");
    return;
  }

  const statusText =
    document.getElementById("mpPokeStats");

  if (statusText) {
    statusText.innerText =
      "Starter selected. Waiting for opponent...";
  }

  socket.emit("selectBattleStarter", {
    roomCode: activeRoom,
    pokemonIndex: index
  });
}
function chooseMultiplayerMove(moveIndex) {
  const activeRoom =
    getActiveMultiplayerRoom();

  if (!activeRoom) return;

  if (!multiplayerGame) return;

  if (multiplayerGame.phase !== "battle") return;

  const alreadyActed =
    multiplayerGame.battle &&
    multiplayerGame.battle[`${multiplayerRole}Ready`] === true;

  if (alreadyActed) {
    return;
  }

  socket.emit("multiplayerBattleMove", {
    roomCode: activeRoom,
    moveIndex
  });
}
function chooseReplacementPokemon(index) {
  const activeRoom =
    getActiveMultiplayerRoom();

  if (!activeRoom) {
    alert("No multiplayer room found");
    return;
  }

  if (!multiplayerGame) {
    alert("No multiplayer game found");
    return;
  }

  if (multiplayerGame.phase !== "pokemon-fainted") {
    alert("Replacement is not active");
    return;
  }

  if (multiplayerGame.battle?.faintedPlayer !== multiplayerRole) {
    alert("Waiting for opponent replacement");
    return;
  }

  socket.emit("multiplayerReplacePokemon", {
    roomCode: activeRoom,
    pokemonIndex: index
  });
}
function renderReplacementSelect() {
  const starterBox =
    document.getElementById("mpStarterSelect");

  if (!starterBox || !multiplayerGame || !multiplayerRole) return;

  const faintedPlayer =
    multiplayerGame.battle?.faintedPlayer;

  starterBox.classList.remove("hidden");

  if (faintedPlayer !== multiplayerRole) {
    starterBox.innerHTML =
      `<p class="battle-wait-text">Waiting for opponent to choose replacement...</p>`;
    return;
  }

  const myTeam =
    multiplayerGame.players[multiplayerRole].team;

  const activeIndex =
    multiplayerGame.battle[`${multiplayerRole}Starter`];

  const availablePokemon =
    myTeam
      .map((pokemon, index) => {
        const currentHp =
          pokemon.battleStats
            ? pokemon.battleStats.currentHp
            : pokemon.stats.hp;

        return {
          pokemon,
          index,
          currentHp,
          isActive: index === activeIndex,
          fainted: currentHp <= 0
        };
      })
      .filter(item => !item.fainted && !item.isActive);

  if (availablePokemon.length === 0) {
    starterBox.innerHTML =
      `<p class="battle-wait-text">No replacement Pokémon available.</p>`;
    return;
  }

  starterBox.innerHTML =
    availablePokemon
      .map(item => {
        const pokemon = item.pokemon;

        return `
          <button
            class="mp-starter-card"
            onclick="chooseReplacementPokemon(${item.index})"
          >
            <img src="${pokemon.animatedImage || pokemon.image}">
            <span>${pokemon.name.toUpperCase()}</span>
            <small>HP ${item.currentHp} / ${pokemon.stats.hp}</small>
            <small>READY</small>
          </button>
        `;
      })
      .join("");
}
function toggleMultiplayerSwitchPanel() {
  const panel = document.getElementById("mpSwitchPanel");

  if (!panel) return;

  panel.classList.toggle("hidden");

  renderMultiplayerSwitchPanel();
}

function renderMultiplayerSwitchPanel() {
  const panel = document.getElementById("mpSwitchPanel");

  if (!panel || !multiplayerGame || !multiplayerRole) return;

  const team =
    multiplayerGame.players[multiplayerRole].team;

  const activeIndex =
    multiplayerGame.battle[`${multiplayerRole}Starter`];

  const switchesLeft =
    multiplayerGame.battle[`${multiplayerRole}SwitchesLeft`] ?? 0;

  const alreadyActed =
    multiplayerGame.battle[`${multiplayerRole}Ready`] === true;

  panel.innerHTML = `
    <h3>Switches Left: ${switchesLeft}</h3>
    <div class="mp-switch-grid">
      ${
        team.map((pokemon, index) => {
          const fainted =
            pokemon.battleStats &&
            pokemon.battleStats.currentHp <= 0;

          const isActive =
            index === activeIndex;

          const disabled =
            fainted ||
            isActive ||
            switchesLeft <= 0 ||
            alreadyActed ||
            multiplayerGame.phase !== "battle";

          return `
            <button
              class="mp-switch-card"
              onclick="switchMultiplayerPokemon(${index})"
              ${disabled ? "disabled" : ""}
            >
              <img src="${pokemon.animatedImage || pokemon.image}">
              <strong>${pokemon.name.toUpperCase()}</strong>
              <small>
                ${
                  pokemon.battleStats
                    ? `HP ${pokemon.battleStats.currentHp}/${pokemon.battleStats.maxHp}`
                    : `HP ${pokemon.stats.hp}`
                }
              </small>
              <small>
                ${isActive ? "ACTIVE" : fainted ? "FAINTED" : "READY"}
              </small>
            </button>
          `;
        }).join("")
      }
    </div>
  `;
}

function switchMultiplayerPokemon(index) {
  const activeRoom =
    getActiveMultiplayerRoom();

  if (!activeRoom) {
    alert("No multiplayer room found");
    return;
  }

  if (!multiplayerGame) {
    alert("No multiplayer game found");
    return;
  }

  if (multiplayerGame.phase !== "battle") {
    alert("Switching is only available during battle");
    return;
  }

  const alreadyActed =
    multiplayerGame.battle &&
    multiplayerGame.battle[`${multiplayerRole}Ready`] === true;

  if (alreadyActed) {
    alert("You already chose an action this round");
    return;
  }

  const panel =
    document.getElementById("mpSwitchPanel");

  if (panel) {
    panel.classList.add("hidden");
  }

  const statusText =
    document.getElementById("mpPokeStats");

  if (statusText) {
    statusText.innerText =
      "Switch selected. Waiting for opponent...";
  }

  socket.emit("multiplayerSwitchPokemon", {
    roomCode: activeRoom,
    pokemonIndex: index
  });
}
async function startDraft() {
  document.getElementById("turnInfo").innerText = "Starting game...";

  const res = await fetch("/api/start");
  const result = await res.json();

  if (result.error) {
    alert(result.error);
    return;
  }

  await loadState();

  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(loadState, 1000);
}

async function loadState() {
  const res = await fetch("/api/state");
  state = await res.json();

  renderState();
}

async function bid(amount) {
  if (!state) return;
  if (state.player.passed) return;
  if (state.phase !== "draft") return;

  await fetch("/api/bid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount })
  });

  await loadState();
}

async function passRound() {
  if (!state) return;
  if (state.player.passed) return;
  if (state.phase !== "draft") return;

  await fetch("/api/pass", {
    method: "POST"
  });

  await loadState();
}

async function selectBattlePokemon(index) {
  const res = await fetch("/api/battle/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index })
  });

  const result = await res.json();

  if (result.error) {
    alert(result.error);
  }

  await loadState();
}

async function chooseBattleMove(moveIndex) {
  if (!state || state.phase !== "battle") return;
  if (state.battle.playerHasChosen) return;
  if (state.battle.playerNeedsReplacement) return;

  stopBattleTimer();

  await fetch("/api/battle/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moveIndex })
  });

  await loadState();
}

async function switchBattlePokemon(index) {
  if (!state || state.phase !== "battle") return;

  stopBattleTimer();

  const res = await fetch("/api/battle/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index })
  });

  const result = await res.json();

  if (result.error) {
    alert(result.error);
  }

  await loadState();
}

async function forceBattleTimeout() {
  if (!state || state.phase !== "battle") return;
  if (state.battle.playerHasChosen && !state.battle.playerNeedsReplacement) return;

  stopBattleTimer();

  await fetch("/api/battle/timeout", {
    method: "POST"
  });

  await loadState();
}

function renderState() {
  if (!state) return;

  if (state.phase === "battle" || state.battle?.started) {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    renderBattleScreen();
    return;
  }

  renderDraftScreen();
}

function renderDraftScreen() {
  stopBattleTimer();

  document.getElementById("draftScreen").classList.remove("hidden");
  document.getElementById("battleScreen").classList.add("hidden");

  if (!state.currentPokemon) return;

  const p = state.currentPokemon;

  renderPokemon(p);

  document.getElementById("currentBid").innerText = state.currentBid;
  document.getElementById("timer").innerText = state.timeLeft;
  document.getElementById("playerTokens").innerText = state.player.tokens;
  document.getElementById("enemyTokens").innerText = state.enemy.tokens;
  document.getElementById("playerCount").innerText = state.player.team.length;
  document.getElementById("enemyCount").innerText = state.enemy.team.length;

  document.getElementById("enemyComment").innerText =
    "Opponent: " + (state.enemy.comment || "Thinking...");

  document.getElementById("turnInfo").innerText = getTurnMessage();

  document.getElementById("roomInfo").innerText =
    `Room: ${state.room.id} | Mode: ${state.room.mode}`;

  renderTeams();
  renderLog();
  updateButtons();
  setBackground(p.type);
}
function renderBattleStatistics() {
  const box = document.getElementById("mpBattleStatsBox");

  if (!box || !multiplayerGame?.battle?.stats) return;

  const stats = multiplayerGame.battle.stats;

  box.classList.remove("hidden");

  box.innerHTML = `
    <h2>📊 Battle Statistics</h2>

    <div class="battle-stats-grid">
      <div>
        <h3>Player 1</h3>
        <p>💥 Damage: ${stats.player1.damageDealt}</p>
        <p>💢 Critical Hits: ${stats.player1.criticalHits}</p>
        <p>🎮 Moves Used: ${stats.player1.movesUsed}</p>
        <p>💀 Pokémon Fainted: ${stats.player1.pokemonFainted}</p>
        <p>🔄 Switches Used: ${stats.player1.switchesUsed}</p>
      </div>

      <div>
        <h3>Player 2</h3>
        <p>💥 Damage: ${stats.player2.damageDealt}</p>
        <p>💢 Critical Hits: ${stats.player2.criticalHits}</p>
        <p>🎮 Moves Used: ${stats.player2.movesUsed}</p>
        <p>💀 Pokémon Fainted: ${stats.player2.pokemonFainted}</p>
        <p>🔄 Switches Used: ${stats.player2.switchesUsed}</p>
      </div>
    </div>
  `;
}
function getTurnMessage() {
  if (state.phase === "end") return "Draft finished!";
  if (state.player.passed) return "You passed. Waiting for this Pokémon to resolve...";
  return "Your choice: Bid or Pass";
}

function updateButtons() {
  const disabled =
    !state ||
    state.phase !== "draft" ||
    state.player.passed ||
    state.player.team.length >= state.player.maxTeam ||
    state.player.tokens <= state.currentBid;

  document.getElementById("bid1Btn").disabled = disabled;
  document.getElementById("bid2Btn").disabled = disabled;
  document.getElementById("bid3Btn").disabled = disabled;

  document.getElementById("passBtn").disabled =
    !state || state.phase !== "draft" || state.player.passed;
}

function renderPokemon(pokemon) {
  document.getElementById("pokeName").innerText =
    pokemon.name.toUpperCase();

  document.getElementById("pokeImage").src = pokemon.image;

  document.getElementById("pokeStats").innerText =
    `HP:${pokemon.stats.hp} | ATK:${pokemon.stats.attack} | DEF:${pokemon.stats.defense || "?"} | SPD:${pokemon.stats.speed} | STA:${pokemon.stats.stamina || 100}`;

  document.getElementById("pokeType").innerText =
    `Type: ${pokemon.type}`;
}

function renderTeams() {
  document.getElementById("playerTeam").innerHTML =
    state.player.team.map(p => teamCard(p)).join("");

  document.getElementById("enemyTeam").innerHTML =
    state.enemy.team.map(p => teamCard(p)).join("");
}

function teamCard(pokemon) {
  return `
    <div class="poke-card">
      <div class="poke-card-top">
        <span>${pokemon.name.toUpperCase()}</span>
        <small>${pokemon.type}</small>
      </div>

      <div class="poke-card-img-wrap">
        <img src="${pokemon.image}">
      </div>

      <div class="poke-card-stats">
        <span>HP ${pokemon.stats.hp}</span>
        <span>ATK ${pokemon.stats.attack}</span>
        <span>SPD ${pokemon.stats.speed}</span>
      </div>
    </div>
  `;
}

function renderLog() {
  const gameLog = document.getElementById("gameLog");

  if (!gameLog || !state.logs) return;

  gameLog.innerHTML =
    state.logs
      .map(log => `<div class="log-item">${log}</div>`)
      .join("");

  gameLog.scrollTop = gameLog.scrollHeight;
}

function renderBattleLog() {
  const battleLog = document.getElementById("battleLog");

  if (!battleLog || !state.logs) return;

  battleLog.innerHTML =
    state.logs
      .slice(-60)
      .map(log => `<div class="log-item">${log}</div>`)
      .join("");

  battleLog.scrollTop = battleLog.scrollHeight;
}

function renderBattleScreen() {
  document.getElementById("draftScreen").classList.add("hidden");
  document.getElementById("battleScreen").classList.remove("hidden");

  renderArena();

  if (state.battle.waitingForPlayerSelection) {
    stopBattleTimer();

    document.getElementById("battleSelectionPanel").classList.remove("hidden");
    document.getElementById("battleField").classList.add("hidden");
    document.getElementById("movePanelWrap").classList.add("hidden");
    document.getElementById("switchPanelWrap").classList.add("hidden");

    document.getElementById("battleStatus").innerText =
      "Choose your first Pokémon";

    renderBattleTeamSelect();
  } else {
    document.getElementById("battleSelectionPanel").classList.add("hidden");
    document.getElementById("battleField").classList.remove("hidden");
    document.getElementById("switchPanelWrap").classList.remove("hidden");

    if (state.battle.playerNeedsReplacement) {
      document.getElementById("movePanelWrap").classList.add("hidden");

      document.getElementById("battleStatus").innerText =
        "Your Pokémon fainted. Choose a replacement.";
    } else {
      document.getElementById("movePanelWrap").classList.remove("hidden");

      document.getElementById("battleStatus").innerText =
        state.battle.status;
    }

    renderBattleField();
    renderMoveButtons();
    renderSwitchPanel();

    if (
      state.phase === "battle" &&
      !state.battle.playerHasChosen
    ) {
      startBattleTimer();
    } else {
      stopBattleTimer();
    }
  }

  if (state.battle.arena?.type) {
    setBackground(state.battle.arena.type);
  }

  renderBattleLog();
}

function renderArena() {
  const arena = state.battle.arena;

  if (!arena) return;

  document.getElementById("arenaName").innerText =
    "Arena: " + arena.name;

  document.getElementById("arenaDescription").innerText =
    arena.description;

  document.getElementById("arenaEffects").innerHTML =
    arena.effects
      .map(effect => `<li>${effect}</li>`)
      .join("");
}

function renderBattleTeamSelect() {
  document.getElementById("battleTeamSelect").innerHTML =
    state.player.team
      .map((pokemon, index) => {
        return `
          <div class="select-card" onclick="selectBattlePokemon(${index})">
            <img src="${pokemon.animatedImage || pokemon.image}">
            <h3>${pokemon.name.toUpperCase()}</h3>
            <p>${pokemon.type}</p>
            <small>
              HP ${pokemon.stats.hp} |
              ATK ${pokemon.stats.attack} |
              SPD ${pokemon.stats.speed}
            </small>
          </div>
        `;
      })
      .join("");
}

function renderBattleField() {
  const player = state.battle.playerActive;
  const enemy = state.battle.enemyActive;

  if (!player || !enemy) return;

  renderFighter("player", player);
  renderFighter("enemy", enemy);

  const roundInfo = document.getElementById("roundInfo");
  if (roundInfo) {
    roundInfo.innerText =
      `Round ${state.battle.round} / ${state.battle.maxRounds}`;
  }

  const roundTimer = document.getElementById("roundTimer");
  if (roundTimer) {
    roundTimer.innerText = state.battle.roundTimeLeft;
  }

  const winnerBox = document.getElementById("winnerBox");

  if (winnerBox) {
    if (state.phase === "end" && state.battle.winner) {
      winnerBox.classList.remove("hidden");

      winnerBox.innerText =
        state.battle.winner === "player"
          ? "🏆 You Win!"
          : "💀 Enemy Wins!";
    } else {
      winnerBox.classList.add("hidden");
    }
  }
}

function renderFighter(side, pokemon) {
  const hpPercent =
    (pokemon.battleStats.currentHp / pokemon.battleStats.maxHp) * 100;

  const staminaPercent =
    (pokemon.battleStats.currentStamina / pokemon.battleStats.maxStamina) * 100;

  document.getElementById(`${side}ActiveName`).innerText =
    pokemon.name.toUpperCase();

  document.getElementById(`${side}ActiveImage`).src =
    pokemon.animatedImage || pokemon.image;

  document.getElementById(`${side}ActiveType`).innerText =
    `Type: ${pokemon.type}`;

  const statsBox =
    document.getElementById(`${side}BattleStats`);

  if (statsBox) {
    statsBox.innerHTML = `
      <div class="battle-stat-grid">
        <div class="battle-stat">⚔️ ATK <span>${pokemon.stats.attack}</span></div>
        <div class="battle-stat">🛡️ DEF <span>${pokemon.stats.defense}</span></div>
        <div class="battle-stat">⚡ SPD <span>${pokemon.stats.speed}</span></div>
        <div class="battle-stat">🔮 SP.ATK <span>${pokemon.stats.specialAttack}</span></div>
        <div class="battle-stat">🧿 SP.DEF <span>${pokemon.stats.specialDefense}</span></div>
        <div class="battle-stat">🌟 TYPE <span>${pokemon.type}</span></div>
      </div>
    `;
  }

  document.getElementById(`${side}HPBar`).style.width =
    `${hpPercent}%`;

  document.getElementById(`${side}HPText`).innerText =
    `HP: ${pokemon.battleStats.currentHp} / ${pokemon.battleStats.maxHp}`;

  document.getElementById(`${side}StaminaBar`).style.width =
    `${staminaPercent}%`;

  document.getElementById(`${side}StaminaText`).innerText =
    `Stamina: ${pokemon.battleStats.currentStamina} / ${pokemon.battleStats.maxStamina}`;
}

function renderMoveButtons() {
  const movePanel = document.getElementById("movePanel");

  if (!movePanel || !state.battle.playerActive) return;

  const disabled =
    state.battle.playerHasChosen ||
    state.phase !== "battle" ||
    state.battle.playerNeedsReplacement;

  movePanel.innerHTML =
    state.battle.playerActive.moves
      .map((move, index) => {
        const notEnoughStamina =
          move.staminaCost >
          state.battle.playerActive.battleStats.currentStamina;

        return `
          <button
            onclick="chooseBattleMove(${index})"
            ${disabled || notEnoughStamina ? "disabled" : ""}
          >
            ${move.name}
            <br>
            Power: ${move.power}
            <br>
            STA: ${move.staminaCost}
          </button>
        `;
      })
      .join("");
}

function renderSwitchPanel() {
  const switchPanel = document.getElementById("switchPanel");

  if (!switchPanel || !state.player?.team) return;

  switchPanel.innerHTML =
    state.player.team
      .map((pokemon, index) => {
        const isActive =
          index === state.battle.playerActiveIndex;

        const currentHp =
          isActive
            ? state.battle.playerActive.battleStats.currentHp
            : pokemon.battleStats
              ? pokemon.battleStats.currentHp
              : pokemon.stats.hp;

        const maxHp =
          isActive
            ? state.battle.playerActive.battleStats.maxHp
            : pokemon.battleStats
              ? pokemon.battleStats.maxHp
              : pokemon.stats.hp;

        const fainted =
          currentHp <= 0;

        const disabled =
          isActive ||
          fainted ||
          state.phase !== "battle" ||
          (
            state.battle.playerHasChosen &&
            !state.battle.playerNeedsReplacement
          );

        return `
          <button
            class="switch-card ${isActive ? "active-switch" : ""} ${fainted ? "fainted-switch" : ""}"
            onclick="switchBattlePokemon(${index})"
            ${disabled ? "disabled" : ""}
          >
            <img src="${pokemon.animatedImage || pokemon.image}">
            <span>${pokemon.name.toUpperCase()}</span>
            <small>HP ${currentHp} / ${maxHp}</small>
            ${isActive ? "<small>ACTIVE</small>" : ""}
            ${fainted ? "<small>FAINTED</small>" : ""}
          </button>
        `;
      })
      .join("");
}

function startBattleTimer() {
  if (battleTimerInterval) return;

  battleTimerInterval = setInterval(async () => {
    if (!state || state.phase !== "battle") {
      stopBattleTimer();
      return;
    }

    if (
      state.battle.playerHasChosen &&
      !state.battle.playerNeedsReplacement
    ) {
      stopBattleTimer();
      return;
    }

    state.battle.roundTimeLeft--;

    const roundTimer =
      document.getElementById("roundTimer");

    if (roundTimer) {
      roundTimer.innerText =
        state.battle.roundTimeLeft;
    }

    if (state.battle.roundTimeLeft <= 0) {
      await forceBattleTimeout();
    }
  }, 1000);
}

function stopBattleTimer() {
  if (battleTimerInterval) {
    clearInterval(battleTimerInterval);
    battleTimerInterval = null;
  }
}

function setBackground(type) {
  const doodles = {
    fire: "🔥 🔥 ✨ ♨️ 🔥",
    water: "💧 🌊 🫧 💦 🌊",
    grass: "🌿 🍃 🌱 🌳 🍀",
    electric: "⚡ ⚡ ✨ 🔋 ⚡",
    ice: "❄️ 🧊 ❄️ ✨ 🧊",
    psychic: "🔮 ✨ 🌀 👁️ 🔮",
    ghost: "👻 🌙 💀 👻 ✨",
    dragon: "🐉 🔥 ✨ 🐲 🐉",
    normal: "⭐ ✨ ⚪ ⭐ ✨",
    poison: "☠️ 🧪 💜 ☣️ 🧪",
    ground: "⛰️ 🪨 🌍 🏜️ 🪨",
    rock: "🪨 ⛰️ 🧱 🪨 ✨",
    fighting: "🥊 💥 🥋 💢 🥊",
    flying: "🪽 ☁️ 🌪️ 🕊️ ☁️",
    bug: "🐞 🐛 🦋 🌿 🐝",
    steel: "⚙️ 🔩 🛡️ ⚙️ ✨",
    dark: "🌑 🖤 🌘 🦇 🌑",
    fairy: "🧚 ✨ 🌸 💫 🧚"
  };

  const colors = {
    fire: ["#ff0844", "#ffb199"],
    water: ["#00c6ff", "#0072ff"],
    grass: ["#00b09b", "#96c93d"],
    electric: ["#f7971e", "#ffd200"],
    ice: ["#89f7fe", "#66a6ff"],
    psychic: ["#da22ff", "#9733ee"],
    ghost: ["#232526", "#6a11cb"],
    dragon: ["#1e3c72", "#2a5298"],
    normal: ["#bdc3c7", "#2c3e50"],
    poison: ["#8e2de2", "#4a00e0"],
    ground: ["#ba8b02", "#181818"],
    rock: ["#3c3b3f", "#605c3c"],
    fighting: ["#cb2d3e", "#ef473a"],
    flying: ["#36d1dc", "#5b86e5"],
    bug: ["#56ab2f", "#a8e063"],
    steel: ["#757f9a", "#d7dde8"],
    dark: ["#141e30", "#243b55"],
    fairy: ["#ff9a9e", "#fad0c4"]
  };

  const selectedColors = colors[type] || ["#0f172a", "#1e293b"];
  const selectedDoodles = doodles[type] || "⭐ ✨ ⚪ ⭐ ✨";

  document.body.style.backgroundImage = `
    radial-gradient(circle at 10% 20%, rgba(255,255,255,0.14), transparent 14%),
    linear-gradient(135deg, ${selectedColors[0]}, ${selectedColors[1]})
  `;

  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundAttachment = "fixed";

  document.body.setAttribute("data-doodles", selectedDoodles);
}
function showOnlyScreen(screenId) {
  const screens = [
    "homeDashboard",
    "multiplayerPanel",
    "draftScreen",
    "battleScreen"
  ];

  screens.forEach(id => {
    const element = document.getElementById(id);

    if (!element) return;

    if (id === screenId) {
      element.classList.remove("hidden");
    } else {
      element.classList.add("hidden");
    }
  });
}

function openHome() {
  showOnlyScreen("homeDashboard");
}

function openAiMode() {
  showOnlyScreen("draftScreen");
}

function openPvpMode() {
  showOnlyScreen("multiplayerPanel");
}

function toggleHomeMenu() {
  const menu = document.getElementById("homeMenu");

  if (!menu) return;

  menu.classList.toggle("hidden");
}

function openAnipediaPreview() {
  alert("Anipedia will be added in Beta 0.1");
}