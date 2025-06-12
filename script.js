// Import compat Firebase modules since on CDN with compat syntax
const firebaseConfig = {
  apiKey: "AIzaSyC67w7K6BqcNkBh4yeNd4OfgvjAw_neO4k",
  authDomain: "the-game-30e6d.firebaseapp.com",
  databaseURL: "https://the-game-30e6d-default-rtdb.firebaseio.com",
  projectId: "the-game-30e6d",
  storageBucket: "the-game-30e6d.appspot.com",
  messagingSenderId: "222102581853",
  appId: "1:222102581853:web:a211cfbed9dadc3cfe13b4",
  measurementId: "G-L2G22DJQFZ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variables globales de jeu
let partieId = null;
let pseudo = null;
let joueurs = {};
let etatPartie = null;  // Contient deck, piles, mains, joueurActuel, etc
let carteSelectionnee = null;
let cartesAJouer = 3;

//////////////////////////
// FONCTIONS MULTIJOUEURS
//////////////////////////

// Créer une partie
async function creerPartie(pseudoJoueur, useBots = false) {
  const partiesRef = db.ref('parties');
  const nouvellePartieRef = partiesRef.push();
  partieId = nouvellePartieRef.key;

  const partieData = {
    joueurs: {
      [pseudoJoueur]: { prêt: false, isCreator: true, mainIndex: 0 }
    },
    useBots: useBots,
    etat: "attente" // ou "en_cours", "terminee"
  };

  await nouvellePartieRef.set(partieData);
  pseudo = pseudoJoueur;

  ecouterPartie();
  montrerLobby();
  afficherLobbyMessage(`Partie créée. ID : ${partieId}`);
}

// Rejoindre une partie existante
async function rejoindrePartie(idPartie, pseudoJoueur) {
  partieId = idPartie;
  pseudo = pseudoJoueur;

  const joueursRef = db.ref(`parties/${partieId}/joueurs`);

  try {
    await joueursRef.transaction(joueurs => {
      if (joueurs) {
        if (Object.keys(joueurs).length >= 4) {
          throw "Partie pleine";
        }
        if (joueurs[pseudo]) {
          throw "Pseudo déjà utilisé dans cette partie";
        }
        // attribuer mainIndex (le premier libre)
        let usedIndexes = Object.values(joueurs).map(j => j.mainIndex);
        let mainIndex = [0,1,2,3].find(i => !usedIndexes.includes(i));
        joueurs[pseudo] = { prêt: false, isCreator: false, mainIndex };
      } else {
        joueurs = { [pseudo]: { prêt: false, isCreator: false, mainIndex: 0 } };
      }
      return joueurs;
    });
    ecouterPartie();
    montrerLobby();
    afficherLobbyMessage(`Rejoint la partie ${partieId} avec le pseudo ${pseudo}`);
  } catch (e) {
    alert("Erreur en rejoignant la partie : " + e);
  }
}

// Écouter la partie pour synchro en temps réel
function ecouterPartie() {
  const partieRef = db.ref(`parties/${partieId}`);
  partieRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      alert("Partie supprimée ou inexistante.");
      return;
    }
    etatPartie = data;
    joueurs = data.joueurs || {};

    // Affichage selon l'état
    if (etatPartie.etat === "attente") {
      montrerLobby();
      updateLobbyAffichage();
    } else if (etatPartie.etat === "en_cours") {
      cacherLobby();
      updateInterfaceAvecEtat();
    } else if (etatPartie.etat === "terminee") {
      cacherLobby();
      afficherMessage("Partie terminée !");
      enableInteraction(false);
    }
  });
}

//////////////////////////////
// LOBBY
//////////////////////////////

function montrerLobby() {
  document.getElementById("menuAccueil").style.display = "none";
  document.getElementById("headerJeu").style.display = "none";
  document.getElementById("jeu").style.display = "none";
  document.getElementById("lobby").style.display = "block";
}
function cacherLobby() {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("headerJeu").style.display = "flex";
  document.getElementById("jeu").style.display = "block";
}
function afficherLobbyMessage(msg) {
  document.getElementById("lobbyMessage").innerText = msg;
}
function updateLobbyAffichage() {
  if (!etatPartie) return;
  // List players and their status
  const lobbyJoueurs = document.getElementById("lobbyJoueurs");
  lobbyJoueurs.innerHTML = "<b>Joueurs connectés :</b><ul>";
  Object.entries(joueurs).forEach(([nom, infos]) => {
    lobbyJoueurs.innerHTML += `<li>${nom} ${infos.isCreator ? "(créateur)" : ""} - ${infos.prêt ? "✅ Prêt" : "⏳"}</li>`;
  });
  lobbyJoueurs.innerHTML += "</ul>";

  // Show start button only for creator and when all are ready
  const creator = Object.entries(joueurs).find(([n, j]) => j.isCreator);
  const tousPrets = Object.values(joueurs).length > 1 && Object.values(joueurs).every(j => j.prêt);
  const isCreator = joueurs[pseudo]?.isCreator;
  document.getElementById("btnDemarrer").style.display = (isCreator && tousPrets) ? "" : "none";
}

// Mark player as ready
function pretLobby() {
  db.ref(`parties/${partieId}/joueurs/${pseudo}/prêt`).set(true);
}

// Start the game (only creator)
async function demarrerPartie() {
  // Shuffle deck, hands, assign bots if needed
  let deck = Array.from({ length: 98 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);
  const joueursList = Object.entries(etatPartie.joueurs);
  const mainsInit = joueursList.map(([,j]) => deck.splice(0, 8));
  await db.ref(`parties/${partieId}`).update({
    etat: "en_cours",
    mains: mainsInit,
    deck: deck,
    piles: [
      { id: 1, type: 'montante', value: 1 },
      { id: 2, type: 'montante', value: 1 },
      { id: 3, type: 'descendante', value: 100 },
      { id: 4, type: 'descendante', value: 100 }
    ],
    joueurActuel: 0,
    cartesAJouer: 3
  });
}

// Quit lobby (just reload for now)
function quitterLobby() {
  window.location.reload();
}

//////////////////////////////
// AFFICHAGE ET INTERACTION
//////////////////////////////

function afficherListeJoueurs(joueurs) {
  const div = document.getElementById("listeJoueurs");
  div.innerHTML = "<h3>Joueurs connectés :</h3>";
  if (!joueurs) {
    div.innerHTML += "<p>Aucun joueur</p>";
    return;
  }
  Object.entries(joueurs).forEach(([nom, infos]) => {
    div.innerHTML += `<p>${nom} ${infos.isCreator ? "(créateur)" : ""}</p>`;
  });
}

function afficherMessage(msg) {
  const div = document.getElementById("message");
  div.innerText = msg;
}

function updateAffichagePartie(main, pilesData, joueurActuelIndex, cartesAJouerRestantes) {
  const zonePiles = document.getElementById("piles");
  zonePiles.innerHTML = '';
  pilesData.forEach(pile => {
    const div = document.createElement("div");
    div.className = `pile ${pile.type}`;
    div.innerText = `${pile.type === 'montante' ? '+' : '-'}\n${pile.value}`;
    div.onclick = () => poserCarteFirebase(pile);
    zonePiles.appendChild(div);
  });

  const mainDiv = document.getElementById("main");
  mainDiv.className = "main";
  mainDiv.innerHTML = '';

  main.sort((a, b) => a - b).forEach(c => {
    const carte = document.createElement("div");
    carte.className = "carte";
    carte.innerText = c;
    carte.onclick = () => selectionnerCarte(c);
    if (c === carteSelectionnee) carte.classList.add("selected");
    mainDiv.appendChild(carte);
  });

  document.getElementById("info").innerText = `Joueur ${joueurActuelIndex + 1} - Cartes à jouer: ${cartesAJouerRestantes}`;

  const btnFinTour = document.getElementById("btnFinTour");
  btnFinTour.disabled = cartesAJouerRestantes > 0;
}

function enableInteraction(active) {
  const mainDiv = document.getElementById("main");
  if (active) {
    mainDiv.style.pointerEvents = "auto";
    document.getElementById("btnFinTour").disabled = false;
  } else {
    mainDiv.style.pointerEvents = "none";
    carteSelectionnee = null;
    document.getElementById("btnFinTour").disabled = true;
  }
}

//////////////////////
// LOGIQUE DU JEU
//////////////////////

function selectionnerCarte(c) {
  if (etatPartie.joueurActuel !== joueurs[pseudo].mainIndex) return; // interdit si pas tour joueur
  carteSelectionnee = carteSelectionnee === c ? null : c;
  updateAffichagePartie(
    etatPartie.mains[joueurs[pseudo].mainIndex],
    etatPartie.piles,
    etatPartie.joueurActuel,
    etatPartie.cartesAJouer
  );
}

async function poserCarteFirebase(pile) {
  if (carteSelectionnee === null) return;
  if (etatPartie.joueurActuel !== joueurs[pseudo].mainIndex) return;

  const mainIndex = joueurs[pseudo].mainIndex;
  const main = [...etatPartie.mains[mainIndex]];
  const carte = carteSelectionnee;

  let top = pile.value;
  let valide = false;
  if (pile.type === 'montante' && (carte > top || carte === top - 10)) valide = true;
  else if (pile.type === 'descendante' && (carte < top || carte === top + 10)) valide = true;
  if (!valide) return alert("Coup invalide");

  // Met à jour localement
  let nouvellesPiles = [...etatPartie.piles];
  nouvellesPiles = nouvellesPiles.map(p => p.id === pile.id ? {...p, value: carte} : p);

  let nouvelleMain = [...main];
  nouvelleMain.splice(nouvelleMain.indexOf(carte),1);

  let nouveauDeck = [...etatPartie.deck];
  if (nouveauDeck.length > 0) {
    nouvelleMain.push(nouveauDeck.pop());
  }

  let nouvellesMains = [...etatPartie.mains];
  nouvellesMains[mainIndex] = nouvelleMain;

  let nouveauxCartesAJouer = etatPartie.cartesAJouer - 1;

  // Met à jour la DB
  await db.ref(`parties/${partieId}`).update({
    piles: nouvellesPiles,
    mains: nouvellesMains,
    deck: nouveauDeck,
    cartesAJouer: nouveauxCartesAJouer
  });

  carteSelectionnee = null;
}

// Fin de tour
async function finTour() {
  if (etatPartie.cartesAJouer > 0) {
    alert(`Vous devez jouer encore ${etatPartie.cartesAJouer} carte(s)`);
    return;
  }
  let joueurCount = Object.keys(joueurs).length;
  let nouveauJoueur = (etatPartie.joueurActuel + 1) % joueurCount;

  // Assure que le nouveau joueur est dans la partie (sinon on boucle)
  const joueursKeys = Object.values(joueurs).map(j => j.mainIndex);
  while (!joueursKeys.includes(nouveauJoueur)) {
    nouveauJoueur = (nouveauJoueur + 1) % joueurCount;
  }

  await db.ref(`parties/${partieId}`).update({
    joueurActuel: nouveauJoueur,
    cartesAJouer: Math.min(3, etatPartie.mains[nouveauJoueur]?.length || 0)
  });
}

/////////////////////////
// CONTROLEURS UI MENU
/////////////////////////

function handleCreerPartie() {
  const pseudoInput = document.getElementById("pseudo");
  const useBots = document.getElementById("useBots").checked;
  if (!pseudoInput.value.trim()) return alert("Entrez un pseudo");
  creerPartie(pseudoInput.value.trim(), useBots);
}

function handleRejoindrePartie() {
  const pseudoInput = document.getElementById("pseudo");
  const idPartieInput = document.getElementById("idPartie");
  if (!pseudoInput.value.trim() || !idPartieInput.value.trim()) return alert("Entrez pseudo et ID partie");
  rejoindrePartie(idPartieInput.value.trim(), pseudoInput.value.trim());
}

function cacherMenuAccueil() {
  document.getElementById("menuAccueil").style.display = "none";
  document.getElementById("headerJeu").style.display = "flex";
  document.getElementById("jeu").style.display = "block";
}

function afficherMenuAccueil() {
  document.getElementById("menuAccueil").style.display = "flex";
  document.getElementById("headerJeu").style.display = "none";
  document.getElementById("jeu").style.display = "none";
  document.getElementById("lobby").style.display = "none";
}

// Liaisons d'événements
window.onload = () => {
  afficherMenuAccueil();

  document.getElementById("btnCreer").onclick = handleCreerPartie;
  document.getElementById("btnRejoindre").onclick = handleRejoindrePartie;
  document.getElementById("btnFinTour").onclick = finTour;
  document.getElementById("btnPret").onclick = pretLobby;
  document.getElementById("btnDemarrer").onclick = demarrerPartie;
  document.getElementById("btnQuitterLobby").onclick = quitterLobby;

  // Optionnel : toggle thème sombre
  document.getElementById("themeToggle").onchange = e => {
    if (e.target.checked) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  };
};
