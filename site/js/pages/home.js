// home.js — page d'accueil.
//
// Les textes génériques (hero, bio, footer) sont déjà hydratés pour toutes
// les pages publiques par site-content.js (appelé depuis nav.js).
//
// Les cinq zones images de la page (grand bandeau, présentation de l'artisane
// et les trois vignettes savoir-faire) ne portent aucune photo en dur : elles
// font défiler les pièces réellement visibles sur le site, boutique en stock
// et réalisations de la vitrine. Voir lib/roulement-photos.js pour les règles.
//
// Tant qu'aucune photo n'est publiée, les zones gardent le motif de
// remplissage et leur légende : la page reste donc lisible en attendant.

import { supabase } from '../supabase-client.js';
import { chargerPhotosPrincipales, demarrerRoulement } from '../lib/roulement-photos.js';

chargerPhotosPrincipales(supabase).then(demarrerRoulement);
