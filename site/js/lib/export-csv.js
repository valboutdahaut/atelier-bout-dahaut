// export-csv.js — fabrique un fichier CSV et le fait télécharger.
//
// Les choix de format visent un tableur français, Google Sheets ou Excel :
//
//   - séparateur point-virgule, convention française, qui évite aussi d'avoir
//     à protéger les virgules décimales ;
//   - marque d'ordre des octets en tête du fichier, sans laquelle Excel affiche
//     « Ã© » à la place de « é » ;
//   - fins de ligne Windows, les seules qu'Excel accepte sans discuter.
//
// Google Sheets lit tout cela sans réglage particulier.

/**
 * Neutralise les formules.
 *
 * Un tableur interprète comme une formule toute cellule qui commence par =, +,
 * - ou @. Or ces colonnes contiennent du texte saisi par des clients : un nom
 * du genre « =HYPERLINK("http://...","Cliquez") » s'exécuterait à l'ouverture
 * du fichier, sur l'ordinateur de l'atelier.
 *
 * L'apostrophe en tête force le tableur à traiter la cellule comme du texte.
 * Elle n'est pas affichée dans la cellule une fois le fichier ouvert.
 *
 * Même famille de problème que l'injection corrigée en septembre dans la
 * messagerie : du texte venu de l'extérieur, affiché dans un outil interne.
 */
function neutraliser(valeur) {
  const texte = String(valeur ?? '');
  return /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte;
}

/** Protège un champ selon les règles du format CSV. */
function echapperChamp(valeur) {
  const texte = neutraliser(valeur);
  if (/[";\n\r]/.test(texte)) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

/**
 * @param {string} nomFichier  nom proposé au téléchargement
 * @param {string[]} entetes   la première ligne
 * @param {Array<Array<string|number>>} lignes
 */
export function telechargerCsv(nomFichier, entetes, lignes) {
  const contenu = [entetes, ...lignes]
    .map((ligne) => ligne.map(echapperChamp).join(';'))
    .join('\r\n');

  // Le ﻿ est la marque d'ordre des octets. Sans elle, Excel suppose un
  // encodage hérité et massacre tous les accents.
  const fichier = new Blob([`﻿${contenu}`], { type: 'text/csv;charset=utf-8;' });

  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Le navigateur garde le fichier en mémoire tant qu'on ne libère pas
  // l'adresse. Sur une page d'administration laissée ouverte toute la journée,
  // une dizaine d'exports finiraient par peser.
  URL.revokeObjectURL(adresse);
}
