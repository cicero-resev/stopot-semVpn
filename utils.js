/* ============================================================
   UTILITÁRIOS COMPARTILHADOS
   ============================================================ */

// Categorias padrão do Stop / Adedanha / Adedonha brasileiro
const CATEGORIES = [
  "Nome",
  "Animal",
  "Fruta ou Verdura",  
  "País ou Cidade",    
  "Objeto",
  "Cor",
  "Profissão",
  "Filme ou Série"     // Alterado de / para ou
];

// Letras usadas no sorteio (exclui K, W, Y, comuns de se excluir na
// variante brasileira tradicional do jogo)
const LETTERS = "ABCDEFGHIJLMNOPQRSTUVZ".split("");

// Duração padrão da rodada (segundos) e da votação (segundos)
const ROUND_SECONDS = 150;
const VOTE_SECONDS = 45;
const TOTAL_ROUNDS = 5;

/** Gera um código de sala de 4 letras maiúsculas */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Gera um id simples para jogador/sessão */
function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/** Sorteia uma letra aleatória que ainda não foi usada na partida (se possível) */
function drawLetter(usedLetters = []) {
  const available = LETTERS.filter(l => !usedLetters.includes(l));
  const pool = available.length > 0 ? available : LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Calcula quantos votos são necessários para invalidar uma resposta.
 * Regra: uma única pessoa NUNCA pode invalidar sozinha (exceto em
 * salas de apenas 2 jogadores, onde isso seria impossível de evitar).
 *  - 2 jogadores no total -> 1 voto (o outro jogador) já invalida
 *  - 3+ jogadores -> max(2, ceil(outrosJogadores / 2))
 */
function votesNeededToInvalidate(totalPlayers) {
  const others = Math.max(totalPlayers - 1, 1);
  if (totalPlayers <= 2) return 1;
  return Math.max(2, Math.ceil(others / 2));
}

/** Normaliza texto para comparação (sem acento, minúsculo, sem espaços extras) */
function normalize(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Verifica se a resposta começa com a letra sorteada */
function startsWithLetter(answer, letter) {
  const norm = normalize(answer);
  return norm.length > 0 && norm[0] === normalize(letter);
}

/** Formata segundos restantes como m:ss */
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Calcula tempo restante (em segundos) a partir de um timestamp de início + duração */
function getRemainingSeconds(startTimestamp, durationSeconds) {
  if (!startTimestamp) return durationSeconds;
  const elapsed = (Date.now() - startTimestamp) / 1000;
  return Math.max(0, durationSeconds - elapsed);
}

/**
 * Calcula a pontuação de uma rodada para todos os jogadores em uma categoria.
 * Recebe um objeto { playerId: { answer, invalid } }
 * Retorna um objeto { playerId: pontos }
 * Regras: resposta inválida = 0 pontos. Resposta válida única = 10 pontos.
 * Resposta válida repetida (por 2+ jogadores) = 5 pontos cada.
 */
function scoreCategory(answersObj) {
  const result = {};
  const validEntries = Object.entries(answersObj || {}).filter(
    ([, data]) => data && data.answer && data.answer.trim() !== "" && !data.invalid
  );

  const countByNormalized = {};
  validEntries.forEach(([, data]) => {
    const key = normalize(data.answer);
    countByNormalized[key] = (countByNormalized[key] || 0) + 1;
  });

  Object.entries(answersObj || {}).forEach(([playerId, data]) => {
    if (!data || !data.answer || data.answer.trim() === "" || data.invalid) {
      result[playerId] = 0;
      return;
    }
    const key = normalize(data.answer);
    result[playerId] = countByNormalized[key] > 1 ? 5 : 10;
  });

  return result;
}

/** Escapa HTML para evitar injeção ao exibir respostas de jogadores */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
