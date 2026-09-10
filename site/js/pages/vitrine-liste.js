// vitrine-liste.js — galerie des réalisations (posts_vitrine publiés).

import { supabase } from '../supabase-client.js';
import { formatAnnee } from '../lib/format.js';
import { monterCarrousel } from '../lib/carrousel-carte.js';
import { photosDuPost } from '../lib/photos-post.js';

const galerieEl = document.getElementById('galerie');
const filtresEl = document.getElementById('filtres-savoir-faire');

let posts = [];
let filtreActif = ''; // '' = tout, sinon id de la catégorie savoir-faire

async function chargerFiltres() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, nom, slug')
    .eq('type', 'savoir_faire')
    .eq('visible', true)
    .order('ordre');

  if (error || !data) return;

  for (const cat of data) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.dataset.filtre = cat.id;
    btn.textContent = cat.nom;
    filtresEl.appendChild(btn);
  }

  filtresEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filtre]');
    if (!btn) return;
    filtreActif = btn.dataset.filtre;
    for (const b of filtresEl.querySelectorAll('button')) {
      b.classList.toggle('btn-primary', b === btn);
      b.classList.toggle('btn-outline', b !== btn);
    }
    afficherGalerie();
  });
}

async function chargerPosts() {
  const { data, error } = await supabase
    .from('posts_vitrine')
    .select('id, titre, slug, resume, photo_apres_url, photo_avant_url, photos_detail, date_projet, mise_en_avant, savoir_faire_id, categories(nom)')
    .eq('statut', 'publie')
    .order('date_projet', { ascending: false });

  if (error) {
    galerieEl.innerHTML = '<p class="empty-state">Impossible de charger les réalisations pour le moment.</p>';
    console.error('vitrine-liste.js', error);
    return;
  }
  posts = data ?? [];
  afficherGalerie();
}

function afficherGalerie() {
  const template = document.getElementById('tpl-carte-post');
  const items = filtreActif ? posts.filter((p) => p.savoir_faire_id === filtreActif) : posts;

  galerieEl.innerHTML = '';
  if (items.length === 0) {
    galerieEl.innerHTML = '<p class="empty-state">Aucune réalisation dans cette catégorie pour le moment.</p>';
    return;
  }

  for (const post of items) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('article');
    const media = node.querySelector('.card-media');
    const lienTitre = node.querySelector('.card-title');
    const eyebrow = node.querySelector('.eyebrow');

    if (post.mise_en_avant) article.classList.add('span-2');
    const href = `/vitrine/projet.html?slug=${encodeURIComponent(post.slug)}`;
    media.querySelector('.card-media-link').href = href;
    lienTitre.href = href;

    const photos = photosDuPost(post);
    if (photos.length === 0) media.querySelector('.card-media-img').textContent = 'photo à venir';
    monterCarrousel(media, photos);

    eyebrow.textContent = `${post.categories?.nom ?? 'Réalisation'} · ${formatAnnee(post.date_projet)}`;
    lienTitre.textContent = post.titre;

    galerieEl.appendChild(node);
  }
}

chargerFiltres();
chargerPosts();
