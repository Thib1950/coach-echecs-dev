# Mon Coach d'échecs

Application web personnelle en français, conçue pour être utilisée sur ordinateur et iPad.

## Compte configuré
- Chess.com : `gone_1950`
- L'application lit l'archive publique Chess.com. Aucun mot de passe Chess.com n'est demandé.

## Version initiale
- Interface responsive avec cinq espaces : vue d'ensemble, parties, entraînement, ouvertures et progression.
- Récupération des archives publiques Chess.com (trois derniers mois).
- Import manuel de fichiers PGN.
- Statistiques de résultats et liste des parties.
- Conservation locale des parties dans le navigateur, avec stockage de développement séparé.
- Puzzles quotidiens et exercices personnalisés créés à partir des erreurs détectées dans tes parties analysées.
- Parcours pédagogique de 20 leçons interactives en tactique, calcul, stratégie, finales et ouvertures, avec suivi et reprise de la dernière leçon.
- Manifeste et service worker pour préparer l'installation comme application web.

## Publication gratuite avec GitHub Pages
Le déploiement est automatisé par GitHub Actions à chaque mise à jour de la branche `main`. L'application est publiée à l'adresse `https://thib1950.github.io/coach-echecs-dev/`.

## Confidentialité
Le dépôt contient le code de l'application, pas les parties personnelles. Les parties importées sont conservées dans le stockage local du navigateur. La version de développement utilise une clé distincte (`coach-echecs-dev-v1`). Au premier lancement, elle copie les parties de la version stable si elles sont présentes dans ce navigateur, sans modifier la clé stable. Les deux versions évoluent ensuite indépendamment. Ne publie pas de fichiers PGN personnels dans le dépôt.

## Refonte de l'interface
- Navigation simplifiée et accueil redessiné avec tableau de bord, accès rapides et historique récent.
- Palette claire et discrète, cartes homogènes et adaptation ordinateur / iPad.
- Précision d'analyse recalculée sur les coups évaluables, sans intégrer les coups d'ouverture classés en théorie.

## Fonctionnalités en développement
- Tableau de bord, historique et statistiques des parties.
- Analyse des parties avec Stockfish et relecture des coups.
- Mode libre avec coups légaux, évaluation et flèches.
- Répertoire d'ouvertures et entraînement des variantes.
- Puzzle quotidien, positions personnalisées issues des erreurs analysées et sessions de cinq exercices ciblés.
- Suivi local des puzzles résolus, des sessions et des erreurs, indépendant des données de la version stable.
- 20 leçons interactives réparties en cinq parcours, avec sauvegarde de la progression.

La version de développement évoluera régulièrement avant toute proposition de remplacement de la version stable.
