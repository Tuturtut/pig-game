// server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ---- Jeu ----
const A = { ROLL: "ROLL", HOLD: "HOLD", RESET: "RESET" };

function initialState() {
  return {
    players: [
      { name: "P1", score: 0 },
      { name: "P2", score: 0 },
    ],
    current_turn: 0,
    turnPoints: 0,
    target: 50,
    lastRoll: 1,
    phase: "LOBBY", // on démarre en lobby tant que les 2 sièges ne sont pas pris
  };
}

const rooms = new Map(); // roomId -> { state, seats: [socketId|null, socketId|null], nextStarter: 0 }

function createEmptyRoom() {
  return { state: initialState(), seats: [null, null], nextStarter: 0 };
}
function roomBothSeatsTaken(room) {
  return Boolean(room.seats[0] && room.seats[1]);
}
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function reduce(s, action) {
  if (!s) s = initialState();
  if (s.phase !== "PLAYING" && action.type !== A.RESET) return s;

  const other = s.current_turn === 0 ? 1 : 0;

  switch (action.type) {
    case A.RESET: {
      // reset “propre” : on conserve noms/target,
      // et on démarre en PLAYING avec le starter fourni
      const base = initialState();
      return {
        ...base,
        players: s.players.map((p) => ({ ...p, score: 0 })),
        target: s.target,
        current_turn: action.starter ?? 0,

        phase: "PLAYING",
      };
    }

    case A.ROLL: {
      const roll = rollDice();
      if (roll === 1) {
        return { ...s, lastRoll: 1, turnPoints: 0, current_turn: other };
      }
      return { ...s, lastRoll: roll, turnPoints: s.turnPoints + roll };
    }

    case A.HOLD: {
      const cur = s.current_turn;
      const newScore = s.players[cur].score + s.turnPoints;
      const updated = s.players.map((p, i) =>
        i === cur ? { ...p, score: newScore } : p
      );
      if (newScore >= s.target) {
        return { ...s, players: updated, turnPoints: 0, phase: "WIN" };
      }
      return { ...s, players: updated, turnPoints: 0, current_turn: other };
    }

    default:
      return s;
  }
}

// ---- Socket wiring ----
io.on("connection", (socket) => {
  socket.on("join", ({ roomId, seat }) => {
    if (!rooms.has(roomId)) rooms.set(roomId, createEmptyRoom());
    const room = rooms.get(roomId);

    if (seat !== 0 && seat !== 1)
      return socket.emit("errorMsg", "Seat invalide");
    if (room.seats[seat] && room.seats[seat] !== socket.id) {
      return socket.emit("errorMsg", "Seat déjà pris");
    }

    room.seats[seat] = socket.id;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.seat = seat;

    // Quand les 2 joueurs sont là, on passe en PLAYING
    if (roomBothSeatsTaken(room) && room.state.phase === "LOBBY") {
      room.state = reduce(room.state, {
        type: A.RESET,
        starter: room.nextStarter,
      });
    }

    io.to(roomId).emit("state", room.state);
  });

  socket.on("action", (action) => {
    const roomId = socket.data.roomId;
    const seat = socket.data.seat;
    if (!roomId || seat === undefined) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // En LOBBY : on autorise uniquement RESET (sinon on ignore)
    if (room.state.phase !== "PLAYING" && action.type !== A.RESET) return;

    // Autorité : seul le joueur du tour peut agir (sauf RESET)
    if (action.type !== A.RESET && seat !== room.state.current_turn) return;

    // RESET : alterne le starter si les 2 sont là, sinon reste en LOBBY
    if (action.type === A.RESET) {
      if (roomBothSeatsTaken(room)) {
        room.nextStarter = room.nextStarter === 0 ? 1 : 0;
        room.state = reduce(room.state, {
          type: A.RESET,
          starter: room.nextStarter,
        });
      } else {
        room.state = {
          ...initialState(),
          players: room.state.players,
          target: room.state.target,
          phase: "LOBBY",
        };
      }
    } else {
      room.state = reduce(room.state, action);
    }

    io.to(roomId).emit("state", room.state);
  });

  socket.on("disconnect", () => {
    const { roomId, seat } = socket.data || {};
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (seat === 0 || seat === 1) room.seats[seat] = null;
    // Retour en LOBBY si un joueur part
    room.state.phase = "LOBBY";
    io.to(roomId).emit("state", room.state);
  });
});

const PORT = 3000;
const HOST = "0.0.0.0";
server.listen(PORT, HOST, () =>
  console.log(`Server running on http://${HOST}:${PORT}`)
);
