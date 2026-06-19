/* ============================================================
   CONFIGURAÇÃO DO FIREBASE
   ============================================================
   Este jogo usa o Firebase Realtime Database como backend para
   sincronizar salas e jogadores em tempo real.

   PASSO A PASSO PARA CONFIGURAR (gratuito):
   1. Acesse https://console.firebase.google.com
   2. Crie um novo projeto (qualquer nome)
   3. No menu lateral, vá em "Build > Realtime Database" e clique
      em "Criar banco de dados". Escolha o modo de teste
      (regras abertas) para começar a jogar rapidamente.
   4. Vá em "Configurações do projeto" (ícone de engrenagem) >
      "Geral" > role até "Seus aplicativos" > clique no ícone
      "</>" (Web) > registre o app.
   5. Copie o objeto firebaseConfig gerado e cole substituindo
      o objeto abaixo.

   Regras sugeridas para o Realtime Database (modo teste):
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   (Para produção, restrinja as regras conforme necessário.)
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAPX12nFKJGDVrMCp2ST5ic1Tlx9OgGYXo",
  authDomain: "stopot-1206-bg.firebaseapp.com",
  databaseURL: "https://stopot-1206-bg-default-rtdb.firebaseio.com",
  projectId: "stopot-1206-bg",
  storageBucket: "stopot-1206-bg.firebasestorage.app",
  messagingSenderId: "986739634715",
  appId: "1:986739634715:web:a4f2660ceb20d96a717ebe"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
