-- =============================================================================
-- migration-2026-09-10-apropos.sql — ajout de la page À propos
-- =============================================================================
-- À exécuter UNE FOIS dans le SQL Editor de Supabase (Project > SQL Editor)
-- sur une base déjà en service.
--
-- Ne pas relancer seed.sql à la place : il réinsérerait les catégories et
-- échouerait sur la contrainte d'unicité. Ce script-ci ne touche qu'à
-- contenu_site et ne fait rien si les clés existent déjà.
--
-- Après exécution, les trois textes sont modifiables dans
-- Administration > Textes du site.
-- =============================================================================

insert into contenu_site (cle, valeur) values
  ('apropos-titre', 'Un métier appris à l''établi, transmis par la main.'),
  ('apropos-intro', 'Formée à la tapisserie d''ameublement traditionnelle et contemporaine, j''accompagne chaque pièce du dégarnissage à la finition : sanglage, guindage, garniture, couture. Le choix du tissu se fait ensemble, à l''atelier ou au showroom.'),
  -- Volontairement vide : à remplir depuis l'admin. Tant qu'aucune ligne n'est
  -- saisie, la section "Formations et certifications" reste masquée sur le site.
  ('apropos-formations', '')
on conflict (cle) do nothing;

-- Vérification : doit renvoyer les trois lignes ci-dessus.
select cle, valeur from contenu_site where cle like 'apropos-%' order by cle;
