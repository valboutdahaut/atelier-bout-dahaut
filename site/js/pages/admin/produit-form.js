// produit-form.js — commun à nouveau.html et edition.html. Le mode est
// déterminé par la présence de ?id= dans l'URL.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { creerPosteDePhotos } from '../../lib/photo-cadree.js';
import { slugify } from '../../lib/slugify.js';
import { creerVignette } from '../../lib/vignette-photo.js';

const idProduit = new URLSearchParams(location.search).get('id');
const estEdition = Boolean(idProduit);

const form = document.getElementById('form-produit');
const zonePhotos = document.getElementById('zone-photos');
const selectCategorie = document.getElementById('categorie');
const erreurEl = document.getElementById('erreur-produit');

let photos = []; // URLs déjà uploadées, index 0 = vignette
let client;
let poste; // choisir, cadrer, envoyer : voir lib/photo-cadree.js

function signalerErreur(err) {
  erreurEl.textContent = err.message;
  erreurEl.hidden = false;
}

/**
 * Reprend le cadrage d'une photo déjà ajoutée. La photo recadrée est un
 * nouveau fichier : son adresse remplace l'ancienne, à la même place, pour que
 * la vignette reste la vignette.
 */
async function recadrerPhoto(url) {
  erreurEl.hidden = true;
  try {
    const nouvelle = await poste.recadrer(url);
    if (!nouvelle) return; // annulé
    const i = photos.indexOf(url);
    if (i !== -1) photos[i] = nouvelle;
    rendrePhotos();
  } catch (err) {
    signalerErreur(err);
  }
}

function rendrePhotos() {
  zonePhotos.querySelectorAll('[data-photo]').forEach((el) => el.remove());
  const dropzone = zonePhotos.querySelector('[data-slot-photo]');

  photos.forEach((url, i) => {
    const div = creerVignette(url, () => { photos.splice(i, 1); rendrePhotos(); }, () => recadrerPhoto(url));
    div.dataset.photo = 'true';
    // La première photo sert de vignette sur le site : le rappeler ici évite
    // d'avoir à deviner laquelle sera reprise dans la grille de la boutique.
    if (i === 0) {
      const etiquette = document.createElement('span');
      etiquette.className = 'photo-badge';
      etiquette.textContent = 'Vignette';
      div.appendChild(etiquette);
    }
    zonePhotos.insertBefore(div, dropzone);
  });

  dropzone.style.display = photos.length >= 4 ? 'none' : 'flex';
}

function wireDropzone() {
  const dropzone = zonePhotos.querySelector('[data-slot-photo]');
  const input = dropzone.querySelector('input[type="file"]');
  dropzone.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    erreurEl.hidden = true;
    try {
      // La fenêtre de recadrage s'ouvre ici, et ne rend l'adresse qu'une fois
      // la photo cadrée puis envoyée. Annuler n'ajoute rien.
      const url = await poste.ajouter(file);
      if (url) {
        photos.push(url);
        rendrePhotos();
      }
    } catch (err) {
      signalerErreur(err);
    }
    // Vidé dans tous les cas : sans cela, rechoisir la même photo après une
    // annulation ne déclencherait rien, le champ n'ayant pas changé.
    input.value = '';
  });
}

async function chargerCategories() {
  const { data } = await client.from('categories').select('id, nom').eq('type', 'boutique').order('ordre');
  selectCategorie.innerHTML = (data ?? []).map((c) => `<option value="${c.id}">${c.nom}</option>`).join('');
}

async function chargerProduitExistant() {
  const { data, error } = await client.from('produits').select('*').eq('id', idProduit).single();
  if (error || !data) {
    erreurEl.textContent = "Produit introuvable.";
    erreurEl.hidden = false;
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }
  form.titre.value = data.titre;
  form.prix.value = (data.prix_cents / 100).toFixed(2);
  form.stock.value = data.stock;
  form.sous_titre.value = data.sous_titre ?? '';
  form.piece_unique.checked = data.piece_unique;
  form.retrait_showroom_seul.checked = data.retrait_showroom_seul ?? false;
  form.description.value = data.description ?? '';
  selectCategorie.value = data.categorie_id ?? '';
  photos = data.photos ?? [];
  rendrePhotos();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erreurEl.hidden = true;

  if (photos.length === 0) {
    erreurEl.textContent = 'Ajoutez au moins une photo.';
    erreurEl.hidden = false;
    return;
  }

  const donnees = new FormData(form, e.submitter);
  const enregistrement = {
    titre: donnees.get('titre'),
    prix_cents: Math.round(Number(donnees.get('prix')) * 100),
    stock: Number(donnees.get('stock')),
    categorie_id: donnees.get('categorie_id'),
    sous_titre: donnees.get('sous_titre') || null,
    piece_unique: donnees.get('piece_unique') === 'on',
    retrait_showroom_seul: donnees.get('retrait_showroom_seul') === 'on',
    description: donnees.get('description') || null,
    photos,
    statut: donnees.get('statut'),
  };

  let resultat;
  if (estEdition) {
    resultat = await client.from('produits').update(enregistrement).eq('id', idProduit);
  } else {
    enregistrement.slug = slugify(enregistrement.titre) + '-' + Math.random().toString(36).slice(2, 6);
    resultat = await client.from('produits').insert(enregistrement);
  }

  if (resultat.error) {
    erreurEl.textContent = "Erreur à l'enregistrement, merci de réessayer.";
    erreurEl.hidden = false;
    console.error('produit-form.js', resultat.error);
    return;
  }

  window.location.href = '/admin/produits/index.html';
});

const btnSupprimer = document.getElementById('btn-supprimer');
if (btnSupprimer) {
  btnSupprimer.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('Supprimer définitivement ce produit ?')) return;
    const { error } = await client.from('produits').delete().eq('id', idProduit);
    if (error) { alert("Impossible de supprimer ce produit."); return; }
    window.location.href = '/admin/produits/index.html';
  });
}

async function init() {
  client = await getAuthenticatedClient();
  poste = creerPosteDePhotos({ client, dossier: 'produits', zone: 'boutique' });
  wireDropzone();
  await chargerCategories();
  if (estEdition) await chargerProduitExistant();
}

init();
