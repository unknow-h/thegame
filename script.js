// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC67w7K6BqcNkBh4yeNd4OfgvjAw_neO4k",
  authDomain: "the-game-30e6d.firebaseapp.com",
  databaseURL: "https://the-game-30e6d-default-rtdb.firebaseio.com",
  projectId: "the-game-30e6d",
  storageBucket: "the-game-30e6d.firebasestorage.app",
  messagingSenderId: "222102581853",
  appId: "1:222102581853:web:a211cfbed9dadc3cfe13b4",
  measurementId: "G-L2G22DJQFZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

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
async function creerPartie(pseudoJoueur) {
  const partiesRef = ref(db, 'parties');
  const nouvellePartieRef = push(partiesRef);
  partieId = nouvellePartieRef.key;

  const deckInit = Array.from({ length: 98 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);

  const mainsInit = [
    deckInit.splice(0, 8),
    deckInit.splice(0, 8),
    deckInit.splice(0, 8),
    deckInit.splice(0, 8)
  ];

  const pilesInit = [
    { id: 1, type: 'montante', value: 1 },
    { id: 2, type: 'montante', value: 1 },
    { id: 3, type: 'descendante', value: 100 },
    { id: 4, type: 'descendante', value: 100 }
  ];

  // Données initiales partie
  const partieData = {
    joueurs: {
      [pseudoJoueur]: { prêt: false, isCreator: true, mainIndex: 0 }
    },
    mains: mainsInit,
    piles: pilesInit,
    deck: deckInit,
    joueurActuel: 0,
    cartesAJouer: 3,
    etat: "attente" // ou "en_cours", "terminee"
  };

  await set(nouvellePartieRef, partieData);
  pseudo = pseudoJoueur;

  ecouterPartie();
  afficherMessage(`Partie créée. ID : ${partieId}`);
}

// Rejoindre une partie existante
async function rejoindrePartie(idPartie, pseudoJoueur) {
  partieId = idPartie;
  pseudo = pseudoJoueur;

  const joueursRef = ref(db, `parties/${partieId}/joueurs`);

  try {
    await runTransaction(joueursRef, joueurs => {
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
    afficherMessage(`Rejoint la partie ${partieId} avec le pseudo ${pseudo}`);
  } catch (e) {
    alert("Erreur en rejoignant la partie : " + e);
  }
}

// Écouter la partie pour synchro en temps réel
function ecouterPartie() {
  const partieRef = ref(db, `parties/${partieId}`);
  onValue(partieRef, snapshot => {
    const data = snapshot.val();
    if (!data) {
      alert("Partie supprimée ou inexistante.");
      return;
    }
    etatPartie = data;
    joueurs = data.joueurs || {};

    updateInterfaceAvecEtat();
  });
}

// Met à jour l'interface selon l'état Firebase reçu
function updateInterfaceAvecEtat() {
  if (!etatPartie) return;

  // Affiche liste joueurs
  afficherListeJoueurs(joueurs);

  if (etatPartie.etat === "attente") {
    afficherMessage("En attente des joueurs...");
  } else if (etatPartie.etat === "en_cours") {
    // Met à jour la partie de jeu en cours
    cartesAJouer = etatPartie.cartesAJouer;
    // Trouve l'index main du joueur connecté
    const mainIndex = joueurs[pseudo]?.mainIndex;
    if (mainIndex === undefined) {
      alert("Tu n'es pas dans cette partie !");
      return;
    }
    // Met à jour mains, piles, joueurActuel
    // Toutes ces données sont synchronisées depuis Firebase
    updateAffichagePartie(
      etatPartie.mains[mainIndex],
      etatPartie.piles,
      etatPartie.joueurActuel,
      cartesAJouer
    );

    if (etatPartie.joueurActuel === joueurs[pseudo].mainIndex) {
      // C’est ton tour !
      enableInteraction(true);
    } else {
      enableInteraction(false);
      afficherMessage(`Tour du joueur ${etatPartie.joueurActuel + 1}`);
    }
  } else if (etatPartie.etat === "terminee") {
    afficherMessage("Partie terminée !");
    enableInteraction(false);
  }
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

  document.querySelector("button[onclick='finTour()']").disabled = cartesAJouerRestantes > 0;
}

function enableInteraction(active) {
  const mainDiv = document.getElementById("main");
  if (active) {
    mainDiv.style.pointerEvents = "auto";
  } else {
    mainDiv.style.pointerEvents = "none";
    carteSelectionnee = null;
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
  await update(ref(db, `parties/${partieId}`), {
    piles: nouvellesPiles,
    mains: nouvellesMains,
    deck: nouveauDeck,
    cartesAJouer: nouveauxCartesAJouer
  });

  carteSelectionnee = null;

  // Si plus de cartes dans main et deck vide -> victoire possible à gérer (à toi d'ajouter)

  // Pas besoin d'updateInterface ici : la DB va pousser les mises à jour
}

async function finTour() {
  if (etatPartie.cartesAJouer > 0) {
    alert(`Vous devez jouer encore ${etatPartie.cartesAJouer} carte(s)`);
    return;
  }
  let nouveauJoueur = (etatPartie.joueurActuel + 1) % 4;

  // Assure que le nouveau joueur est dans la partie (sinon on boucle)
  const joueursKeys = Object.values(joueurs).map(j => j.mainIndex);
  while (!joueursKeys.includes(nouveauJoueur)) {
    nouveauJoueur = (nouveauJoueur + 1) % 4;
  }

  await update(ref(db, `parties/${partieId}`), {
    joueurActuel: nouveauJoueur,
    cartesAJouer: Math.min(3, etatPartie.mains[nouveauJoueur]?.length || 0)
  });
}

/////////////////////////
// CONTROLEURS UI MENU
/////////////////////////

function handleCreerPartie() {
  const pseudoInput = document.getElementById("pseudo");
  if (!pseudoInput.value.trim()) return alert("Entrez un pseudo");
  creerPartie(pseudoInput.value.trim());
  cacherMenuAccueil();
}

function handleRejoindrePartie() {
  const pseudoInput = document.getElementById("pseudo");
  const idPartieInput = document.getElementById("idPartie");
  if (!pseudoInput.value.trim() || !idPartieInput.value.trim()) return alert("Entrez pseudo et ID partie");
  rejoindrePartie(idPartieInput.value.trim(), pseudoInput.value.trim());
  cacherMenuAccueil();
}

function cacherMenuAccueil() {
  document.getElementById("menuAccueil").style.display = "none";
  document.getElementById("jeu").style.display = "block";
}

function afficherMenuAccueil() {
  document.getElementById("menuAccueil").style.display = "block";
  document.getElementById("jeu").style.display = "none";
}

// AU DEMARRAGE
window.onload = () => {
  afficherMenuAccueil();
};
