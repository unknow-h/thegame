let historiqueCartesJouees = [];

let deck = [],
  joueurs = [],
  piles = [],
  joueurActuel = 0,
  cartesAJouer = 3,
  bots = [];
let carteSelectionnee = null;

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function initJeuAvecBots() {
  const nbHumains = parseInt(document.getElementById("nbJoueurs").value);
  const nbBots = 4 - nbHumains;
  bots = Array.from({ length: 4 }, (_, i) => i >= nbHumains);
  document.getElementById("setupModal").style.display = "none";
  initJeu();
}

function initJeu() {
  deck = Array.from({ length: 98 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);
  piles = [
    { id: 1, type: "montante", value: 1 },
    { id: 2, type: "montante", value: 1 },
    { id: 3, type: "descendante", value: 100 },
    { id: 4, type: "descendante", value: 100 },
  ];
  joueurs = Array.from({ length: 4 }, () => ({ main: deck.splice(0, 8) }));
  joueurActuel = 0;
  cartesAJouer = 3;
  carteSelectionnee = null;
  updateAffichage();
  if (bots[joueurActuel]) jouerBot();
}

function updateAffichage() {
  document.getElementById("info").innerText = `Joueur ${joueurActuel + 1} (${bots[joueurActuel] ? "Bot" : "Humain"}) - Cartes à jouer: ${cartesAJouer}`;
  const zonePiles = document.getElementById("piles");
  zonePiles.innerHTML = "";
  piles.forEach((pile) => {
    const div = document.createElement("div");
    div.className = `pile ${pile.type}`;
    div.innerText = `${pile.type === "montante" ? "+" : "-"}\n${pile.value}`;
    div.onclick = () => poserCarte(pile);
    zonePiles.appendChild(div);
  });

  const main = document.getElementById("main");
  main.className = "main";
  main.innerHTML = "";

  const mainTriee = [...joueurs[joueurActuel].main].sort((a, b) => a - b);
  let cartesSpec = new Set();

  for (let c of mainTriee) {
    for (let pile of piles) {
      if (Math.abs(c - pile.value) === 10) cartesSpec.add(c);
    }
    for (let autre of mainTriee) {
      if (c !== autre && Math.abs(c - autre) === 10) cartesSpec.add(c);
    }
  }

  mainTriee.forEach((c) => {
    const carte = document.createElement("div");
    carte.className = "carte";
    carte.innerText = c;
    carte.onclick = () => selectionnerCarte(c);
    if (cartesSpec.has(c)) carte.style.backgroundColor = "#ffe066";
    if (c === carteSelectionnee) carte.classList.add("selected");
    main.appendChild(carte);
  });

  document.getElementById("pioche").innerText = `Cartes dans la pioche : ${deck.length}`;
  document.querySelector("button[onclick='finTour()']").disabled = cartesAJouer > 0;
}

function selectionnerCarte(c) {
  if (bots[joueurActuel]) return;
  carteSelectionnee = carteSelectionnee === c ? null : c;
  updateAffichage();
}

function poserCarte(pile) {
  if (carteSelectionnee === null || bots[joueurActuel]) return;
  if (jouerCarte(pile, carteSelectionnee)) {
    carteSelectionnee = null;
    updateAffichage();
  }
}

function jouerCarte(pile, carte) {
  let top = pile.value;
  if (pile.type === "montante" && (carte > top || carte === top - 10)) {
    pile.value = carte;
  } else if (pile.type === "descendante" && (carte < top || carte === top + 10)) {
    pile.value = carte;
  } else {
    return false;
  }

  historiqueCartesJouees.push(`Joueur ${joueurActuel + 1} ➜ ${carte} sur pile ${pile.id} (${pile.type})`);

  let main = joueurs[joueurActuel].main;
  main.splice(main.indexOf(carte), 1);
  cartesAJouer--;
  if (deck.length > 0) main.push(deck.pop());
  if (main.length === 0 && deck.length === 0) alert("Victoire collective !");
  return true;
}

function finTour() {
  if (cartesAJouer > 0) return;
  joueurActuel = (joueurActuel + 1) % 4;
  cartesAJouer = Math.min(3, joueurs[joueurActuel].main.length);
  carteSelectionnee = null;
  updateAffichage();
  if (bots[joueurActuel]) jouerBot();
}

function jouerBot() {
  let main = joueurs[joueurActuel].main;
  let choix = [];
  for (let carte of main) {
    for (let pile of piles) {
      let top = pile.value;
      let ok =
        (pile.type === "montante" && (carte > top || carte === top - 10)) ||
        (pile.type === "descendante" && (carte < top || carte === top + 10));
      if (ok) choix.push({ carte, pile, ecart: Math.abs(carte - top) });
    }
  }
  choix.sort((a, b) => a.ecart - b.ecart);
  let jouees = 0;
  function jouerUne() {
    if (jouees >= 3 || choix.length === 0) return finTour();
    let { carte, pile } = choix.shift();
    if (jouerCarte(pile, carte)) {
      updateAffichage();
      jouees++;
      setTimeout(jouerUne, 300);
    } else {
      jouerUne();
    }
  }
  jouerUne();
}

function afficherAide() {
  alert(
    `OBJECTIF:\nJouez toutes les cartes (2-99) sur 4 piles.\n\nPILES:\n- 2 montantes (+): poser une carte plus grande\n- 2 descendantes (-): poser une carte plus petite\n\nREGLES:\n- Vous devez jouer au moins 3 cartes par tour.\n- Vous pouvez faire un saut de 10 en arriere.\n- Pioche automatique après pose si cartes dispo.\n- Les cartes avec un ecart de 10 sont en jaune.\n\nVICTOIRE : toutes les cartes ont ete jouees.`
  );
}

function afficherHistorique() {
  alert(historiqueCartesJouees.length === 0 ? "Aucun coup joué pour l'instant." : historiqueCartesJouees.join("\n"));
}
