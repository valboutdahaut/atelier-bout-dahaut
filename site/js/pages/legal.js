// legal.js — remplit les pages légales (mentions légales, politique de
// confidentialité, conditions générales) depuis contenu_site.
//
// Un seul script pour les trois pages. Chaque rubrique est une
// <section data-cle="..."> dont le titre est fixé dans le HTML et dont seul le
// texte se modifie depuis l'administration. Découper ainsi plutôt que d'avoir
// un seul grand champ par page a deux avantages : l'artisane remplit des cases
// courtes et nommées au lieu d'un pavé, et elle n'a aucune syntaxe de titre à
// apprendre puisque les titres ne lui appartiennent pas.
//
// Une rubrique vide disparaît entièrement de la page. Mieux vaut une page plus
// courte qu'un titre suivi d'un « à compléter » vu par les visiteurs.
//
// Les pages mentions légales et confidentialité portent leur texte en secours
// dans le HTML : leur présence est une obligation légale et ne doit pas
// dépendre d'un service extérieur. Les conditions générales, elles, n'en ont
// pas : elles ne concernent que la vente, et si la base ne répond pas, la
// boutique ne peut de toute façon rien vendre, les produits venant de là aussi.

import { supabase } from '../supabase-client.js';
import { rendreMarkdownLite } from '../lib/markdown-lite.js';

const sections = Array.from(document.querySelectorAll('.legal-section[data-cle]'));
// Lignes d'une seule phrase, comme la date de mise à jour : du texte brut, pas
// de mise en forme, et le libellé qui l'introduit reste dans le HTML.
const lignesSimples = Array.from(document.querySelectorAll('[data-cle] [data-slot="texte-simple"]'))
  .map((span) => span.closest('[data-cle]'));

/**
 * Le message « rien à afficher » se calcule par volet et non par page : sur les
 * conditions générales, les deux onglets se remplissent indépendamment.
 */
function ajusterMessagesVides() {
  for (const message of document.querySelectorAll('[data-slot="page-vide"]')) {
    const portee = message.closest('.volet-legal') ?? document;
    const rubriques = Array.from(portee.querySelectorAll('.legal-section[data-cle]'));
    message.hidden = rubriques.some((s) => !s.hidden);
  }
}

// --- Onglets ----------------------------------------------------------------
// Présents uniquement sur la page des conditions générales. Ailleurs, cette
// partie ne trouve rien et ne fait rien.
const onglets = Array.from(document.querySelectorAll('.onglet-legal[data-volet]'));

function activerVolet(nom, deplacerFocus = false) {
  const cible = onglets.find((o) => o.dataset.volet === nom);
  if (!cible) return;

  for (const onglet of onglets) {
    const actif = onglet === cible;
    onglet.classList.toggle('actif', actif);
    onglet.setAttribute('aria-selected', String(actif));
    // Un seul onglet reste atteignable à la tabulation : la flèche sert à
    // passer de l'un à l'autre, c'est le fonctionnement attendu d'un groupe
    // d'onglets et ça évite de traverser tous les titres pour atteindre le
    // texte.
    onglet.tabIndex = actif ? 0 : -1;
    document.getElementById(onglet.getAttribute('aria-controls')).hidden = !actif;
  }
  if (deplacerFocus) cible.focus();
}

for (const [index, onglet] of onglets.entries()) {
  onglet.addEventListener('click', () => {
    activerVolet(onglet.dataset.volet);
    // L'adresse suit l'onglet ouvert, pour qu'un lien copié rouvre le bon.
    history.replaceState(null, '', `#${onglet.dataset.volet}`);
  });

  onglet.addEventListener('keydown', (e) => {
    const pas = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (pas === 0) return;
    e.preventDefault();
    const suivant = onglets[(index + pas + onglets.length) % onglets.length];
    activerVolet(suivant.dataset.volet, true);
  });
}

// Ouverture directe sur un onglet : /cgu-cgv.html#cgv depuis la case à cocher
// du tunnel de commande, #cgu depuis un lien de pied de page.
const ancre = window.location.hash.replace('#', '');
if (ancre) activerVolet(ancre);

// --- Contenu ----------------------------------------------------------------
async function charger() {
  if (sections.length === 0) return;

  const { data, error } = await supabase.from('contenu_site').select('cle, valeur');
  if (error) {
    console.error('legal.js : impossible de charger les textes', error);
    return; // les textes de secours du HTML restent affichés
  }

  const valeurs = new Map((data ?? []).map((r) => [r.cle, r.valeur]));

  for (const section of sections) {
    const valeur = valeurs.get(section.dataset.cle);
    if (valeur === undefined) continue; // clé absente : on garde le secours

    const texte = valeur.trim();
    if (texte === '') {
      section.hidden = true;
      continue;
    }
    section.querySelector('[data-slot="texte"]').innerHTML = rendreMarkdownLite(texte);
    section.hidden = false;
  }

  for (const ligne of lignesSimples) {
    const texte = (valeurs.get(ligne.dataset.cle) ?? '').trim();
    ligne.querySelector('[data-slot="texte-simple"]').textContent = texte;
    ligne.hidden = texte === '';
  }

  ajusterMessagesVides();
}

charger();
