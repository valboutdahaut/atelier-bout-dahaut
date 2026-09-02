// format.js — formatage prix (centimes -> affichage FR) et dates.

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
