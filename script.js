// ------------------------------
// Pig Game - Client (multijoueur + IA optionnelle)
// ------------------------------

let state = {
  players: [
    { name: "Bernard", score: 0 },
    { name: "Computer", score: 0 },
  ],
  current_turn: 0,
  turnPoints: 0,
  target: 50,
  lastRoll: 1,
  phase: "PLAYING",
};

// === UI ===
const roll_btn = document.querySelector("#roll_btn");
const hold_btn = document.querySelector("#hold_btn");
const turnEl = document.querySelector("#turn");
const turnPointsEl = document.querySelector("#turn_points");
const p1NameEl = document.querySelector("#player_1_name");
const p2NameEl = document.querySelector("#player_2_name");
const p1ScoreEl = document.querySelector("#player_1_score");
const p2ScoreEl = document.querySelector("#player_2_score");
const invite_btn = document.querySelector("#invite_btn");
const statusEl = document.querySelector("#status");
const diceImg = document.querySelector("#dice");
const reset_btn = document.querySelector("#new_game");
const victoryEl = document.querySelector("#victory");

// === Params ===
const params = new URLSearchParams(location.search);
const roomId = params.get("room") || "test-room";
const mySeat = Number(params.get("seat") ?? 0); // 0 ou 1

// === Socket.IO (CDN requis dans index.html) ===
let socket = null;
try {
  if (typeof io !== "undefined") {
    const host = window.location.hostname || "127.0.0.1";
    socket = io(`http://${host}:3000`);

    socket.on("connect", () => setStatus("Connecté au serveur ✓"));
    socket.on("disconnect", () =>
      setStatus("Déconnecté — mode local possible")
    );
    socket.on("connect_error", () =>
      setStatus("⚠️ Impossible de joindre le serveur")
    );

    socket.emit("join", { roomId, seat: mySeat });

    socket.on("state", (serverState) => {
      state = serverState;
      render();
    });

    socket.on("errorMsg", (msg) => {
      console.warn("[server]", msg);
      setStatus(`⚠️ ${msg}`);
    });
  } else {
    console.warn("Socket.IO client non chargé (CDN manquant).");
    setStatus("Mode local (pas de serveur).");
  }
} catch (e) {
  console.warn("Échec connexion Socket.IO:", e);
  setStatus("⚠️ Échec Socket.IO. Mode local uniquement.");
}

// === Envoi d'action ===
function dispatchRemote(action) {
  if (socket && socket.connected) {
    socket.emit("action", action);
    return;
  }
  // Fallback local (test solo)
  state = reduceLocal(state, action);
  render();
}

// === Handlers ===
roll_btn?.addEventListener("click", () => dispatchRemote({ type: "ROLL" }));
hold_btn?.addEventListener("click", () => dispatchRemote({ type: "HOLD" }));
reset_btn?.addEventListener("click", () => dispatchRemote({ type: "RESET" }));

invite_btn?.addEventListener("click", async () => {
  const url = new URL(location.href);
  const room = roomId;
  const otherSeat = mySeat === 0 ? 1 : 0;
  url.searchParams.set("room", room);
  url.searchParams.set("seat", otherSeat);
  try {
    await navigator.clipboard.writeText(url.toString());
    setStatus("✅ Invite link copied!");
  } catch {
    setStatus(url.toString());
  }
});

// === Render ===
function render() {
  if (p1NameEl) p1NameEl.textContent = state.players?.[0]?.name ?? "P1";
  if (p2NameEl) p2NameEl.textContent = state.players?.[1]?.name ?? "P2";

  if (p1ScoreEl) p1ScoreEl.textContent = state.players?.[0]?.score ?? 0;
  if (p2ScoreEl) p2ScoreEl.textContent = state.players?.[1]?.score ?? 0;

  if (turnEl) {
    const who =
      state.current_turn === 0
        ? state.players?.[0]?.name
        : state.players?.[1]?.name;
    turnEl.textContent = who ?? "-";
  }
  if (turnPointsEl) turnPointsEl.textContent = state.turnPoints ?? 0;

  if (diceImg) {
    const face = state.lastRoll ?? 1;
    diceImg.src = `assets/dice-${face}.svg`;
    diceImg.alt = `Dice ${face}`;
  }

  // Couleurs joueur actif
  if (p1NameEl && p2NameEl) {
    const isP1 = state.current_turn === 0;
    p1NameEl.classList.toggle("font-bold", isP1);
    p1NameEl.classList.toggle("text-blue-600", isP1);
    p1NameEl.classList.toggle("text-gray-800", !isP1);
    p2NameEl.classList.toggle("font-bold", !isP1);
    p2NameEl.classList.toggle("text-red-600", !isP1);
    p2NameEl.classList.toggle("text-gray-800", isP1);
  }

  if (victoryEl) {
    if (state.phase === "WIN") {
      const winner = state.current_turn;
      const name = state.players?.[winner]?.name ?? "Player";
      victoryEl.textContent = `${name} wins! 🎉`;
      victoryEl.classList.remove("hidden");
    } else {
      victoryEl.textContent = "";
      victoryEl.classList.add("hidden");
    }
  }

  const myTurn = state.phase === "PLAYING" && state.current_turn === mySeat;
  const playing = state.phase === "PLAYING";
  toggleBtn(roll_btn, myTurn && playing);
  toggleBtn(hold_btn, myTurn && playing && (state.turnPoints ?? 0) > 0);

  if (statusEl) {
    if (state.phase === "LOBBY") setStatus("En attente d'un autre joueur…");
    else if (state.phase === "PLAYING")
      setStatus(myTurn ? "À toi de jouer !" : "L'adversaire joue…");
    else if (state.phase === "WIN") setStatus("Partie terminée.");
  }

  if (ENABLE_CLIENT_AI && shouldAiPlayNow()) {
    scheduleClientAiStep();
  }
}

function toggleBtn(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
  btn.classList.toggle("opacity-60", !enabled);
  btn.classList.toggle("cursor-not-allowed", !enabled);
}
function setStatus(text) {
  if (statusEl) statusEl.textContent = text ?? "";
}

// === Reducer local (fallback) ===
function rollDiceLocal() {
  return Math.floor(Math.random() * 6) + 1;
}
function reduceLocal(s, action) {
  const other = s.current_turn === 0 ? 1 : 0;
  switch (action.type) {
    case "RESET":
      return {
        players: [
          { name: "P1", score: 0 },
          { name: "P2", score: 0 },
        ],
        current_turn: 0,
        turnPoints: 0,
        target: 50,
        lastRoll: 1,
        phase: "PLAYING",
      };
    case "ROLL": {
      if (s.phase !== "PLAYING") return s;
      const roll = rollDiceLocal();
      if (roll === 1)
        return { ...s, lastRoll: 1, turnPoints: 0, current_turn: other };
      return { ...s, lastRoll: roll, turnPoints: s.turnPoints + roll };
    }
    case "HOLD": {
      if (s.phase !== "PLAYING") return s;
      const cur = s.current_turn;
      const newScore = s.players[cur].score + s.turnPoints;
      const updated = s.players.map((p, i) =>
        i === cur ? { ...p, score: newScore } : p
      );
      if (newScore >= s.target)
        return { ...s, players: updated, turnPoints: 0, phase: "WIN" };
      return { ...s, players: updated, turnPoints: 0, current_turn: other };
    }
    default:
      return s;
  }
}

// === IA locale optionnelle (OFF par défaut) ===
const ENABLE_CLIENT_AI = false;
const AI_SEAT = 1;
let aiTimeoutId = null;

function clientAiDecideAction(s) {
  const me = AI_SEAT,
    opp = 1 - me;
  if (s.current_turn !== me || s.phase !== "PLAYING") return null;

  const myScore = s.players[me].score;
  const oppScore = s.players[opp].score;
  const tp = s.turnPoints;

  if (myScore + tp >= s.target) return "HOLD";
  if (s.target - (myScore + tp) <= 6 && tp >= 6) return "HOLD";

  const lead = myScore - oppScore;
  let N = Math.round(16 - lead / 12);
  N = Math.max(10, Math.min(22, N));
  return tp >= N ? "HOLD" : "ROLL";
}
function shouldAiPlayNow() {
  return (
    ENABLE_CLIENT_AI &&
    state.phase === "PLAYING" &&
    state.current_turn === AI_SEAT &&
    mySeat === AI_SEAT
  );
}
function scheduleClientAiStep() {
  if (aiTimeoutId) return;
  aiTimeoutId = setTimeout(() => {
    aiTimeoutId = null;
    const decision = clientAiDecideAction(state);
    if (!decision) return;
    dispatchRemote({ type: decision });
  }, 450);
}

// Premier rendu
render();
