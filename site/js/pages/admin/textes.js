// textes.js — édite la table contenu_site (clé/valeur), un champ de
// formulaire par clé attendue par les pages publiques (voir site-content.js).
//
// Les champs sont répartis en onglets, une page du site par onglet. Les
// panneaux masqués restent dans le formulaire : "hidden" cache un champ mais
// ne le retire pas de l'envoi, contrairement à "disabled". Enregistrer depuis
// n'importe quel onglet sauvegarde donc bien l'ensemble des textes.

import { getAuthenticatedClient } from '../../supabase-client.js';

const form = document.getElementById('form-textes');
const statutEl = document.getElementById('statut-textes');
const ongletsEl = document.getElementById('onglets-textes');
let client;

function activerOnglet(nom) {
  for (const b of ongletsEl.querySelectorAll('.admin-tab')) {
    b.classList.toggle('active', b.dataset.onglet === nom);
  }
  for (const p of form.querySelectorAll('[data-panneau]')) {
    p.hidden = p.dataset.panneau !== nom;
  }
}

ongletsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.admin-tab');
  if (btn) activerOnglet(btn.dataset.onglet);
});

async function charger() {
  client = await getAuthenticatedClient();
  const { data } = await client.from('contenu_site').select('cle, valeur');
  for (const { cle, valeur } of data ?? []) {
    const champ = form.elements.namedItem(cle);
    if (champ) champ.value = valeur;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const lignes = Array.from(form.elements)
    .filter((el) => el.name)
    .map((el) => ({ cle: el.name, valeur: el.value }));

  const { error } = await client.from('contenu_site').upsert(lignes, { onConflict: 'cle' });

  statutEl.className = error ? 'status-msg error' : 'status-msg success';
  statutEl.textContent = error ? "Erreur à l'enregistrement." : 'Enregistré. Les modifications sont en ligne.';
  statutEl.hidden = false;
  if (error) {
    console.error('textes.js', error);
    return;
  }
  // Le message de succès s'efface seul : laissé en place, il ferait douter au
  // prochain enregistrement (a-t-il bien été pris en compte, ou est-ce
  // l'ancien message ?). Un échec, lui, reste affiché.
  setTimeout(() => { statutEl.hidden = true; }, 4000);
});

charger();
