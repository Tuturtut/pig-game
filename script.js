let state = {
  player: [
    {
      name: "Bernard",
      score: 0,
    },
    {
      name: "Computer",
      score: 0,
    },
  ],
  current_turn: 0,
  turnPoints: 0,
  target: 100,
  lastRoll: 1,
  phase: "MENU",
};

function rollDice(faces = 6) {
  let dice = Math.floor(Math.random() * faces) + 1;
  return dice;
}

const roll_btn = document.querySelector("#roll_btn");
const hold_btn = document.querySelector("#hold_btn");
const turn_points = document.querySelector("#turn_points");

const player_1_score = document.querySelector("#player_1_score");
const player_2_score = document.querySelector("#player_2_score");

const player_1_name = document.querySelector("#player_1_name");
const player_2_name = document.querySelector("#player_2_name");

const dice_img = document.querySelector("#dice");

const new_game_btn = document.querySelector("#new_game");
const victory = document.querySelector("#victory");

const A = {
  ROLL: "ROLL",
  HOLD: "HOLD",
  RESET: "RESET",
};

const HUMAN = 0;
const COMPUTER = 1;

let aiTimeoutId = null;

function canAiWinThisTurn(s) {
  const cur = s.current_turn;
  return s.player[cur].score + s.turnPoints >= s.target;
}

function isAiTurn(s) {
  return s.current_turn === COMPUTER && s.phase === "PLAYING";
}

function computerTurn() {
  if (!isAiTurn(state)) return;

  if (canAiWinThisTurn(state)) {
    dispatch({ type: A.HOLD });
    return;
  }
  const lead = state.player[COMPUTER].score - state.player[HUMAN].score;
  const current_target = Math.max(10, Math.min(30, 16 - lead / 10));
  console.log("current target", current_target);
  if (state.turnPoints >= current_target) {
    dispatch({ type: A.HOLD });
    return;
  }

  dispatch({ type: A.ROLL });
}

function scheduleComputerTurn() {
  if (aiTimeoutId) {
    clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }

  aiTimeoutId = setTimeout(() => {
    aiTimeoutId = null;
    computerTurn();
  }, 1000);
}

function reduce(state, action) {
  if (state.phase !== "PLAYING" && action.type !== A.RESET) return state;

  const other = state.current_turn === 0 ? 1 : 0;

  switch (action.type) {
    case A.RESET:
      return {
        ...state,
        player: state.player.map((p) => ({
          ...p,
          score: 0,
        })),
        current_turn: 0,
        turnPoints: 0,
        phase: "PLAYING",
        lastRoll: 1,
      };
    case A.ROLL: {
      const roll = rollDice();

      if (roll === 1) {
        return {
          ...state,
          lastRoll: 1,
          current_turn: other,
          turnPoints: 0,
        };
      }

      return {
        ...state,
        turnPoints: state.turnPoints + roll,
        lastRoll: roll,
      };
    }
    case A.HOLD: {
      const cur = state.current_turn;
      const newScore = state.player[cur].score + state.turnPoints;
      const withScore = {
        ...state,
        player: state.player.map((p, i) =>
          i === cur ? { ...p, score: newScore } : p
        ),
        turnPoints: 0,
      };
      if (newScore >= state.target) return { ...withScore, phase: "WIN" };
      return { ...withScore, current_turn: other };
    }
    default: {
      return state;
    }
  }
}

function dispatch(action) {
  state = reduce(state, action);
  render();
}

roll_btn.addEventListener("click", () => {
  dispatch({ type: A.ROLL });
});

hold_btn.addEventListener("click", () => {
  dispatch({ type: A.HOLD });
});

function changeBtnColors(p1_color = "bg-sky-600", p2_color = "bg-red-600") {
  if (state.current_turn === 0) {
    roll_btn.classList.remove(p2_color);
    roll_btn.classList.add(p1_color);
    hold_btn.classList.remove(p2_color);
    hold_btn.classList.add(p1_color);
    player_1_name.classList.add(p1_color);
    player_2_name.classList.remove(p2_color);
  } else {
    roll_btn.classList.remove(p1_color);
    roll_btn.classList.add(p2_color);
    hold_btn.classList.remove(p1_color);
    hold_btn.classList.add(p2_color);
    player_2_name.classList.add(p2_color);
    player_1_name.classList.remove(p1_color);
  }
}

function render() {
  victory.textContent = "";

  player_1_score.textContent = state.player[0].score;
  player_2_score.textContent = state.player[1].score;
  if (state.phase === "PLAYING") {
    changeBtnColors();
    turn_points.textContent = state.turnPoints;
    player_1_name.textContent = state.player[0].name;
    player_2_name.textContent = state.player[1].name;

    roll_btn.disabled = false;
    hold_btn.disabled = false;
    // Show buttons
    hold_btn.classList.remove("hidden");
    roll_btn.classList.remove("hidden");
  }

  dice_img.src = `assets/dice-${state.lastRoll}.svg`;

  if (state.phase === "WIN") {
    roll_btn.disabled = true;
    hold_btn.disabled = true;
    // Hide buttons
    hold_btn.classList.add("hidden");
    roll_btn.classList.add("hidden");
    let winner =
      state.player[0].score >= state.target
        ? state.player[0].name
        : state.player[1].name;
    victory.textContent = `${winner} wins!`;
  }

  if (state.phase === "MENU") {
    roll_btn.disabled = true;
    hold_btn.disabled = true;
    // Hide buttons
    hold_btn.classList.add("hidden");
    roll_btn.classList.add("hidden");
  }

  // Désactiver les boutons quand ce n'est pas au joueur humain de jouer
  roll_btn.disabled = state.phase !== "PLAYING" || state.current_turn !== HUMAN;
  hold_btn.disabled =
    state.phase !== "PLAYING" ||
    state.current_turn !== HUMAN ||
    state.turnPoints === 0;

  // Si c'est au tour de l'IA, on programme son action
  if (isAiTurn(state)) {
    scheduleComputerTurn();
  } else {
    // Si c'est le tour du joueur, on s'assure qu'aucun timer IA ne traîne
    if (aiTimeoutId) {
      clearTimeout(aiTimeoutId);
      aiTimeoutId = null;
    }
  }
}

window.onload = () => {
  render();

  new_game_btn.addEventListener("click", () => {
    dispatch({ type: A.RESET });
  });
};
