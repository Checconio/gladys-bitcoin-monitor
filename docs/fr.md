# Bitcoin Monitor

## Présentation

Bitcoin Monitor est une intégration externe pour Gladys Assistant qui surveille les données publiques du réseau Bitcoin au moyen de l'API REST mempool configurée. Elle ne demande aucun compte, aucune clé d'API, aucun broker MQTT, aucun flux Node-RED et aucune définition manuelle de feature. La découverte propose cinq appareils virtuels ; l'utilisateur choisit ceux qu'il souhaite créer.

L'intégration est informative. Les estimations de frais ne garantissent aucun délai de confirmation et le score d'opportunité est une heuristique transparente, pas un conseil financier.

## Prérequis et installation

- Gladys Assistant 4.86.0 ou plus récent.
- Un accès Internet à `https://mempool.space`, ou un accès réseau unicast à une instance mempool personnelle compatible.
- Aucun abonnement Gladys Plus et aucun compte tiers.

Installez **Bitcoin Monitor** depuis le catalogue décentralisé des intégrations. Ouvrez sa page **Configuration**, enregistrez les réglages souhaités, puis ouvrez **Découverte**. Créez les cinq appareils proposés, ou seulement ceux dont vous avez besoin. L'intégration n'utilise jamais d'API Gladys interne non documentée pour les créer automatiquement.

## Configuration

- **URL de base de l'API** : URL HTTP(S) racine de mempool.space ou d'une instance personnelle compatible. Les chemins, identifiants, paramètres et fragments sont refusés. Une URL HTTP du réseau local est autorisée pour l'auto-hébergement.
- **Devise** : EUR, USD, GBP, CHF, CAD, AUD ou JPY. Ce sont les devises actuellement renvoyées par `/api/v1/prices`.
- **Actualisation rapide** : frais, blocs projetés, mempool, prix et hauteur, de 30 à 900 secondes (60 par défaut).
- **Actualisation difficulté** : de 300 à 3600 secondes (600 par défaut).
- **Actualisation hashrate** : de 600 à 21600 secondes (1800 par défaut).
- **Taille virtuelle par défaut** : de 50 à 10000 vB (250 par défaut).
- **Montant par défaut** : de 0,00000001 à 21000000 BTC (0,01 par défaut).
- **Priorité par défaut** : Rapide, 30 minutes, 1 heure ou Économique.

Un changement de devise republie la découverte, car l'unité Gladys native ou le code ISO visible peut changer. Les appareils existants peuvent afficher un bouton **Mettre à jour** dans la découverte ; utilisez-le pour accepter cette évolution de structure.

Actions disponibles :

- **Tester la connexion** valide les réponses des frais précis et de la hauteur, puis affiche un résultat traduit.
- **Actualiser maintenant** lance immédiatement les trois familles de collecte.
- **Modifier le simulateur de transaction** enregistre localement un montant, une taille virtuelle et une priorité.

## Appareils et métriques

### Bitcoin Fees

- **Fastest fee**, **30 min fee**, **1 hour fee**, **Economy fee** et **Minimum fee** sont les feerates précis en sat/vB.
- **Projected block 1/2/3 median fee** provient des blocs projetés de la mempool.
- Le nombre de transactions et la taille virtuelle décrivent le premier bloc projeté.
- **Fast/economy spread** vaut `fastestFee - economyFee`, sans jamais devenir négatif.
- **Storage opportunity score** va de 0 à 5 :
  - economy ≤1 : 5 (Exceptionnel)
  - economy ≤2 : 4 (Excellent)
  - economy ≤3 : 3 (Bon)
  - economy ≤5 : 2 (Correct)
  - economy ≤10 : 1 (Attendre)
  - economy >10 : 0 (Éviter)
- Si economy ne dépasse pas 3 sat/vB mais que le bloc projeté 2 dépasse 5 sat/vB, le score est plafonné à 1 (**Attendre**) pour refléter une congestion projetée momentanée.
- **Storage opportunity advice** explique le score courant en texte clair.

`sat/vB` figure dans le nom, car Gladys ne fournit pas cette unité native.

### Bitcoin Mempool

- **Unconfirmed transactions** : nombre de transactions présentes dans la mempool.
- **Mempool backlog** : taille virtuelle totale divisée par 1 000 000, en vMB.
- **Total mempool fees** : somme des frais en satoshis.
- **Backlog >= 1/2/5/10 sat/vB** : vsize de l'histogramme au-dessus de chaque seuil, divisée par 1 000 000.

### Bitcoin Network

- **Blockchain height** : hauteur actuelle de la chaîne.
- **Last block age** : minutes écoulées depuis le timestamp du dernier bloc connu.
- Nombre de transactions, taille et poids du dernier bloc : informations enrichies de l'API v1. Le détail n'est appelé que lorsque la hauteur change.
- **Difficulty adjustment estimate** et **Difficulty progress** : pourcentages fournis par mempool.
- **Blocks until adjustment** : blocs restants dans la période de 2016 blocs.
- **Average block time** : champ `timeAvg` de mempool, explicitement interprété en millisecondes puis converti en minutes.
- **Estimated retarget date** : timestamp Unix en millisecondes de mempool, affiché en texte ISO 8601.
- **Network hashrate** : `currentHashrate / 10^18`, avec EH/s dans le nom.
- **Network difficulty** : `currentDifficulty / 10^12`, avec T dans le nom.

### Bitcoin Market

- **Bitcoin price** est le prix public courant dans la devise configurée.
- Les unités Gladys natives sont utilisées pour EUR, USD et GBP. CHF, CAD, AUD et JPY ne sont jamais étiquetés comme dollars : leur code ISO apparaît dans le nom.

### Bitcoin Transaction Simulator

Entrées locales :

- **Transfer amount** en BTC.
- **Transaction vSize** en octets virtuels.
- **Priority** : Rapide, 30 minutes, 1 heure ou Économique.

Résultats :

- Valeur du transfert dans la devise configurée.
- Feerate, satoshis, BTC, valeur fiat et pourcentage pour la priorité sélectionnée.
- Frais en devise pour les quatre priorités.
- Résumé texte de la simulation.

Calcul :

```text
fee_sats = ceil(vsize × feerate)
fee_btc = fee_sats / 100 000 000
fee_fiat = fee_btc × prix_public_BTC
fee_percent = fee_btc / montant_btc × 100 (seulement si le montant est > 0)
```

Le montant transféré ne détermine **pas** les frais réseau. Une transaction de 0,01 BTC peut coûter autant qu'une transaction de 1 BTC si leur taille virtuelle et leur feerate sont identiques. La vSize dépend surtout du nombre et du type d'entrées et de sorties, pas de la valeur en BTC.

Gladys 4.86 ne fournit pas de champ numérique générique modifiable pour une feature `sensor/decimal`. La déclarer modifiable continue de l'afficher comme un capteur. Le mécanisme officiel de repli est donc utilisé : l'action propose des champs validés de type `number` pour le montant et la vSize. La priorité emploie la feature modifiable officielle `text/select` et peut être changée directement. Les trois valeurs sont enregistrées atomiquement dans `/data/simulator-state.json`.

## Polling, limites et pannes

Chaque famille de collecte utilise `setTimeout` uniquement après la fin de l'exécution précédente : les requêtes ne s'accumulent pas. Un léger jitter évite les rafales synchronisées. Le client HTTP applique un timeout et ne réessaie que les erreurs réseau, HTTP 429 et HTTP 5xx. Les délais utilisent un backoff exponentiel avec jitter, respectent `Retry-After` et sont plafonnés à 30 secondes.

Le service public mempool.space ne promet pas de quota public fixe. Conservez les intervalles par défaut, sauf si vous exploitez votre propre instance. Bitcoin Monitor ne télécharge jamais tous les txids de la mempool, toutes les transactions ni de longs historiques de blocs.

En cas de panne temporaire, les dernières valeurs valides restent en mémoire ; elles ne sont pas remplacées par zéro ou null. Après trois cycles rapides sans aucune requête importante réussie, Gladys affiche l'API mempool comme indisponible. La collecte reprend automatiquement au retour du service.

## Instance mempool personnelle

Saisissez uniquement son URL racine, par exemple `http://192.168.1.20:8080`. Elle doit exposer les endpoints documentés avec des réponses compatibles. L'intégration autorise volontairement les adresses privées pour les déploiements locaux, tout en refusant les syntaxes URL ambiguës et les identifiants intégrés.

## Dépannage

- **Aucun appareil** : ouvrez l'onglet Découverte et lancez la recherche ; la création reste une action utilisateur.
- **Aucune valeur sur un appareil** : vérifiez que l'appareil et sa structure actuelle ont été créés. Utilisez **Mettre à jour** dans la découverte après un changement de devise ou une mise à niveau.
- **Échec du test de connexion** : vérifiez le DNS, le pare-feu et que l'URL désigne la racine, pas `/api`.
- **HTTP 429 dans les logs** : augmentez l'intervalle rapide ou utilisez une instance personnelle.
- **Certaines métriques restent anciennes** : l'endpoint peut être temporairement indisponible ou invalide. Bitcoin Monitor conserve volontairement la dernière bonne valeur.
- **Montant/vSize non modifiables sur la carte** : utilisez **Configuration → Modifier le simulateur de transaction** ; il s'agit de la limite Gladys décrite ci-dessus.
- **Avertissement de persistance** : vérifiez que Gladys a monté le dossier `/data` de l'intégration et qu'il appartient à l'UID/GID 1000.

## Confidentialité

Il n'existe aucune télémétrie, mesure d'audience, tracker ni compte utilisateur. Seules des requêtes GET de données publiques sont envoyées à l'API mempool configurée. Le montant BTC, la vSize et la priorité restent locaux, ne figurent jamais dans ces requêtes et ne quittent pas le volume `/data`. Aucun secret n'est requis ni journalisé.
