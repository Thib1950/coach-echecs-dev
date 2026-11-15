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
- Conservation locale des parties dans le navigateur.
- Manifeste et service worker pour préparer l'installation comme application web.

## Publication gratuite avec GitHub Pages
Dans le dépôt GitHub :
1. Ouvrir **Settings**.
2. Dans le menu **Pages**, choisir **Deploy from a branch**.
3. Choisir la branche **main** et le dossier **/(root)**, puis **Save**.
4. Attendre la publication. L'adresse attendue est `https://thib1950.github.io/coach-echecs-dev/`.

## Confidentialité
Le dépôt contient le code de l'application, pas les parties personnelles. Les parties importées sont conservées dans le stockage local du navigateur. La version de développement utilise une clé distincte (`coach-echecs-dev-v1`). Au premier lancement, elle copie les parties de la version stable si elles sont présentes dans ce navigateur, sans modifier la clé stable. Les deux versions évoluent ensuite indépendamment. Ne publie pas de fichiers PGN personnels dans le dépôt.

## Prochaines étapes
1. Vérifier la synchronisation Chess.com sur Safari et les éventuelles restrictions CORS.
2. Ajouter un échiquier interactif et la navigation coup par coup.
3. Intégrer Stockfish WebAssembly avec des réglages adaptés à l'iPad.
4. Analyser les erreurs, les occasions manquées, les ouvertures et les finales.
5. Construire des exercices et un programme de progression personnalisés.
