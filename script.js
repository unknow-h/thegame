// ---- Firebase config (replace by your own if needed) ----
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---- Variables de jeu ----
let partieId = null, pseudo = null, joueurs = {}, etatPartie = null, carteSelectionnee = null, cartesAJouer = 3;

// ---- MENU & LOBBY ----

function afficherMenuAccueil() {
  document.getElementById("menuAccueil").style.display = "block";
  document.getElementById("lobby").style.display = "none";
  document.getElementById("jeu").style.display = "none";
}
function montrerLobby() {
  document.getElementById("menuAccueil").style.display = "none";
  document.getElementById("lobby").style.display = "block";
  document.getElementById("jeu").style.display = "none";
}
function cacherLobby() {
  document.getElementById("menuAccueil").style.display = "none";
  document.getElementById("lobby").style.display = "none";
  document.getElementById("jeu").style.display = "block";
}

async function creerPartie(pseudoJoueur) {
  const partiesRef = db.ref('parties');
  const nouvellePartieRef = partiesRef.push();
  partieId = nouvellePartieRef.key;
  const partieData = {
    joueurs: {
      [pseudoJoueur]: { prêt: false, isCreator: true, mainIndex: 0 }
    },
    etat: "attente"
  };
  await nouvellePartieRef.set(partieData);
  pseudo = pseudoJoueur;
  ecouterPartie();
  montrerLobby();
  afficherLobbyMessage(`Partie créée. ID : ${partieId}`);
}

async function rejoindrePartie(idPartie, pseudoJoueur) {
  partieId = idPartie;
  pseudo = pseudoJoueur;
  const joueursRef = db.ref(`parties/${partieId}/joueurs`);
  try {
    await joueursRef.transaction(joueurs => {
      if (joueurs) {
        if (Object.keys(joueurs).length >= 4) throw "Partie pleine";
        if (joueurs[pseudo]) throw "Pseudo déjà utilisé";
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
    afficherLobbyMessage(`Rejoint la partie ${partieId}`);
  } catch (e) {
    document.getElementById("menuMessage").innerText = e;
  }
}

function afficherLobbyMessage(msg) {
  document.getElementById("lobbyMessage").innerText = msg;
}
function updateLobbyAffichage() {
  if (!etatPartie) return;
  const lobbyJoueurs = document.getElementById("lobbyJoueurs");
  lobbyJoueurs.innerHTML = "<b>Joueurs connectés :</b><ul>";
  Object.entries(joueurs).forEach(([nom, infos]) => {
    lobbyJoueurs.innerHTML += `<li>${nom} ${infos.isCreator ? "(créateur)" : ""} - ${infos.prêt ? "✅ Prêt" : "⏳"}</li>`;
  });
  lobbyJoueurs.innerHTML += "</ul>";
  const tousPrets = Object.values(joueurs).length > 1 && Object.values(joueurs).every(j => j.prêt);
  const isCreator = joueurs[pseudo]?.isCreator;
  document.getElementById("btnDemarrer").style.display = (isCreator && tousPrets) ? "" : "none";
}
function pretLobby() {
  db.ref(`parties/${partieId}/joueurs/${pseudo}/prêt`).set(true);
}
async function demarrerPartie() {
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
function quitterLobby() { window.location.reload(); }

// ---- SYNCHRO TEMPS RÉEL ----

function ecouterPartie() {
  const partieRef = db.ref(`parties/${partieId}`);
  partieRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return alert("Partie supprimée ou inexistante.");
    etatPartie = data;
    joueurs = data.joueurs || {};
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

// ---- AFFICHAGE JEU ----

function afficherListeJoueurs(joueurs) {
  const div = document.getElementById("listeJoueurs");
  div.innerHTML = "<h3>Joueurs connectés :</h3>";
  Object.entries(joueurs).forEach(([nom, infos]) => {
    div.innerHTML += `<p>${nom} ${infos.isCreator ? "(créateur)" : ""}</p>`;
  });
}
function afficherMessage(msg) {
  document.getElementById("message").innerText = msg;
}
function updateInterfaceAvecEtat() {
  if (!etatPartie) return;
  afficherListeJoueurs(joueurs);
  cartesAJouer = etatPartie.cartesAJouer;
  const mainIndex = joueurs[pseudo]?.mainIndex;
  if (mainIndex === undefined) return alert("Tu n'es pas dans cette partie !");
  updateAffichagePartie(
    etatPartie.mains[mainIndex],
    etatPartie.piles,
    etatPartie.joueurActuel,
    cartesAJouer
  );
  if (etatPartie.joueurActuel === joueurs[pseudo].mainIndex) {
    enableInteraction(true);
  } else {
    enableInteraction(false);
    afficherMessage(`Tour du joueur ${etatPartie.joueurActuel + 1}`);
  }
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
  document.getElementById("btnFinTour").disabled = cartesAJouerRestantes > 0;
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

// ---- LOGIQUE DU JEU ----

function selectionnerCarte(c) {
  if (etatPartie.joueurActuel !== joueurs[pseudo].mainIndex) return;
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
  await db.ref(`parties/${partieId}`).update({
    piles: nouvellesPiles,
    mains: nouvellesMains,
    deck: nouveauDeck,
    cartesAJouer: nouveauxCartesAJouer
  });
  carteSelectionnee = null;
}

async function finTour() {
  if (etatPartie.cartesAJouer > 0) {
    alert(`Vous devez jouer encore ${etatPartie.cartesAJouer} carte(s)`);
    return;
  }
  let joueurCount = Object.keys(joueurs).length;
  let nouveauJoueur = (etatPartie.joueurActuel + 1) % joueurCount;
  const joueursKeys = Object.values(joueurs).map(j => j.mainIndex);
  while (!joueursKeys.includes(nouveauJoueur)) {
    nouveauJoueur = (nouveauJoueur + 1) % joueurCount;
  }
  await db.ref(`parties/${partieId}`).update({
    joueurActuel: nouveauJoueur,
    cartesAJouer: Math.min(3, etatPartie.mains[nouveauJoueur]?.length || 0)
  });
}

// ---- UI EVENTS ----

window.onload = () => {
  afficherMenuAccueil();
  document.getElementById("btnCreer").onclick = () => {
    const pseudoInput = document.getElementById("pseudo");
    if (!pseudoInput.value.trim()) return alert("Entrez un pseudo");
    creerPartie(pseudoInput.value.trim());
  };
  document.getElementById("btnRejoindre").onclick = () => {
    const pseudoInput = document.getElementById("pseudo");
    const idPartieInput = document.getElementById("idPartie");
    if (!pseudoInput.value.trim() || !idPartieInput.value.trim()) return alert("Entrez pseudo et ID partie");
    rejoindrePartie(idPartieInput.value.trim(), pseudoInput.value.trim());
  };
  document.getElementById("btnFinTour").onclick = finTour;
  document.getElementById("btnPret").onclick = pretLobby;
  document.getElementById("btnDemarrer").onclick = demarrerPartie;
  document.getElementById("btnQuitterLobby").onclick = quitterLobby;
  document.getElementById("themeToggle").onchange = e => {
    if (e.target.checked) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  };
};
