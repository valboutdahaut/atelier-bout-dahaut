// legal.js — remplit les pages légales (mentions légales, politique de
// confidentialité, CGU et CGV) depuis contenu_site.
//
// Un seul script pour les trois pages. Chaque rubrique de la page est une
// <section data-cle="..."> dont le titre est fixé dans le HTML et dont seul le
// texte se modifie depuis l'administration. Découper ainsi plutôt que d'avoir
// un seul grand champ par page a deux avantages : l'artisane remplit des cases
// courtes et nommées au lieu d'un pavé, et elle n'a aucune syntaxe de titre à
// apprendre puisque les titres ne lui appartiennent pas.
//
// Une rubrique vide disparaît entièrement de la page. Mieux vaut une page plus
// courte qu'un titre suivi d'un « à compléter » vu par les visiteurs.
//
// Le HTML contient déjà le texte des rubriques connues. Si la base ne répond
// pas, le visiteur voit donc quand même des mentions valides : leur présence
// est une obligation légale, elle ne peut pas dépendre d'un service extérieur.

import { supabase } from '../supabase-client.js';
import { rendreMarkdownLite } from '../lib/markdown-lite.js';

const sections = Array.from(document.querySelectorAll('.legal-section[data-cle]'));
const messageVide = document.querySelector('[data-slot="page-vide"]');

function ajusterMessageVide() {
  if (!messageVide) return;
  // Une page dont toutes les rubriques sont vides n'afficherait qu'un titre
  // seul, ce qui ressemble à une page cassée. On l'annonce plutôt clairement.
  messageVide.hidden = sections.some((s) => !s.hidden);
}

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

  ajusterMessageVide();
}

charger();
