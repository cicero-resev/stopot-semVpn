/* ============================================================
   LOBBY.JS - lógica da tela inicial (criar/entrar em sala)
   ============================================================ */

const playerNameInput = document.getElementById("playerName");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const errorMsg = document.getElementById("errorMsg");

// Recupera nome salvo anteriormente, se houver
playerNameInput.value = localStorage.getItem("stopots_playerName") || "";

function showError(msg) {
  errorMsg.textContent = msg;
}

function getPlayerName() {
  const name = playerNameInput.value.trim();
  if (!name) {
    showError("Por favor, digite seu nome.");
    return null;
  }
  localStorage.setItem("stopots_playerName", name);
  return name;
}

function getOrCreatePlayerId() {
  let id = localStorage.getItem("stopots_playerId");
  if (!id) {
    id = generateId();
    localStorage.setItem("stopots_playerId", id);
  }
  return id;
}

createRoomBtn.addEventListener("click", async () => {
  const name = getPlayerName();
  if (!name) return;
  createRoomBtn.disabled = true;
  showError("");

  const playerId = getOrCreatePlayerId();
  const roomCode = generateRoomCode();

  const roomRef = db.ref("rooms/" + roomCode);

  try {
    await roomRef.set({
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      hostId: playerId,
      state: "lobby",
      totalRounds: 5,
      currentRound: 0,
      usedLetters: [],
      players: {
        [playerId]: {
          name: name,
          score: 0,
          joinedAt: firebase.database.ServerValue.TIMESTAMP,
          online: true
        }
      }
    });

    // remove o jogador automaticamente se a aba for fechada
    roomRef.child("players").child(playerId).child("online").onDisconnect().set(false);

    localStorage.setItem("stopots_roomCode", roomCode);
    window.location.href = "sala.html?room=" + roomCode;
  } catch (err) {
    console.error(err);
    showError("Erro ao criar sala. Verifique a configuração do Firebase em config.js.");
    createRoomBtn.disabled = false;
  }
});

joinRoomBtn.addEventListener("click", async () => {
  const name = getPlayerName();
  if (!name) return;

  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    showError("O código da sala deve ter 4 caracteres.");
    return;
  }

  joinRoomBtn.disabled = true;
  showError("");

  const playerId = getOrCreatePlayerId();
  const roomRef = db.ref("rooms/" + code);

  try {
    const snapshot = await roomRef.once("value");
    if (!snapshot.exists()) {
      showError("Sala não encontrada. Verifique o código.");
      joinRoomBtn.disabled = false;
      return;
    }

    const room = snapshot.val();
    if (room.state !== "lobby") {
      showError("Esta sala já está em uma partida. Aguarde a próxima rodada terminar ou crie outra sala.");
      joinRoomBtn.disabled = false;
      return;
    }

    await roomRef.child("players").child(playerId).set({
      name: name,
      score: 0,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
      online: true
    });

    roomRef.child("players").child(playerId).child("online").onDisconnect().set(false);

    localStorage.setItem("stopots_roomCode", code);
    window.location.href = "sala.html?room=" + code;
  } catch (err) {
    console.error(err);
    showError("Erro ao entrar na sala. Verifique a configuração do Firebase em config.js.");
    joinRoomBtn.disabled = false;
  }
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});
