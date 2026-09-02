// site-content.js — hydrate les textes génériques éditables par l'admin
// (hero, bio de l'artisane, footer) depuis la table contenu_site.
//
// Convention simple : chaque ligne de contenu_site a une "cle" qui
// correspond exactement à l'id d'un élément HTML sur le site public
// (ex: cle="hero-titre" -> <h1 id="hero-titre">). Si l'élément n'existe
// pas sur la page courante, on l'ignore silencieusement.
//
// Ces textes restent dans les templates HTML fixes (la "forme" ne change
// jamais) : seul leur contenu texte est remplacé.

import { supabase } from './supabase-client.js';

export async function appliquerContenuSite() {
  const { data, error } = await supabase.from('contenu_site').select('cle, valeur');
  if (error) {
    console.error('site-content.js : impossible de charger contenu_site', error);
    return;
  }
  for (const { cle, valeur } of data ?? []) {
    const el = document.getElementById(cle);
    // Les retours à la ligne tapés dans l'admin (touche Entrée) doivent
    // apparaître comme tels sur le site : en HTML ils sont sinon ignorés.
    if (el) el.innerHTML = (valeur ?? '').replace(/\r?\n/g, '<br>');
  }
}
