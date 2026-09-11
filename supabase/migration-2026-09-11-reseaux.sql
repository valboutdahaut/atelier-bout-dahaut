-- =============================================================================
-- migration-2026-09-11-reseaux.sql — renseigner les réseaux sociaux
-- =============================================================================
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
--
-- Format d'une ligne, tel que la page Contact le lit :
--   réseau | nom affiché | adresse du profil
--
-- Le premier champ choisit le logo (instagram, facebook, pinterest). Un mot
-- inconnu affiche un logo de lien générique plutôt que de casser la page.
--
-- Les adresses ci-dessous sont volontairement nettoyées : le lien Instagram
-- fourni contenait un jeton de partage personnel (stkn=...) et un paramètre de
-- suivi, qui n'ont rien à faire sur un site public.
--
-- Tout cela reste modifiable ensuite dans Administration > Textes du site,
-- onglet Contact : ce script ne sert qu'à remplir le champ la première fois.
-- =============================================================================

insert into contenu_site (cle, valeur) values (
  'contact-reseaux',
  'instagram | @atelierboutdahaut | https://www.instagram.com/atelierboutdahaut
facebook | @atelierduboutdahaut | https://www.facebook.com/atelierduboutdahaut/
pinterest | @latelierduboutd | https://fr.pinterest.com/latelierduboutd/'
)
-- Ne remplace la valeur que si le champ est encore vide : si quelqu'un a saisi
-- ses propres liens entre-temps, ils sont conservés.
on conflict (cle) do update
  set valeur = excluded.valeur
  where contenu_site.valeur = '';

-- Vérification : doit afficher les trois lignes ci-dessus.
select valeur as reseaux from contenu_site where cle = 'contact-reseaux';
