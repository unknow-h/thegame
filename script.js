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

// Stocke les références des listeners et intervalles pour les nettoyer
window.firebasePartieListener = null;
window.partieTimeoutInterval = null;

// === NOTIFICATIONS VISUELLES ===
function showNotification(msg) {
  const area = document.getElementById('notificationArea');
  if (!area) return;
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = msg;
  area.appendChild(notif);
  setTimeout(() => notif.remove(), 4500);
}

// === LOBBY GLOBAL ===
function afficherLobbyGlobal() {
  const zone = document.getElementById("zoneLobbyAll");
  const liste = document.getElementById("listeLobbyParties");
  if (!zone || !liste) return;
  zone.style.display = "";
  liste.innerHTML = "<i>Chargement...</i>";
  // Important: Assurez-vous d'avoir ".indexOn": "etat" dans vos règles de sécurité Firebase
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

// DEBUT MODIFICATION 3: updateAffichageSolo
function updateAffichageSolo() {
  document.getElementById("info").innerText = `Joueur ${solo.joueurActuel + 1} (${solo.bots[solo.joueurActuel] ? 'Bot' : 'Humain'}) - Cartes à jouer: ${solo.cartesAJouer} - Deck: ${solo.deck.length} cartes`;
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
// FIN MODIFICATION 3: updateAffichageSolo

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

// DEBUT MODIFICATION 1: finTourSolo
function finTourSolo() {
    if (solo.cartesAJouer > 0) return;

    let main = solo.joueurs[solo.joueurActuel].main;
    // Vérification de la main vide pour le bonus
    const mainVideAvantPioche = main.length === 0;

    // Piocher pour revenir à 8 cartes (ou moins si pioche vide)
    while (main.length < 8 && solo.deck.length > 0) {
        main.push(solo.deck.pop());
    }

    // Si la main était vide avant la pioche et qu'on a pioché des cartes,
    // on donne des cartes à jouer supplémentaires (bonus)
    if (mainVideAvantPioche && main.length > 0) {
        solo.cartesAJouer = Math.min(3, main.length) + 3; // +3 cartes à jouer en bonus
        showNotification("Bonus ! Vous avez vidé votre main, +3 cartes à jouer ce tour !");
    } else {
        solo.cartesAJouer = Math.min(3, main.length);
    }

    // Vérification de la condition de victoire après la pioche bonus
    if (main.length === 0 && solo.deck.length === 0) {
        setTimeout(() => alert("Victoire collective !"), 300);
        return; // Fin de partie, ne pas passer au joueur suivant
    }

    solo.joueurActuel = (solo.joueurActuel + 1) % 4;
    carteSelectionnee = null;
    updateAffichageSolo();
    if (solo.bots[solo.joueurActuel]) jouerBotSolo();
}
// FIN MODIFICATION 1: finTourSolo

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
  pseudo = pseudoJoueur;
  const partieData = {
    joueurs: {
      [pseudoJoueur]: { prêt: false, isCreator: true, mainIndex: 0 }
    },
    etat: "attente",
    historique: [],
    lastActive: Date.now()
  };
  await partieRef.set(partieData);
  ecouterPartie();
  verifierSuppressionAuto();
  montrerLobby();
  afficherLobbyMessage(`Partie créée. ID : ${partieId}`);
  localStorage.setItem('lastPartieId', customId);
  localStorage.setItem('lastPseudo', pseudoJoueur);
}

async function rejoindrePartie(idPartie, pseudoJoueur) {
  console.log("DEBUG: --- Début rejoindrePartie ---");
  console.log("DEBUG: Tentative de rejoindre la partie ID:", idPartie, "avec pseudo:", pseudoJoueur);

  partieId = idPartie;
  pseudo = pseudoJoueur;
  const joueursRef = db.ref(`parties/${partieId}/joueurs`);

  try {
    console.log("DEBUG: Récupération de l'état actuel de la partie...");
    const snapshot = await db.ref(`parties/${partieId}`).get();

    if (!snapshot.exists()) {
      console.error("DEBUG: La partie n'existe pas ou a été supprimée.");
      throw "La partie n'existe pas.";
    }
    const partieState = snapshot.val();
    console.log("DEBUG: État de la partie récupéré:", partieState.etat);

    // Permettre la reconnexion à une partie "attente" ou "en_cours"
    if (partieState.etat !== "attente" && partieState.etat !== "en_cours") {
        console.error("DEBUG: La partie est dans un état non joignable:", partieState.etat);
        throw `La partie est dans un état non joignable: ${partieState.etat}.`;
    }

    console.log("DEBUG: Début de la transaction pour ajouter/confirmer le joueur...");
    await joueursRef.transaction(joueursData => {
        if (joueursData) {
            // Si le joueur existe déjà, on ne fait rien dans la transaction (il est "reconnecté")
            if (joueursData[pseudoJoueur]) {
                console.log(`DEBUG: Pseudo '${pseudoJoueur}' déjà présent dans la partie. Confirmation.`);
                return joueursData;
            }
            console.log("DEBUG: Joueurs existants:", Object.keys(joueursData).length);
            if (Object.keys(joueursData).length >= 4) {
                console.error("DEBUG: Partie pleine.");
                throw "Partie pleine";
            }
            let usedIndexes = Object.values(joueursData).map(j => j.mainIndex);
            let mainIndex = [0,1,2,3].find(i => !usedIndexes.includes(i));
            console.log("DEBUG: Assignation du mainIndex:", mainIndex);
            joueursData[pseudoJoueur] = { prêt: false, isCreator: false, mainIndex };
        } else {
            console.log("DEBUG: Initialisation du premier joueur de la partie.");
            joueursData = { [pseudoJoueur]: { prêt: false, isCreator: false, mainIndex: 0 } };
        }
        return joueursData;
    });

    console.log("DEBUG: Transaction terminée avec succès. Appel de ecouterPartie()...");
    ecouterPartie();
    console.log("DEBUG: Appel de verifierSuppressionAuto()...");
    verifierSuppressionAuto();

    // Gérer l'affichage immédiat en fonction de l'état de la partie
    if (partieState.etat === "attente") {
        console.log("DEBUG: Partie en attente, montrer lobby.");
        montrerLobby();
        afficherLobbyMessage(`Rejoint la partie ${partieId}`);
    } else if (partieState.etat === "en_cours") {
        console.log("DEBUG: Partie en cours, cacher lobby et mettre à jour le jeu.");
        cacherLobby();
    }

    localStorage.setItem('lastPartieId', idPartie);
    localStorage.setItem('lastPseudo', pseudoJoueur);
    console.log("DEBUG: Fin de rejoindrePartie (succès).");

  } catch (e) {
    console.error("DEBUG: Erreur capturée dans rejoindrePartie:", e);
    document.getElementById("menuMessage").innerText = String(e);
    localStorage.removeItem('lastPartieId');
    localStorage.removeItem('lastPseudo');
    afficherMenuAccueil();
    afficherLobbyGlobal();
    console.log("DEBUG: Fin de rejoindrePartie (échec).");
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
  db.ref(`parties/${partieId}/joueurs/${pseudo}/prêt`).set(true)
    .then(() => {
      console.log("DEBUG: Statut 'prêt' mis à jour dans Firebase.");
    })
    .catch(error => {
      console.error("Erreur setting prêt status:", error);
      showNotification("Erreur: Impossible de se marquer comme prêt.");
    });
}
async function demarrerPartie() {
  updateLastActive();
  let deck = Array.from({ length: 98 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);
  const joueursList = Object.entries(etatPartie.joueurs);
  const mainsInit = Array.from({length: 4}).fill([]); // Initialise un tableau de 4 tableaux vides
  joueursList.forEach(([,j]) => {
      mainsInit[j.mainIndex] = deck.splice(0, 8);
  });

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

// Fonction modifiée pour supprimer la partie si elle est vide et en attente
async function quitterLobby() {
    console.log("DEBUG: Tentative de quitter le lobby.");
    if (!partieId || !pseudo) {
        console.log("DEBUG: partieId ou pseudo non définis, réinitialisation simple.");
        localStorage.removeItem('lastPartieId');
        localStorage.removeItem('lastPseudo');
        window.location.reload();
        return;
    }

    const joueurRef = db.ref(`parties/${partieId}/joueurs/${pseudo}`);
    try {
        await joueurRef.remove();
        console.log(`DEBUG: Joueur '${pseudo}' retiré de la partie '${partieId}'.`);

        // Vérifier si la partie est vide après le départ
        const joueursSnapshot = await db.ref(`parties/${partieId}/joueurs`).once('value');
        if (!joueursSnapshot.exists() || Object.keys(joueursSnapshot.val()).length === 0) {
            console.log(`DEBUG: Plus de joueurs dans la partie '${partieId}'. Vérification de l'état.`);
            // Plus de joueurs, récupérer l'état actuel de la partie pour décider de la suppression
            const partieSnapshot = await db.ref(`parties/${partieId}`).once('value');
            const partieData = partieSnapshot.val();

            if (partieData && partieData.etat === "attente") {
                await db.ref(`parties/${partieId}`).remove();
                console.log(`DEBUG: Partie '${partieId}' supprimée car vide et en attente.`);
                showNotification(`Partie '${partieId}' supprimée.`);
            } else if (partieData) {
                console.log(`DEBUG: Partie '${partieId}' n'est pas en attente (état: ${partieData.etat}), ne pas supprimer.`);
            } else {
                console.log(`DEBUG: La partie '${partieId}' n'existe plus (peut-être déjà supprimée par timeout ou autre).`);
            }
        } else {
            console.log(`DEBUG: Des joueurs restent dans la partie '${partieId}', ne pas supprimer.`);
        }
    } catch (error) {
        console.error("DEBUG: Erreur lors du retrait du joueur ou de la suppression de la partie:", error);
        showNotification("Erreur lors de la déconnexion de la partie.");
    } finally {
        localStorage.removeItem('lastPartieId');
        localStorage.removeItem('lastPseudo');
        window.location.reload(); // Recharger la page pour un nettoyage complet de l'état
    }
}


// Bloc de suppression automatique (notification visuelle si expiration)
function verifierSuppressionAuto() {
  // Nettoie l'intervalle existant pour éviter les doublons
  if (window.partieTimeoutInterval) {
    clearInterval(window.partieTimeoutInterval);
  }
  window.partieTimeoutInterval = setInterval(async () => {
    if (!partieId) return;
    const partieRef = db.ref(`parties/${partieId}`);
    const snap = await partieRef.child('lastActive').get();
    const last = snap.val();
    if (last && (Date.now() - last > PARTIE_TIMEOUT)) {
      await partieRef.remove();
      showNotification("La partie a expiré après 30 minutes d'inactivité.");
      localStorage.removeItem('lastPartieId');
      localStorage.removeItem('lastPseudo');
      window.location.reload();
    }
  }, 60 * 1000);
}

// Bloc d'écoute de la partie (notification visuelle si suppression)
function ecouterPartie() {
  // Détache le listener précédent pour éviter les listeners multiples
  if (window.firebasePartieListener) {
    db.ref(`parties/${partieId}`).off('value', window.firebasePartieListener);
  }

  const partieRef = db.ref(`parties/${partieId}`);
  window.firebasePartieListener = snapshot => {
    const data = snapshot.val();
    console.log("DEBUG: ecouterPartie - Données Firebase reçues:", data);

    if (!data) {
      showNotification("La partie a été supprimée ou expirée.");
      localStorage.removeItem('lastPartieId');
      localStorage.removeItem('lastPseudo');
      // S'assurer de rediriger proprement si la partie n'existe plus et qu'on n'est pas déjà sur le menu
      if (document.getElementById("jeu").style.display !== "none" || document.getElementById("lobby").style.display !== "none") {
        afficherMenuAccueil();
      }
      return;
    }
    etatPartie = data;
    joueurs = data.joueurs || {};
    historiqueCartesJouees = data.historique || [];

    // Si le joueur actuel n'est plus dans la liste des joueurs de la partie
    if (pseudo && !joueurs[pseudo]) {
        showNotification("Vous avez été déconnecté de la partie.");
        localStorage.removeItem('lastPartieId');
        localStorage.removeItem('lastPseudo');
        afficherMenuAccueil();
        afficherLobbyGlobal();
        return;
    }

    if (etatPartie.etat === "attente") {
      console.log("DEBUG: ecouterPartie - État: attente");
      montrerLobby();
      updateLobbyAffichage();
    } else if (etatPartie.etat === "en_cours") {
      console.log("DEBUG: ecouterPartie - État: en_cours");
      cacherLobby();
      updateInterfaceAvecEtat();
    } else if (etatPartie.etat === "terminee") {
      console.log("DEBUG: ecouterPartie - État: terminee");
      cacherLobby();
      afficherMessage("Partie terminée !");
      enableInteraction(false);
      localStorage.removeItem('lastPartieId');
      localStorage.removeItem('lastPseudo');
    }
  };
  partieRef.on('value', window.firebasePartieListener);
}

function afficherListeJoueurs(joueurs, mains, joueurActuel) {
  const div = document.getElementById("listeJoueurs");
  div.innerHTML = "<h3>Joueurs connectés :</h3><ul>";
  const joueursTries = Object.entries(joueurs).sort((a,b) => a[1].mainIndex - b[1].mainIndex);

  joueursTries.forEach(([nom, infos]) => {
    let mainIndex = infos.mainIndex;
    let nbcartes = mains && mains[mainIndex] ? mains[mainIndex].length : "?";
    div.innerHTML += `<li>
      ${nom}
      ${infos.isCreator ? "(créateur)" : ""}
      ${etatPartie.joueurActuel === mainIndex ? "<b> (joue)</b>" : ""}
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

// DEBUT MODIFICATION 4: updateInterfaceAvecEtat
function updateInterfaceAvecEtat() {
  if (!etatPartie) return;
  const mainIndex = joueurs[pseudo]?.mainIndex;

  if (mainIndex === undefined || mainIndex === null) {
      console.error("DEBUG: updateInterfaceAvecEtat - mainIndex est undefined ou null pour le pseudo actuel.");
      showNotification("Vous n'êtes plus dans cette partie.");
      localStorage.removeItem('lastPartieId');
      localStorage.removeItem('lastPseudo');
      afficherMenuAccueil();
      afficherLobbyGlobal();
      return;
  }

  // NOUVEAU: Assurez-vous que etatPartie.mains est un tableau
  if (etatPartie.mains && typeof etatPartie.mains === 'object' && !Array.isArray(etatPartie.mains)) {
      const tempMains = [];
      for (let i = 0; i < 4; i++) { // Assuming max 4 players (mainIndex 0 to 3)
         tempMains[i] = etatPartie.mains[i] || [];
      }
      etatPartie.mains = tempMains;
  } else if (!etatPartie.mains) {
      etatPartie.mains = [];
  }
  // FIN NOUVEAU

  afficherListeJoueurs(joueurs, etatPartie.mains, etatPartie.joueurActuel);
  updateAffichagePartie(
    etatPartie.mains[mainIndex],
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
// FIN MODIFICATION 4: updateInterfaceAvecEtat

// DEBUT MODIFICATION 5: updateAffichagePartie
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
  document.getElementById("info").innerText = `Joueur ${joueurActuelIndex + 1} - Cartes à jouer: ${cartesAJouerRestantes} - Deck: ${etatPartie.deck?.length || 0} cartes`;
  document.getElementById("btnFinTour").disabled = cartesAJouerRestantes > 0;
  document.getElementById("btnFinTour").onclick = finTour;
  document.getElementById("btnFinTour").style.display = "";

  // Vérifie l'absence de coup possible pour le joueur courant
  if (
    etatPartie.joueurActuel === joueurs[pseudo]?.mainIndex &&
    main.length > 0 &&
    aucunCoupPossible(main, pilesData)
  ) {
    afficherGameOverMulti();
  }
}
// FIN MODIFICATION 5: updateAffichagePartie

function enableInteraction(active) {
  const mainDiv = document.getElementById("main");
  const finTourBtn = document.getElementById("btnFinTour");
  if (active) {
    mainDiv.style.pointerEvents = "auto";
    finTourBtn.disabled = false;
  } else {
    mainDiv.style.pointerEvents = "none";
    carteSelectionnee = null;
    finTourBtn.disabled = true;
  }
}

function selectionnerCarte(c) {
  if (etatPartie.joueurActuel !== joueurs[pseudo]?.mainIndex) return;
  carteSelectionnee = carteSelectionnee === c ? null : c;
  updateAffichagePartie(
    etatPartie.mains[joueurs[pseudo].mainIndex],
    etatPartie.piles,
    etatPartie.joueurActuel,
    etatPartie.cartesAJouer
  );
}

// DEBUT MODIFICATION 6: poserCarteFirebase
async function poserCarteFirebase(pile) {
  if (carteSelectionnee === null) return;
  if (etatPartie.joueurActuel !== joueurs[pseudo]?.mainIndex) return;
  updateLastActive();
  const mainIndex = joueurs[pseudo].mainIndex;

  // NOUVEAU: Assurez-vous que etatPartie.mains est un tableau ici
  let mainsFirebase = etatPartie.mains;
  if (mainsFirebase && typeof mainsFirebase === 'object' && !Array.isArray(mainsFirebase)) {
      const tempMains = [];
      for (let i = 0; i < 4; i++) { // Assuming max 4 players
         tempMains[i] = mainsFirebase[i] || [];
      }
      mainsFirebase = tempMains;
  } else if (!mainsFirebase) {
      mainsFirebase = [];
  }
  // FIN NOUVEAU

  const main = [...mainsFirebase[mainIndex]];
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
  let nouvellesMains = [...mainsFirebase];
  nouvellesMains[mainIndex] = nouvelleMain;
  let nouveauxCartesAJouer = etatPartie.cartesAJouer - 1;

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
// FIN MODIFICATION 6: poserCarteFirebase

// DEBUT MODIFICATION 2: finTour (Multijoueur)
async function finTour() {
    if (etatPartie.cartesAJouer > 0) {
        alert(`Vous devez jouer encore ${etatPartie.cartesAJouer} carte(s)`);
        return;
    }
    updateLastActive();

    // NOUVEAU: Assurez-vous que etatPartie.mains est un tableau ici aussi
    let mains = etatPartie.mains;
    if (mains && typeof mains === 'object' && !Array.isArray(mains)) {
        const tempMains = [];
        // Assuming max 4 players (mainIndex 0 to 3) based on common game structure
        for (let i = 0; i < 4; i++) { // You might want to use Object.keys(etatPartie.joueurs).length if it reflects max possible mains
             tempMains[i] = mains[i] || [];
        }
        mains = tempMains;
    } else if (!mains) {
        mains = [];
    }
    // FIN NOUVEAU

    let deck = [...etatPartie.deck];
    const mainIndex = joueurs[pseudo].mainIndex;
    let main = [...mains[mainIndex]];

    // Vérification de la main vide pour le bonus
    const mainVideAvantPioche = main.length === 0;

    // Pioche les cartes pour revenir à 8 (ou moins si le deck est vide)
    while (main.length < 8 && deck.length > 0) {
        main.push(deck.pop());
    }
    mains[mainIndex] = main;

    let nouveauCartesAJouer;
    if (mainVideAvantPioche && main.length > 0) {
        // Bonus: 3 cartes supplémentaires à jouer si la main était vide avant la pioche
        nouveauCartesAJouer = Math.min(3, main.length) + 3;
        showNotification("Bonus ! Vous avez vidé votre main, +3 cartes à jouer ce tour !");
    } else {
        // Nombre de cartes normal pour le prochain tour
        nouveauCartesAJouer = Math.min(3, main.length);
    }

    // Vérification de la condition de victoire (si toutes les mains sont vides ET le deck est vide)
    const toutesMainsVides = mains.every(m => m.length === 0);
    if (toutesMainsVides && deck.length === 0) {
        await db.ref(`parties/${partieId}`).update({
            etat: "terminee",
            mains: mains,
            deck: deck,
            joueurActuel: etatPartie.joueurActuel,
            cartesAJouer: 0,
            lastActive: Date.now()
        });
        afficherMessage("Victoire collective !");
        return;
    }

    // Logique pour passer au joueur suivant
    let joueurCount = Object.keys(joueurs).length;
    let nouveauJoueurIndexCourant = etatPartie.joueurActuel;
    let nextPlayerMainIndex = -1;

    const joueursActifsIndexes = Object.values(joueurs)
                                    .map(j => j.mainIndex)
                                    .sort((a,b)=>a-b);

    for (let i = 0; i < joueurCount; i++) {
        nouveauJoueurIndexCourant = (nouveauJoueurIndexCourant + 1);
        if (nouveauJoueurIndexCourant >= 4) {
            nouveauJoueurIndexCourant = 0;
        }

        if (joueursActifsIndexes.includes(nouveauJoueurIndexCourant)) {
            nextPlayerMainIndex = nouveauJoueurIndexCourant;
            break;
        }
    }

    if (nextPlayerMainIndex === -1 && joueursActifsIndexes.length > 0) {
        nextPlayerMainIndex = joueursActifsIndexes[0];
    } else if (joueursActifsIndexes.length === 0) {
        console.error("Plus de joueurs actifs dans la partie.");
        return;
    }

    await db.ref(`parties/${partieId}`).update({
        mains: mains,
        deck: deck,
        joueurActuel: nextPlayerMainIndex,
        cartesAJouer: Math.min(3, mains[nextPlayerMainIndex]?.length || 0),
        lastActive: Date.now()
    });
}
// FIN MODIFICATION 2: finTour (Multijoueur)

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
    localStorage.removeItem('lastPartieId');
    localStorage.removeItem('lastPseudo');
    afficherMenuAccueil();
  };
}
// =============== RECONNEXION AUTOMATIQUE ===============
function checkReconnect() {
  console.log("DEBUG: checkReconnect() appelée.");
  const lastId = localStorage.getItem('lastPartieId');
  const lastPseudo = localStorage.getItem('lastPseudo');

  if (lastId && lastPseudo) {
    console.log(`DEBUG: Données de reconnexion trouvées - ID: ${lastId}, Pseudo: ${lastPseudo}`);
    db.ref('parties/' + lastId).once('value').then(snap => {
      if (snap.exists()) {
        const partieData = snap.val();
        console.log("DEBUG: checkReconnect - Partie existe. État:", partieData.etat);
        if (partieData.etat === "attente" || partieData.etat === "en_cours") {
          showNotification("Vous avez quitté une partie. Reconnexion automatique possible !");
          const reconnexion = confirm("Souhaitez-vous rejoindre la dernière partie (" + lastId + ") avec le pseudo " + lastPseudo + " ?");
          if (reconnexion) {
            console.log("DEBUG: Utilisateur a accepté la reconnexion. Pré-remplissage des champs.");
            document.getElementById("idPartie").value = lastId;
            document.getElementById("pseudo").value = lastPseudo;
            console.log("DEBUG: Appel de rejoindrePartie avec ID:", lastId, "Pseudo:", lastPseudo);
            rejoindrePartie(lastId, lastPseudo);
          } else {
            console.log("DEBUG: Utilisateur a refusé la reconnexion. Nettoyage localStorage.");
            localStorage.removeItem('lastPartieId');
            localStorage.removeItem('lastPseudo');
            afficherMenuAccueil();
            afficherLobbyGlobal();
          }
        } else {
          console.log("DEBUG: checkReconnect - Partie dans un état non rejoignable (terminée). Nettoyage localStorage.");
          localStorage.removeItem('lastPartieId');
          localStorage.removeItem('lastPseudo');
          showNotification("L'ancienne partie est terminée ou inaccessible.");
          afficherMenuAccueil();
          afficherLobbyGlobal();
        }
      } else {
        console.log("DEBUG: checkReconnect - L'ancienne partie n'existe plus dans Firebase. Nettoyage localStorage.");
        localStorage.removeItem('lastPartieId');
        localStorage.removeItem('lastPseudo');
        showNotification("L'ancienne partie n'existe plus ou a expiré.");
        afficherMenuAccueil();
        afficherLobbyGlobal();
      }
    }).catch(error => {
        console.error("DEBUG: Erreur lors de la vérification de reconnexion:", error);
        localStorage.removeItem('lastPartieId');
        localStorage.removeItem('lastPseudo');
        afficherMenuAccueil();
        afficherLobbyGlobal();
    });
  } else {
    console.log("DEBUG: Aucune donnée de reconnexion trouvée. Affichage du menu principal.");
    afficherMenuAccueil();
    afficherLobbyGlobal();
  }
}

// =============== INITIALISATION AU CHARGEMENT ===============
window.onload = () => {
  console.log("DEBUG: window.onload - Initialisation de l'application.");
  checkReconnect();

  document.getElementById("btnCreer").onclick = () => {
    const pseudoInput = document.getElementById("pseudo");
    const customIdInput = document.getElementById("customIdPartie");
    if (!pseudoInput.value.trim() || !customIdInput.value.trim()) return alert("Entrez un pseudo et un ID de partie");
    modeSolo = false;
    creerPartie(pseudoInput.value.trim(), customIdInput.value.trim());
  };
  document.getElementById("btnRejoindre").onclick = () => {
    const pseudoInput = document.getElementById("pseudo");
    const idPartieInput = document.getElementById("idPartie");
    if (!pseudoInput.value.trim() || !idPartieInput.value.trim()) return alert("Entrez pseudo et ID partie");
    modeSolo = false;
    rejoindrePartie(idPartieInput.value.trim(), idPartieInput.value.trim()); // Correction: utiliser pseudoInput.value.trim() pour pseudo
  };
  document.getElementById("btnSolo").onclick = ouvrirSoloModal;
  document.getElementById("btnLancerSolo").onclick = lancerPartieSolo;

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
      contenu.innerText = hist.slice().reverse().join("\n");
    }
    modal.style.display = "flex";
  };
  document.getElementById("btnCreerLobby").onclick = () => {
    document.getElementById("zoneLobbyAll").style.display = "none";
    document.getElementById("menuAccueil").style.display = "";
    document.getElementById("customIdPartie").focus();
  };
};
