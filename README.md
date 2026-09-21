# Vitrine + Marketplace — L'Atelier du Bout d'à Haut

Statut : en cours (maquette Claude Design finalisée, site HTML/CSS/JS implémenté, reste à créer les comptes Supabase/Netlify et déployer)

## Contexte

Refonte moderne du site de **L'Atelier du Bout d'à Haut**, artisane tapissière-garnisseuse (atelier à Gallardon, showroom à Rambouillet).

Ancien site : https://www.latelierduboutdahaut.fr/ (site daté visuellement, construit sur un créateur de site IONOS/1&1). On garde les mêmes codes couleurs et la même typo de fond, adoucis et modernisés, ainsi que la structure de contenu existante (tapissier / couture d'ameublement / abat-jour, blog "Le Boudoir", démarche d'économie circulaire).

## Objectif du site

Trois parties, plus un espace d'administration à liberté totale sur le fond (jamais sur la forme) :

1. **Vitrine** : grosses pièces (fauteuils, canapés, chaises), présentées comme un portfolio avec récits avant/après. Pas de vente directe, juste du contact.
2. **Marketplace** : petites pièces en vente directe (abat-jours, lampes, rideaux, coussins).
3. **Admin** : formulaires guidés pour ajouter un produit boutique ou un post vitrine, sans jamais pouvoir toucher à la mise en page.

## Structure du dossier

```
atelier-bout-dahaut/
├── Atelier du Bout d'a Haut.dc.html   Maquette Claude Design (référence visuelle, ne pas déployer)
├── support.js, uploads/, assets/       Fichiers du canvas de design (référence)
├── supabase/                           Scripts SQL à exécuter une fois (voir plus bas)
├── netlify.toml                        Config de déploiement
└── site/                               LE SITE RÉEL — tout ce qui est déployé sur Netlify
```

Stack : HTML/CSS/JS simple, sans framework ni étape de build. Les données (produits, posts, commandes) vivent dans Supabase, interrogées directement depuis le JS du navigateur. L'admin est protégé par Supabase Auth, en connexion par lien magique (aucun mot de passe).

## Dépôt Git

Ce dossier est un **dépôt Git indépendant**, avec son propre historique, sa propre branche `main`, son propre `.gitignore` et son propre `.gitattributes`. Il se trouve physiquement à l'intérieur du workspace Jarvis de Tom (qui l'ignore volontairement), mais il n'en fait pas partie.

C'est délibéré : un transfert de dépôt GitHub emporte **tout l'historique**, y compris les fichiers supprimés depuis. Si le code du site partageait le dépôt Jarvis, il serait impossible de le transférer à la cliente sans lui livrer aussi le contenu personnel du workspace (profil, objectifs, historique de sessions). La séparation devait donc être faite avant le premier envoi sur GitHub, pas au moment de la livraison.

Conséquence pratique : toutes les commandes Git de ce projet doivent être lancées **depuis ce dossier**, pas depuis la racine du workspace Jarvis.

## Lancer le site en local

Le site utilise `fetch()` pour injecter le header/footer (`site/js/include.js`), ce qui ne fonctionne pas en ouvrant les fichiers directement (`file://`). Il faut un serveur HTTP local :

```
npx serve site
```

Puis ouvrir l'URL affichée (ex. http://localhost:3000). Sans configuration Supabase, les pages publiques se chargent mais restent vides (erreurs réseau visibles dans la console) — normal, voir l'étape suivante.

## Mettre en place Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans le SQL Editor, exécuter dans l'ordre : `supabase/schema.sql`, `supabase/policies.sql`, `supabase/functions.sql`, `supabase/storage.sql`. `supabase/seed.sql` est optionnel, utile pour tester. L'adresse email qui a le droit d'administrer le site est fixée dans `policies.sql` (fonction `est_admin()`), actuellement `atelierduboutdahaut@gmail.com`.
3. Copier l'URL et la clé anon publique du projet (Project Settings > API) dans `site/js/config.js`
4. Dans **Authentication > Users**, créer l'utilisateur `atelierduboutdahaut@gmail.com` (bouton "Add user", option "Auto Confirm User")
5. Dans **Authentication > Sign In / Providers > Email**, désactiver **"Allow new users to sign up"**. Sans ça, n'importe qui pourrait se créer un compte. Il ne pourrait rien modifier (les policies ne reconnaissent que l'adresse de l'atelier), mais autant fermer la porte.
6. Dans **Authentication > URL Configuration**, renseigner l'adresse du site en **Site URL** et l'ajouter aux **Redirect URLs** (ex. `https://atelier-bout-dahaut.netlify.app/**`). C'est ce qui autorise le retour du lien magique.

### Migrations (base déjà en service)

Les scripts `supabase/migration-*.sql` s'appliquent à une base **déjà en production**, une fois chacun, dans le SQL Editor. Ne pas relancer `seed.sql` à leur place : il réinsérerait les catégories et échouerait sur la contrainte d'unicité.

| Script | Effet | Exécuté ? |
| --- | --- | --- |
| `migration-2026-09-10-apropos.sql` | Crée les trois textes de la page À propos dans `contenu_site` | fait le 10/09/2026 |
| `migration-2026-09-10-admin-tom.sql` | Ouvre l'administration à une seconde adresse (le prestataire) | fait le 10/09/2026 |
| `migration-2026-09-11-reseaux.sql` | Renseigne les trois réseaux sociaux affichés sur la page Contact | fait le 11/09/2026 |
| `migration-2026-09-11-mentions.sql` | Ajoute les mentions de l'entreprise et le nom complet de la page Facebook | fait le 11/09/2026 |
| `migration-2026-09-19-pages-legales.sql` | Crée les textes des trois pages légales (mentions, confidentialité, CGU et CGV) | fait le 19/09/2026 |
| `migration-2026-09-19-reprise-contenu.sql` | Reprend le contenu de l'ancien projet de Londres dans celui de Paris | fait le 19/09/2026 |
| `migration-2026-09-19-hebergement-paris.sql` | Indique Paris comme lieu d'hébergement dans la politique de confidentialité | fait le 19/09/2026 |
| `migration-2026-09-19-legal-en-rubriques.sql` | Découpe les pages légales en rubriques, une clé et un encadré d'admin par rubrique | fait le 19/09/2026 |
| `migration-2026-09-19-messages.sql` | Messagerie : sujet en liste, photos jointes, suivi en trois états, purge des archives | fait le 19/09/2026 |
| `migration-2026-09-19-paiement.sql` | Suivi du paiement Stripe, preuve d'achat du visiteur, libération du stock | fait le 21/09/2026 |
| `migration-2026-09-21-statuts-commandes.sql` | « Retirée » devient « Livrée » ; annuler une commande peut remettre les pièces en vente | **à exécuter** |

> ⚠️ `functions.sql` n'avait pas été rejoué lors du passage sur le projet de Paris : sans lui, `creer_commande()` n'existe pas et **toute commande échoue**. À exécuter avant la migration paiement.

### Paiement en ligne (Stripe)

Le site est statique : le montant ne doit jamais venir du navigateur, sinon il est modifiable. Deux fonctions serveur (Supabase Edge Functions) s'en chargent, leur code est dans `supabase/functions/`.

#### Comment l'argent et le stock circulent

1. Le client valide ses coordonnées. `creer_commande()` enregistre la commande, **relit les prix réels** et **retire le stock** tout de suite, pour que deux clients n'achètent pas la même pièce unique pendant qu'ils paient.
2. `creer-paiement` retrouve cette commande par son numéro, ouvre une session Stripe de son vrai montant, et renvoie l'adresse de la page de paiement. La session vaut **une heure**, durée de la réservation du stock.
3. Le client paie chez Stripe. Aucun numéro de carte ne touche ce site.
4. **Stripe prévient le serveur** (`stripe-webhook`), qui seul fait foi. Le retour du navigateur ne prouve rien : on peut ouvrir l'adresse de confirmation à la main.
5. Si le client renonce, la page panier libère la réservation immédiatement. S'il ferme simplement l'onglet, Stripe signale l'expiration au bout d'une heure. Et si le webhook est en panne, `purger_commandes_abandonnees()` repasse derrière toutes les heures.

Le visiteur n'étant pas connecté, la page de confirmation prouve son achat avec un **jeton** propre à la commande, transporté dans l'adresse de retour. Les fonctions `statut_commande()` et `annuler_paiement_client()` ne répondent que sur présentation de ce jeton, et ne renvoient aucune donnée personnelle.

#### Mise en place, dans l'ordre

1. **Compte Stripe au nom de l'entreprise.** Il faut le SIRET, une pièce d'identité et l'IBAN pour recevoir les virements. Le **mode test** du même compte fonctionne sans attendre cette vérification : on développe et on valide avec, puis on bascule sur les clés réelles.
2. **Moyens de paiement** : Stripe > Settings > Payment methods. Le code ne fixe volontairement aucune liste (`payment_method_types` n'est pas renseigné), donc cocher une case suffit, sans redéploiement. Activés au 21/09/2026 : carte, PayPal, Google Pay, Revolut Pay.

   > ⚠️ **Avant d'activer un moyen de paiement différé** (prélèvement SEPA, virement bancaire, Klarna), s'abonner aussi à **`checkout.session.async_payment_succeeded`** dans la destination d'évènements. Ces moyens terminent le parcours d'achat sans que l'argent soit confirmé, parfois des jours plus tard. Le webhook refuse déjà de marquer « payée » une commande dont le paiement n'est pas confirmé, donc rien ne peut être expédié à tort ; mais sans cet évènement supplémentaire, le règlement ne serait jamais enregistré et la commande resterait en attente jusqu'à sa libération automatique.
3. **Déployer les fonctions** : Supabase > Edge Functions > *Deploy a new function* > **Via Editor**, une fois par fonction, en collant le fichier correspondant :
   - `creer-paiement` — laisser la vérification de jeton activée
   - `stripe-webhook` — **désactiver « Verify JWT »**, Stripe appelle sans jeton Supabase ; sa sécurité vient de la signature vérifiée dans le code
4. **Secrets** : Supabase > Edge Functions > Secrets :
   - `STRIPE_SECRET_KEY` — clé secrète Stripe
   - `STRIPE_WEBHOOK_SECRET` — *signing secret* du webhook (`whsec_…`)
   - `SITE_URL` — adresse du site, sans barre oblique finale
5. **Webhook** : Stripe > Developers > Webhooks, adresse `https://<projet>.supabase.co/functions/v1/stripe-webhook`, abonné à **`checkout.session.completed`** et **`checkout.session.expired`**.

**Ne jamais mettre la clé secrète Stripe dans `site/js/`** : tout ce qui est dans ce dossier est téléchargé par les visiteurs.

#### Recette en mode test

Carte de test : `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel cryptogramme.

- Paiement accepté → confirmation « paiement confirmé », panier vidé, commande **Payée** dans l'administration.
- Carte refusée `4000 0000 0000 0002` → le client reste chez Stripe et peut réessayer.
- Retour en arrière depuis la page Stripe → panier intact, message d'abandon, **stock rendu** (vérifier le stock du produit dans l'administration).
- Onglet fermé sans payer → au bout d'une heure, la commande passe en *Abandonnée* et le stock revient.

#### Passage en réel

Reprendre les points 4 et 5 avec les valeurs du **mode réel** : la clé secrète change, et le webhook doit être recréé côté réel, avec un nouveau *signing secret*. Faire ensuite un achat réel de faible montant, puis le rembourser depuis le tableau de bord Stripe.

**E-mails aux clients** (Stripe > Paramètres > E-mails, adresse `/settings/emails`). Ces réglages restent verrouillés tant que le compte n'est pas activé, il faut donc y revenir une fois la vérification Stripe passée :

- **Langue par défaut : Français.** Par défaut l'anglais, ce qui enverrait des reçus en anglais à des clientes françaises. La page de paiement, elle, est déjà forcée en français par le code (`locale: 'fr'`).
- **Paiements réussis : activé.** C'est le reçu que la page de confirmation promet à l'acheteur. Sans lui, le site annonce un e-mail qui n'arrive jamais.
- **Remboursements : activé.**

**Avant d'encaisser de vrais clients** : les CGV doivent être rédigées (droit de rétractation de 14 jours et son exception pour le sur-mesure, délais de livraison, garanties), et un médiateur de la consommation désigné, obligatoire pour toute vente à des particuliers en France.

Après ce dernier script, créer aussi l'utilisateur dans **Authentication > Users** ("Add user", cocher "Auto Confirm User") : ajouter une adresse dans `est_admin()` lui donne les droits, mais ne crée pas le compte, les inscriptions publiques étant fermées.

**Note historique** : l'authentification devait initialement passer par Netlify Identity, avec un pont de secret JWT vers Supabase. Cette approche n'est plus viable : depuis octobre 2025, Supabase signe ses jetons avec des clés asymétriques et n'accepte des identités externes que via un fournisseur exposant une découverte OIDC, ce que Netlify Identity ne fait pas. On utilise donc Supabase Auth, plus simple et mieux intégré puisque les données sont déjà chez Supabase.

## Mettre en place Netlify

1. New site from Git, sélectionner le dépôt de ce site
2. Aucun **Base directory** à renseigner : ce dossier est la racine du dépôt, `netlify.toml` fait le reste (il publie `site/`)
3. Rien à configurer côté authentification : elle est entièrement gérée par Supabase Auth

**Limite à connaître (offre gratuite)** : sur un dépôt **privé**, Netlify n'autorise qu'un seul contributeur Git. Si le compte Netlify appartient au client et que le prestataire pousse le code, les déploiements sont bloqués ("unrecognized Git contributor"). Trois issues : rendre le dépôt public, héberger le site sur le compte Netlify du prestataire, ou passer le client en offre Pro.

## Décisions de scope prises pendant l'implémentation

La maquette (10 écrans) ne détaillait pas tout. Ce qui a été tranché sans repasser par Tom, documenté ici pour traçabilité :

- **Textes génériques du site** (hero, bio, footer) : rendus éditables via une page admin dédiée (`admin/textes.html` + table `contenu_site`), cohérent avec l'objectif initial de liberté totale sur le fond, même si la maquette ne montrait pas cette section
- **Page Contact** : construite de toutes pièces (formulaire simple), absente de la maquette mais indispensable
- **Lien nav "Savoir-faire"** → ancre sur la section de l'accueil ; **"Le Boudoir"** → alias vers la vitrine (voir le README historique de l'ancien site)
- **Filtres boutique** (prix) codés en dur ; seules les catégories sont éditables par l'admin
- **Commandes / Messages de contact en admin** : portée minimale (liste + détail + statut), pas de facturation ni d'emails automatiques
- **Pagination boutique** : non implémentée (catalogue d'artisan, volume attendu faible) ; filtre "Disponibilité" de la maquette non repris (le stock filtre déjà les produits épuisés)

## Identité visuelle

| Rôle | Couleur | Hex | Confiance |
|---|---|---|---|
| Fond | Blanc cassé | `#F4EDDE` | fournie par Tom |
| Accent principal | Ile de Malte (Tollens CR4123-1) | `#C0D4C9` | moyenne, non confirmée sur une source primaire |
| Accent secondaire | Vert profond assorti | `#7FA6A2` | proposition Claude, à valider visuellement |
| Texte | Bleu marine | `#1B2A41` | proposition Claude, à valider visuellement |

Typographie : **Libre Baskerville** en titres (reprise de l'ancien site, vérifiée dans son code source), **Work Sans** en texte courant (proposition Claude pour la lisibilité web).

### Sources

- Ancien site (structure, contenu, police) : https://www.latelierduboutdahaut.fr/
- Bain de mer CR4120-6 `#C3DDDC` (couleur explorée puis remplacée par Ile de Malte) : https://www.photoshoplus.fr/couleurs/couleurs-tollens/
- Ile de Malte CR4123-1 : pas de page officielle retrouvée, valeur basée sur des résultats de recherche concordants mais non vérifiés directement. **À confirmer avec un nuancier Tollens si possible.**

## Historique — prompt de design (déjà utilisé, gardé pour référence)

```
Crée une maquette multi-écrans pour le site de L'Atelier du Bout d'à Haut,
artisane tapissière-garnisseuse (atelier à Gallardon, showroom à Rambouillet).
Format : mockup UI / canvas de design, pas de code fonctionnel.

IDENTITÉ VISUELLE
Palette :
- Fond : blanc cassé #F4EDDE
- Accent principal : vert "Ile de Malte" #C0D4C9 (aplats doux, fonds de
  section, éléments décoratifs)
- Accent secondaire : vert profond #7FA6A2 (boutons, hover, éléments
  d'action)
- Texte : bleu marine #1B2A41
Typographie : Libre Baskerville pour les titres (élégant, classique),
Work Sans pour le texte courant (sobre, lisible, moderne).
Ambiance : version modernisée et épurée de l'identité actuelle de
l'atelier (aujourd'hui un site un peu daté visuellement) : mêmes codes
couleurs adoucis, mise en page plus aérée et plus contemporaine.

STRUCTURE DU SITE (3 parties + admin)

1. Page d'accueil
   Hero sur une pièce phare (fauteuil restauré), courte présentation de
   l'artisane, deux accès clairs : "Vitrine" et "Boutique".

2. Vitrine (grosses pièces : fauteuils, canapés, chaises)
   Galerie de réalisations façon portfolio, organisée autour des trois
   savoir-faire de l'atelier : tapisserie, couture d'ameublement, abat-jour
   sur mesure. Chaque pièce = photos avant/après + récit du projet (style
   article de blog, dans l'esprit du blog existant "Le Boudoir"). Pas de
   prix ni d'achat direct, CTA "Me contacter pour un projet similaire".
   Une mention discrète de la démarche d'économie circulaire (rénovation
   plutôt que remplacement) fait partie de l'identité de l'atelier.

3. Marketplace (petites pièces : abat-jours, lampes, rideaux, coussins)
   Grille produits en vente directe. Fiche produit : photos, prix,
   description, bouton d'achat. Mini tunnel panier (mockup, pas de vrai
   paiement).

4. Espace administrateur
   Tableau de bord simple avec deux actions principales :
   - "Ajouter un produit boutique" (formulaire : photos, titre, prix,
     description, stock)
   - "Ajouter un post vitrine" (formulaire : photos avant/après, titre,
     texte du récit)

   Contrainte clé : l'admin peut tout modifier sur le FOND (textes, photos,
   produits, posts) mais jamais sur la FORME (mise en page, couleurs,
   structure). Les formulaires sont donc simples et guidés, pas un éditeur
   de mise en page libre.

COHÉRENCE
Même identité visuelle sur vitrine, boutique et admin (l'admin peut être
plus sobre/fonctionnel, style back-office). Responsive mobile + desktop.
```

## Prochaine étape

1. ✅ Créer le projet Supabase et exécuter les scripts SQL (voir plus haut)
2. ✅ Remplir `site/js/config.js`
3. ✅ Créer le site Netlify et déployer
4. Créer l'utilisateur admin dans Supabase Auth, fermer les inscriptions publiques, autoriser l'adresse de redirection
5. Remplacer les placeholders photo par de vraies photos une fois le catalogue réel saisi
6. Brancher un vrai nom de domaine
