-- =============================================================================
-- migration-2026-10-06-cgv-cgu.sql
-- =============================================================================
-- Reprend le document juridique fourni par l'atelier le 6 octobre 2026 et le
-- met en ligne dans sa totalité, en deux ensembles distincts :
--
--   cgv-*  conditions générales de VENTE      (24 articles + formulaire)
--   cgu-*  conditions générales d'UTILISATION (13 articles)
--
-- Ce qui a changé par rapport au premier collage :
--   - les conditions d'utilisation n'étaient pas en ligne du tout ;
--   - trois articles de vente manquaient (propriété intellectuelle, données
--     personnelles, cookies) ;
--   - le texte était réparti dans 7 rubriques, il l'est maintenant dans 14 du
--     côté vente et 12 du côté utilisation, une par titre visible sur la page,
--     pour qu'une correction ne demande pas de fouiller un pavé ;
--   - les titres bruts « Article 1 », « Article 2 » et « Article 17 » qui
--     étaient restés dans le texte ont été retirés, les titres appartenant à
--     la page et non au contenu.
--
-- Corrections de fond, validées avec Tom le 6 octobre :
--   - les moyens de paiement réellement proposés sont nommés ;
--   - le délai d'expédition de la boutique est annoncé (deux semaines) ;
--   - l'article « Cookies » dit ce que le site fait vraiment, c'est à dire
--     n'utiliser aucun traceur, au lieu de renvoyer à une politique cookies
--     qui n'existe pas ;
--   - l'adresse de contact des mentions légales comportait une lettre en trop.
--
-- À exécuter UNE FOIS, après migration-2026-09-21-statuts-commandes.sql.
-- =============================================================================

-- --- 1. Conditions générales de vente ----------------------------------------
insert into contenu_site (cle, valeur) values

('cgu-cgv-titre', 'Conditions générales'),

('cgv-maj', '6 octobre 2026'),

('cgv-vendeur', $txt$Les présentes conditions générales de vente sont celles de :

**Bailleux Blondeau Valérie**
Entrepreneure individuelle, micro-entrepreneure
Nom commercial : L'Atelier du Bout d'à Haut
33, rue du Bout d'A Haut
28320 Gallardon, France

SIREN : 839 565 397
SIRET : 839 565 397 00016

E-mail : atelierduboutdahaut@gmail.com
Téléphone : 06 63 70 09 15
Site : www.latelierduboutdahaut.fr$txt$),

('cgv-objet', $txt$Les présentes conditions générales de vente régissent les ventes réalisées sur le site de L'Atelier du Bout d'à Haut auprès des consommateurs. Elles s'appliquent à toute commande passée sur le site.

Le client est invité à les lire attentivement avant toute commande.

La validation de la commande implique l'acceptation des présentes conditions générales de vente, que le client confirme en cochant la case prévue à cet effet avant de valider sa commande.$txt$),

('cgv-produits', $txt$L'Atelier du Bout d'à Haut propose notamment des abat-jour, des abat-jour sur mesure, des lampes, des têtes de lit, du linge de maison, du linge de table, des assises, des coussins, des rideaux et des plaids, ainsi que des travaux de tapisserie et de couture d'ameublement.

Les produits sont réalisés artisanalement dans l'atelier de L'Atelier du Bout d'à Haut.

Les photographies et illustrations sont présentées à titre de représentation. De légères différences de couleur, de texture, de matière ou de finition peuvent exister, en raison notamment des caractéristiques des matériaux et du caractère artisanal de la fabrication.

Ces variations ne constituent pas un défaut lorsqu'elles correspondent aux caractéristiques normales du produit et qu'elles ne compromettent pas sa conformité.

## Produits personnalisés et sur mesure

Certains produits peuvent être personnalisés ou réalisés sur mesure. Les caractéristiques particulières demandées par le client doivent être validées avant la fabrication.

Le client est responsable de l'exactitude des informations, dimensions et spécifications qu'il fournit pour la réalisation d'un produit personnalisé ou sur mesure. Les caractéristiques particulières qu'il accepte peuvent entraîner une différence avec les modèles présentés à titre d'exemple.

Les produits confectionnés selon les spécifications du client ou nettement personnalisés peuvent être exclus du droit légal de rétractation, dans les conditions prévues par l'article L.221-28 du Code de la consommation. Lorsque cette exception s'applique à un produit, cette information est communiquée au client avant la conclusion de la commande.$txt$),

('cgv-commandes', $txt$Le client sélectionne les produits qu'il souhaite commander et vérifie le contenu de son panier avant validation.

Il doit vérifier l'exactitude des informations saisies, notamment ses coordonnées et son adresse de livraison. Avant la validation définitive, il peut corriger les éventuelles erreurs de saisie.

La validation s'effectue au moyen d'un bouton portant la mention « Commande avec obligation de paiement ». La commande devient définitive après cette validation et après confirmation du paiement.

Le numéro de commande est affiché au client dès la confirmation du paiement. Un reçu de paiement lui est adressé par courrier électronique, à l'adresse indiquée lors de la commande.$txt$),

('cgv-prix', $txt$Les prix sont indiqués en euros.

Les prix applicables sont ceux affichés au moment de la validation de la commande. Les frais de livraison sont indiqués avant la validation définitive.

Lorsque les conditions fiscales sont remplies, la facture comporte la mention : « TVA non applicable, article 293 B du Code général des impôts ».

## Moyens de paiement

Le paiement s'effectue en ligne, par carte bancaire, PayPal, Google Pay ou Revolut Pay, selon les moyens proposés sur le site au moment de la commande.

Le paiement est traité par le prestataire Stripe, sur ses propres pages sécurisées. Aucune donnée de carte bancaire ne transite par le site de L'Atelier du Bout d'à Haut, ni n'y est conservée.

Le paiement est exigible au moment de la commande. La commande n'est traitée qu'après confirmation du paiement.$txt$),

('cgv-fabrication', $txt$Les produits étant fabriqués artisanalement, certains articles sont réalisés après commande.

Les commandes passées sur la boutique en ligne sont **expédiées ou mises à disposition au showroom sous deux semaines au maximum**, à compter de la confirmation du paiement.

Les pièces réalisées sur mesure ou sur devis ne sont pas vendues par la boutique en ligne. Leur délai est convenu directement avec l'atelier au moment du devis, en fonction de la nature du projet et du plan de charge.$txt$),

-- Mention de franchise en base, affichée sous chaque prix annoncé avant
-- l'achat. L'atelier ne facture aucune TVA : le prix affiché est donc le prix
-- final, et cette phrase l'explique au lieu de laisser le client se demander
-- si une taxe viendra s'ajouter.
-- Le jour où l'atelier dépasse le seuil de la franchise, cette mention devient
-- fausse et il faut la retirer, en même temps que les prix deviennent TTC.
('boutique-tva', $txt$TVA non applicable, article 293 B du Code général des impôts.$txt$),

-- Le même délai, en une phrase, affiché dans le panier et sur la page de
-- commande. L'information doit être donnée AVANT la validation, pas seulement
-- dans les conditions générales : une seule clé pour les deux endroits, pour
-- qu'ils ne puissent pas se contredire.
('boutique-delai', $txt$Votre commande est expédiée ou mise à disposition au showroom sous deux semaines au maximum, à compter de la confirmation du paiement.$txt$),

('cgv-livraison', $txt$Les livraisons sont effectuées **en France uniquement**. L'atelier ne livre pas à l'étranger.

Le client peut également choisir de retirer sa commande au showroom de Rambouillet, sans frais.

Les frais de livraison sont indiqués avant la validation de la commande. Le transporteur est choisi par L'Atelier du Bout d'à Haut en fonction notamment de la nature, du poids et du volume de la commande, ainsi que de sa destination.

Le vendeur est responsable de la bonne exécution du contrat à l'égard du consommateur, y compris lorsque la livraison est réalisée par un transporteur. En cas de retard ou de difficulté de livraison, le client est invité à contacter rapidement L'Atelier du Bout d'à Haut.

## À la réception

Le client est invité à vérifier l'état apparent du colis et du produit lors de sa réception.

En cas de dommage apparent, il est recommandé de conserver tous les éléments permettant de constater le problème et d'en informer rapidement L'Atelier du Bout d'à Haut. Cette recommandation ne limite pas les droits du client au titre des garanties légales.$txt$),

('cgv-retractation', $txt$Conformément aux dispositions du Code de la consommation, le consommateur dispose d'un délai de **14 jours** pour exercer son droit de rétractation lorsqu'il conclut un contrat de vente à distance.

Pour les ventes de biens, le délai court à compter de la réception du bien par le consommateur ou par le tiers qu'il a désigné, autre que le transporteur. Lorsque plusieurs biens sont livrés séparément, le délai court à compter de la réception du dernier bien ou lot concerné.

Le client n'a pas à justifier sa décision.

## Comment se rétracter

Le client adresse à L'Atelier du Bout d'à Haut, avant l'expiration du délai, une déclaration dénuée d'ambiguïté exprimant sa décision de se rétracter. La demande peut être envoyée par courrier électronique à atelierduboutdahaut@gmail.com, ou au moyen du formulaire reproduit en fin de page.

Le simple retour du produit, sans déclaration explicite, ne suffit pas nécessairement à manifester la volonté de se rétracter.

## Frais de retour

Les frais directs de retour du produit sont à la charge du client, qui en est informé par les présentes conditions avant sa commande.

Le client doit retourner le produit sans retard excessif et au plus tard dans les 14 jours suivant la communication de sa décision de se rétracter.

## Produits exclus

Conformément à l'article L.221-28 du Code de la consommation, le droit de rétractation ne s'applique notamment pas aux biens « confectionnés selon les spécifications du consommateur ou nettement personnalisés ».

Cette exception concerne uniquement les produits entrant effectivement dans cette catégorie. Le caractère artisanal d'un produit, à lui seul, ne supprime pas le droit de rétractation.

## Remboursement

En cas d'exercice valable du droit de rétractation, L'Atelier du Bout d'à Haut rembourse les sommes versées, y compris les frais de livraison initiaux correspondant au mode de livraison standard proposé.

Le remboursement intervient dans les 14 jours suivant la notification de la rétractation. Il peut toutefois être différé jusqu'à récupération du produit, ou jusqu'à réception de la preuve de son expédition, la date retenue étant celle du premier de ces deux événements.

Le remboursement est effectué avec le même moyen de paiement que celui utilisé lors de la transaction, sauf accord exprès du client pour un autre moyen.$txt$),

('cgv-formulaire', $txt$À compléter et à renvoyer uniquement si vous souhaitez vous rétracter.

À l'attention de L'Atelier du Bout d'à Haut, 33 rue du Bout d'A Haut, 28320 Gallardon, France. E-mail : atelierduboutdahaut@gmail.com

Je vous notifie par la présente ma rétractation du contrat portant sur la vente du bien ci-dessous :

Produit ou produits concernés : ...............................
Commandé le, reçu le : ...............................
Numéro de commande : ...............................
Nom du consommateur : ...............................
Adresse du consommateur : ...............................
Date : ...............................
Signature du consommateur, uniquement en cas de notification sur papier : ...............................$txt$),

('cgv-garanties', $txt$Le client consommateur bénéficie des garanties légales applicables, notamment des deux garanties suivantes.

## Garantie légale de conformité

La garantie légale de conformité s'applique aux biens vendus par un professionnel à un consommateur.

Le client dispose d'un délai de **2 ans à compter de la délivrance du bien** pour agir à ce titre. Pour un bien neuf, les défauts de conformité apparus dans ce délai sont présumés exister au moment de la délivrance, dans les conditions prévues par la loi.

Lorsque les conditions légales sont réunies, le consommateur peut notamment obtenir la réparation ou le remplacement du bien ou, lorsque la loi le permet, une réduction du prix ou la résolution du contrat.

## Garantie légale des vices cachés

Le client bénéficie également de la garantie légale des vices cachés prévue aux articles 1641 et suivants du Code civil. L'action doit être exercée dans un délai de **2 ans à compter de la découverte du vice**, dans les conditions prévues par la loi.

Aucune clause des présentes conditions ne peut priver le consommateur des garanties légales auxquelles il a droit.

## Service après-vente

Toute demande concernant un produit peut être adressée à atelierduboutdahaut@gmail.com.

Le client est invité à préciser son numéro de commande et à joindre, si nécessaire, des photographies permettant d'examiner le problème.$txt$),

('cgv-responsabilite', $txt$L'Atelier du Bout d'à Haut est responsable de la bonne exécution des obligations résultant du contrat, conformément aux dispositions légales applicables.

Sa responsabilité ne saurait être engagée en cas de force majeure, ou lorsque le dommage résulte du fait du client ou d'un tiers, dans les conditions prévues par la loi.

Les présentes dispositions ne limitent ni n'excluent les garanties légales dont bénéficie le consommateur.$txt$),

('cgv-propriete', $txt$Les créations, photographies, textes, modèles, illustrations et autres éléments appartenant à L'Atelier du Bout d'à Haut demeurent protégés par les dispositions relatives à la propriété intellectuelle.

Toute reproduction ou exploitation non autorisée est interdite.$txt$),

('cgv-donnees', $txt$Les traitements de données personnelles liés aux commandes sont réalisés conformément à la politique de confidentialité, accessible depuis le pied de page du site, rubrique Légal.

## Cookies et traceurs

Ce site n'utilise aucun cookie publicitaire, aucun traceur de mesure d'audience et aucun outil de suivi de la navigation. Aucun consentement n'est donc demandé au visiteur à ce titre.

Le contenu du panier est conservé dans le navigateur du visiteur, sur son propre appareil, et n'est transmis à l'atelier qu'au moment où il valide sa commande.

Le paiement s'effectue sur les pages du prestataire Stripe, qui peut déposer ses propres cookies sur son domaine, nécessaires au fonctionnement et à la sécurité du paiement.$txt$),

('cgv-litiges', $txt$## Réclamations

Pour toute réclamation, le client contacte en priorité :

L'Atelier du Bout d'à Haut
33, rue du Bout d'A Haut
28320 Gallardon, France
E-mail : atelierduboutdahaut@gmail.com

L'Atelier du Bout d'à Haut s'efforcera de rechercher une solution amiable.

## Médiation de la consommation

Conformément aux dispositions relatives à la médiation de la consommation, le consommateur doit avoir préalablement adressé une réclamation écrite au professionnel avant de pouvoir saisir le médiateur, sous réserve des conditions légales de recevabilité.

L'entité de médiation désignée est :

MÉDIATION CONSOMMATION DÉVELOPPEMENT, MED CONSO DEV
C/O Centre d'Affaires Stéphanois SAS
Immeuble L'Horizon, Esplanade de France
3, rue J. Constant Milleret
42000 Saint-Étienne, France
Site : www.medconsodev.eu

La demande de médiation peut être effectuée selon les modalités indiquées sur le site du médiateur. MED CONSO DEV est une entité de médiation de la consommation référencée par la CECMC.

## Droit applicable

Les présentes conditions générales de vente sont soumises au droit français.

En cas de litige, le consommateur peut utiliser les voies de recours amiables prévues par la réglementation, notamment la réclamation préalable et, lorsque les conditions sont réunies, la médiation de la consommation. À défaut de résolution amiable, les juridictions compétentes sont celles désignées par les règles légales applicables.

## Modification des conditions

L'Atelier du Bout d'à Haut peut modifier les présentes conditions générales de vente pour tenir compte notamment de l'évolution de la réglementation ou des services proposés.

Les conditions applicables à une commande sont celles acceptées par le client au moment de la conclusion du contrat.$txt$),

-- --- 2. Conditions générales d'utilisation -----------------------------------

('cgu-maj', '6 octobre 2026'),

('cgu-objet', $txt$Les présentes conditions générales d'utilisation définissent les conditions d'accès et d'utilisation du site www.latelierduboutdahaut.fr.

Elles s'appliquent à toute personne consultant ou utilisant le site.

Les ventes réalisées sur le site sont régies par les conditions générales de vente, consultables dans l'onglet voisin.$txt$),

('cgu-acces', $txt$Le site est accessible, en principe, 24 heures sur 24 et 7 jours sur 7.

L'Atelier du Bout d'à Haut peut interrompre temporairement l'accès au site, notamment pour des raisons de maintenance, de mise à jour ou de sécurité.$txt$),

('cgu-utilisation', $txt$L'utilisateur s'engage à utiliser le site conformément aux lois et règlements en vigueur.

Il lui est notamment interdit de perturber le fonctionnement du site, d'y introduire des virus ou tout programme malveillant, de tenter d'accéder sans autorisation aux systèmes informatiques, de détourner le site à des fins frauduleuses, ou de porter atteinte aux droits de L'Atelier du Bout d'à Haut ou de tiers.$txt$),

('cgu-informations', $txt$Les informations publiées sur le site sont fournies à titre informatif.

L'Atelier du Bout d'à Haut s'efforce de les maintenir à jour mais ne peut garantir l'absence totale d'erreurs ou d'omissions.

Les caractéristiques et conditions de vente applicables à une commande sont celles présentées au client au moment de la conclusion du contrat, ainsi que les conditions générales de vente alors en vigueur.$txt$),

('cgu-propriete', $txt$Le site et l'ensemble de ses éléments, notamment les textes, photographies, images, illustrations, logos, créations et graphismes, sont protégés par les dispositions relatives à la propriété intellectuelle.

Toute reproduction, représentation, adaptation ou exploitation non autorisée est interdite, sauf dans les limites prévues par la loi.$txt$),

('cgu-liens', $txt$Le site peut contenir des liens vers des sites internet extérieurs, notamment vers les réseaux sociaux de l'atelier.

L'Atelier du Bout d'à Haut n'exerce aucun contrôle sur ces sites et ne saurait être tenue responsable de leur contenu, de leur disponibilité ou de leurs pratiques.$txt$),

('cgu-donnees', $txt$La collecte et le traitement des données personnelles sont régis par la politique de confidentialité, accessible depuis le pied de page du site, rubrique Légal.

## Cookies et traceurs

Ce site n'utilise aucun cookie publicitaire, aucun traceur de mesure d'audience et aucun outil de suivi de la navigation. Aucun consentement n'est donc demandé au visiteur à ce titre.

Le contenu du panier est conservé dans le navigateur du visiteur, sur son propre appareil. L'espace d'administration réservé à l'atelier utilise un identifiant de connexion, strictement nécessaire à son fonctionnement.$txt$),

('cgu-securite', $txt$L'Atelier du Bout d'à Haut met en œuvre des mesures raisonnables afin d'assurer la sécurité du site.

L'utilisateur reconnaît toutefois qu'aucune transmission de données sur internet ne peut être garantie comme totalement sécurisée.$txt$),

('cgu-responsabilite', $txt$L'Atelier du Bout d'à Haut ne saurait être tenue responsable d'une interruption temporaire du site, ou d'une impossibilité d'accès résultant notamment d'une maintenance, d'un incident technique ou d'un événement indépendant de sa volonté.

Cette disposition ne limite pas les responsabilités qui ne peuvent légalement être exclues.$txt$),

('cgu-modification', $txt$L'Atelier du Bout d'à Haut peut modifier les présentes conditions générales d'utilisation à tout moment, afin de tenir compte de l'évolution du site, de ses services ou de la réglementation.

La version applicable est celle publiée sur le site à la date de consultation.$txt$),

('cgu-droit', $txt$Les présentes conditions générales d'utilisation sont soumises au droit français.

En cas de litige, les règles légales relatives à la compétence des juridictions s'appliquent.$txt$),

('cgu-contact', $txt$Pour toute question concernant l'utilisation du site :

L'Atelier du Bout d'à Haut
33, rue du Bout d'A Haut
28320 Gallardon, France
E-mail : atelierduboutdahaut@gmail.com
Téléphone : 06 63 70 09 15$txt$),

-- --- 3. Mentions légales complétées ------------------------------------------
-- L'adresse de contact comportait un « l » en trop, elle ne menait donc nulle
-- part. C'est l'adresse qu'un visiteur doit pouvoir utiliser pour joindre
-- l'éditeur, son exactitude est une obligation.

('mentions-editeur', $txt$**L'Atelier du Bout d'à Haut**
Nom commercial de Bailleux Blondeau Valérie
Entrepreneure individuelle, micro-entrepreneure

SIREN : 839 565 397
SIRET : 839 565 397 00016
RCS Chartres

Téléphone : 06 63 70 09 15$txt$),

('mentions-responsable', $txt$Mme Valérie Bailleux Blondeau, en qualité de directrice de la publication.$txt$),

('mentions-contact', $txt$atelierduboutdahaut@gmail.com$txt$),

('mentions-hebergement', $txt$Le site est hébergé par **Netlify, Inc.**
512 2nd Street, Suite 200
San Francisco, CA 94107
États-Unis
www.netlify.com

Les textes, les photos, les messages et les commandes sont enregistrés chez **Supabase**, sur l'infrastructure Amazon Web Services située à Paris, en France.

Les paiements en ligne sont traités par **Stripe**, dont l'entité européenne est établie en Irlande. Le détail de ces prestataires figure dans la politique de confidentialité.$txt$),

-- --- 4. Politique de confidentialité remise à jour ----------------------------
-- Elle datait d'avant le paiement en ligne et affirmait que les données
-- n'étaient transmises à personne, ce qui n'est plus exact depuis que Stripe
-- traite les paiements. La durée de conservation, obligatoire, était vide.

('confidentialite-collecte', $txt$Ce site n'utilise aucun traceur publicitaire et ne mesure pas votre navigation. Il n'enregistre que les informations que vous saisissez vous-même.

**Si vous envoyez un message depuis la page Contact** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, le sujet et le contenu de votre message, ainsi que les photos que vous y joignez.

**Si vous passez une commande** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, votre adresse de livraison le cas échéant, et le détail de votre commande.

**Si vous payez en ligne** : le paiement se déroule sur les pages de notre prestataire Stripe. Votre numéro de carte ne transite jamais par ce site et n'y est jamais enregistré. Nous ne conservons que le montant, la date et le fait que le paiement a abouti.

**Votre panier** reste dans votre navigateur, sur votre appareil, et n'est transmis à l'atelier qu'au moment où vous validez votre commande.$txt$),

('confidentialite-usage', $txt$À répondre à vos demandes, à préparer et à vous remettre vos commandes, et à respecter nos obligations comptables. Rien d'autre.

Vos informations ne sont jamais vendues, ni louées, ni transmises à qui que ce soit à des fins commerciales ou publicitaires.

Elles sont en revanche confiées aux prestataires techniques strictement nécessaires au fonctionnement du site, listés plus bas, qui agissent pour notre compte et n'ont pas le droit de les utiliser à d'autres fins.$txt$),

('confidentialite-duree', $txt$**Les messages de contact** sont conservés le temps nécessaire à leur traitement. Une fois archivés par l'atelier, ils sont supprimés automatiquement au bout d'un mois, photos jointes comprises.

**Les commandes réglées** sont conservées 10 ans, durée imposée par les obligations comptables.

**Les commandes commencées mais jamais payées** sont supprimées automatiquement au bout d'un an. Elles ne donnent lieu à aucune relance.$txt$),

('confidentialite-lieu', $txt$**Supabase** héberge la base de données du site : les textes, les photos, les messages et les commandes. Les données sont stockées sur l'infrastructure Amazon Web Services située à Paris, en France.

**Netlify** héberge les pages du site.

**Stripe** traite les paiements en ligne. Il reçoit à ce titre votre nom, votre adresse e-mail et le montant de votre commande. Son entité européenne est établie en Irlande.$txt$),

('confidentialite-droits', $txt$Vous pouvez demander à consulter, à corriger ou à supprimer les informations qui vous concernent, ou vous opposer à leur traitement.

Il suffit d'écrire à atelierduboutdahaut@gmail.com. Une réponse vous est apportée dans un délai d'un mois.

Certaines informations ne peuvent pas être supprimées avant le terme prévu lorsque la loi impose de les conserver, notamment les commandes pour des raisons comptables.

Si la réponse ne vous satisfait pas, vous pouvez saisir la Commission nationale de l'informatique et des libertés, la CNIL, sur www.cnil.fr.$txt$)

on conflict (cle) do update set valeur = excluded.valeur;

-- --- 5. Tenir la promesse de suppression -------------------------------------
-- La politique de confidentialité annonce désormais que les commandes jamais
-- payées sont supprimées au bout d'un an. Une durée de conservation annoncée
-- et non appliquée vaut moins que pas de durée du tout : voici la suppression.
--
-- Les commandes réglées ne sont jamais touchées, elles relèvent de l'obligation
-- comptable de dix ans. Les lignes de commande partent avec, la clé étrangère
-- étant déclarée en suppression en cascade.
create or replace function purger_commandes_non_reglees()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total integer;
begin
  with supprimees as (
    delete from commandes
    where paiement_statut not in ('paye', 'non_requis')
      and created_at < now() - interval '1 year'
    returning 1
  )
  select count(*) into v_total from supprimees;
  return v_total;
end;
$fn$;

revoke execute on function purger_commandes_non_reglees() from public, anon;
grant execute on function purger_commandes_non_reglees() to authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('purge-commandes-non-reglees');
exception when others then
  null; -- extension absente, ou tâche pas encore créée : sans conséquence
end $$;

do $$
begin
  perform cron.schedule('purge-commandes-non-reglees', '40 4 1 * *',
                        'select purger_commandes_non_reglees();');
  raise notice 'Suppression des commandes non réglées planifiée le 1er de chaque mois.';
exception when others then
  raise notice 'pg_cron indisponible : la suppression devra être faite à la main. (%)', sqlerrm;
end $$;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from contenu_site where cle like 'cgv-%')                    as blocs_cgv,
  (select count(*) from contenu_site where cle like 'cgu-%' and cle <> 'cgu-cgv-titre') as blocs_cgu,
  (select count(*) from contenu_site where cle like 'cgv-%' and valeur = '')    as cgv_vides,
  (select count(*) from contenu_site where cle like 'cgu-%' and valeur = '')    as cgu_vides,
  (select count(*) from contenu_site where cle like 'confidentialite-%' and valeur = '') as confidentialite_vides,
  (select count(*) from pg_proc where proname = 'purger_commandes_non_reglees') as fn_purge;
