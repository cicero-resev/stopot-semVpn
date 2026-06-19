/* ============================================================
   GAME.JS - lógica da sala / partida (sala.html)
   ============================================================ */

// ---------- Setup inicial ----------
const params = new URLSearchParams(window.location.search);
const roomCode = (params.get("room") || "").toUpperCase();
const playerId = localStorage.getItem("stopots_playerId");
const playerName = localStorage.getItem("stopots_playerName");

if (!roomCode || !playerId || !playerName) {
  window.location.href = "index.html";
}

document.getElementById("roomCodeDisplay").textContent = roomCode;

const roomRef = db.ref("rooms/" + roomCode);
const playersRef = roomRef.child("players");

// Offset entre o relógio do servidor e o relógio local, para sincronizar timers
let serverOffset = 0;
db.ref(".info/serverTimeOffset").on("value", snap => {
  serverOffset = snap.val() || 0;
});
function serverNow() {
  return Date.now() + serverOffset;
}

// Marca o jogador como online / configura saída automática
playersRef.child(playerId).update({ online: true, name: playerName });
playersRef.child(playerId).child("online").onDisconnect().set(false);

// Estado local
let currentRoom = null;
let isHost = false;
let transitionLock = false; // evita múltiplas transições simultâneas pelo host
let answerDebounceTimers = {};

// ---------- Elementos DOM ----------
const screens = {
  lobby: document.getElementById("screen-lobby"),
  playing: document.getElementById("screen-playing"),
  voting: document.getElementById("screen-voting"),
  scores: document.getElementById("screen-scores"),
  gameover: document.getElementById("screen-gameover")
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

const errorMsg = document.getElementById("errorMsg");
function showError(msg) {
  errorMsg.textContent = msg;
  if (msg) setTimeout(() => { if (errorMsg.textContent === msg) errorMsg.textContent = ""; }, 4000);
}

// ============================================================
// LISTENER PRINCIPAL DA SALA
// ============================================================
roomRef.on("value", snapshot => {
  if (!snapshot.exists()) {
    showError("Esta sala não existe mais.");
    setTimeout(() => window.location.href = "index.html", 2000);
    return;
  }
  currentRoom = snapshot.val();
  isHost = currentRoom.hostId === playerId;

  renderPlayersList();
  renderHostControls();

  switch (currentRoom.state) {
    case "lobby":
      showScreen("lobby");
      break;
    case "playing":
      showScreen("playing");
      renderPlayingScreen();
      break;
    case "voting":
      showScreen("voting");
      renderVotingScreen();
      break;
    case "scores":
      showScreen("scores");
      renderScoresScreen();
      break;
    case "gameover":
      showScreen("gameover");
      renderGameOverScreen();
      break;
  }
});

// ============================================================
// LOBBY
// ============================================================
function renderPlayersList() {
  const list = document.getElementById("playersList");
  list.innerHTML = "";
  const players = currentRoom.players || {};
  Object.entries(players).forEach(([id, p]) => {
    const li = document.createElement("li");
    const isOnline = p.online !== false;
    li.innerHTML = `<span>${escapeHtml(p.name)}${id === playerId ? " (você)" : ""} ${!isOnline ? "💤" : ""}</span>` +
      (id === currentRoom.hostId ? `<span class="badge">Anfitrião</span>` : `<span class="muted">${p.score || 0} pts</span>`);
    list.appendChild(li);
  });
}

function renderHostControls() {
  const hostControls = document.getElementById("hostControls");
  const waitingNonHost = document.getElementById("waitingNonHost");
  if (!hostControls) return; // só existe na tela de lobby

  const playerCount = Object.keys(currentRoom.players || {}).length;
  if (isHost) {
    hostControls.classList.remove("hidden");
    waitingNonHost.classList.add("hidden");
    const startBtn = document.getElementById("startGameBtn");
    const needMsg = document.getElementById("needPlayersMsg");
    if (playerCount < 2) {
      startBtn.disabled = true;
      needMsg.classList.remove("hidden");
    } else {
      startBtn.disabled = false;
      needMsg.classList.add("hidden");
    }
  } else {
    hostControls.classList.add("hidden");
    waitingNonHost.classList.remove("hidden");
  }
}

document.getElementById("startGameBtn")?.addEventListener("click", async () => {
  const roundsVal = parseInt(document.getElementById("roundsInput").value, 10);
  const totalRounds = isNaN(roundsVal) || roundsVal < 1 ? TOTAL_ROUNDS : Math.min(roundsVal, 20);
  await startRound(1, [], totalRounds);
});

async function startRound(roundNumber, usedLetters, totalRounds) {
  const letter = drawLetter(usedLetters);
  const updates = {
    state: "playing",
    currentRound: roundNumber,
    totalRounds: totalRounds,
    currentLetter: letter,
    usedLetters: [...usedLetters, letter],
    roundDuration: ROUND_SECONDS,
    roundStartTime: firebase.database.ServerValue.TIMESTAMP,
    stopRequestedBy: null
  };
  await roomRef.update(updates);
  // limpa respostas antigas dessa rodada (caso existam de uma partida anterior)
  await roomRef.child("answers/" + roundNumber).remove();
}

// ============================================================
// TELA DE JOGO (PREENCHENDO CATEGORIAS)
// ============================================================
let playingRendered = -1; // evita re-criar inputs a cada snapshot (perderia o foco)
let playingTimerInterval = null;

function renderPlayingScreen() {
  document.getElementById("currentLetter").textContent = currentRoom.currentLetter;
  document.getElementById("roundInfo").textContent =
    `Rodada ${currentRoom.currentRound} de ${currentRoom.totalRounds}`;

  // Só (re)cria os campos quando a rodada muda, para não perder o que o usuário digitou
  if (playingRendered !== currentRoom.currentRound) {
    playingRendered = currentRoom.currentRound;
    buildCategoryInputs();
  }

  // Timer
  clearInterval(playingTimerInterval);
  playingTimerInterval = setInterval(updatePlayingTimer, 250);
  updatePlayingTimer();

  // Botão STOP
  const stopBtn = document.getElementById("stopBtn");
  stopBtn.disabled = !!currentRoom.stopRequestedBy;
  stopBtn.textContent = currentRoom.stopRequestedBy ? "STOP enviado!" : "STOP!";
}

function buildCategoryInputs() {
  const grid = document.getElementById("categoriesGrid");
  grid.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const wrap = document.createElement("div");
    wrap.className = "category-field";
    const safeId = "cat-" + cat.replace(/[^a-zA-Z]/g, "");
    wrap.innerHTML = `
      <label for="${safeId}">${cat}</label>
      <input type="text" id="${safeId}" autocomplete="off" placeholder="Letra ${currentRoom.currentLetter}...">
    `;
    grid.appendChild(wrap);
    const input = wrap.querySelector("input");

    // Pré-carrega valor existente (ex.: reconexão)
    roomRef.child(`answers/${currentRoom.currentRound}/${cat}/${playerId}/answer`).once("value").then(snap => {
      if (snap.exists()) input.value = snap.val();
    });

    input.addEventListener("input", () => {
      clearTimeout(answerDebounceTimers[cat]);
      answerDebounceTimers[cat] = setTimeout(() => {
        roomRef.child(`answers/${currentRoom.currentRound}/${cat}/${playerId}`).update({
          answer: input.value,
          playerName: playerName
        });
      }, 250);
    });
  });
}

function updatePlayingTimer() {
  if (!currentRoom || currentRoom.state !== "playing") return;
  const remaining = currentRoom.stopRequestedBy
    ? 0
    : getRemainingSeconds(currentRoom.roundStartTime, currentRoom.roundDuration);
  const timerEl = document.getElementById("timer");
  timerEl.textContent = formatTime(remaining);
  timerEl.classList.toggle("low", remaining <= 10);

  // Apenas o anfitrião decide a transição, evitando corrida entre clientes
  if (isHost && !transitionLock && (remaining <= 0 || currentRoom.stopRequestedBy)) {
    transitionLock = true;
    clearInterval(playingTimerInterval);
    goToVoting();
  }
}

document.getElementById("stopBtn")?.addEventListener("click", () => {
  if (!currentRoom.stopRequestedBy) {
    roomRef.child("stopRequestedBy").set(playerId);
  }
});

async function goToVoting() {
  await roomRef.update({
    state: "voting",
    voteDuration: VOTE_SECONDS,
    voteStartTime: firebase.database.ServerValue.TIMESTAMP
  });
  transitionLock = false;
}

// ============================================================
// TELA DE VOTAÇÃO
// ============================================================
let voteTimerInterval = null;

function renderVotingScreen() {
  const area = document.getElementById("votingArea");
  const round = currentRoom.currentRound;
  const totalPlayers = Object.keys(currentRoom.players || {}).length;
  const threshold = votesNeededToInvalidate(totalPlayers);

  roomRef.child("answers/" + round).once("value").then(snap => {
    const answersByCategory = snap.val() || {};
    area.innerHTML = "";

    CATEGORIES.forEach(cat => {
      const block = document.createElement("div");
      block.className = "vote-block";
      const title = document.createElement("h4");
      title.textContent = cat;
      block.appendChild(title);

      const catAnswers = answersByCategory[cat] || {};
      const entries = Object.entries(catAnswers).filter(([, d]) => d.answer && d.answer.trim() !== "");

      if (entries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "Ninguém respondeu.";
        block.appendChild(empty);
      }

      entries.forEach(([answererId, data]) => {
        const row = document.createElement("div");
        const votes = data.votes || {};
        const voteCount = Object.keys(votes).length;
        const autoInvalid = !startsWithLetter(data.answer, currentRoom.currentLetter);
        const votedInvalid = voteCount >= threshold;
        const isInvalid = autoInvalid || votedInvalid;

        row.className = "vote-answer-row" + (isInvalid ? (autoInvalid ? " auto-invalid" : " invalid") : "");

        const iVoted = !!votes[playerId];
        const canVote = answererId !== playerId && !autoInvalid;

        row.innerHTML = `
          <span class="answer-text">${escapeHtml(data.answer)} <span class="muted">— ${escapeHtml(data.playerName || "?")}</span></span>
          <span class="vote-count">${autoInvalid ? "Não começa com " + currentRoom.currentLetter : voteCount + "/" + threshold + " votos"}</span>
        `;

        if (canVote) {
          const btn = document.createElement("button");
          btn.className = "vote-btn" + (iVoted ? " voted" : "");
          btn.textContent = iVoted ? "Voto registrado ✕" : "Invalidar";
          btn.addEventListener("click", () => toggleVote(cat, answererId, iVoted));
          row.appendChild(btn);
        }

        block.appendChild(row);
      });

      area.appendChild(block);
    });
  });

  clearInterval(voteTimerInterval);
  voteTimerInterval = setInterval(updateVoteTimer, 250);
  updateVoteTimer();
}

function toggleVote(category, answererId, currentlyVoted) {
  const round = currentRoom.currentRound;
  const ref = roomRef.child(`answers/${round}/${category}/${answererId}/votes/${playerId}`);
  if (currentlyVoted) {
    ref.remove();
  } else {
    ref.set(true);
  }
  // Re-renderiza após pequeno delay para refletir o voto
  setTimeout(renderVotingScreen, 200);
}

function updateVoteTimer() {
  if (!currentRoom || currentRoom.state !== "voting") return;
  const remaining = getRemainingSeconds(currentRoom.voteStartTime, currentRoom.voteDuration);
  const timerEl = document.getElementById("voteTimer");
  timerEl.textContent = formatTime(remaining);
  timerEl.classList.toggle("low", remaining <= 10);

  if (isHost && !transitionLock && remaining <= 0) {
    transitionLock = true;
    clearInterval(voteTimerInterval);
    finalizeVotingAndScore();
  }
}

document.getElementById("finishVotingBtn")?.addEventListener("click", () => {
  if (!isHost) {
    showError("Apenas o anfitrião pode encerrar a votação.");
    return;
  }
  if (!transitionLock) {
    transitionLock = true;
    clearInterval(voteTimerInterval);
    finalizeVotingAndScore();
  }
});

// Calcula validade final (letra + votos), grava pontuação e avança o estado
async function finalizeVotingAndScore() {
  const round = currentRoom.currentRound;
  const totalPlayers = Object.keys(currentRoom.players || {}).length;
  const threshold = votesNeededToInvalidate(totalPlayers);

  const snap = await roomRef.child("answers/" + round).once("value");
  const answersByCategory = snap.val() || {};

  const totalPointsByPlayer = {};
  const updates = {};

  CATEGORIES.forEach(cat => {
    const catAnswers = answersByCategory[cat] || {};
    const adjusted = {};

    Object.entries(catAnswers).forEach(([pid, data]) => {
      const voteCount = Object.keys(data.votes || {}).length;
      const autoInvalid = !startsWithLetter(data.answer || "", currentRoom.currentLetter);
      const invalid = autoInvalid || voteCount >= threshold;
      adjusted[pid] = { answer: data.answer, invalid };
      updates[`answers/${round}/${cat}/${pid}/invalid`] = invalid;
    });

    const points = scoreCategory(adjusted);
    Object.entries(points).forEach(([pid, pts]) => {
      totalPointsByPlayer[pid] = (totalPointsByPlayer[pid] || 0) + pts;
    });
  });

  // Garante que todo jogador da sala tenha uma entrada (mesmo com 0 pontos)
  Object.keys(currentRoom.players || {}).forEach(pid => {
    if (!(pid in totalPointsByPlayer)) totalPointsByPlayer[pid] = 0;
  });

  updates[`roundScores/${round}`] = totalPointsByPlayer;
  updates["state"] = "scores";

  // Atualiza pontuação total de cada jogador
  Object.entries(totalPointsByPlayer).forEach(([pid, pts]) => {
    const current = (currentRoom.players[pid] && currentRoom.players[pid].score) || 0;
    updates[`players/${pid}/score`] = current + pts;
  });

  await roomRef.update(updates);
  transitionLock = false;
}

// ============================================================
// TELA DE PLACAR DA RODADA
// ============================================================
function renderScoresScreen() {
  const round = currentRoom.currentRound;
  document.getElementById("scoresTitle").textContent = `Placar - Rodada ${round} (letra ${currentRoom.currentLetter})`;
  const table = document.getElementById("scoresTable");
  const roundScores = (currentRoom.roundScores && currentRoom.roundScores[round]) || {};

  const rows = Object.entries(currentRoom.players || {})
    .map(([pid, p]) => ({ pid, name: p.name, total: p.score || 0, round: roundScores[pid] || 0 }))
    .sort((a, b) => b.total - a.total);

  table.innerHTML = `<tr><th>Jogador</th><th>Pontos na rodada</th><th>Total</th></tr>` +
    rows.map(r => `<tr><td>${escapeHtml(r.name)}${r.pid === playerId ? " (você)" : ""}</td><td>${r.round}</td><td>${r.total}</td></tr>`).join("");

  const nextBtn = document.getElementById("nextRoundBtn");
  nextBtn.classList.toggle("hidden", !isHost);
  nextBtn.textContent = (currentRoom.currentRound >= currentRoom.totalRounds)
    ? "Ver resultado final (anfitrião)"
    : "Próxima rodada (anfitrião)";
}

document.getElementById("nextRoundBtn")?.addEventListener("click", async () => {
  if (!isHost) return;
  if (currentRoom.currentRound >= currentRoom.totalRounds) {
    await roomRef.update({ state: "gameover" });
  } else {
    await startRound(currentRoom.currentRound + 1, currentRoom.usedLetters || [], currentRoom.totalRounds);
  }
});

// ============================================================
// TELA FINAL
// ============================================================
function renderGameOverScreen() {
  const table = document.getElementById("finalScoresTable");
  const rows = Object.entries(currentRoom.players || {})
    .map(([pid, p]) => ({ pid, name: p.name, total: p.score || 0 }))
    .sort((a, b) => b.total - a.total);

  table.innerHTML = `<tr><th>#</th><th>Jogador</th><th>Pontos</th></tr>` +
    rows.map((r, i) => `<tr><td>${i + 1}${i === 0 ? " 🏆" : ""}</td><td>${escapeHtml(r.name)}${r.pid === playerId ? " (você)" : ""}</td><td>${r.total}</td></tr>`).join("");

  const playAgainBtn = document.getElementById("playAgainBtn");
  playAgainBtn.classList.toggle("hidden", !isHost);
}

document.getElementById("playAgainBtn")?.addEventListener("click", async () => {
  if (!isHost) return;
  const resetPlayers = {};
  Object.entries(currentRoom.players || {}).forEach(([pid, p]) => {
    resetPlayers[pid] = { ...p, score: 0 };
  });
  await roomRef.update({
    state: "lobby",
    currentRound: 0,
    usedLetters: [],
    players: resetPlayers,
    roundScores: null,
    answers: null,
    stopRequestedBy: null
  });
  playingRendered = -1;
});

// Remove o jogador "online" ao sair da página
window.addEventListener("beforeunload", () => {
  playersRef.child(playerId).child("online").set(false);
});
