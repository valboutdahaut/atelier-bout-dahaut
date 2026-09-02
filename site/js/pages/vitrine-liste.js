// vitrine-liste.js — galerie des réalisations (posts_vitrine publiés).

import { supabase } from '../supabase-client.js';
import { formatAnnee } from '../lib/format.js';

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
    .select('id, titre, slug, resume, photo_apres_url, date_projet, mise_en_avant, savoir_faire_id, categories(nom)')
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
    const lien1 = node.querySelector('.placeholder-img');
    const lien2 = node.querySelector('.card-title');
    const eyebrow = node.querySelector('.eyebrow');

    if (post.mise_en_avant) article.classList.add('span-2');
    const href = `/vitrine/projet.html?slug=${encodeURIComponent(post.slug)}`;
    lien1.href = href;
    lien2.href = href;
    lien1.style.backgroundImage = post.photo_apres_url ? `url("${post.photo_apres_url}")` : '';
    if (post.photo_apres_url) { lien1.style.background = `center/cover no-repeat url("${post.photo_apres_url}")`; lien1.textContent = ''; }
    else { lien1.querySelector('span').textContent = 'photo à venir'; }
    eyebrow.textContent = `${post.categories?.nom ?? 'Réalisation'} · ${formatAnnee(post.date_projet)}`;
    lien2.textContent = post.titre;

    galerieEl.appendChild(node);
  }
}

chargerFiltres();
chargerPosts();
