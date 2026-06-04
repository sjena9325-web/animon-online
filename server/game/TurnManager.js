class TurnManager {
  constructor(state, engine) {
    this.state = state;
    this.engine = engine;
  }

  bid(amount) {
    const result = this.engine.bidPlayer(amount);

    if (!result.error) {
      this.state.turn = "enemy";
      this.engine.aiTurnAfterPlayerBid();
      this.state.turn = "player";
    }

    return result;
  }

  pass() {
    this.state.turn = "enemy";
    const result = this.engine.passPlayer();
    this.state.turn = "player";

    return result;
  }
}

module.exports = TurnManager;