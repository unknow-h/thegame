// --- MULTIJOUEUR FIREBASE ---
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

let partieId = null, pseudo = null, joueurs = {}, etatPartie = null, carteSelectionnee = null, cartesAJouer = 3;
let modeSolo = false;
let historiqueCartesJouees = [];

const PARTIE_TIMEOUT = 30 * 60 * 1000; // 30 min en ms

// === NOTIFICATIONS VISUELLES (NOUVEAU) ===
function showNotification(msg) {
  const area = document.getElementById('notificationArea');
  if (!area) return;
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = msg;
  area.appendChild(notif);
  setTimeout(() => notif.remove(), 4500);
}

// === LOBBY GLOBAL (NOUVEAU) ===
function afficherLobbyGlobal() {
  const zone = document.getElementById("zoneLobbyAll");
  const liste = document.getElementById("listeLobbyParties");
  if (!zone || !liste) return;
  zone.style.display = "";
  liste.innerHTML = "<i>Chargement...</i>";
  db.ref('parties').orderByChild('etat').equalTo('attente').on('value', snap => {
    liste.innerHTML = "";
    let found = false;
    snap.forEach(child => {
      const id = child.key;
      const data = child.val();
      found = true;
      const btn = document.createElement("button");
      btn.className = 'lobby-entry';
      btn.innerHTML = `
        <span><b>${id}</b> (${Object.keys(data.joueurs||{}).length} joueur${Object.keys(data.joueurs||{}).length>1?'s':''})</span>
        <span style="font-size:0.9em;color:#555;">Rejoindre</span>
      `;
      btn.onclick = () => {
        document.getElementById("zoneLobbyAll").style.display="none";
        document.getElementById("menuAccueil").style.display="";
        document.getElementById("idPartie").value = id;
      };
      liste.appendChild(btn);
    });
    if (!found) liste.innerHTML = "<i>Aucune partie ouverte</i>";
  });
}

// --- MODE SOLO LOCAL ---
let solo = {
  deck: [],
  joueurs: [],
  piles: [],
  joueurActuel: 0,
  cartesAJouer: 3,
  bots: [],
  historique: []
};

function afficherMenuAccueil() {
  document.getElementById("menuAccueil").style.display = "block";
  document.getElementById("lobby").style.display = "none";
  document.getElementById("jeu").style.display = "none";
  const zoneLobby = document.getElementById("zoneLobbyAll");
  if(zoneLobby) zoneLobby.style.display = "";
  afficherLobbyGlobal();
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

function ouvrirSoloModal() {
  document.getElementById("soloModal").style.display = "flex";
}
function lancerPartieSolo() {
  modeSolo = true;
  document.getElementById("soloModal").style.display = "none";
  document.getElementById("menuAccueil").style.display = "none";
  document.getElementById("jeu").style.display = "block";
  // Config
  const nbHumains = Math.max(1, Math.min(4, parseInt(document.getElementById("nbJoueurs").value || "1")));
  const nbBots = 4 - nbHumains;
  solo.deck = Array.from({ length: 98 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);
  solo.piles = [
    { id: 1, type: 'montante', value: 1 },
    { id: 2, type: 'montante', value: 1 },
    { id: 3, type: 'descendante', value: 100 },
    { id: 4, type: 'descendante', value: 100 }
  ];
  solo.joueurs = Array.from({ length: 4 }, () => ({ main: solo.deck.splice(0, 8) }));
  solo.bots = Array.from({ length: 4 }, (_, i) => i >= nbHumains);
  solo.joueurActuel = 0;
  solo.cartesAJouer = Math.min(3, solo.joueurs[solo.joueurActuel].main.length);
  carteSelectionnee = null;
  solo.historique = [];
  updateAffichageSolo();
  if (solo.bots[solo.joueurActuel]) jouerBotSolo();
}
function updateAffichageSolo() {
  document.getElementById("info").innerText = `Joueur ${solo.joueurActuel + 1} (${solo.bots[solo.joueurActuel] ? 'Bot' : 'Humain'}) - Cartes à jouer: ${solo.cartesAJouer}`;
  const zonePiles = document.getElementById("piles");
  zonePiles.innerHTML = '';
  solo.piles.forEach(pile => {
    const div = document.createElement("div");
    div.className = `pile ${pile.type}`;
    div.innerText = `${pile.type === 'montante' ? '+' : '-'}\n${pile.value}`;
    div.onclick = () => poserCarteSolo(pile);
    zonePiles.appendChild(div);
  });

  const main = document.getElementById("main");
  main.className = "main";
  main.innerHTML = '';

  // Surbrillance cartes "spéciales"
  const mainTriee = [...solo.joueurs[solo.joueurActuel].main].sort((a, b) => a - b);
  let cartesSpec = new Set();
  for (let c of mainTriee) {
    for (let pile of solo.piles) {
      if (Math.abs(c - pile.value) === 10) cartesSpec.add(c);
    }
    for (let autre of mainTriee) {
      if (c !== autre && Math.abs(c - autre) === 10) cartesSpec.add(c);
    }
  }

  mainTriee.forEach(c => {
    const carte = document.createElement("div");
    carte.className = "carte";
    carte.innerText = c;
    carte.onclick = () => selectionnerCarteSolo(c);
    if (cartesSpec.has(c)) carte.style.backgroundColor = "#ffe066";
    if (c === carteSelectionnee) carte.classList.add("selected");
    main.appendChild(carte);
  });

  document.getElementById("listeJoueurs").innerHTML = "";
  document.getElementById("message").innerHTML = "";
  document.getElementById("btnFinTour").onclick = finTourSolo;
  document.getElementById("btnFinTour").disabled = solo.cartesAJouer > 0;
  document.getElementById("btnFinTour").style.display = "";

  // Vérifie l'absence de coup possible
  if (
    !solo.bots[solo.joueurActuel] &&
    solo.joueurs[solo.joueurActuel].main.length > 0 &&
    aucunCoupPossible(solo.joueurs[solo.joueurActuel].main, solo.piles)
  ) {
    afficherGameOverSolo();
  }
}

function selectionnerCarteSolo(c) {
  if (solo.bots[solo.joueurActuel]) return;
  carteSelectionnee = carteSelectionnee === c ? null : c;
  updateAffichageSolo();
}
function poserCarteSolo(pile) {
  if (carteSelectionnee === null || solo.bots[solo.joueurActuel]) return;
  if (jouerCarteSolo(pile, carteSelectionnee)) {
    carteSelectionnee = null;
    updateAffichageSolo();
  }
}
function jouerCarteSolo(pile, carte) {
  let top = pile.value;
  if (pile.type === 'montante' && (carte > top || carte === top - 10)) {
    pile.value = carte;
  } else if (pile.type === 'descendante' && (carte < top || carte === top + 10)) {
    pile.value = carte;
  } else {
    return false;
  }
  solo.historique.push(`Joueur ${solo.joueurActuel + 1} ➜ ${carte} sur pile ${pile.id} (${pile.type})`);
  let main = solo.joueurs[solo.joueurActuel].main;
  main.splice(main.indexOf(carte), 1);
  solo.cartesAJouer--;
  if (main.length === 0 && solo.deck.length === 0) setTimeout(() => alert("Victoire collective !"), 300);
  return true;
}
function finTourSolo() {
  if (solo.cartesAJouer > 0) return;

  // Piocher pour revenir à 8 cartes (ou moins si pioche vide)
  let main = solo.joueurs[solo.joueurActuel].main;
  while (main.length < 8 && solo.deck.length > 0) {
    main.push(solo.deck.pop());
  }

  solo.joueurActuel = (solo.joueurActuel + 1) % 4;
  solo.cartesAJouer = Math.min(3, solo.joueurs[solo.joueurActuel].main.length);
  carteSelectionnee = null;
  updateAffichageSolo();
  if (solo.bots[solo.joueurActuel]) jouerBotSolo();
}
function jouerBotSolo() {
  let main = solo.joueurs[solo.joueurActuel].main;
  let choix = [];
  for (let carte of main) {
    for (let pile of solo.piles) {
      let top = pile.value;
      let ok = (pile.type === 'montante' && (carte > top || carte === top - 10)) ||
               (pile.type === 'descendante' && (carte < top || carte === top + 10));
      if (ok) choix.push({ carte, pile, ecart: Math.abs(carte - top) });
    }
  }
  choix.sort((a, b) => a.ecart - b.ecart);
  let jouees = 0;
  function jouerUne() {
    if (jouees >= 3 || choix.length === 0) return finTourSolo();
    let { carte, pile } = choix.shift();

    // Animation
    const mainDiv = document.getElementById("main");
    const cartesDiv = Array.from(mainDiv.children);
    const indexCarte = solo.joueurs[solo.joueurActuel].main.indexOf(carte);
    if (indexCarte === -1) return jouerUne();

    const carteElem = cartesDiv[indexCarte];
    const rectCarte = carteElem.getBoundingClientRect();

    // Trouver la position de la pile cible
    const pilesDiv = document.getElementById("piles");
    const pileDivs = Array.from(pilesDiv.children);
    const pileIndex = solo.piles.findIndex(p => p.id === pile.id);
    const pileElem = pileDivs[pileIndex];
    const rectPile = pileElem.getBoundingClientRect();

    // Créer la carte animée
    const animCarte = document.createElement("div");
    animCarte.className = "carte-anim";
    animCarte.innerText = carte;
    document.body.appendChild(animCarte);

    // Position initiale
    animCarte.style.left = rectCarte.left + "px";
    animCarte.style.top = rectCarte.top + "px";
    animCarte.offsetWidth;
    // Position finale (au centre de la pile)
    const leftFinal = rectPile.left + (rectPile.width - rectCarte.width) / 2;
    const topFinal = rectPile.top + (rectPile.height - rectCarte.height) / 2;
    animCarte.style.left = leftFinal + "px";
    animCarte.style.top = topFinal + "px";
    animCarte.style.width = "40px";
    animCarte.style.height = "60px";
    animCarte.style.lineHeight = "60px";
    animCarte.style.fontSize = "18px";
    animCarte.style.opacity = "0.7";
    animCarte.addEventListener("transitionend", () => {
      if (jouerCarteSolo(pile, carte)) {
        updateAffichageSolo();
        jouees++;
        animCarte.remove();
        setTimeout(jouerUne, 300);
      } else {
        animCarte.remove();
        jouerUne();
      }
    }, { once: true });
  }
  jouerUne();
}

function aucunCoupPossible(main, piles) {
  for (let carte of main) {
    for (let pile of piles) {
      let top = pile.value;
      if (
        (pile.type === 'montante' && (carte > top || carte === top - 10)) ||
        (pile.type === 'descendante' && (carte < top || carte === top + 10))
      ) {
        return false;
      }
    }
  }
  return true;
}

function afficherGameOverSolo() {
  if (document.getElementById("gameOverSoloModal")) return;
  const modal = document.createElement('div');
  modal.id = "gameOverSoloModal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.85)";
  modal.style.color = "#fff";
  modal.style.zIndex = 2500;
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.innerHTML = `
    <div style="background:#222;padding:30px;border-radius:10px;text-align:center;max-width:320px">
      <h2>Aucun coup possible</h2>
      <p>Vous ne pouvez poser aucune carte.<br>Voulez-vous recommencer ou quitter ?</p>
      <button id="btnRestartSolo">Recommencer</button>
      <button id="btnQuitSolo" style="margin-left:20px;">Quitter</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("btnRestartSolo").onclick = () => {
    modal.remove();
    lancerPartieSolo();
  };
  document.getElementById("btnQuitSolo").onclick = () => {
    modal.remove();
    afficherMenuAccueil();
  };
}
// =============== MULTIJOUEUR ===============

function updateLastActive() {
  if (partieId) {
    db.ref(`parties/${partieId}/lastActive`).set(Date.now());
  }
}

async function creerPartie(pseudoJoueur, customId) {
  if (!customId) {
    alert("Veuillez choisir un ID de partie simple (ex: 123, abc)");
    return;
  }
  const partieRef = db.ref('parties/' + customId);
  const snapshot = await partieRef.get();
  if (snapshot.exists()) {
    alert("Cet ID est déjà utilisé, choisis-en un autre.");
    return;
  }
  partieId = customId;
  const partieData = {
    joueurs: {
      [pseudoJoueur]: { prêt: false, isCreator: true, mainIndex: 0 }
    },
    etat: "attente",
    historique: [],
    lastActive: Date.now()
  };
  await partieRef.set(partieData);
  pseudo = pseudoJoueur;
  ecouterPartie();
  verifierSuppressionAuto();
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
    verifierSuppressionAuto();
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
  updateLastActive();
  db.ref(`parties/${partieId}/joueurs/${pseudo}/prêt`).set(true);
}
async function demarrerPartie() {
  updateLastActive();
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
    cartesAJouer: Math.min(3, mainsInit[0]?.length || 0),
    historique: [],
    lastActive: Date.now()
  });
}
function quitterLobby() { window.location.reload(); }

// Bloc de suppression automatique (notification visuelle si expiration)
function verifierSuppressionAuto() {
  setInterval(async () => {
    if (!partieId) return;
    const partieRef = db.ref(`parties/${partieId}`);
    const snap = await partieRef.child('lastActive').get();
    const last = snap.val();
    if (last && (Date.now() - last > PARTIE_TIMEOUT)) {
      await partieRef.remove();
      showNotification("La partie a expiré après 30 minutes d'inactivité.");
      window.location.reload();
    }
  }, 60 * 1000);
}

// Bloc d'écoute de la partie (notification visuelle si suppression)
function ecouterPartie() {
  const partieRef = db.ref(`parties/${partieId}`);
  partieRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      showNotification("La partie a été supprimée ou expirée.");
      afficherMenuAccueil();
      afficherLobbyGlobal();
      return;
    }
    etatPartie = data;
    joueurs = data.joueurs || {};
    historiqueCartesJouees = data.historique || [];
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

function afficherListeJoueurs(joueurs, mains, joueurActuel) {
  const div = document.getElementById("listeJoueurs");
  div.innerHTML = "<h3>Joueurs connectés :</h3><ul>";
  Object.entries(joueurs).forEach(([nom, infos]) => {
    let mainIndex = infos.mainIndex;
    let nbcartes = mains && mains[mainIndex] ? mains[mainIndex].length : "?";
    div.innerHTML += `<li>
      ${nom} 
      ${infos.isCreator ? "(créateur)" : ""} 
      ${joueurActuel === mainIndex ? "<b> (joue)</b>" : ""}
      &mdash; <span style="color:#888;">${nbcartes} carte${nbcartes>1?'s':''}</span>
    </li>`;
  });
  div.innerHTML += "</ul>";
}

function afficherMessage(msg) {
  document.getElementById("message").innerText = msg;
}

function getNomJoueurParIndex(idx) {
  for (let nom in joueurs) {
    if (joueurs[nom].mainIndex === idx) return nom;
  }
  return "Joueur " + (idx+1);
}

function updateInterfaceAvecEtat() {
  if (!etatPartie) return;
  const mainIndex = joueurs[pseudo]?.mainIndex;
  afficherListeJoueurs(joueurs, etatPartie.mains, etatPartie.joueurActuel);
  updateAffichagePartie(
    etatPartie.mains[mainIndex],    // toujours la main du joueur connecté !
    etatPartie.piles,
    etatPartie.joueurActuel,
    etatPartie.cartesAJouer
  );
  if (etatPartie.joueurActuel === mainIndex) {
    enableInteraction(true);
    afficherMessage("C'est votre tour !");
  } else {
    enableInteraction(false);
    afficherMessage(`Tour de ${getNomJoueurParIndex(etatPartie.joueurActuel)}`);
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

  // Surbrillance cartes spéciales (écart de 10)
  let cartesSpec = new Set();
  let mainTriee = [...main].sort((a, b) => a - b);
  for (let c of mainTriee) {
    for (let pile of pilesData) {
      if (Math.abs(c - pile.value) === 10) cartesSpec.add(c);
    }
    for (let autre of mainTriee) {
      if (c !== autre && Math.abs(c - autre) === 10) cartesSpec.add(c);
    }
  }

  mainTriee.forEach(c => {
    const carte = document.createElement("div");
    carte.className = "carte";
    carte.innerText = c;
    carte.onclick = () => selectionnerCarte(c);
    if (cartesSpec.has(c)) carte.style.backgroundColor = "#ffe066";
    if (c === carteSelectionnee) carte.classList.add("selected");
    mainDiv.appendChild(carte);
  });
  document.getElementById("info").innerText = `Joueur ${joueurActuelIndex + 1} - Cartes à jouer: ${cartesAJouerRestantes}`;
  document.getElementById("btnFinTour").disabled = cartesAJouerRestantes > 0;
  document.getElementById("btnFinTour").onclick = finTour;
  document.getElementById("btnFinTour").style.display = "";

  // Vérifie l'absence de coup possible pour le joueur courant
  if (
    etatPartie.joueurActuel === joueurs[pseudo].mainIndex &&
    main.length > 0 &&
    aucunCoupPossible(main, pilesData)
  ) {
    afficherGameOverMulti();
  }
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
  updateLastActive();
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
  let nouvellesMains = [...etatPartie.mains];
  nouvellesMains[mainIndex] = nouvelleMain;
  let nouveauxCartesAJouer = etatPartie.cartesAJouer - 1;

  // Historique (synchrone pour tous)
  let hist = etatPartie.historique || [];
  hist.push(`Joueur ${mainIndex + 1} ➜ ${carte} sur pile ${pile.id} (${pile.type})`);

  await db.ref(`parties/${partieId}`).update({
    piles: nouvellesPiles,
    mains: nouvellesMains,
    deck: etatPartie.deck,
    cartesAJouer: nouveauxCartesAJouer,
    historique: hist,
    lastActive: Date.now()
  });
  carteSelectionnee = null;
}

async function finTour() {
  if (etatPartie.cartesAJouer > 0) {
    alert(`Vous devez jouer encore ${etatPartie.cartesAJouer} carte(s)`);
    return;
  }
  updateLastActive();
  let mains = [...etatPartie.mains];
  let deck = [...etatPartie.deck];
  const mainIndex = joueurs[pseudo].mainIndex;
  let main = [...mains[mainIndex]];
  while (main.length < 8 && deck.length > 0) {
    main.push(deck.pop());
  }
  mains[mainIndex] = main;

  let joueurCount = Object.keys(joueurs).length;
  let nouveauJoueur = (etatPartie.joueurActuel + 1) % joueurCount;
  const joueursKeys = Object.values(joueurs).map(j => j.mainIndex);
  while (!joueursKeys.includes(nouveauJoueur)) {
    nouveauJoueur = (nouveauJoueur + 1) % joueurCount;
  }
  await db.ref(`parties/${partieId}`).update({
    mains: mains,
    deck: deck,
    joueurActuel: nouveauJoueur,
    cartesAJouer: Math.min(3, mains[nouveauJoueur]?.length || 0),
    lastActive: Date.now()
  });
}

function afficherGameOverMulti() {
  if (document.getElementById("gameOverMultiModal")) return;
  const modal = document.createElement('div');
  modal.id = "gameOverMultiModal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.85)";
  modal.style.color = "#fff";
  modal.style.zIndex = 2500;
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.innerHTML = `
    <div style="background:#222;padding:30px;border-radius:10px;text-align:center;max-width:320px">
      <h2>Aucun coup possible</h2>
      <p>Vous ne pouvez poser aucune carte.<br>Voulez-vous recommencer ou quitter ?</p>
      <button id="btnRestartMulti">Recommencer</button>
      <button id="btnQuitMulti" style="margin-left:20px;">Quitter</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("btnRestartMulti").onclick = () => {
    modal.remove();
    if (joueurs[pseudo]?.isCreator) {
      demarrerPartie();
    } else {
      alert("Seul le créateur peut relancer la partie.");
    }
  };
  document.getElementById("btnQuitMulti").onclick = () => {
    modal.remove();
    afficherMenuAccueil();
  };
}
// =============== RECONNEXION AUTOMATIQUE ===============
function checkReconnect() {
  const lastId = localStorage.getItem('lastPartieId');
  if (lastId) {
    db.ref('parties/' + lastId).once('value').then(snap => {
      if (snap.exists()) {
        showNotification("Vous avez quitté une partie. Reconnexion automatique possible !");
        // On propose à l'utilisateur de rejoindre (si il veut)
        const reconnexion = confirm("Souhaitez-vous rejoindre la dernière partie (" + lastId + ") ?");
        if (reconnexion) {
          document.getElementById("idPartie").value = lastId;
        } else {
          localStorage.removeItem('lastPartieId');
          afficherMenuAccueil();
          afficherLobbyGlobal();
        }
      } else {
        localStorage.removeItem('lastPartieId');
        afficherMenuAccueil();
        afficherLobbyGlobal();
      }
    });
  } else {
    afficherMenuAccueil();
    afficherLobbyGlobal();
  }
}

// =============== INITIALISATION AU CHARGEMENT ===============
window.onload = () => {
  checkReconnect();

  document.getElementById("btnCreer").onclick = () => {
    const pseudoInput = document.getElementById("pseudo");
    const customIdInput = document.getElementById("customIdPartie");
    if (!pseudoInput.value.trim() || !customIdInput.value.trim()) return alert("Entrez un pseudo et un ID de partie");
    modeSolo = false;
    creerPartie(pseudoInput.value.trim(), customIdInput.value.trim());
    localStorage.setItem('lastPartieId', customIdInput.value.trim());
  };
  document.getElementById("btnRejoindre").onclick = () => {
    const pseudoInput = document.getElementById("pseudo");
    const idPartieInput = document.getElementById("idPartie");
    if (!pseudoInput.value.trim() || !idPartieInput.value.trim()) return alert("Entrez pseudo et ID partie");
    modeSolo = false;
    rejoindrePartie(idPartieInput.value.trim(), pseudoInput.value.trim());
    localStorage.setItem('lastPartieId', idPartieInput.value.trim());
  };
  document.getElementById("btnSolo").onclick = ouvrirSoloModal;
  document.getElementById("btnLancerSolo").onclick = lancerPartieSolo;

  // === AJOUTE ICI LES LIGNES POUR LE MULTIJOUEUR ===
  document.getElementById("btnPret").onclick = pretLobby;
  document.getElementById("btnDemarrer").onclick = demarrerPartie;
  document.getElementById("btnQuitterLobby").onclick = quitterLobby;

  document.getElementById("themeToggle").onchange = e => {
    if (e.target.checked) document.body.classList.add("dark");
    else document.body.classList.remove("dark");
  };
  document.getElementById("btnAide").onclick = () => {
    alert(`OBJECTIF:\nJouez toutes les cartes (2-99) sur 4 piles.\n\nPILES:\n- 2 montantes (+): poser une carte plus grande\n- 2 descendantes (-): poser une carte plus petite\n\nREGLES:\n- Vous devez jouer au moins 3 cartes par tour.\n- Vous pouvez faire un saut de 10 en arrière.\n- Pioche automatique après pose si cartes dispo.\n- Les cartes avec un écart de 10 sont en jaune.\n\nVICTOIRE : toutes les cartes ont été jouées.`);
  };
  document.getElementById("btnHistorique").onclick = () => {
    let hist = modeSolo ? solo.historique : (historiqueCartesJouees || []);
    const modal = document.getElementById("historiqueModal");
    const contenu = document.getElementById("historiqueContenu");
    if (!hist || hist.length === 0) {
      contenu.innerText = "Aucune action pour le moment.";
    } else {
      contenu.innerText = hist.join("\n");
    }
    modal.style.display = "flex";
  };
  // Affichage lobby global au démarrage
  if(document.getElementById("btnCreerLobby")) {
    document.getElementById("btnCreerLobby").onclick = () => {
      document.getElementById("zoneLobbyAll").style.display = "none";
      document.getElementById("menuAccueil").style.display = "";
      document.getElementById("customIdPartie").focus();
    };
  }
  afficherLobbyGlobal();
};
