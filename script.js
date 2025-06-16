// --- Firebase Initialization ---
// You NEED to replace 'YOUR_API_KEY', 'YOUR_PROJECT_ID', 'YOUR_APP_ID'
// with your actual Firebase project configuration.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const { ref, set, get, child, update, onValue, push } = firebase.database; // Firebase Realtime Database methods

// --- Game State Variables ---
let partie = {
    idPartie: null,
    createur: null, // To identify the host
    statut: 'en attente', // 'en attente', 'en cours', 'finie'
    joueurs: {}, // Ex: { pseudo: { pseudo: 'nom', pret: false, main: [], estActif: false } }
    piles: {
        montante1: 1,
        montante2: 1,
        descendante1: 100,
        descendante2: 100
    },
    cartesDansPioche: 0,
    nombreTotalCartesDeck: 98,
    deckActuel: [], // The actual shuffled deck
    cartesJoueesCeTour: 0,
    modeSolo: false,
    nombreJoueursSolo: 1
};

// --- Utility Functions ---

function genererDeck() {
    const deck = [];
    for (let i = 2; i <= 99; i++) {
        deck.push(i);
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// --- UI Display Functions ---

function afficherCartesRestantes() {
    const cartesRestantesElem = document.getElementById('cartesRestantesPioche');
    if (cartesRestantesElem) {
        cartesRestantesElem.textContent = `Cartes restantes dans la pioche: ${partie.cartesDansPioche}`;
    }
}

function showSection(id) {
    document.getElementById('menuAccueil').style.display = 'none';
    document.getElementById('zoneLobbyAll').style.display = 'none';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('jeu').style.display = 'none';
    document.getElementById(id).style.display = 'block';
}

function showNotification(message) {
    const notificationArea = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.textContent = message;
    notificationArea.appendChild(notification);

    notification.addEventListener('animationend', () => {
        notification.remove();
    });
}

function afficherJoueursLobby() {
    const lobbyJoueursDiv = document.getElementById('lobbyJoueurs');
    lobbyJoueursDiv.innerHTML = ''; // Clear previous content

    if (partie.joueurs) {
        for (const pseudo in partie.joueurs) {
            const joueur = partie.joueurs[pseudo];
            const p = document.createElement('p');
            p.textContent = `${joueur.pseudo} ${joueur.pret ? ' (Prêt!)' : ' (Pas prêt)'}`;
            lobbyJoueursDiv.appendChild(p);
        }
    }
}

function mettreAJourBoutonDemarrer() {
    const btnDemarrer = document.getElementById('btnDemarrer');
    const pseudoActuel = document.getElementById('pseudo').value;
    const joueursArray = Object.values(partie.joueurs || {});
    
    const tousPrets = joueursArray.length > 0 && joueursArray.every(j => j.pret);
    const assezDeJoueurs = joueursArray.length >= 2; // At least 2 players for multiplayer

    // Only host sees the button, and only if all are ready and enough players
    if (partie.createur === pseudoActuel && tousPrets && assezDeJoueurs) {
        btnDemarrer.style.display = 'block';
    } else {
        btnDemarrer.style.display = 'none';
    }
}


// --- Firebase Logic ---

// Function to create a new game in Firebase
async function creerPartieFirebase(pseudo, customId) {
    const partieRef = customId ? ref(db, 'parties/' + customId) : push(ref(db, 'parties'));
    const partieId = customId || partieRef.key;

    try {
        await set(partieRef, {
            id: partieId,
            createur: pseudo,
            statut: 'en attente',
            joueurs: {
                [pseudo]: {
                    pseudo: pseudo,
                    pret: false,
                    main: []
                }
            },
            piles: { montante1: 1, montante2: 1, descendante1: 100, descendante2: 100 },
            cartesDansPioche: 0, // Will be set when game starts
            deckActuel: [] // Will be set when game starts
        });
        partie.idPartie = partieId;
        partie.createur = pseudo; // Set creator for the current player
        showNotification(`Partie créée! ID: ${partieId}`);
        ecouterChangementsPartie(partieId); // Start listening for changes
        showSection('lobby');
    } catch (error) {
        console.error("Erreur lors de la création de la partie:", error);
        showNotification("Erreur lors de la création de la partie.");
    }
}

// Function to join an existing game in Firebase
async function rejoindrePartieFirebase(pseudo, idPartie) {
    try {
        const partieSnapshot = await get(child(ref(db, 'parties'), idPartie));
        if (partieSnapshot.exists()) {
            const data = partieSnapshot.val();
            if (data.statut !== 'en attente') {
                showNotification("Cette partie est déjà en cours ou terminée.");
                return;
            }
            if (Object.keys(data.joueurs || {}).length >= 4) { // Max 4 players example
                 showNotification("Cette partie est pleine.");
                 return;
            }
            
            const joueursRef = ref(db, `parties/${idPartie}/joueurs/${pseudo}`);
            await set(joueursRef, {
                pseudo: pseudo,
                pret: false,
                main: []
            });
            partie.idPartie = idPartie;
            partie.createur = data.createur; // Sync creator from Firebase
            showNotification(`Partie ${idPartie} rejointe!`);
            ecouterChangementsPartie(idPartie); // Start listening for changes
            showSection('lobby');
        } else {
            showNotification("La partie n'existe pas !");
        }
    } catch (error) {
        console.error("Erreur lors de la jointure de la partie:", error);
        showNotification("Erreur lors de la jointure de la partie.");
    }
}

// Listener for real-time updates from Firebase for the current game
function ecouterChangementsPartie(partieId) {
    const partieRef = ref(db, 'parties/' + partieId);
    onValue(partieRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            partie = { ...partie, ...data }; // Update local 'partie' state
            afficherJoueursLobby(); // Update lobby UI
            mettreAJourBoutonDemarrer(); // Update Start button visibility
            afficherCartesRestantes(); // Update card count (for in-game view)

            // Transition to game view if game status changes to 'en cours'
            if (partie.statut === 'en cours' && document.getElementById('jeu').style.display === 'none') {
                 showSection('jeu');
                 // You might need to call a function here to draw the initial game state
                 // e.g., dessinerPiles(), dessinerMainDuJoueur(partie.joueurs[document.getElementById('pseudo').value].main);
            }
        } else {
            console.log("Partie introuvable ou supprimée.");
            showNotification("La partie a été supprimée ou n'existe plus.");
            showSection('menuAccueil'); // Go back to main menu
        }
    });
}

// --- Game Logic ---

// This function should be called when a NEW game starts (after players are ready)
function initialiserNouvellePartie(nombreDeJoueursReels) {
    partie.deckActuel = genererDeck(); // Generate and shuffle a new deck

    let cartesParJoueur;
    if (nombreDeJoueursReels === 1) {
        cartesParJoueur = 8;
    } else if (nombreDeJoueursReels === 2) {
        cartesParJoueur = 7;
    } else { // 3 or 4 players (assuming max 4 for this version based on HTML)
        cartesParJoueur = 6;
    }

    // Distribute initial cards to players' hands
    // This is a critical part you need to adapt to your player management.
    // Loop through partie.joueurs and deal cards from partie.deckActuel
    for (const pseudo in partie.joueurs) {
        const mainJoueur = [];
        for (let j = 0; j < cartesParJoueur; j++) {
            if (partie.deckActuel.length > 0) {
                mainJoueur.push(partie.deckActuel.shift());
            }
        }
        partie.joueurs[pseudo].main = mainJoueur; // Assign hand to player
    }

    // Calculate remaining cards in the deck after initial distribution
    partie.cartesDansPioche = partie.nombreTotalCartesDeck - (nombreDeJoueursReels * cartesParJoueur);
    afficherCartesRestantes();

    // Reset piles (values are already set in partie.piles, just need to update UI)
    // You'll need a function to draw these on screen, e.g., `dessinerPiles()`
    // For now, let's just make sure the values are initialized in Firebase if the game starts.

    partie.cartesJoueesCeTour = 0;
    // Set the first active player, etc.
}

// Function to draw cards from the deck for a player's hand
function piocherCartesPourMain(joueurPseudo, nombreDeCartesAPiocher) {
    let cartesPiochees = [];
    if (!partie.joueurs[joueurPseudo]) {
        console.error(`Joueur ${joueurPseudo} non trouvé.`);
        return [];
    }

    // Make sure the deck is synced with Firebase if it's a multiplayer game
    if (!partie.modeSolo && partie.idPartie) {
        // In a real multiplayer game, you'd fetch the deck from Firebase,
        // draw cards, then update Firebase. For simplicity here, we assume partie.deckActuel is synced.
    }

    for (let i = 0; i < nombreDeCartesAPiocher; i++) {
        if (partie.deckActuel.length > 0) {
            const cartePiochee = partie.deckActuel.shift();
            cartesPiochees.push(cartePiochee);
            partie.cartesDansPioche--;
        } else {
            console.log("La pioche est vide !");
            showNotification("La pioche est vide!");
            break;
        }
    }

    // Add drawn cards to the player's hand (local update)
    partie.joueurs[joueurPseudo].main.push(...cartesPiochees);

    // IMPORTANT: Update Firebase with the new deck, new card count, and updated player hand
    if (partie.idPartie) { // Only update if it's a networked game
        update(ref(db, 'parties/' + partie.idPartie), {
            deckActuel: partie.deckActuel,
            cartesDansPioche: partie.cartesDansPioche,
            [`joueurs/${joueurPseudo}/main`]: partie.joueurs[joueurPseudo].main // Update specific player's hand
        }).catch(error => console.error("Erreur mise à jour Firebase pioche:", error));
    }

    afficherCartesRestantes();
    // You need a function to redraw the player's hand on the UI
    // e.g., dessinerMainDuJoueur(partie.joueurs[joueurPseudo].main);
    return cartesPiochees;
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    const pseudoInput = document.getElementById('pseudo');
    const customIdPartieInput = document.getElementById('customIdPartie');
    const idPartieInput = document.getElementById('idPartie');
    const themeToggle = document.getElementById('themeToggle');

    // Load pseudo from localStorage if available
    const savedPseudo = localStorage.getItem('pseudo');
    if (savedPseudo) {
        pseudoInput.value = savedPseudo;
    }
    pseudoInput.addEventListener('input', () => {
        localStorage.setItem('pseudo', pseudoInput.value);
    });

    // Handle Create Game button
    document.getElementById('btnCreer').addEventListener('click', async () => {
        const pseudo = pseudoInput.value;
        const customId = customIdPartieInput.value;
        if (!pseudo) {
            showNotification("Veuillez entrer un pseudo.");
            return;
        }
        await creerPartieFirebase(pseudo, customId);
    });

    // Handle Join Game button
    document.getElementById('btnRejoindre').addEventListener('click', async () => {
        const pseudo = pseudoInput.value;
        const idPartie = idPartieInput.value;
        if (!pseudo || !idPartie) {
            showNotification("Veuillez entrer un pseudo et l'ID de la partie.");
            return;
        }
        await rejoindrePartieFirebase(pseudo, idPartie);
    });

    // Handle Solo Mode button
    document.getElementById('btnSolo').addEventListener('click', () => {
        document.getElementById('soloModal').style.display = 'flex';
    });

    // Handle Launch Solo Game button
    document.getElementById('btnLancerSolo').addEventListener('click', () => {
        const nbJoueursSolo = parseInt(document.getElementById('nbJoueurs').value);
        if (isNaN(nbJoueursSolo) || nbJoueursSolo < 1 || nbJoueursSolo > 4) {
            showNotification("Veuillez entrer un nombre de joueurs valide (1-4).");
            return;
        }
        partie.modeSolo = true;
        partie.nombreJoueursSolo = nbJoueursSolo;
        partie.idPartie = 'solo-' + Date.now(); // Unique ID for solo game (not sent to Firebase)
        partie.createur = pseudoInput.value || 'JoueurSolo'; // Set a pseudo for solo player
        partie.joueurs = {
            [partie.createur]: { pseudo: partie.createur, pret: true, main: [] }
        };

        document.getElementById('soloModal').style.display = 'none';
        showSection('jeu');
        initialiserNouvellePartie(nbJoueursSolo); // Use nbJoueursSolo for deck calculation
        showNotification("Partie solo lancée!");
        // You'll need to implement actual game start for solo here (drawing cards, enabling buttons etc.)
        piocherCartesPourMain(partie.createur, 8); // Example: deal 8 cards to solo player
        document.getElementById('btnFinTour').disabled = false; // Enable end turn for solo
    });

    // Handle "Je suis prêt!" button in lobby
    document.getElementById('btnPret').addEventListener('click', async () => {
        const currentPseudo = pseudoInput.value;
        if (partie.idPartie && currentPseudo) {
            const joueurPretRef = ref(db, `parties/${partie.idPartie}/joueurs/${currentPseudo}/pret`);
            const estPretActuel = partie.joueurs[currentPseudo]?.pret || false;
            await set(joueurPretRef, !estPretActuel)
                .then(() => showNotification(`Vous êtes maintenant ${!estPretActuel ? 'Prêt!' : 'Pas prêt.'}`))
                .catch(error => console.error("Erreur état prêt:", error));
        }
    });

    // Handle "Démarrer la partie" button in lobby (only visible to host when players are ready)
    document.getElementById('btnDemarrer').addEventListener('click', async () => {
        if (partie.idPartie && partie.createur === pseudoInput.value) {
            const nombreDeJoueursActifs = Object.keys(partie.joueurs).length;
            
            // Re-initialize for game start (generates deck, distributes hands, updates local count)
            initialiserNouvellePartie(nombreDeJoueursActifs);

            // Update Firebase with the new game state (deck, card count, player hands)
            await update(ref(db, 'parties/' + partie.idPartie), {
                statut: 'en cours',
                deckActuel: partie.deckActuel,
                cartesDansPioche: partie.cartesDansPioche,
                joueurs: partie.joueurs // Update all player hands in Firebase
            }).then(() => {
                showNotification("La partie commence!");
            }).catch(error => console.error("Erreur démarrage partie Firebase:", error));
            
            showSection('jeu'); // Switch to game view
            document.getElementById('btnFinTour').disabled = false; // Enable end turn button
        }
    });

    // Handle "Quitter la salle" button in lobby
    document.getElementById('btnQuitterLobby').addEventListener('click', async () => {
        if (partie.idPartie && pseudoInput.value) {
            const currentPseudo = pseudoInput.value;
            // Remove player from the party
            await set(ref(db, `parties/${partie.idPartie}/joueurs/${currentPseudo}`), null)
                .then(() => {
                    showNotification("Vous avez quitté la partie.");
                    showSection('menuAccueil');
                    partie = { // Reset local state
                        idPartie: null, createur: null, statut: 'en attente', joueurs: {},
                        piles: { montante1: 1, montante2: 1, descendante1: 100, descendante2: 100 },
                        cartesDansPioche: 0, nombreTotalCartesDeck: 98, deckActuel: [], cartesJoueesCeTour: 0,
                        modeSolo: false, nombreJoueursSolo: 1
                    };
                })
                .catch(error => console.error("Erreur quitter lobby:", error));
        }
    });

    // Handle "Fin du tour" button
    document.getElementById('btnFinTour').addEventListener('click', () => {
        const currentPseudo = pseudoInput.value; // Assuming current player is this pseudo
        const cardsToDraw = 2; // Example: player must draw 2 cards
        piocherCartesPourMain(currentPseudo, cardsToDraw);
        showNotification(`Vous avez pioché ${cardsToDraw} cartes.`);
        // You'll need to implement logic to pass the turn to the next player
    });

    // Theme toggle
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                document.body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // Show the initial menu
    showSection('menuAccueil');

    // Initial check for existing game if user refreshed page (advanced, optional)
    // You might want to try to rejoin based on localStorage partieId if available.
});


// --- Placeholder Game UI Update Functions (you will need to implement these fully) ---

// Function to draw the player's hand cards on the UI
function dessinerMainDuJoueur(main) {
    const mainDiv = document.getElementById('main');
    mainDiv.innerHTML = ''; // Clear existing cards
    main.sort((a, b) => a - b); // Keep hand sorted for better play
    main.forEach(cardValue => {
        const cardElem = document.createElement('div');
        cardElem.classList.add('carte');
        cardElem.textContent = cardValue;
        // Add event listener for card clicks (select card)
        // cardElem.addEventListener('click', () => selectCard(cardValue, cardElem));
        mainDiv.appendChild(cardElem);
    });
}

// Function to draw the piles on the UI
function dessinerPiles() {
    const pilesDiv = document.getElementById('piles');
    pilesDiv.innerHTML = ''; // Clear existing piles

    // Example for one ascending and one descending pile
    // You'll need to iterate through all four piles (montante1, montante2, descendante1, descendante2)
    const pileMontante1 = document.createElement('div');
    pileMontante1.classList.add('pile', 'montante');
    pileMontante1.dataset.pileType = 'montante1';
    pileMontante1.textContent = partie.piles.montante1;
    // pileMontante1.addEventListener('click', () => placeCardOnPile('montante1'));
    pilesDiv.appendChild(pileMontante1);

    const pileDescendante1 = document.createElement('div');
    pileDescendante1.classList.add('pile', 'descendante');
    pileDescendante1.dataset.pileType = 'descendante1';
    pileDescendante1.textContent = partie.piles.descendante1;
    // pileDescendante1.addEventListener('click', () => placeCardOnPile('descendante1'));
    pilesDiv.appendChild(pileDescendante1);

    // Add remaining piles (montante2, descendante2) similarly
}

// You will also need:
// - `selectCard(cardValue, cardElement)`: To handle selecting a card from hand.
// - `placeCardOnPile(pileType)`: To handle placing a selected card on a pile.
// - `checkWinCondition()` and `checkLoseCondition()`
// - Full turn management (who's active, how many cards played per turn, etc.)
