// post-form.js — commun à nouveau.html et edition.html (posts vitrine).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { uploadPhoto } from '../../lib/upload.js';
import { slugify } from '../../lib/slugify.js';

const idPost = new URLSearchParams(location.search).get('id');
const estEdition = Boolean(idPost);

const form = document.getElementById('form-post');
const erreurEl = document.getElementById('erreur-post');
const zoneDetail = document.getElementById('zone-detail');

let photoAvant = null;
let photoApres = null;
let photosDetail = [];
let client;

function rendreDropzoneUnique(nom, url) {
  const dz = document.querySelector(`[data-slot-photo="${nom}"]`);
  dz.classList.remove('dropzone');
  dz.classList.add('placeholder-img');
  dz.style.background = `center/cover no-repeat url("${url}")`;
  dz.querySelector('input')?.remove();
  dz.textContent = '';
}

function rendreDetail() {
  zoneDetail.querySelectorAll('[data-photo-detail]').forEach((el) => el.remove());
  const dropzone = zoneDetail.querySelector('[data-slot-photo="detail"]');
  photosDetail.forEach((url, i) => {
    const div = document.createElement('div');
    div.className = 'placeholder-img';
    div.dataset.photoDetail = 'true';
    div.style.background = `center/cover no-repeat url("${url}")`;
    div.style.cursor = 'pointer';
    div.title = 'Cliquer pour retirer';
    div.addEventListener('click', () => { photosDetail.splice(i, 1); rendreDetail(); });
    zoneDetail.insertBefore(div, dropzone);
  });
  dropzone.style.display = photosDetail.length >= 3 ? 'none' : 'flex';
}

function wireDropzones() {
  document.querySelectorAll('[data-slot-photo="avant"], [data-slot-photo="apres"]').forEach((dz) => {
    const input = dz.querySelector('input[type="file"]');
    dz.addEventListener('click', () => { if (input) input.click(); });
    input?.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const url = await uploadPhoto(client, file, 'posts');
      if (dz.dataset.slotPhoto === 'avant') photoAvant = url; else photoApres = url;
      rendreDropzoneUnique(dz.dataset.slotPhoto, url);
    });
  });

  const dzDetail = zoneDetail.querySelector('[data-slot-photo="detail"]');
  const inputDetail = dzDetail.querySelector('input[type="file"]');
  dzDetail.addEventListener('click', () => inputDetail.click());
  inputDetail.addEventListener('change', async () => {
    const file = inputDetail.files[0];
    if (!file) return;
    const url = await uploadPhoto(client, file, 'posts');
    photosDetail.push(url);
    rendreDetail();
    inputDetail.value = '';
  });
}

async function chargerSavoirFaire() {
  const { data } = await client.from('categories').select('id, nom').eq('type', 'savoir_faire').order('ordre');
  document.getElementById('savoir_faire').innerHTML = (data ?? []).map((c) => `<option value="${c.id}">${c.nom}</option>`).join('');
}

async function chargerPostExistant() {
  const { data, error } = await client.from('posts_vitrine').select('*').eq('id', idPost).single();
  if (error || !data) {
    erreurEl.textContent = 'Post introuvable.';
    erreurEl.hidden = false;
    return;
  }
  form.titre.value = data.titre;
  form.savoir_faire_id.value = data.savoir_faire_id ?? '';
  form.lieu.value = data.lieu ?? '';
  form.date_projet.value = data.date_projet ?? '';
  form.duree.value = data.duree ?? '';
  form.tissu.value = data.tissu ?? '';
  form.matieres_reemployees.value = data.matieres_reemployees ?? '';
  form.resume.value = data.resume ?? '';
  form.recit.value = data.recit ?? '';
  form.mise_en_avant.checked = data.mise_en_avant;

  photoAvant = data.photo_avant_url;
  photoApres = data.photo_apres_url;
  photosDetail = data.photos_detail ?? [];
  if (photoAvant) rendreDropzoneUnique('avant', photoAvant);
  if (photoApres) rendreDropzoneUnique('apres', photoApres);
  rendreDetail();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erreurEl.hidden = true;

  const donnees = new FormData(form, e.submitter);
  const enregistrement = {
    titre: donnees.get('titre'),
    savoir_faire_id: donnees.get('savoir_faire_id'),
    lieu: donnees.get('lieu') || null,
    date_projet: donnees.get('date_projet'),
    duree: donnees.get('duree') || null,
    tissu: donnees.get('tissu') || null,
    matieres_reemployees: donnees.get('matieres_reemployees') || null,
    resume: donnees.get('resume') || null,
    recit: donnees.get('recit'),
    mise_en_avant: donnees.get('mise_en_avant') === 'on',
    photo_avant_url: photoAvant,
    photo_apres_url: photoApres,
    photos_detail: photosDetail,
    statut: donnees.get('statut'),
  };

  let resultat;
  if (estEdition) {
    resultat = await client.from('posts_vitrine').update(enregistrement).eq('id', idPost);
  } else {
    enregistrement.slug = slugify(enregistrement.titre) + '-' + Math.random().toString(36).slice(2, 6);
    resultat = await client.from('posts_vitrine').insert(enregistrement);
  }

  if (resultat.error) {
    erreurEl.textContent = "Erreur à l'enregistrement, merci de réessayer.";
    erreurEl.hidden = false;
    console.error('post-form.js', resultat.error);
    return;
  }

  window.location.href = '/admin/posts/index.html';
});

const btnSupprimer = document.getElementById('btn-supprimer');
if (btnSupprimer) {
  btnSupprimer.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('Supprimer définitivement ce post ?')) return;
    const { error } = await client.from('posts_vitrine').delete().eq('id', idPost);
    if (error) { alert('Impossible de supprimer ce post.'); return; }
    window.location.href = '/admin/posts/index.html';
  });
}

async function init() {
  client = await getAuthenticatedClient();
  wireDropzones();
  await chargerSavoirFaire();
  if (estEdition) await chargerPostExistant();
}

init();
