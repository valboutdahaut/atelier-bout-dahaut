-- =============================================================================
-- migration-2026-09-10-admin-tom.sql — ouvrir l'administration à une 2e adresse
-- =============================================================================
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, sur la base en service.
--
-- Jusqu'ici, une seule adresse pouvait administrer le site. Le prestataire a
-- besoin du même accès pour créer les fiches, corriger le contenu et
-- intervenir sans mobiliser l'artisane à chaque fois.
--
-- ATTENTION, avant de lancer : remplacez l'adresse ci-dessous par celle avec
-- laquelle vous recevrez le lien de connexion. Elle doit être écrite
-- EXACTEMENT comme dans Supabase Auth. Pour Supabase, "tom.exemple@gmail.com"
-- et "tomexemple@gmail.com" sont deux comptes distincts, même si Gmail livre
-- les deux dans la même boîte.
--
-- Ce script ne suffit pas à lui seul : il faut ensuite créer l'utilisateur
-- dans Authentication > Users (bouton "Add user", option "Auto Confirm User"),
-- car les inscriptions publiques sont fermées. Voir le README.
-- =============================================================================

create or replace function est_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (array[
    'atelierduboutdahaut@gmail.com',  -- l'artisane, propriétaire du site
    'tomblndeau@gmail.com'            -- le prestataire (adresse sans point)
  ]);
$$;

-- Vérification : affiche le corps de la fonction, où les deux adresses
-- autorisées doivent apparaître.
select prosrc as fonction_est_admin from pg_proc where proname = 'est_admin';
