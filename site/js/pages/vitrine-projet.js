// vitrine-projet.js — récit d'une réalisation (avant/après), lu via ?slug=

import { supabase } from '../supabase-client.js';
import { formatAnnee } from '../lib/format.js';
import { rendreMarkdownLite } from '../lib/markdown-lite.js';
import { monterCarrousel } from '../lib/carrousel-carte.js';
import { photosDuPost } from '../lib/photos-post.js';

const contenuEl = document.getElementById('contenu-projet');
const slug = new URLSearchParams(location.search).get('slug');

function setPhoto(el, url, texteVide) {
  if (url) {
    el.style.background = `center/cover no-repeat url("${url}")`;
    el.querySelector('span:not(.badge)')?.remove();
  } else {
    const span = document.createElement('span');
    span.textContent = texteVide;
    el.appendChild(span);
  }
}

async function afficherAutresPosts(idActuel) {
  const conteneur = document.querySelector('[data-slot="autres-posts"]');
  const { data } = await supabase
    .from('posts_vitrine')
    .select('titre, slug, photo_apres_url, photo_avant_url, photos_detail')
    .eq('statut', 'publie')
    .neq('id', idActuel)
    .order('date_projet', { ascending: false })
    .limit(3);

  for (const post of data ?? []) {
    const href = `/vitrine/projet.html?slug=${encodeURIComponent(post.slug)}`;
    const article = document.createElement('article');
    article.className = 'card';
    // Même structure que le template de la galerie (vitrine/index.html) : zoom
    // au survol et flèches de parcours des photos, posées par monterCarrousel.
    article.innerHTML = `
      <div class="card-media">
        <a class="card-media-link" href="${href}"><span class="card-media-img placeholder-img"></span></a>
        <button class="card-media-nav" type="button" data-dir="-1" aria-label="Photo précédente">‹</button>
        <button class="card-media-nav" type="button" data-dir="1" aria-label="Photo suivante">›</button>
      </div>
      <a class="card-title" href="${href}" style="color:var(--color-text)"></a>
    `;
    // Le titre vient de l'admin : posé en texte, jamais interprété comme du HTML.
    article.querySelector('.card-title').textContent = post.titre;

    const photos = photosDuPost(post);
    if (photos.length === 0) article.querySelector('.card-media-img').textContent = 'photo à venir';
    monterCarrousel(article.querySelector('.card-media'), photos);

    conteneur.appendChild(article);
  }
}

async function charger() {
  if (!slug) {
    contenuEl.innerHTML = '<p class="empty-state" style="padding:96px 0">Réalisation introuvable.</p>';
    return;
  }

  const { data: post, error } = await supabase
    .from('posts_vitrine')
    .select('*, categories(nom)')
    .eq('slug', slug)
    .eq('statut', 'publie')
    .single();

  if (error || !post) {
    contenuEl.innerHTML = '<p class="empty-state" style="padding:96px 0">Réalisation introuvable ou plus disponible.</p>';
    return;
  }

  document.title = `${post.titre} — L'Atelier du Bout d'à Haut`;
  document.getElementById('page-title').textContent = document.title;

  const template = document.getElementById('tpl-projet');
  const node = template.content.cloneNode(true);

  node.querySelector('[data-slot="eyebrow"]').textContent =
    `${post.categories?.nom ?? 'Réalisation'} · ${formatAnnee(post.date_projet)}${post.lieu ? ' · ' + post.lieu : ''}`;
  node.querySelector('[data-slot="titre"]').textContent = post.titre;
  node.querySelector('[data-slot="resume"]').textContent = post.resume ?? '';
  setPhoto(node.querySelector('[data-slot="photo-avant"]'), post.photo_avant_url, 'photo avant à venir');
  setPhoto(node.querySelector('[data-slot="photo-apres"]'), post.photo_apres_url, 'photo après à venir');
  node.querySelector('[data-slot="savoir-faire"]').textContent = post.categories?.nom ?? '—';
  node.querySelector('[data-slot="tissu"]').textContent = post.tissu ?? '—';
  node.querySelector('[data-slot="duree"]').textContent = post.duree ?? '—';
  node.querySelector('[data-slot="matieres"]').textContent = post.matieres_reemployees ?? '—';
  node.querySelector('[data-slot="recit"]').innerHTML = rendreMarkdownLite(post.recit);
  node.querySelector('[data-slot="lien-contact"]').href =
    `/contact.html?sujet=${encodeURIComponent('Projet similaire à : ' + post.titre)}&post=${post.id}`;

  contenuEl.innerHTML = '';
  contenuEl.appendChild(node);

  afficherAutresPosts(post.id);
}

charger();
