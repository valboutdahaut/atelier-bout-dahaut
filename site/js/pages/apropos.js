// apropos.js — remplit la liste des formations et certifications de la page
// À propos depuis la clé "apropos-formations" de contenu_site.
//
// Une ligne saisie dans l'admin = une entrée affichée. Deux écritures sont
// acceptées, au choix de l'artisane :
//
//   2019 | CAP Tapissier d'ameublement | Greta de Chartres
//        -> mis en colonnes : date, intitulé, organisme
//   Stage de garniture traditionnelle chez un Meilleur Ouvrier de France
//        -> affiché tel quel, sur toute la largeur
//
// La barre verticale reste donc facultative : aucune saisie ne peut casser la
// mise en page, ce qui est la promesse faite à l'admin sur tout le site.

import { supabase } from '../supabase-client.js';

const sectionEl = document.querySelector('.apropos-formations');
const listeEl = document.getElementById('formations-liste');

function creerLigne(texte) {
  const li = document.createElement('li');
  li.className = 'formation-ligne';

  const colonnes = texte.split('|').map((c) => c.trim()).filter(Boolean);

  // Sans séparateur, la ligne entière est l'intitulé : pas de colonne date,
  // l'intitulé occupe alors toute la largeur (voir .formation-ligne.pleine).
  if (colonnes.length === 1) {
    li.classList.add('pleine');
    const titre = document.createElement('span');
    titre.className = 'formation-titre';
    titre.textContent = colonnes[0];
    li.append(titre);
    return li;
  }

  const [date, intitule, ...reste] = colonnes;

  const dateEl = document.createElement('span');
  dateEl.className = 'formation-date';
  dateEl.textContent = date;

  const titreEl = document.createElement('span');
  titreEl.className = 'formation-titre';
  titreEl.textContent = intitule;

  li.append(dateEl, titreEl);

  // Tout ce qui suit l'intitulé (organisme, ville, mention) est regroupé sur
  // une seule ligne secondaire plutôt que d'inventer une colonne par élément.
  if (reste.length > 0) {
    const lieuEl = document.createElement('span');
    lieuEl.className = 'formation-lieu';
    lieuEl.textContent = reste.join(' · ');
    li.append(lieuEl);
  }

  return li;
}

async function afficherFormations() {
  const { data, error } = await supabase
    .from('contenu_site')
    .select('valeur')
    .eq('cle', 'apropos-formations')
    .maybeSingle();

  if (error) {
    console.error('apropos.js : impossible de charger les formations', error);
    listeEl.innerHTML = '<li class="empty-state" style="text-align:left">Impossible de charger cette section pour le moment.</li>';
    return;
  }

  const lignes = (data?.valeur ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Tant qu'aucune formation n'est saisie, la section entière disparaît :
  // mieux vaut une page plus courte qu'un titre suivi d'un vide.
  if (lignes.length === 0) {
    sectionEl.hidden = true;
    return;
  }

  listeEl.innerHTML = '';
  for (const ligne of lignes) listeEl.append(creerLigne(ligne));
}

afficherFormations();
