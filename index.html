<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>The Game - Multi et Solo</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #eee;
      padding: 20px;
      color: #000;
      margin: 0;
    }
    h1 { text-align: center; }
    .zone { display: flex; justify-content: space-around; flex-wrap: wrap; }
    .pile, .main, .zone-info { margin: 10px; }
    .pile {
      width: 120px;
      height: 160px;
      background: white;
      border: 2px solid black;
      text-align: center;
      padding-top: 20px;
      font-size: 24px;
    }
    .montante { border-color: green; }
    .descendante { border-color: red; }
    .main {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 10px;
      justify-content: flex-start;
      padding: 10px;
      background: #ddd;
      border-radius: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    .carte {
      width: 70px;
      height: 100px;
      background: white;
      border: 1px solid black;
      text-align: center;
      line-height: 100px;
      font-weight: bold;
      font-size: 24px;
      cursor: pointer;
      transition: transform 0.2s ease;
      border-radius: 5px;
      animation: pop-in 0.3s cubic-bezier(.5,-0.5,.5,1.5);
    }
    @keyframes pop-in {
      0% { transform: scale(0.8); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .selected {
      border: 2px solid blue;
      transform: scale(1.1);
    }
    button { margin: 10px 0; padding: 10px; }
    body.dark { background: #222; color: #eee; }
    body.dark .pile, body.dark .carte, body.dark .main {
      background: #444;
      border-color: #888;
      color: #fff;
    }
    body.dark button { background: #333; color: #fff; }
    #historiqueModal {
      position:fixed; top:0; left:0; width:100vw; height:100vh;
      background: rgba(0,0,0,0.8); color:#fff; overflow:auto; z-index: 2000;
      align-items: center; justify-content: center;
      display:none;
    }
    #historiqueModal .box {
      background:#222; margin:50px auto; padding:20px;
      max-width:400px; border-radius:10px; position:relative;
    }
    .carte-anim {
      position: fixed;
      width: 70px;
      height: 100px;
      background: white;
      border: 1px solid black;
      font-weight: bold;
      font-size: 24px;
      line-height: 100px;
      text-align: center;
      pointer-events: none;
      transition: all 0.5s ease;
      z-index: 2000;
      border-radius: 5px;
    }
    /* ------ Notifications visuelles ------ */
    #notificationArea {
      position: fixed;
      top: 30px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5000;
      min-width: 200px;
      pointer-events: none;
    }
    .notification {
      display: inline-block;
      background: #3084c4;
      color: #fff;
      padding: 16px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 16px #0003;
      font-size: 1.1em;
      opacity: 0;
      animation: fadeInOut 4.5s linear;
      margin-bottom: 8px;
    }
    @keyframes fadeInOut {
      0% { opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { opacity: 0; }
    }
    /* ------ Responsive design ------ */
    @media (max-width: 700px) {
      h1 { font-size: 1.3em; }
      .zone { flex-direction: column; align-items: center; }
      .pile { width: 80vw; min-width: 100px; max-width: 98vw; height: 90px; font-size: 1.1em; margin: 8px 0; }
      .main { flex-wrap: wrap; gap: 7px; padding: 4px; }
      .carte { width: 55px; height: 76px; font-size: 1em; line-height: 76px; }
      .zone-info { padding: 5px; }
      button { width: 100%; font-size: 1em; margin: 8px 0; }
      #setupBox, #soloModal > div, #historiqueModal .box {
        width: 95vw !important; max-width: none !important; margin: 10px auto !important;
        box-sizing: border-box;
      }
      #main { width: 100vw; max-width: 99vw; }
      #menuAccueil, #lobby, #jeu { padding: 2vw; }
    }
    @media (max-width: 400px) {
      .pile { font-size: 0.9em; }
      .carte { width: 36px; height: 54px; font-size: 0.9em; line-height: 54px; }
      #main { gap: 3px; }
      button { font-size: 0.85em; }
    }
    /* --- Zone lobby visible --- */
    #zoneLobbyAll {
      margin: 20px auto;
      background: #f0f4fa;
      border-radius: 10px;
      max-width: 500px;
      box-shadow: 0 2px 10px #0001;
      padding: 16px 22px;
      display: none;
    }
    #zoneLobbyAll h2 {
      margin-top: 0;
    }
    #listeLobbyParties {
      margin-bottom: 12px;
    }
    #zoneLobbyAll button {
      background: #3084c4;
      color: #fff;
      border: none;
    }
    #zoneLobbyAll button:hover {
      background: #1d668f;
    }
    .lobby-entry {
      margin: 5px 0;
      padding: 7px 14px;
      border-radius: 6px;
      background: #e9f2fb;
      border: 1px solid #3084c4;
      font-size: 1em;
      width: 100%;
      text-align: left;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
    }
    .lobby-entry:hover {
      background: #c9e8fa;
    }
  </style>
</head>
<body>
<div id="notificationArea"></div>
<div id="historiqueModal">
  <div class="box">
    <h3>Historique des cartes jouées</h3>
    <div id="historiqueContenu" style="max-height:300px; overflow-y:auto; white-space: pre-line;"></div>
    <button onclick="document.getElementById('historiqueModal').style.display='none'" style="margin-top:10px;">Fermer</button>
  </div>
</div>

  <!-- Zone lobby global -->
  <div id="zoneLobbyAll">
    <h2>Liste des parties ouvertes</h2>
    <div id="listeLobbyParties"></div>
    <button id="btnCreerLobby">Créer une nouvelle partie</button>
  </div>

  <div id="menuAccueil">
    <h2>Bienvenue dans The Game</h2>
    <input type="text" id="pseudo" placeholder="Ton pseudo">
    <input type="text" id="customIdPartie" placeholder="ID de la partie (ex: 123)">
    <button id="btnCreer">Créer une partie</button>
    <button id="btnSolo">Mode Solo</button>
    <hr>
    <input type="text" id="idPartie" placeholder="ID de la partie à rejoindre">
    <button id="btnRejoindre">Rejoindre une partie</button>
    <div id="menuMessage"></div>
  </div>

  <!-- Modal SOLO -->
  <div id="soloModal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0,0,0,0.8); z-index:999; align-items: center; justify-content: center;">
    <div style="background: #fff; color:#000; padding:30px; border-radius:10px; text-align:center; margin: 10vw auto;">
      <h2>Mode Solo</h2>
      <label for="nbJoueurs">Nombre de joueurs humains :</label>
      <input type="number" id="nbJoueurs" min="1" max="4" value="1"><br><br>
      <button id="btnLancerSolo">Lancer la partie Solo</button>
      <button onclick="document.getElementById('soloModal').style.display='none'" style="margin-left:20px;">Annuler</button>
    </div>
  </div>

  <!-- Partie multijoueur -->
  <div id="lobby" style="display:none;">
    <h2>Lobby de la partie</h2>
    <div id="lobbyJoueurs"></div>
    <button id="btnPret">Je suis prêt !</button>
    <button id="btnDemarrer" style="display:none;">Démarrer la partie</button>
    <button id="btnQuitterLobby">Quitter la salle</button>
    <div id="lobbyMessage"></div>
  </div>

  <!-- Partie en cours (multi ou solo) -->
  <div id="jeu" style="display:none;">
    <h1>The Game</h1>
    <label>
      <input type="checkbox" id="themeToggle"> Mode sombre
      <button id="btnAide">❓ Aide</button>
      <button id="btnHistorique">📜 Historique</button>
    </label>
    <div id="info"></div>
    <div class="zone" id="piles"></div>
    <div class="zone-info">
      <div id="main"></div>
      <button id="btnFinTour" disabled>Fin du tour</button>
    </div>
    <div id="listeJoueurs"></div>
    <div id="message"></div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js"></script>
  <script src="script.js"></script>
</body>
</html>
