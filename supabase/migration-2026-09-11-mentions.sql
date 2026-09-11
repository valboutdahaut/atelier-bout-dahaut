-- =============================================================================
-- migration-2026-09-11-mentions.sql — mentions de l'entreprise + nom Facebook
-- =============================================================================
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, après
-- migration-2026-09-11-reseaux.sql.
--
-- Deux changements :
--   1. Ajoute les mentions de l'entreprise sous la carte de la page Contact.
--      Elles reprennent celles de l'ancien site, sans le numéro de téléphone.
--   2. Affiche le nom complet de la page Facebook au lieu de l'identifiant.
--
-- Les deux restent modifiables dans Administration > Textes du site,
-- onglet Contact.
-- =============================================================================

-- --- 1. Mentions de l'entreprise --------------------------------------------
insert into contenu_site (cle, valeur) values (
  'contact-mentions',
  'L''Atelier du Bout d''à Haut, Entreprise personnelle artisan
RCS Chartres Siren N° 839 565 397'
)
-- Ne remplace que si le champ est vide ou absent : une saisie faite entre-temps
-- dans l'administration est conservée.
on conflict (cle) do update
  set valeur = excluded.valeur
  where contenu_site.valeur = '';

-- --- 2. Nom affiché de la page Facebook --------------------------------------
-- Remplacement ciblé plutôt que réécriture des trois lignes : si les liens
-- Instagram ou Pinterest ont été modifiés depuis, ils ne sont pas écrasés.
update contenu_site
   set valeur = replace(valeur, 'facebook | @atelierduboutdahaut |', 'facebook | L''Atelier du Bout d''à Haut |')
 where cle = 'contact-reseaux';

-- Vérification : la ligne Facebook doit afficher le nom complet, et les
-- mentions doivent apparaître sur deux lignes.
select cle, valeur from contenu_site
 where cle in ('contact-reseaux', 'contact-mentions')
 order by cle;
