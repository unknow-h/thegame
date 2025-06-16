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

let partieId = null, pseudo = null, joueurs = {}, etatPartie = null, carteSelectionnee = null;
// La valeur initiale de cartesAJouer devrait être 3, mais elle est gérée par Firebase/Solo State
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
    zone.style.display = "flex"; // Changed to flex to use CSS flex properties
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
                <span><b><span class="math-inline">\{id\}</b\> \(</span>{Object.keys(data.joueurs||{}).length} joueur${Object.keys(data.joueurs||{}).length>1?'s':''})</span>
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
    joueurs: [], // main: [] pour chaque joueur
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
    if(zoneLobby) zoneLobby.style.display = "flex"; // Ensure it shows
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
    const nbBots = 4 - nbHumains; // Not directly used but good for clarity
    solo.deck = Array.from({ length: 98 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);
    solo.piles = [
        { id: 1, type: 'montante', value: 1 },
        { id: 2, type: 'montante', value: 1 },
        { id: 3, type: 'descendante', value: 100 },
        { id: 4, type: 'descendante', value: 100 }
    ];
    solo.joueurs = [];
    for (let i = 0; i < 4; i++) {
        solo.joueurs.push({
            main: solo.deck.splice(0, 8)
        });
    }
    solo.bots = Array.from({ length: 4 }, (_, i) => i >= nbHumains);
    solo.joueurActuel = 0;
    solo.cartesAJouer = Math.min(3, solo.joueurs[solo.joueurActuel].main.length);
    carteSelectionnee = null;
    solo.historique = [];
    updateAffichageSolo();
    if (solo.bots[solo.joueurActuel]) jouerBotSolo();
}

function updateAffichageSolo() {
    // Règle 1: Compteur de cartes à piocher
    document.getElementById("info").innerText = `Joueur <span class="math-inline">\{solo\.joueurActuel \+ 1\} \(</span>{solo.bots[solo.joueurActuel] ? 'Bot' : 'Humain'}) - Cartes à jouer: ${solo.cartesAJouer} | Deck: ${solo.deck.length} cartes`;

    const zonePiles = document.getElementById("piles");
    zonePiles.innerHTML = '';
    solo.piles.forEach(pile => {
        const div = document.createElement("div");
        div.className = `pile ${pile.type}`;
        div.innerText = `<span class="math-inline">\{pile\.type \=\=\= 'montante' ? '\+' \: '\-'\}\\n</span>{pile.value}`;
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

    document.getElementById("listeJoueurs").innerHTML = ""; // This should be populated by displayJoueursListSolo
    // Temporarily disable this, it causes conflicts with afficherListeJoueurs in multi
    // document.getElementById("message").innerHTML = ""; 

    document.getElementById("btnFinTour").onclick = finTourSolo;
    document.getElementById("btnFinTour").disabled = solo.cartesAJouer > 0;
    document.getElementById("btnFinTour").style.display = "";

    // Afficher les joueurs dans le mode solo
    displayJoueursListSolo(solo.joueurs, solo.joueurActuel, solo.bots);

    // Vérifie l'absence de coup possible
    if (
        !solo.bots[solo.joueurActuel] &&
        solo.joueurs[solo.joueurActuel].main.length > 0 &&
        aucunCoupPossible(solo.joueurs[solo.joueurActuel].main, solo.piles)
    ) {
        afficherGameOverSolo();
    }
}

// Helper for solo mode to show player hands count
function displayJoueursListSolo(joueursSolo, joueurActuelIndex, botsStatus) {
    const div = document.getElementById("listeJoueurs");
    div.innerHTML = "<h3>Joueurs :</h3><ul>";
    joueursSolo.forEach((joueur, index) => {
        const nom = (botsStatus[index] ? "Bot " : "Humain ") + (index + 1);
        let nbcartes = joueur.main.length;
        div.innerHTML += `<li>
            ${nom}
            <span class="math-inline">\{joueurActuelIndex \=\=\= index ? "<b\> \(joue\)</b\>" \: ""\}
&mdash; <span style\="color\:\#888;"\></span>{nbcartes} carte${nbcartes > 1 ? 's' : ''}</span>
        </li>`;
    });
    div.innerHTML += "</ul>";
}


function selectionnerCarteSolo(c) {
    if (solo.bots[solo.joueurActuel]) return;
    carteSelectionnee = carteSelectionnee ===
