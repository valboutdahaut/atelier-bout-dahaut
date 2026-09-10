// redimensionner-image.js — allège une photo dans le navigateur avant de
// l'envoyer sur Supabase.
//
// Pourquoi : une photo de téléphone fait couramment 4000 px de large pour 3 à
// 4 Mo, alors que la plus grande zone du site en affiche 1200 environ. Sans
// cette étape, un visiteur mobile télécharge plusieurs mégaoctets par vignette
// et le stockage Supabase se remplit pour rien.
//
// Le redimensionnement automatique côté Supabase ferait le même travail, mais
// il est réservé aux plans payants. On le fait donc ici, gratuitement.

// 1600 px couvre la plus grande zone du site (le bandeau d'accueil) même sur
// un écran à haute densité, où le navigateur affiche deux pixels d'image par
// pixel d'écran. Au-delà, le poids augmente sans rien apporter de visible.
//
// La limite porte sur le plus grand côté, pas sur la largeur : une photo prise
// en portrait a son grand côté à la verticale, et ne plafonner que la largeur
// la laisserait à plus de 2000 px de haut, soit près du double de pixels à
// télécharger pour un affichage identique.
const COTE_MAX = 1600;

// 0.82 est le palier au-delà duquel le poids grimpe vite alors que l'oeil ne
// distingue plus rien sur une photo d'atelier.
const QUALITE = 0.82;

/**
 * @param {File} file photo choisie dans le formulaire
 * @returns {Promise<File>} version allégée, ou le fichier d'origine si la
 *          conversion échoue ou n'apporterait rien
 */
export async function redimensionner(file) {
  try {
    // imageOrientation: 'from-image' est indispensable : un canvas ignore les
    // données EXIF, et sans cette option les photos prises en portrait avec un
    // téléphone se retrouveraient couchées après conversion.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    // Une photo déjà petite est renvoyée telle quelle : la réencoder ne ferait
    // que dégrader l'image sans gain de poids.
    const grandCote = Math.max(bitmap.width, bitmap.height);
    if (grandCote <= COTE_MAX) {
      bitmap.close();
      return file;
    }

    const echelle = COTE_MAX / grandCote;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * echelle);
    canvas.height = Math.round(bitmap.height * echelle);

    const ctx = canvas.getContext('2d');
    // Fond blanc : une image transparente convertie en JPEG afficherait
    // sinon du noir là où elle était transparente.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITE));
    if (!blob || blob.size >= file.size) return file;

    const nom = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nom, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    // Un navigateur trop ancien, un format exotique, une image corrompue : on
    // envoie l'original plutôt que de bloquer la publication. La photo sera
    // lourde, mais elle sera en ligne.
    console.warn('redimensionner-image.js : conversion impossible, envoi de l\'original', err);
    return file;
  }
}
