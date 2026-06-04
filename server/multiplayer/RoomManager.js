class RoomManager {
  constructor() {
    this.rooms = {};
  }

  createRoom(hostSocketId) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    this.rooms[code] = {
      code,
      players: [
        {
          id: hostSocketId,
          role: "player1",
          name: "Player 1"
        }
      ],
      game: null,
      createdAt: Date.now()
    };

    return this.rooms[code];
  }

  joinRoom(code, socketId) {
    const room = this.rooms[code];

    if (!room) {
      return { error: "Room not found" };
    }

    if (room.players.length >= 2) {
      return { error: "Room is full" };
    }

    room.players.push({
      id: socketId,
      role: "player2",
      name: "Player 2"
    });

    return room;
  }

  getRoom(code) {
    return this.rooms[code];
  }

  getPlayerRole(roomCode, socketId) {
    const room = this.rooms[roomCode];

    if (!room) return null;

    const player = room.players.find(p => p.id === socketId);

    return player ? player.role : null;
  }

  setGame(roomCode, game) {
    const room = this.rooms[roomCode];

    if (!room) return null;

    room.game = game;

    return room.game;
  }

  getGame(roomCode) {
    const room = this.rooms[roomCode];

    if (!room) return null;

    return room.game;
  }

  removePlayer(socketId) {
    for (const code in this.rooms) {
      const room = this.rooms[code];

      room.players = room.players.filter(player => player.id !== socketId);

      if (room.players.length === 0) {
        delete this.rooms[code];
      }
    }
  }
}

module.exports = RoomManager;