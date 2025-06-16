// Initialisation des variables globales
let pseudo;
let partieId;
let partieRef;
let etatPartie; // État de la partie récupéré de Firebase
let carteSelectionnee = null;
let modeSombreActif = false;
let solo = null; // Pour le mode solo

// Références aux éléments du DOM
const pseudoInput = document.getElementById('pseudoInput');
const partieIdInput = document.getElementById('partieIdInput');
const creerPartieBtn = document.getElementById('creerPartie');
const rejoindrePartieBtn = document.getElementById('rejoindrePartie');
const modeSoloBtn = document.getElementById('modeSolo');
const jeuContainer = document.getElementById('jeu-container');
const accueilContainer = document.getElementById('accueil-container');
const modeSombreToggle = document.getElementById('modeSombreToggle');
const joueurActuelSpan = document.getElementById('joueurActuel');
const cartesAJouerSpan = document.getElementById('cartesAJouer');
const deckCountSpan = document.getElementById('deckCount');
const finTourBtn = document.getElementById('finTour');
const historiqueBtn = document.getElementById('historiqueBtn');
const historiqueModal = document.getElementById('historiqueModal');
const closeHistorique = document.querySelector('.close-historique');
const historiqueContent = document.getElementById('historiqueContent');
const joueursConnectesList = document.getElementById('joueursConnectesList');
const notificationContainer = document.getElementById('notificationContainer');


// --- Initialisation Firebase ---
// Votre configuration Firebase (Assurez-vous que c'est bien configuré)
// firebase.initializeApp(firebaseConfig); // Assurez-vous que firebaseConfig est défini quelque part
const db = firebase.database();


// --- Fonctions utilitaires ---

// Fonction pour mélanger un tableau (algorithme de Fisher-Yates)
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Génère un ID unique pour la partie
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 9);
}

// Affiche une notification temporaire
function showNotification(message, isError = false) {
    notificationContainer.textContent = message;
    notificationContainer.className = 'notification ' + (isError ? 'error' : 'success');
    notificationContainer.style.display = 'block';
    setTimeout(() => {
        notificationContainer.style.display = 'none';
    }, 3000);
}

// Met à jour le timestamp de la dernière activité (pour la gestion des parties inactives)
async function updateLastActive() {
    if (partieId && pseudo) {
        await db.ref(`parties/${partieId}/lastActive`).set(Date.now());
    }
}

// Fonction pour ajouter un message à l'historique de la partie
async function ajouterHistorique(message) {
    if (partieId) {
        const historiqueRef = db.ref(`parties/${partieId}/historique`);
        await historiqueRef.push({
            timestamp: Date.now(),
            message: message
        });
    } else if (solo) {
        solo.historique.push({
            timestamp: Date.now(),
            message: message
        });
        updateHistoriqueAffichage(); // Mettre à jour l'affichage de l'historique en mode solo
    }
}


// --- Fonctions de gestion de l'interface et du jeu ---

// Initialise l'affichage des piles
function initialiserPiles() {
    const pilesContainer = document.getElementById('piles');
    pilesContainer.innerHTML = ''; // Nettoie les piles existantes

    for (let i = 0; i < 4; i++) {
        const pileDiv = document.createElement('div');
        pileDiv.classList.add('pile');
        pileDiv.dataset.index = i;

        const pileType = document.createElement('div');
        pileType.classList.add('pile-type');
        pileType.textContent = (i < 2) ? 'Montante' : 'Descendante'; // 0,1 Montante; 2,3 Descendante

        const pileValue = document.createElement('div');
        pileValue.classList.add('pile-value');
        pileValue.textContent = ''; // Sera mis à jour par updatePilesAffichage

        pileDiv.appendChild(pileType);
        pileDiv.appendChild(pileValue);
        pilesContainer.appendChild(pileDiv);
    }
}

// Met à jour l'affichage des piles
function updatePilesAffichage(piles) {
    if (!piles) return;
    document.querySelectorAll('.pile').forEach((pileDiv, index) => {
        pileDiv.querySelector('.pile-value').textContent = piles[index];
    });
}

// Met à jour l'affichage de la main du joueur
function updateMainAffichage(main, cartesAJouer) {
    const mainJoueurDiv = document.getElementById('mainJoueur');
    mainJoueurDiv.innerHTML = ''; // Nettoie la main existante

    if (!main) {
        // console.warn("La main du joueur est undefined ou null.");
        return;
    }

    // Assurez-vous que 'main' est un tableau, même si Firebase le renvoie comme un objet
    let mainArray = Array.isArray(main) ? main : Object.values(main || {});
    mainArray = mainArray.filter(card => card !== null && card !== undefined); // Nettoyer les valeurs null/undefined

    mainArray.sort((a, b) => a - b).forEach(carte => {
        const carteDiv = document.createElement('div');
        carteDiv.classList.add('carte');
        carteDiv.textContent = carte;
        carteDiv.dataset.value = carte;

        // Si la carte est sélectionnée, ajoutez la classe 'selected'
        if (carteSelectionnee && carteSelectionnee.value == carte) { // Comparaison avec == pour type coercion
            carteDiv.classList.add('selected');
        }

        // Ajoutez la classe 'highlight' si c'est une carte spéciale (+/- 10)
        if (carteSelectionnee) {
            const pileIndex = carteSelectionnee.pileIndex;
            const pileValue = (etatPartie || solo).piles[pileIndex];
            const diff = Math.abs(carte - pileValue);
            if (diff === 10) {
                carteDiv.classList.add('highlight');
            }
        }

        // Écouteur d'événement pour la sélection/désélection de carte
        carteDiv.addEventListener('click', () => {
            if (carteSelectionnee && carteSelectionnee.value == carteDiv.dataset.value) {
                // Désélectionner la carte si elle est déjà sélectionnée
                carteSelectionnee = null;
                document.querySelectorAll('.carte').forEach(c => c.classList.remove('selected', 'highlight'));
            } else {
                // Sélectionner la nouvelle carte
                carteSelectionnee = { value: parseInt(carteDiv.dataset.value) };
                document.querySelectorAll('.carte').forEach(c => c.classList.remove('selected', 'highlight'));
                carteDiv.classList.add('selected');

                // Mettre en évidence les piles valides pour la carte sélectionnée
                const piles = document.querySelectorAll('.pile');
                piles.forEach((pileDiv, index) => {
                    const pileValue = parseInt(pileDiv.querySelector('.pile-value').textContent);
                    const isMontante = index < 2;
                    const isValidMove = isMoveValid(carteSelectionnee.value, pileValue, isMontante);

                    if (isValidMove) {
                        pileDiv.classList.add('highlight-valid');
                    } else {
                        pileDiv.classList.remove('highlight-valid');
                    }
                });
            }
        });

        mainJoueurDiv.appendChild(carteDiv);
    });

    // Mettre à jour l'affichage du nombre de cartes à jouer
    cartesAJouerSpan.textContent = cartesAJouer;
}


// Met à jour l'affichage des joueurs connectés
function updateJoueursConnectes(joueurs) {
    joueursConnectesList.innerHTML = '';
    if (!joueurs) return;

    // Assurez-vous que 'joueurs' est un objet itérable
    const joueursArray = Object.keys(joueurs).map(key => ({ pseudo: key, ...joueurs[key] }));

    joueursArray.forEach(joueur => {
        const li = document.createElement('li');
        li.textContent = `${joueur.pseudo} (${joueur.main ? joueur.main.length : 0} carte(s))`;
        if (etatPartie && etatPartie.joueurActuel !== undefined && joueur.mainIndex === etatPartie.joueurActuel) {
            li.classList.add('current-player');
        }
        joueursConnectesList.appendChild(li);
    });
}

// Met à jour l'affichage de l'historique
function updateHistoriqueAffichage() {
    historiqueContent.innerHTML = '';
    const historiqueData = solo ? solo.historique : (etatPartie ? etatPartie.historique : {});

    if (!historiqueData) {
        historiqueContent.textContent = "Pas d'historique disponible.";
        return;
    }

    // Convertir l'objet historique en tableau et trier par timestamp
    const historiqueArray = Object.values(historiqueData).sort((a, b) => a.timestamp - b.timestamp);

    historiqueArray.forEach(item => {
        const p = document.createElement('p');
        const date = new Date(item.timestamp).toLocaleTimeString();
        p.textContent = `[${date}] ${item.message}`;
        historiqueContent.appendChild(p);
    });
    historiqueContent.scrollTop = historiqueContent.scrollHeight; // Scroll to bottom
}

// Fonction pour afficher des messages
function afficherMessage(message) {
    alert(message); // Peut être remplacé par une modale plus sophistiquée
}

// Fonction pour vérifier si un mouvement est valide
function isMoveValid(carte, pileValue, isMontante) {
    if (isMontante) {
        return carte > pileValue || carte === pileValue - 10;
    } else {
        return carte < pileValue || carte === pileValue + 10;
    }
}


// --- Logique du jeu (Multiplayer) ---

// Crée une nouvelle partie dans Firebase
async function creerPartie() {
    pseudo = pseudoInput.value.trim();
    if (!pseudo) {
        showNotification("Veuillez entrer un pseudo.", true);
        return;
    }

    partieId = generateUniqueId();
    const deck = shuffle(Array.from({ length: 98 }, (_, i) => i + 2)); // Cartes 2 à 99
    const piles = [1, 1, 100, 100]; // Deux piles montantes, deux descendantes
    const mains = {}; // Les mains des joueurs seront stockées ici
    const joueurs = {}; // Informations sur les joueurs

    joueurs[pseudo] = {
        pseudo: pseudo,
        isCreator: true,
        mainIndex: 0, // Le créateur prend la main 0
        pret: false // Le joueur doit confirmer être prêt
    };

    await db.ref(`parties/${partieId}`).set({
        deck: deck,
        piles: piles,
        mains: mains,
        joueurs: joueurs,
        joueurActuel: -1, // Pas de joueur actuel au début, attend que la partie commence
        cartesAJouer: 0,
        etat: "attente", // "attente", "en_cours", "terminee"
        historique: {},
        lastActive: Date.now()
    });

    partieRef = db.ref(`parties/${partieId}`);
    partieRef.on('value', snapshot => {
        etatPartie = snapshot.val();
        if (etatPartie) {
            updateInterfaceAvecEtat();
        }
    });

    showNotification(`Partie créée ! ID: ${partieId}. Partagez cet ID.`);
    accueilContainer.style.display = 'none';
    jeuContainer.style.display = 'block';
    initialiserPiles();
    await ajouterHistorique(`${pseudo} a créé la partie.`);
}

// Rejoindre une partie existante
async function rejoindrePartie() {
    pseudo = pseudoInput.value.trim();
    const inputPartieId = partieIdInput.value.trim();

    if (!pseudo || !inputPartieId) {
        showNotification("Veuillez entrer un pseudo et l'ID de la partie.", true);
        return;
    }

    const snapshot = await db.ref(`parties/${inputPartieId}`).once('value');
    const partieExistante = snapshot.val();

    if (!partieExistante) {
        showNotification("Partie introuvable.", true);
        return;
    }

    if (partieExistante.etat === "en_cours") {
        showNotification("La partie est déjà en cours. Impossible de rejoindre.", true);
        return;
    }

    partieId = inputPartieId;
    partieRef = db.ref(`parties/${partieId}`);

    const joueursActuels = partieExistante.joueurs || {};
    const nbJoueurs = Object.keys(joueursActuels).length;

    if (nbJoueurs >= 4) {
        showNotification("La partie est pleine (max 4 joueurs).", true);
        return;
    }

    if (joueursActuels[pseudo]) {
        showNotification("Vous êtes déjà dans cette partie.", true);
        // Si déjà dans la partie, mettez à jour l'interface
        partieRef.on('value', snapshot => {
            etatPartie = snapshot.val();
            if (etatPartie) {
                updateInterfaceAvecEtat();
            }
        });
        accueilContainer.style.display = 'none';
        jeuContainer.style.display = 'block';
        initialiserPiles();
        return;
    }

    // Assigner la prochaine mainIndex disponible
    let nouvelleMainIndex = 0;
    const existingMainIndexes = Object.values(joueursActuels).map(j => j.mainIndex);
    while (existingMainIndexes.includes(nouvelleMainIndex)) {
        nouvelleMainIndex++;
    }

    await db.ref(`parties/${partieId}/joueurs/${pseudo}`).set({
        pseudo: pseudo,
        isCreator: false,
        mainIndex: nouvelleMainIndex,
        pret: false // Doit confirmer être prêt
    });

    partieRef.on('value', snapshot => {
        etatPartie = snapshot.val();
        if (etatPartie) {
            updateInterfaceAvecEtat();
        }
    });

    showNotification(`Vous avez rejoint la partie ${partieId}.`);
    accueilContainer.style.display = 'none';
    jeuContainer.style.display = 'block';
    initialiserPiles();
    await ajouterHistorique(`${pseudo} a rejoint la partie.`);

    // Demander au joueur de confirmer qu'il est prêt
    const pretConfirmation = confirm("Êtes-vous prêt à commencer la partie ?");
    if (pretConfirmation) {
        await db.ref(`parties/${partieId}/joueurs/${pseudo}/pret`).set(true);
        showNotification("Vous êtes marqué comme prêt.");
    }
}

// Met à jour l'interface en fonction de l'état de la partie Firebase
function updateInterfaceAvecEtat() {
    if (!etatPartie) return;

    updatePilesAffichage(etatPartie.piles);
    deckCountSpan.textContent = etatPartie.deck ? etatPartie.deck.length : 0;
    updateJoueursConnectes(etatPartie.joueurs);
    updateHistoriqueAffichage(); // Met à jour l'historique

    const monJoueurData = etatPartie.joueurs ? etatPartie.joueurs[pseudo] : null;
    const maMainIndex = monJoueurData ? monJoueurData.mainIndex : -1;

    // IMPORTANT: Firebase peut stocker les tableaux avec des clés numériques comme des objets.
    // Assurez-vous de convertir mains en tableau si nécessaire.
    let mainsAsArray = [];
    if (etatPartie.mains && typeof etatPartie.mains === 'object') {
        for (let i = 0; i < 4; i++) { // Supposons max 4 joueurs/mains
            mainsAsArray[i] = etatPartie.mains[i] || [];
        }
    }

    const maMain = mainsAsArray[maMainIndex] || [];
    updateMainAffichage(maMain, etatPartie.cartesAJouer);

    const estMonTour = (etatPartie.joueurActuel === maMainIndex);

    if (estMonTour) {
        joueurActuelSpan.textContent = `C'est VOTRE tour !`;
        finTourBtn.style.display = 'block';
        document.getElementById('mainJoueur').classList.remove('disabled');
        document.querySelectorAll('.pile').forEach(pileDiv => pileDiv.classList.remove('disabled'));
    } else {
        const joueurActuelPseudo = Object.values(etatPartie.joueurs || {}).find(j => j.mainIndex === etatPartie.joueurActuel)?.pseudo || 'Inconnu';
        joueurActuelSpan.textContent = `C'est le tour de ${joueurActuelPseudo}`;
        finTourBtn.style.display = 'none';
        document.getElementById('mainJoueur').classList.add('disabled');
        document.querySelectorAll('.pile').forEach(pileDiv => pileDiv.classList.add('disabled'));
    }

    // Gestion du démarrage de la partie (par le créateur)
    if (monJoueurData && monJoueurData.isCreator && etatPartie.etat === "attente") {
        const tousPrets = Object.values(etatPartie.joueurs || {}).every(j => j.pret);
        const nbJoueursActuels = Object.keys(etatPartie.joueurs || {}).length;
        if (tousPrets && nbJoueursActuels > 0) { // Au moins un joueur doit être prêt pour démarrer
            // Démarrer la partie
            distribuerCartesEtCommencer();
        }
    }
}

// Distribue les cartes et démarre la partie (appelé par le créateur une fois tous prêts)
async function distribuerCartesEtCommencer() {
    if (etatPartie.etat !== "attente") return;

    let deck = [...etatPartie.deck];
    const nouvellesMains = {};
    const joueursConnectes = Object.values(etatPartie.joueurs || {}).sort((a, b) => a.mainIndex - b.mainIndex);

    joueursConnectes.forEach(joueur => {
        const main = [];
        for (let i = 0; i < 8; i++) { // Chaque joueur pioche 8 cartes
            if (deck.length > 0) {
                main.push(deck.pop());
            }
        }
        nouvellesMains[joueur.mainIndex] = main;
    });

    // Déterminer le premier joueur (par exemple, celui avec l'index de main le plus bas)
    const premierJoueurIndex = joueursConnectes[0].mainIndex;

    await db.ref(`parties/${partieId}`).update({
        mains: nouvellesMains,
        deck: deck,
        joueurActuel: premierJoueurIndex,
        cartesAJouer: Math.min(3, nouvellesMains[premierJoueurIndex]?.length || 0), // Premier joueur doit jouer min 3 cartes
        etat: "en_cours",
        lastActive: Date.now()
    });
    await ajouterHistorique("La partie a commencé ! Les cartes ont été distribuées.");
}


// Logique pour poser une carte
async function poserCarte(pileIndex) {
    if (!carteSelectionnee) {
        showNotification("Veuillez sélectionner une carte à jouer.", true);
        return;
    }

    if (etatPartie.joueurActuel !== (etatPartie.joueurs[pseudo] ? etatPartie.joueurs[pseudo].mainIndex : -1)) {
        showNotification("Ce n'est pas votre tour !", true);
        return;
    }

    // Conversion robuste de `mains` pour s'assurer que c'est un tableau de tableaux
    let mains = etatPartie.mains;
    if (mains && typeof mains === 'object' && !Array.isArray(mains)) {
        const tempMains = [];
        for (let i = 0; i < 4; i++) { // Assume 4 possible hands
            tempMains[i] = mains[i] || []; // Ensure each hand is an array, default to empty
        }
        mains = tempMains;
    } else if (!mains) {
        mains = []; // Initialize as empty array if null/undefined
    }

    const maMainIndex = etatPartie.joueurs[pseudo].mainIndex;
    let maMain = [...(mains[maMainIndex] || [])]; // Copie de la main du joueur actuel

    const pileValue = etatPartie.piles[pileIndex];
    const isMontante = pileIndex < 2;
    const carteAJouerValue = carteSelectionnee.value;

    if (!isMoveValid(carteAJouerValue, pileValue, isMontante)) {
        showNotification("Mouvement invalide pour cette pile.", true);
        carteSelectionnee = null; // Désélectionner la carte après un mouvement invalide
        updateMainAffichage(maMain, etatPartie.cartesAJouer); // Rafraîchir l'affichage
        return;
    }

    // Vérifier si la carte est dans la main du joueur
    const carteIndexInMain = maMain.indexOf(carteAJouerValue);
    if (carteIndexInMain === -1) {
        showNotification("La carte sélectionnée n'est pas dans votre main.", true);
        carteSelectionnee = null;
        updateMainAffichage(maMain, etatPartie.cartesAJouer);
        return;
    }

    // Retirer la carte de la main
    maMain.splice(carteIndexInMain, 1);
    mains[maMainIndex] = maMain; // Mettre à jour la main dans la structure des mains

    // Mettre à jour la pile
    let nouvellesPiles = [...etatPartie.piles];
    nouvellesPiles[pileIndex] = carteAJouerValue;

    // Mettre à jour les cartes à jouer
    let nouvellesCartesAJouer = etatPartie.cartesAJouer - 1;

    // Mettre à jour Firebase
    await db.ref(`parties/${partieId}`).update({
        mains: mains,
        piles: nouvellesPiles,
        cartesAJouer: nouvellesCartesAJouer,
        lastActive: Date.now()
    });

    await ajouterHistorique(`${pseudo} a joué ${carteAJouerValue} sur la pile ${pileIndex + 1}.`);

    carteSelectionnee = null; // Réinitialiser la carte sélectionnée
    // updateInterfaceAvecEtat sera appelé par l'écouteur Firebase
}


// Fonction de fin de tour (Multiplayer)
async function finTour() {
    // Si le deck est vide et que la main du joueur actuel est vide et qu'il n'y a plus de cartes à jouer,
    // cela pourrait potentiellement être un scénario de fin de partie prématuré pour le joueur.
    // Cependant, la règle standard est de toujours jouer 3 cartes.
    // Le "problème de quand je pose toutes les cartes d'une main" est que `cartesAJouer` pourrait être 0
    // mais le joueur n'a pas encore pioché ses cartes.
    // La règle du jeu est que vous PIOCHEZ vos cartes à la fin de votre tour.
    // Ensuite, le prochain joueur prend son tour.

    // Vérifie si le joueur a joué le nombre minimum de cartes requis.
    // Si la main est vide, le joueur a réussi à jouer toutes ses cartes.
    // Dans The Game, si vous videz votre main, vous n'avez plus besoin de jouer d'autres cartes ce tour.
    const maMainIndex = joueurs[pseudo].mainIndex;
    let maMainActuelle = etatPartie.mains ? (Array.isArray(etatPartie.mains) ? etatPartie.mains[maMainIndex] : Object.values(etatPartie.mains)[maMainIndex] || []) : [];

    // Si le joueur a vidé sa main ET il lui reste des cartes à jouer (ce qui est une contradiction si la règle est d'avoir 0 cartesAJouer pour finir)
    // C'est ici que la logique doit être plus précise: si la main est vide, le tour se termine même si `cartesAJouer` > 0.
    // MAIS, la condition `etatPartie.cartesAJouer > 0` est le MINIMUM à jouer.

    if (etatPartie.cartesAJouer > 0 && maMainActuelle.length > 0) {
        alert(`Vous devez jouer encore ${etatPartie.cartesAJouer} carte(s)`);
        return;
    }

    updateLastActive();

    // S'assurer que `mains` est un tableau d'arrays
    let mains = etatPartie.mains;
    if (mains && typeof mains === 'object' && !Array.isArray(mains)) {
        const tempMains = [];
        for (let i = 0; i < 4; i++) {
            tempMains[i] = mains[i] || [];
        }
        mains = tempMains;
    } else if (!mains) {
        mains = [];
    }

    let deck = [...etatPartie.deck];
    const mainIndex = joueurs[pseudo].mainIndex; // Index de la main du joueur actuel
    let mainDuJoueurActuel = [...mains[mainIndex]]; // Copie de la main du joueur actuel

    const mainVideAvantPioche = mainDuJoueurActuel.length === 0 && etatPartie.cartesAJouer <= 0; // Check si la main était vide APRES avoir joué

    // Pioche les cartes pour revenir à 8 (ou moins si le deck est vide)
    while (mainDuJoueurActuel.length < 8 && deck.length > 0) {
        mainDuJoueurActuel.push(deck.pop());
    }
    mains[mainIndex] = mainDuJoueurActuel; // Mettre à jour la main du joueur dans la structure globale des mains

    // Notification si le joueur a vidé sa main avant de piocher
    if (mainVideAvantPioche && mainDuJoueurActuel.length > 0) {
        showNotification("Bonus ! Vous avez vidé votre main et pioché de nouvelles cartes !");
        await ajouterHistorique(`${pseudo} a vidé sa main et a pioché.`);
    }

    // Vérifier la condition de victoire après que le joueur actuel ait pioché
    const toutesMainsVides = Object.values(mains).every(m => m.length === 0);
    if (toutesMainsVides && deck.length === 0) {
        await db.ref(`parties/${partieId}`).update({
            etat: "terminee",
            mains: mains, // Mettre à jour avec les mains finales
            deck: deck, // Mettre à jour avec le deck final
            joueurActuel: etatPartie.joueurActuel, // Dernier joueur qui a agi
            cartesAJouer: 0,
            lastActive: Date.now()
        });
        afficherMessage("Victoire collective ! Toutes les cartes ont été jouées.");
        await ajouterHistorique("Victoire collective ! La partie est terminée.");
        return;
    }

    // Passer au joueur suivant
    const joueursActifsIndexes = Object.values(etatPartie.joueurs)
                                    .map(j => j.mainIndex)
                                    .sort((a,b)=>a-b);

    let nouveauJoueurIndexCourant = etatPartie.joueurActuel;
    let nextPlayerMainIndex = -1;
    let foundNextPlayer = false;

    // Itérer pour trouver le prochain joueur actif
    for (let i = 0; i < joueursActifsIndexes.length; i++) {
        nouveauJoueurIndexCourant = (nouveauJoueurIndexCourant + 1);
        if (nouveauJoueurIndexCourant >= 4) { // Assurez-vous que l'index boucle de 0 à 3
            nouveauJoueurIndexCourant = 0;
        }

        if (joueursActifsIndexes.includes(nouveauJoueurIndexCourant)) {
            // Le joueur est actif, vérifions s'il peut jouer
            // Un joueur peut jouer s'il a des cartes en main OU si le deck n'est pas vide (pour piocher)
            // Ou si c'est le dernier joueur possible et qu'il n'y a plus de deck, il doit valider pour fin de partie.
            if ((mains[nouveauJoueurIndexCourant]?.length > 0) || (deck.length > 0 && mains[nouveauJoueurIndexCourant]?.length < 8)) {
                nextPlayerMainIndex = nouveauJoueurIndexCourant;
                foundNextPlayer = true;
                break;
            }
        }
    }

    if (!foundNextPlayer) {
        // Cas où aucun joueur suivant n'a été trouvé : potentiellement la fin de partie si personne ne peut jouer
        // Ou cela signifie que le deck est vide et tous les joueurs actifs ont leurs mains vides.
        // Ce cas devrait être couvert par la condition de victoire plus haut.
        // Si on arrive ici, c'est que la partie n'est pas terminée mais qu'il n'y a plus de mouvements possibles.
        afficherMessage("Plus aucun joueur ne peut jouer. Fin de la partie.");
        await ajouterHistorique("La partie s'est terminée car plus aucun joueur ne pouvait jouer.");
        await db.ref(`parties/${partieId}`).update({
            etat: "terminee",
            lastActive: Date.now()
        });
        return;
    }

    // Le nombre de cartes à jouer pour le prochain joueur est toujours 3 ou sa main si < 3.
    // Le "bonus" de vider sa main est la notification et la possibilité de refiller sa main.
    let cartesAJouerForNextPlayer = Math.min(3, mains[nextPlayerMainIndex]?.length || 0);
    if (cartesAJouerForNextPlayer === 0 && deck.length > 0) {
        // If next player has 0 cards but deck is not empty, they will draw, so they still need to play 3.
        cartesAJouerForNextPlayer = 3;
    }


    await db.ref(`parties/${partieId}`).update({
        mains: mains,
        deck: deck,
        joueurActuel: nextPlayerMainIndex,
        cartesAJouer: cartesAJouerForNextPlayer, // Le prochain joueur doit jouer 3 cartes ou sa main si < 3
        lastActive: Date.now()
    });

    await ajouterHistorique(`Le tour est passé au joueur avec la main ${nextPlayerMainIndex}.`);
}


// --- Fonctions du mode Solo ---

function creerPartieSolo() {
    pseudo = pseudoInput.value.trim(); // Utilisez le pseudo du joueur pour le mode solo
    if (!pseudo) {
        showNotification("Veuillez entrer un pseudo pour le mode solo.", true);
        return;
    }

    const deck = shuffle(Array.from({ length: 98 }, (_, i) => i + 2));
    const piles = [1, 1, 100, 100];
    const mains = {}; // Les mains des joueurs seront stockées ici
    const joueurs = {}; // Informations sur les joueurs

    // Configuration des joueurs pour le mode solo (joueur 0 = humain, 1, 2, 3 = bots)
    joueurs[pseudo] = { pseudo: pseudo, mainIndex: 0 };
    joueurs['Bot 1'] = { pseudo: 'Bot 1', mainIndex: 1 };
    joueurs['Bot 2'] = { pseudo: 'Bot 2', mainIndex: 2 };
    joueurs['Bot 3'] = { pseudo: 'Bot 3', mainIndex: 3 };

    // Distribution initiale des cartes
    const mainsInitiales = {};
    Object.values(joueurs).forEach(joueur => {
        const main = [];
        for (let i = 0; i < 8; i++) {
            if (deck.length > 0) {
                main.push(deck.pop());
            }
        }
        mainsInitiales[joueur.mainIndex] = main;
    });


    solo = {
        deck: deck,
        piles: piles,
        mains: mainsInitiales,
        joueurs: joueurs,
        joueurActuel: 0, // Le joueur humain commence
        cartesAJouer: 3,
        etat: "en_cours",
        historique: [],
        bots: {
            1: true,
            2: true,
            3: true
        }
    };

    accueilContainer.style.display = 'none';
    jeuContainer.style.display = 'block';
    initialiserPiles();
    updateAffichageSolo();
    ajouterHistorique(`${pseudo} a commencé une partie solo.`);
}

// Met à jour l'affichage pour le mode solo
function updateAffichageSolo() {
    if (!solo) return;

    updatePilesAffichage(solo.piles);
    deckCountSpan.textContent = solo.deck.length;

    const maMain = solo.mains[solo.joueurs[pseudo].mainIndex];
    updateMainAffichage(maMain, solo.cartesAJouer);

    updateJoueursConnectesSolo(solo.joueurs, solo.mains, solo.joueurActuel);
    updateHistoriqueAffichage(); // Met à jour l'historique solo

    const joueurActuelSolo = Object.values(solo.joueurs).find(j => j.mainIndex === solo.joueurActuel);
    const estMonTour = (joueurActuelSolo.pseudo === pseudo);

    if (estMonTour) {
        joueurActuelSpan.textContent = `C'est VOTRE tour !`;
        finTourBtn.style.display = 'block';
        document.getElementById('mainJoueur').classList.remove('disabled');
        document.querySelectorAll('.pile').forEach(pileDiv => pileDiv.classList.remove('disabled'));
    } else {
        joueurActuelSpan.textContent = `C'est le tour de ${joueurActuelSolo.pseudo}`;
        finTourBtn.style.display = 'none';
        document.getElementById('mainJoueur').classList.add('disabled');
        document.querySelectorAll('.pile').forEach(pileDiv => pileDiv.classList.add('disabled'));
    }
}

// Met à jour l'affichage des joueurs connectés en mode solo
function updateJoueursConnectesSolo(joueurs, mains, joueurActuelIndex) {
    joueursConnectesList.innerHTML = '';
    Object.values(joueurs).forEach(joueur => {
        const li = document.createElement('li');
        const mainDuJoueur = mains[joueur.mainIndex] || []; // Obtenir la main par son index
        li.textContent = `${joueur.pseudo} (${mainDuJoueur.length} carte(s))`;
        if (joueur.mainIndex === joueurActuelIndex) {
            li.classList.add('current-player');
        }
        joueursConnectesList.appendChild(li);
    });
}


// Logique pour poser une carte en mode solo
function poserCarteSolo(pileIndex) {
    if (!carteSelectionnee) {
        showNotification("Veuillez sélectionner une carte à jouer.", true);
        return;
    }

    if (solo.joueurActuel !== solo.joueurs[pseudo].mainIndex) {
        showNotification("Ce n'est pas votre tour !", true);
        return;
    }

    let maMain = solo.mains[solo.joueurs[pseudo].mainIndex];
    const pileValue = solo.piles[pileIndex];
    const isMontante = pileIndex < 2;
    const carteAJouerValue = carteSelectionnee.value;

    if (!isMoveValid(carteAJouerValue, pileValue, isMontante)) {
        showNotification("Mouvement invalide pour cette pile.", true);
        carteSelectionnee = null;
        updateAffichageSolo();
        return;
    }

    const carteIndexInMain = maMain.indexOf(carteAJouerValue);
    if (carteIndexInMain === -1) {
        showNotification("La carte sélectionnée n'est pas dans votre main.", true);
        carteSelectionnee = null;
        updateAffichageSolo();
        return;
    }

    // Retirer la carte de la main
    maMain.splice(carteIndexInMain, 1);
    solo.piles[pileIndex] = carteAJouerValue;
    solo.cartesAJouer--;

    ajouterHistorique(`${pseudo} a joué ${carteAJouerValue} sur la pile ${pileIndex + 1}.`);

    carteSelectionnee = null;
    updateAffichageSolo();
}

// Fonction de fin de tour (Solo)
function finTourSolo() {
    // Si le joueur n'a pas joué le minimum de cartes et qu'il lui reste des cartes, il ne peut pas finir son tour.
    // Sauf s'il a vidé sa main.
    if (solo.cartesAJouer > 0 && solo.mains[solo.joueurActuel].length > 0) {
        alert(`Vous devez jouer encore ${solo.cartesAJouer} carte(s)`);
        return;
    }

    let mainDuJoueurActuel = solo.mains[solo.joueurActuel];
    const mainVideAvantPioche = mainDuJoueurActuel.length === 0 && solo.cartesAJouer <= 0; // Vérifie si la main est vide APRES avoir joué

    // Piocher les cartes pour revenir à 8
    while (mainDuJoueurActuel.length < 8 && solo.deck.length > 0) {
        mainDuJoueurActuel.push(solo.deck.pop());
    }

    // Notification si le joueur a vidé sa main
    if (mainVideAvantPioche && mainDuJoueurActuel.length > 0) {
        showNotification("Bonus ! Vous avez vidé votre main et pioché de nouvelles cartes !");
        ajouterHistorique(`${Object.values(solo.joueurs).find(j => j.mainIndex === solo.joueurActuel).pseudo} a vidé sa main et a pioché.`);
    }

    // Vérifier la condition de victoire *après* avoir pioché
    const toutesMainsVides = Object.values(solo.mains).every(m => m.length === 0);
    if (toutesMainsVides && solo.deck.length === 0) {
        setTimeout(() => afficherMessage("Victoire collective ! Toutes les cartes ont été jouées."), 300);
        ajouterHistorique("Victoire collective ! La partie est terminée.");
        return;
    }

    // Passer au joueur suivant
    solo.joueurActuel = (solo.joueurActuel + 1) % 4; // Boucle à travers les 4 joueurs
    carteSelectionnee = null;

    // Déterminer le nombre de cartes à jouer pour le prochain joueur
    let cartesAJouerPourProchain = Math.min(3, solo.mains[solo.joueurActuel].length);
    if (cartesAJouerPourProchain === 0 && solo.deck.length > 0) {
        // Si le prochain joueur n'a pas de cartes mais que le deck n'est pas vide, il piochera et devra jouer 3.
        cartesAJouerPourProchain = 3;
    }
    solo.cartesAJouer = cartesAJouerPourProchain;


    updateAffichageSolo();

    // Si c'est le tour d'un bot, le faire jouer
    if (solo.bots[solo.joueurActuel]) {
        setTimeout(jouerBotSolo, 1000); // Délai pour simuler la réflexion du bot
    }
}


// Logique de jeu du bot en mode solo
function jouerBotSolo() {
    if (!solo.bots[solo.joueurActuel]) return; // S'assurer que c'est bien un bot

    let botMain = solo.mains[solo.joueurActuel];
    let cartesJoueesCeTour = 0;
    const botPseudo = Object.values(solo.joueurs).find(j => j.mainIndex === solo.joueurActuel).pseudo;

    // Tant que le bot doit jouer des cartes et qu'il a des cartes en main
    while (solo.cartesAJouer > 0 && botMain.length > 0) {
        let playedCard = false;
        // Tenter de jouer une carte - Stratégie simple: Jouer la plus petite possible sur une pile montante
        // ou la plus grande sur une pile descendante, en privilégiant le "saut de 10".

        // Priorité 1: Sauts de 10
        for (let i = 0; i < botMain.length; i++) {
            const carte = botMain[i];
            for (let p = 0; p < 4; p++) {
                const pileValue = solo.piles[p];
                const isMontante = p < 2;

                if ((isMontante && carte === pileValue - 10) || (!isMontante && carte === pileValue + 10)) {
                    solo.piles[p] = carte;
                    botMain.splice(i, 1);
                    solo.cartesAJouer--;
                    cartesJoueesCeTour++;
                    ajouterHistorique(`${botPseudo} a joué ${carte} (saut de 10) sur la pile ${p + 1}.`);
                    playedCard = true;
                    break;
                }
            }
            if (playedCard) break;
        }

        if (!playedCard) {
            // Priorité 2: Jouer une carte normale valide
            for (let i = 0; i < botMain.length; i++) {
                const carte = botMain[i];
                for (let p = 0; p < 4; p++) {
                    const pileValue = solo.piles[p];
                    const isMontante = p < 2;

                    if (isMoveValid(carte, pileValue, isMontante)) {
                        solo.piles[p] = carte;
                        botMain.splice(i, 1);
                        solo.cartesAJouer--;
                        cartesJoueesCeTour++;
                        ajouterHistorique(`${botPseudo} a joué ${carte} sur la pile ${p + 1}.`);
                        playedCard = true;
                        break;
                    }
                }
                if (playedCard) break;
            }
        }

        if (!playedCard) {
            // Le bot ne peut plus jouer de carte valide, même s'il lui reste des cartesAJouer ou des cartes en main
            // Cela indique une fin de tour forcée pour le bot, ou un game over si personne ne peut jouer.
            break;
        }
    }

    // Le bot a fini de jouer ses cartes pour ce tour (soit il a joué le min, soit il est bloqué)
    setTimeout(finTourSolo, 500); // Le bot termine son tour
}


// --- Événements et mode sombre ---

creerPartieBtn.addEventListener('click', creerPartie);
rejoindrePartieBtn.addEventListener('click', rejoindrePartie);
modeSoloBtn.addEventListener('click', creerPartieSolo);

finTourBtn.addEventListener('click', () => {
    if (solo) {
        finTourSolo();
    } else if (partieId) {
        finTour();
    }
});

historiqueBtn.addEventListener('click', () => {
    historiqueModal.style.display = 'block';
    updateHistoriqueAffichage(); // Assurez-vous que l'historique est à jour à l'ouverture
});

closeHistorique.addEventListener('click', () => {
    historiqueModal.style.display = 'none';
});

// Fermer la modale si l'utilisateur clique en dehors
window.addEventListener('click', (event) => {
    if (event.target === historiqueModal) {
        historiqueModal.style.display = 'none';
    }
});

// Écouteurs d'événements pour les piles (pour poser une carte)
document.getElementById('piles').addEventListener('click', (event) => {
    let target = event.target;
    // Remonter jusqu'à l'élément .pile si on a cliqué sur un enfant
    while (target && !target.classList.contains('pile')) {
        target = target.parentNode;
    }

    if (target && target.classList.contains('pile')) {
        const pileIndex = parseInt(target.dataset.index);
        if (solo) {
            poserCarteSolo(pileIndex);
        } else if (partieId) {
            poserCarte(pileIndex);
        }
    }
});

// Toggle Mode Sombre
modeSombreToggle.addEventListener('change', () => {
    modeSombreActif = modeSombreToggle.checked;
    document.body.classList.toggle('dark-mode', modeSombreActif);
    // Sauvegarder la préférence de l'utilisateur (optionnel)
    localStorage.setItem('darkMode', modeSombreActif);
});

// Charger la préférence de mode sombre au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        modeSombreActif = true;
        modeSombreToggle.checked = true;
        document.body.classList.add('dark-mode');
    } else {
        modeSombreActif = false;
        modeSombreToggle.checked = false;
        document.body.classList.remove('dark-mode');
    }
});

// Gestion des joueurs inactifs (à activer sur le serveur si besoin, ou pour des sessions courtes)
// setInterval(updateLastActive, 60000); // Met à jour toutes les minutes


// Petite aide pour le débogage: Affiche les règles
document.getElementById('aideBtn').addEventListener('click', () => {
    alert("Règles du Jeu (Simplifié):\n\n" +
        "Le but est de jouer toutes les cartes du deck et de vos mains sur les piles.\n" +
        "Il y a 4 piles: 2 Montantes (commencent à 1) et 2 Descendantes (commencent à 100).\n" +
        "Sur une pile Montante, vous devez jouer une carte de valeur supérieure.\n" +
        "Sur une pile Descendante, vous devez jouer une carte de valeur inférieure.\n" +
        "Exception: Vous pouvez toujours jouer une carte exactement 10 inférieure sur une pile montante (ex: 30 sur 40).\n" +
        "Et une carte exactement 10 supérieure sur une pile descendante (ex: 70 sur 60).\n" +
        "Chaque tour, vous devez jouer au moins 3 cartes (sauf si vous ne pouvez pas ou si vous videz votre main).\n" +
        "Si vous videz entièrement votre main, vous piochez de nouvelles cartes et continuez votre tour.\n" +
        "À la fin de votre tour, vous piochez pour avoir 8 cartes en main. Le tour passe au joueur suivant.\n" +
        "La partie se termine si le deck est vide et qu'aucun joueur ne peut jouer de carte, ou si toutes les cartes ont été jouées.");
});

// Pour la partie "pseudo" et "ID de la partie"
document.addEventListener('DOMContentLoaded', () => {
    // Tenter de récupérer le pseudo stocké localement
    const savedPseudo = localStorage.getItem('gamePseudo');
    if (savedPseudo) {
        pseudoInput.value = savedPseudo;
    }

    // Sauvegarder le pseudo lors de la saisie
    pseudoInput.addEventListener('input', () => {
        localStorage.setItem('gamePseudo', pseudoInput.value);
    });
});
