// categories.js — CRUD + réordonnancement (boutons haut/bas, pas de
// glisser-déposer : plus simple à construire pour un gain équivalent sur un
// nombre de catégories toujours restreint).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { slugify } from '../../lib/slugify.js';

let client;
let boutique = [];
let savoirFaire = [];

async function chargerTout() {
  client = client ?? (await getAuthenticatedClient());
  const { data } = await client.from('categories').select('*').order('ordre');
  boutique = (data ?? []).filter((c) => c.type === 'boutique');
  savoirFaire = (data ?? []).filter((c) => c.type === 'savoir_faire');
  afficher('liste-boutique', boutique);
  afficher('liste-savoir-faire', savoirFaire);
}

function afficher(conteneurId, liste) {
  const conteneur = document.getElementById(conteneurId);
  const template = document.getElementById('tpl-tag');
  conteneur.innerHTML = '';

  if (liste.length === 0) {
    conteneur.innerHTML = '<span class="empty-state">Aucune catégorie pour le moment.</span>';
    return;
  }

  liste.forEach((cat, i) => {
    const node = template.content.cloneNode(true);
    node.querySelector('[data-slot="nom"]').textContent = cat.nom;
    const btnVisibilite = node.querySelector('[data-action="visibilite"]');
    btnVisibilite.textContent = cat.visible ? 'masquer' : 'afficher';

    node.querySelector('[data-action="haut"]').addEventListener('click', () => deplacer(liste, i, -1));
    node.querySelector('[data-action="bas"]').addEventListener('click', () => deplacer(liste, i, 1));
    node.querySelector('[data-action="renommer"]').addEventListener('click', () => renommer(cat));
    btnVisibilite.addEventListener('click', () => basculerVisibilite(cat));

    conteneur.appendChild(node);
  });
}

async function deplacer(liste, index, direction) {
  const autre = liste[index + direction];
  if (!autre) return;
  const courant = liste[index];
  const ordreCourant = courant.ordre;
  await client.from('categories').update({ ordre: autre.ordre }).eq('id', courant.id);
  await client.from('categories').update({ ordre: ordreCourant }).eq('id', autre.id);
  chargerTout();
}

async function renommer(cat) {
  const nouveauNom = prompt('Nouveau nom :', cat.nom);
  if (!nouveauNom || nouveauNom === cat.nom) return;
  await client.from('categories').update({ nom: nouveauNom, slug: slugify(nouveauNom) }).eq('id', cat.id);
  chargerTout();
}

async function basculerVisibilite(cat) {
  await client.from('categories').update({ visible: !cat.visible }).eq('id', cat.id);
  chargerTout();
}

async function ajouter(type) {
  const nom = prompt('Nom de la nouvelle catégorie :');
  if (!nom) return;
  const liste = type === 'boutique' ? boutique : savoirFaire;
  const ordreMax = liste.reduce((max, c) => Math.max(max, c.ordre), -1);
  await client.from('categories').insert({ type, nom, slug: slugify(nom), ordre: ordreMax + 1, visible: true });
  chargerTout();
}

document.getElementById('btn-ajout-boutique').addEventListener('click', () => ajouter('boutique'));
document.getElementById('btn-ajout-savoir-faire').addEventListener('click', () => ajouter('savoir_faire'));

chargerTout();
