// format.js — formatage prix (centimes -> affichage FR), dates, et échappement
// du texte inséré dans du HTML.

// À utiliser dès qu'un texte saisi dans l'administration est injecté via
// innerHTML : un titre de produit contenant < ou & casserait le tableau, et un
// titre contenant une balise serait interprété au lieu d'être affiché.
export function echapper(texte) {
  const remplacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texte ?? '').replace(/[&<>"']/g, (c) => remplacements[c]);
}

export function formatPrix(cents) {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatAnnee(isoString) {
  if (!isoString) return '';
  return new Date(isoString).getFullYear().toString();
}
