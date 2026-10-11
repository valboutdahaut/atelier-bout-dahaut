-- =============================================================================
-- migration-2026-10-11-admin-troisieme-adresse.sql
-- =============================================================================
-- Ouvre l'administration à une troisième adresse.
--
-- La liste des administrateurs vit dans cette seule fonction, interrogée par
-- toutes les règles de sécurité de la base (voir policies.sql). La remplacer
-- est donc le seul geste à faire côté données : aucune policy n'est à retoucher.
--
-- ATTENTION : l'adresse doit être écrite EXACTEMENT comme dans Supabase Auth.
-- Pour Supabase, « prenom.nom@gmail.com » et « prenomnom@gmail.com » sont deux
-- comptes distincts, même si Gmail livre les deux dans la même boîte.
--
-- CE SCRIPT NE SUFFIT PAS À LUI SEUL. Autoriser une adresse ne crée pas le
-- compte : les inscriptions publiques sont fermées (voir README). Il faut
-- ensuite créer l'utilisateur dans Authentication > Users, bouton « Add user »,
-- en cochant « Auto Confirm User ». Sans ce second geste, la personne ne peut
-- pas se connecter ; sans ce script, elle se connecte mais ne voit rien.
--
-- À exécuter UNE FOIS, après migration-2026-10-10-confirmation-commande.sql.
-- =============================================================================

create or replace function est_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (array[
    'atelierduboutdahaut@gmail.com',  -- l'artisane, propriétaire du site
    'tomblndeau@gmail.com',           -- le prestataire (adresse sans point)
    'evidencesx@gmail.com'            -- un artisan qui travaille avec l'atelier,
                                      -- accès ouvert le 11/10/2026
  ]);
$$;

-- --- Vérification ------------------------------------------------------------
-- Les trois adresses doivent apparaître dans le corps de la fonction.
select
  prosrc like '%atelierduboutdahaut@gmail.com%' as artisane,
  prosrc like '%tomblndeau@gmail.com%'          as prestataire,
  prosrc like '%evidencesx@gmail.com%'          as nouvelle_adresse
from pg_proc where proname = 'est_admin';
