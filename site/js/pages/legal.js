// legal.js — remplit le corps des trois pages légales (mentions légales,
// politique de confidentialité, CGU et CGV) depuis contenu_site.
//
// Un seul script pour les trois pages : l'attribut data-legal posé sur <main>
// indique quelle clé lire. data-legal="mentions" lit "mentions-contenu".
//
// La mise en forme passe par markdown-lite, comme le récit d'une réalisation,
// et non par site-content.js : ce sont des textes longs, avec des sous-titres
// et des paragraphes, que de simples retours à la ligne rendraient illisibles.
// Les clés se terminent donc par "-contenu" et ne correspondent à l'id d'aucun
// élément, sinon site-content.js viendrait écrire par-dessus.
//
// Le HTML de chaque page contient déjà une version de secours du texte. Si la
// base ne répond pas, le visiteur voit quand même un document valide. Ce n'est
// pas une coquetterie : la présence de ces mentions est une obligation légale,
// elles ne peuvent pas dépendre de la disponibilité d'un service extérieur.

import { supabase } from '../supabase-client.js';
import { rendreMarkdownLite } from '../lib/markdown-lite.js';

const mainEl = document.querySelector('[data-legal]');
const contenuEl = mainEl?.querySelector('[data-slot="contenu"]');

async function charger() {
  if (!mainEl || !contenuEl) return;
  const cle = `${mainEl.dataset.legal}-contenu`;

  const { data, error } = await supabase
    .from('contenu_site')
    .select('valeur')
    .eq('cle', cle)
    .maybeSingle();

  if (error) {
    console.error(`legal.js : impossible de charger "${cle}"`, error);
    return; // le texte de secours du HTML reste affiché
  }

  const texte = (data?.valeur ?? '').trim();
  if (!texte) return; // rien en base non plus : on garde le secours

  contenuEl.innerHTML = rendreMarkdownLite(texte);
}

charger();
