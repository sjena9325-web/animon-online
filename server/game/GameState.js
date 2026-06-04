class GameState {
  constructor() {
    this.room = {
      id: "ROOM-001",
      mode: "single-player-ai",
      players: ["player", "enemy"]
    };

    this.player = {
      tokens: 20,
      team: [],
      passed: false,
      maxTeam: 6,
      minTeam: 1
    };

    this.enemy = {
      tokens: 20,
      team: [],
      passed: false,
      maxTeam: 6,
      minTeam: 1,
      comment: "Waiting..."
    };

    this.currentPokemon = null;
    this.currentBid = 0;
    this.highestBidder = null;

    this.timeLeft = 10;
    this.pool = [];
    this.index = 0;

    this.turn = "player";
    this.phase = "draft";

    this.bin = [];
    this.logs = [];

    this.battle = this.createBattleState();
  }

  createBattleState() {
    return {
      started: false,

      arena: null,
      lastArenaName: null,

      playerActive: null,
      enemyActive: null,

      playerActiveIndex: null,
      enemyActiveIndex: null,

      round: 1,
      maxRounds: 10,
      overtimeRounds: 0,

      roundTimeLeft: 20,

      playerAction: null,
      enemyAction: null,

      playerHasChosen: false,
      enemyHasChosen: false,

      waitingForPlayerSelection: false,
      waitingForSwitch: false,

      playerNeedsReplacement: false,
      enemyNeedsReplacement: false,

      status: "Battle not started",

      winner: null
    };
  }

  resetGame() {
    this.player.tokens = 20;
    this.player.team = [];
    this.player.passed = false;

    this.enemy.tokens = 20;
    this.enemy.team = [];
    this.enemy.passed = false;
    this.enemy.comment = "Waiting...";

    this.currentPokemon = null;
    this.currentBid = 0;
    this.highestBidder = null;

    this.timeLeft = 10;
    this.pool = [];
    this.index = 0;

    this.turn = "player";
    this.phase = "draft";

    this.bin = [];
    this.logs = [];

    this.battle = this.createBattleState();
  }

  resetRound() {
    this.currentBid = 0;
    this.highestBidder = null;

    this.player.passed = false;
    this.enemy.passed = false;

    this.enemy.comment = "Thinking...";

    this.timeLeft = 10;
    this.turn = "player";
  }

  resetBattleRound() {
    this.battle.roundTimeLeft = 20;

    this.battle.playerAction = null;
    this.battle.enemyAction = null;

    this.battle.playerHasChosen = false;
    this.battle.enemyHasChosen = false;

    this.battle.status = `Round ${this.battle.round}: choose your move`;
  }

  addLog(message) {
    this.logs.push(message);

    if (this.logs.length > 150) {
      this.logs.shift();
    }
  }

  canStartBattle() {
    return (
      this.player.team.length >= this.player.minTeam &&
      this.enemy.team.length >= this.enemy.minTeam
    );
  }

  playerDraftDone() {
    return (
      this.player.team.length >= this.player.maxTeam ||
      this.player.tokens <= 0
    );
  }

  enemyDraftDone() {
    return (
      this.enemy.team.length >= this.enemy.maxTeam ||
      this.enemy.tokens <= 0
    );
  }

  bothDraftDone() {
    return this.playerDraftDone() && this.enemyDraftDone();
  }

  alivePlayerPokemon() {
    return this.player.team.filter((pokemon, index) => {
      if (index === this.battle.playerActiveIndex) {
        return this.battle.playerActive?.battleStats?.currentHp > 0;
      }

      return !pokemon.battleStats || pokemon.battleStats.currentHp > 0;
    });
  }

  aliveEnemyPokemon() {
    return this.enemy.team.filter((pokemon, index) => {
      if (index === this.battle.enemyActiveIndex) {
        return this.battle.enemyActive?.battleStats?.currentHp > 0;
      }

      return !pokemon.battleStats || pokemon.battleStats.currentHp > 0;
    });
  }
}

module.exports = GameState;