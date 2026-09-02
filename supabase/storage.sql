-- =============================================================================
-- storage.sql — bucket "photos" (produits + posts vitrine)
-- =============================================================================
-- À exécuter après policies.sql (utilise la fonction est_admin()).
-- Peut aussi être fait depuis l'interface Supabase (Storage > New bucket,
-- cocher "Public bucket") si le SQL Editor n'accepte pas la création de
-- bucket dans votre région/version.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "lecture_publique_photos" on storage.objects
  for select using (bucket_id = 'photos');

create policy "admin_ecriture_photos" on storage.objects
  for insert with check (bucket_id = 'photos' and est_admin());

create policy "admin_modification_photos" on storage.objects
  for update using (bucket_id = 'photos' and est_admin());

create policy "admin_suppression_photos" on storage.objects
  for delete using (bucket_id = 'photos' and est_admin());
