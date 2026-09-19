// markdown-lite.js — le strict minimum de mise en forme autorisé dans le
// récit d'un post vitrine : gras, italique, sous-titres. Volontairement
// limité (pas de liens, d'images, de tableaux...) pour rester cohérent avec
// la règle "l'admin ne touche jamais à la mise en page".

export function rendreMarkdownLite(texte) {
  if (!texte) return '';
  // Les navigateurs renvoient le contenu d'un <textarea> avec des fins de
  // ligne Windows (\r\n), c'est la spécification HTML. Sans cette
  // normalisation, le découpage en paragraphes ci-dessous ne trouve jamais
  // deux \n qui se suivent, et tout le texte ressort en un seul bloc avec les
  // "##" affichés tels quels. Défaut constaté en conditions réelles.
  const normalise = texte.replace(/\r\n?/g, '\n');
  const paragraphes = normalise.split(/\n{2,}/).map((bloc) => {
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
