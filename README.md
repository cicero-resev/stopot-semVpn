# StopotS Clone — Jogo de Stop (Adedanha/Adedonha) Online

Clone funcional, inspirado no [stopots.com](https://stopots.com), feito apenas com
**HTML, CSS e JavaScript puro** (sem build tools/frameworks), usando o
**Firebase Realtime Database** como backend em tempo real para salas multiplayer.

## ✅ O que está implementado

- Criação e entrada em salas via código de 4 letras.
- Lista de jogadores em tempo real (online/offline).
- Anfitrião (host) configura número de rodadas e inicia a partida — só ele
  controla as transições de estado, evitando bugs de corrida entre clientes.
- Sorteio de letra (sem repetir letras já usadas na partida) e timer
  sincronizado entre todos os jogadores (baseado em timestamp do servidor).
- 8 categorias clássicas: Nome, Animal, Fruta/Verdura, País/Cidade, Objeto,
  Cor, Profissão, Filme/Série.
- Botão **STOP!** que qualquer jogador pode acionar para encerrar a rodada
  antes do tempo (como no jogo original).
- Tela de votação: jogadores podem **denunciar/invalidar** respostas de
  outros jogadores.
  - **Uma única pessoa nunca pode invalidar uma resposta sozinha** (salas
    com 3+ jogadores exigem `max(2, ceil(outrosJogadores / 2))` votos).
  - Em salas de exatamente 2 jogadores, 1 voto (o do outro jogador) basta,
    já que matematicamente não há como exigir mais nesse caso.
  - Respostas que não começam com a letra sorteada são automaticamente
    invalidadas (não precisam de votação).
- Pontuação: 10 pontos por resposta válida única, 5 pontos se repetida por
  outro jogador, 0 se invalidada.
- Placar por rodada e placar final, com opção de jogar novamente.

## 📂 Estrutura de arquivos

```
stopots-clone/
├── index.html      → tela inicial (criar/entrar em sala)
├── sala.html        → tela da sala/partida (todos os estados do jogo)
├── style.css         → estilos compartilhados
├── config.js        → configuração do Firebase (você precisa preencher!)
├── utils.js          → funções utilitárias (categorias, letras, pontuação, etc.)
├── lobby.js          → lógica da tela inicial
├── game.js          → lógica completa da partida (máquina de estados)
└── README.md
```

## 🔧 Como configurar (obrigatório)

O jogo precisa de um backend em tempo real para sincronizar os jogadores.
Usamos o **Firebase Realtime Database**, que tem um plano gratuito generoso.

1. Acesse https://console.firebase.google.com e crie um projeto novo (grátis).
2. No menu lateral: **Build > Realtime Database** → "Criar banco de dados"
   → escolha o **modo de teste** para liberar leitura/escrita rapidamente.
3. Vá em **Configurações do projeto** (ícone de engrenagem) → guia **Geral**
   → role até "Seus aplicativos" → clique no ícone `</>` (Web) → registre o app
   (não precisa do Firebase Hosting).
4. Copie o objeto `firebaseConfig` que aparece e cole no arquivo `config.js`,
   substituindo os valores de exemplo.
5. (Opcional, recomendado) Ajuste as regras do Realtime Database para algo
   como:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
   Isso é aceitável para um jogo casual entre amigos. Para uso público em
   produção, considere regras mais restritivas.

## ▶️ Como jogar

1. Abra `index.html` em um navegador (pode usar uma extensão de servidor
   local como "Live Server" no VS Code, ou simplesmente abrir o arquivo
   diretamente — funciona dos dois jeitos, já que não há build step).
2. Digite seu nome e clique em **Criar sala**.
3. Compartilhe o código de 4 letras exibido com seus amigos.
4. Os amigos abrem `index.html`, digitam o nome e o código, e clicam em
   **Entrar**.
5. Quando houver pelo menos 2 jogadores, o anfitrião clica em
   **Iniciar partida**.
6. Cada jogador preenche as categorias com palavras que comecem com a letra
   sorteada, antes do tempo acabar (ou alguém aperta **STOP!**).
7. Na tela de votação, qualquer jogador pode marcar **Invalidar** em
   respostas de outros jogadores; quando o número de votos necessário é
   atingido, a resposta é riscada e vale 0 pontos.
8. Ao final das rodadas configuradas, o placar final é exibido.

## 💡 Notas técnicas

- O sistema de "host authority" garante que apenas o navegador do anfitrião
  decide quando uma rodada termina e quando avançar de tela, evitando
  condições de corrida quando vários jogadores detectam a mesma condição de
  transição ao mesmo tempo.
- O timer é calculado localmente por cada jogador a partir de um timestamp
  `roundStartTime`/`voteStartTime` gravado pelo servidor (Firebase
  `ServerValue.TIMESTAMP`) e ajustado pelo offset de relógio
  (`.info/serverTimeOffset`), então o cronômetro fica sincronizado mesmo que
  os relógios dos dispositivos estejam levemente diferentes.
- Todo o app é "serverless" do ponto de vista de hospedagem: pode ser
  publicado em qualquer hospedagem de arquivos estáticos (GitHub Pages,
  Netlify, Vercel, Firebase Hosting, etc.) — o único backend "ativo" é o
  Realtime Database.
