// textes.js — édite la table contenu_site (clé/valeur), un champ de
// formulaire par clé attendue par les pages publiques (voir site-content.js).

import { getAuthenticatedClient } from '../../supabase-client.js';

const form = document.getElementById('form-textes');
const statutEl = document.getElementById('statut-textes');
let client;

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
  statutEl.textContent = error ? "Erreur à l'enregistrement." : 'Enregistré.';
  statutEl.hidden = false;
  if (error) console.error('textes.js', error);
});

charger();
