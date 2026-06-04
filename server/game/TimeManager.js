class TimeManager {
  constructor(state, engine) {
    this.state = state;
    this.engine = engine;
    this.interval = null;
  }

  start() {
    this.stop();

    this.interval = setInterval(() => {
      if (!this.state.currentPokemon) return;
      if (this.state.phase !== "draft") return;

      this.state.timeLeft--;

      if (this.state.timeLeft <= 0) {
        this.engine.forceTimeoutResolve();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = null;
  }
}

module.exports = TimeManager;