-- =============================================================================
-- migration-2026-09-19-messages.sql
-- =============================================================================
-- Fait évoluer la messagerie de contact :
--   1. un sujet choisi dans une liste, avec un sujet libre si « Autre »
--   2. jusqu'à trois photos jointes par message
--   3. un suivi en trois états : nouveau, traité, archivé
--   4. les messages archivés sont supprimés automatiquement au bout d'un mois
--
-- À exécuter UNE FOIS dans le SQL Editor, sur le projet de Paris.
--
-- La table messages_contact est vide à ce jour (vérifié le 19/09/2026), la
-- migration ne peut donc perdre aucune donnée client.
-- =============================================================================

-- --- 1. Colonnes -------------------------------------------------------------
alter table messages_contact
  -- Rempli uniquement quand le visiteur choisit « Autre » dans la liste.
  add column if not exists sujet_libre text,
  -- Chemins dans le bucket messages-photos, pas des adresses complètes : le
  -- bucket est privé, l'administration génère un lien temporaire à l'affichage.
  add column if not exists photos text[] not null default '{}',
  add column if not exists statut text not null default 'nouveau',
  -- Date d'archivage, qui fait courir le délai avant suppression.
  add column if not exists archive_le timestamptz;

alter table messages_contact
  drop constraint if exists messages_contact_statut_check;
alter table messages_contact
  add constraint messages_contact_statut_check
  check (statut in ('nouveau', 'traite', 'archive'));

-- La colonne "lu" est remplacée par "statut", qui dit la même chose en plus
-- précis. Migration des éventuelles lignes existantes avant de la retirer.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'messages_contact' and column_name = 'lu') then
    update messages_contact set statut = 'traite' where lu = true and statut = 'nouveau';
    alter table messages_contact drop column lu;
  end if;
end $$;

-- Les trois vues de l'administration filtrent sur le statut et trient par date.
create index if not exists idx_messages_statut on messages_contact (statut, created_at desc);

-- --- 2. Stockage des pièces jointes ------------------------------------------
-- Bucket séparé et PRIVÉ, contrairement à celui des photos du site : ces images
-- accompagnent une correspondance privée, elles n'ont pas à être lisibles par
-- quiconque connaît leur adresse.
--
-- Les deux garde-fous ci-dessous sont appliqués par le serveur, pas par le
-- navigateur : un envoi qui contournerait le formulaire s'y heurte quand même.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages-photos', 'messages-photos', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "envoi_public_photos_messages" on storage.objects;
drop policy if exists "admin_lecture_photos_messages" on storage.objects;
drop policy if exists "admin_suppression_photos_messages" on storage.objects;

-- Un visiteur peut déposer, jamais lire ni lister : il ne peut donc pas
-- récupérer les pièces jointes envoyées par quelqu'un d'autre.
create policy "envoi_public_photos_messages" on storage.objects
  for insert with check (bucket_id = 'messages-photos');

create policy "admin_lecture_photos_messages" on storage.objects
  for select using (bucket_id = 'messages-photos' and est_admin());

create policy "admin_suppression_photos_messages" on storage.objects
  for delete using (bucket_id = 'messages-photos' and est_admin());

-- --- 3. Purge des messages archivés ------------------------------------------
-- Archiver garde le message visible un mois de plus, puis il disparaît.
-- La fonction supprime d'abord les fichiers, puis les lignes : l'inverse
-- laisserait des photos orphelines dans le stockage, invisibles et éternelles.
create or replace function purger_messages_archives()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  supprimes integer;
begin
  -- Appelée par la tâche planifiée (aucun jeton) ou par l'administration.
  -- Un simple utilisateur connecté ne doit pas pouvoir la déclencher.
  if auth.jwt() is not null and not est_admin() then
    raise exception 'Réservé à l''administration';
  end if;

  delete from storage.objects
  where bucket_id = 'messages-photos'
    and name in (
      select unnest(photos) from messages_contact
      where statut = 'archive' and archive_le < now() - interval '30 days'
    );

  delete from messages_contact
  where statut = 'archive' and archive_le < now() - interval '30 days';

  get diagnostics supprimes = row_count;
  return supprimes;
end;
$fn$;

revoke execute on function purger_messages_archives() from public, anon;
grant execute on function purger_messages_archives() to authenticated;

-- --- 4. Tâche planifiée ------------------------------------------------------
-- Ceinture et bretelles : la purge tourne toutes les nuits si l'extension est
-- disponible, et l'administration l'appelle aussi à l'ouverture des archives.
-- Si pg_cron manque, la seconde suffit, la migration ne doit pas échouer pour
-- autant.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('purge-messages-archives');
exception when others then
  null; -- extension absente, ou tâche pas encore créée : sans conséquence
end $$;

do $$
begin
  perform cron.schedule('purge-messages-archives', '0 3 * * *',
                        'select purger_messages_archives();');
  raise notice 'Purge nocturne planifiée à 3h.';
exception when others then
  raise notice 'pg_cron indisponible : la purge se fera à l''ouverture des archives. (%)', sqlerrm;
end $$;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'messages_contact'
      and column_name in ('sujet_libre', 'photos', 'statut', 'archive_le')) as colonnes_ajoutees,
  (select count(*) from information_schema.columns
    where table_name = 'messages_contact' and column_name = 'lu')          as colonne_lu_restante,
  (select count(*) from storage.buckets where id = 'messages-photos')      as bucket_cree,
  (select count(*) from pg_proc where proname = 'purger_messages_archives') as fonction_purge;
