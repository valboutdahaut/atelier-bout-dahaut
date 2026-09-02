// markdown-lite.js — le strict minimum de mise en forme autorisé dans le
// récit d'un post vitrine : gras, italique, sous-titres. Volontairement
// limité (pas de liens, d'images, de tableaux...) pour rester cohérent avec
// la règle "l'admin ne touche jamais à la mise en page".

export function rendreMarkdownLite(texte) {
  if (!texte) return '';
  const paragraphes = texte.split(/\n{2,}/).map((bloc) => {
    const ligne = bloc.trim();
    if (ligne.startsWith('## ')) {
      return `<h3>${inline(ligne.slice(3))}</h3>`;
    }
    return `<p>${inline(ligne).replace(/\n/g, '<br>')}</p>`;
  });
  return paragraphes.join('\n');
}

function inline(texte) {
  return escapeHtml(texte)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function escapeHtml(texte) {
  const div = document.createElement('div');
  div.textContent = texte;
  return div.innerHTML;
}
