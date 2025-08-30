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
  target: 10,
  lastRoll: 1,
  phase: "PLAYING",
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
      state.lastRoll = roll;

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
}

window.onload = () => {
  render();

  new_game_btn.addEventListener("click", () => {
    dispatch({ type: A.RESET });
  });
};
