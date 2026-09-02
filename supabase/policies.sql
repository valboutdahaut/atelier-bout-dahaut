-- =============================================================================
-- policies.sql — Row Level Security
-- =============================================================================
-- À exécuter après schema.sql.
--
-- L'adresse email ci-dessous est celle qui aura le droit d'administrer le
-- site. Elle doit correspondre exactement au compte Netlify Identity de
-- Valérie. Si elle change un jour, c'est le SEUL endroit à modifier : la
-- fonction est_admin() est utilisée par toutes les policies plus bas.
--
-- Prérequis : le secret JWT de Netlify Identity doit être configuré dans
-- Supabase (Project Settings > API > JWT Settings) pour qu'auth.jwt() sache
-- lire le jeton émis par Netlify Identity. Voir le README du projet.
-- =============================================================================

create or replace function est_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'atelierduboutdahaut@gmail.com';
$$;

-- --- categories ---------------------------------------------------------------
alter table categories enable row level security;

create policy "lecture_publique_categories" on categories
  for select using (visible = true);

create policy "admin_full_access_categories" on categories
  for all using (est_admin()) with check (est_admin());

-- --- contenu_site ---------------------------------------------------------------
alter table contenu_site enable row level security;

create policy "lecture_publique_contenu_site" on contenu_site
  for select using (true);

create policy "admin_full_access_contenu_site" on contenu_site
  for all using (est_admin()) with check (est_admin());

-- --- produits -----------------------------------------------------------------
alter table produits enable row level security;

create policy "lecture_publique_produits" on produits
  for select using (statut = 'publie');

create policy "admin_full_access_produits" on produits
  for all using (est_admin()) with check (est_admin());

-- --- posts_vitrine --------------------------------------------------------------
alter table posts_vitrine enable row level security;

create policy "lecture_publique_posts_vitrine" on posts_vitrine
  for select using (statut = 'publie');

create policy "admin_full_access_posts_vitrine" on posts_vitrine
  for all using (est_admin()) with check (est_admin());

-- --- commandes / lignes_commande ------------------------------------------------
-- Aucune policy INSERT publique : le seul chemin d'écriture pour un visiteur
-- est la fonction creer_commande() (security definer, voir functions.sql),
-- qui contourne RLS pour insérer proprement dans une transaction. Un visiteur
-- ne peut jamais lire les commandes de quelqu'un d'autre.
alter table commandes enable row level security;
alter table lignes_commande enable row level security;

create policy "admin_full_access_commandes" on commandes
  for all using (est_admin()) with check (est_admin());

create policy "admin_full_access_lignes_commande" on lignes_commande
  for all using (est_admin()) with check (est_admin());

-- --- messages_contact --------------------------------------------------------------
alter table messages_contact enable row level security;

create policy "insertion_publique_messages_contact" on messages_contact
  for insert with check (true);

create policy "admin_full_access_messages_contact" on messages_contact
  for all using (est_admin()) with check (est_admin());
