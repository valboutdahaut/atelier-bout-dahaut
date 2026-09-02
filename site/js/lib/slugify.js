// slugify.js — génère un slug URL à partir d'un titre (ex. pour produits/posts/catégories).

export function slugify(texte) {
  return texte
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents (marques combinantes Unicode)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
