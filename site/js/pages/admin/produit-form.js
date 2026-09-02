// produit-form.js — commun à nouveau.html et edition.html. Le mode est
// déterminé par la présence de ?id= dans l'URL.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { uploadPhoto } from '../../lib/upload.js';
import { slugify } from '../../lib/slugify.js';

const idProduit = new URLSearchParams(location.search).get('id');
const estEdition = Boolean(idProduit);

const form = document.getElementById('form-produit');
const zonePhotos = document.getElementById('zone-photos');
const selectCategorie = document.getElementById('categorie');
const erreurEl = document.getElementById('erreur-produit');

let photos = []; // URLs déjà uploadées, index 0 = vignette
let client;

function rendrePhotos() {
  zonePhotos.querySelectorAll('[data-photo]').forEach((el) => el.remove());
  const dropzone = zonePhotos.querySelector('[data-slot-photo]');

  photos.forEach((url, i) => {
    const div = document.createElement('div');
    div.className = 'placeholder-img';
    div.dataset.photo = 'true';
    div.style.background = `center/cover no-repeat url("${url}")`;
    div.style.cursor = 'pointer';
    div.title = 'Cliquer pour retirer';
    div.addEventListener('click', () => { photos.splice(i, 1); rendrePhotos(); });
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
    try {
      const url = await uploadPhoto(client, file, 'produits');
      photos.push(url);
      rendrePhotos();
    } catch (err) {
      erreurEl.textContent = err.message;
      erreurEl.hidden = false;
    }
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
  wireDropzone();
  await chargerCategories();
  if (estEdition) await chargerProduitExistant();
}

init();
