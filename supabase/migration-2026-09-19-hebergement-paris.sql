-- =============================================================================
-- migration-2026-09-19-hebergement-paris.sql
-- =============================================================================
-- Renseigne le lieu d'hébergement réel des données dans la politique de
-- confidentialité, maintenant que la base a été déplacée de Londres
-- (eu-west-2) vers Paris (eu-west-3).
--
-- À exécuter UNE FOIS, sur le projet de Paris uniquement.
--
-- Écriture prudente : on remplace un morceau de texte précis plutôt que de
-- réécrire toute la clé. Si l'artisane a déjà retouché le reste de la page,
-- ses modifications sont conservées.
--
-- Les deux remplacements couvrent les deux états possibles du texte : celui
-- avec le trou à combler, et celui qui mentionnait Londres.
-- =============================================================================

update contenu_site
set valeur = replace(
               replace(
                 valeur,
                 '[à compléter : pays d''hébergement des données]',
                 'Les données sont stockées sur l''infrastructure Amazon Web Services située à Paris, en France.'
               ),
               'Les données sont stockées sur l''infrastructure Amazon Web Services située à Londres, au Royaume-Uni.',
               'Les données sont stockées sur l''infrastructure Amazon Web Services située à Paris, en France.'
             )
where cle = 'confidentialite-contenu';

-- --- Vérification ------------------------------------------------------------
-- Doit renvoyer une ligne : mentionne_paris = true, reste_un_trou = false.
select
  valeur like '%Paris, en France%'                        as mentionne_paris,
  valeur like '%pays d''hébergement des données%'         as reste_un_trou,
  valeur like '%Londres%'                                 as mentionne_encore_londres
from contenu_site
where cle = 'confidentialite-contenu';
