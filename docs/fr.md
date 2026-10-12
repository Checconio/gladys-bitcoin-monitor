# Bitcoin Monitor

## Présentation

Bitcoin Monitor est une intégration externe pour Gladys Assistant qui surveille les données publiques du réseau Bitcoin au moyen de l'API REST de mempool.space. Elle ne demande aucun compte, aucune clé d'API, aucun broker MQTT, aucun flux Node-RED et aucune définition manuelle de feature. La découverte propose cinq appareils virtuels ; l'utilisateur choisit ceux qu'il souhaite créer.

L'intégration est informative. Les estimations de frais ne garantissent aucun délai de confirmation et le score d'opportunité est une heuristique transparente, pas un conseil financier.

## Prérequis et installation

- Gladys Assistant 5.1.0 ou plus récent (widgets d'intégration).
- Un accès Internet à `https://mempool.space`.
- Aucun abonnement Gladys Plus et aucun compte tiers.

Installez **Bitcoin Monitor** depuis le catalogue décentralisé des intégrations. Ouvrez sa page **Configuration**, enregistrez les réglages souhaités, puis ouvrez **Découverte**. Créez les cinq appareils proposés, ou seulement ceux dont vous avez besoin. L'intégration n'utilise jamais d'API Gladys interne non documentée pour les créer automatiquement.

## Widgets de l'intégration

Depuis l'éditeur du tableau de bord, ajoutez les widgets **Bitcoin** proposés par l'intégration. Cinq types de widgets fournissent les douze cartes des captures grâce aux sélecteurs **Vue** et **Graphique**. Le SDK 0.14.0 ne crée pas le tableau de bord ni la disposition automatiquement : les cartes sont ajoutées et placées depuis Gladys, qui gère leur apparence et leurs couleurs de graphique.

Disposition conseillée pour **₿ Bitcoin — Frais & Réseau**, de haut en bas dans chaque colonne :

| Rang | Colonne gauche                                 | Colonne centrale                     | Colonne droite                     |
| ---- | ---------------------------------------------- | ------------------------------------ | ---------------------------------- |
| 1    | Frais & opportunité → Opportunité de transfert | Simulateur → Simulation de transfert | État du réseau                     |
| 2    | Frais & opportunité → Situation actuelle       | Simulateur → Comparatif actuel       | Graphique → Pression sur les frais |
| 3    | Graphique → Frais Bitcoin                      | Graphique → Coût transaction         | Graphique → Rythme des blocs       |
| 4    | Graphique → Blocs projetés                     | Graphique → Prix Bitcoin             | Minage & difficulté                |

Laissez **Période → Par défaut pour ce graphique** : 12 h pour les blocs projetés, 7 jours pour le prix, 24 h pour les autres. Vous pouvez sélectionner une autre période dans chaque instance. Créez les cinq appareils dans **Découverte** pour activer tous les historiques ; ils se constituent au fil des collectes, sans téléchargement rétroactif. Les identifiants des appareils et features existants restent identiques et conservent leurs historiques.

La carte **Simulation de transfert** affiche l'état du simulateur partagé. Pour le modifier, renseignez **Montant (BTC)**, **Taille virtuelle (vB)** et **Priorité** dans les réglages du widget, puis cliquez sur **Appliquer les réglages** sur la carte. Enregistrer les réglages du widget seul ne modifie pas le simulateur. Les entrées sont persistées localement et s'appliquent aussi au comparatif et aux graphiques de coût. Cette action ne réalise aucune transaction Bitcoin. Les commandes existantes du montant et de la priorité dans les cartes d'appareils restent utilisables.

Corrections par rapport aux captures : « Simulation de transfert » décrit le calcul réel ; les taux ont l'unité sat/vB, la mempool et sa pression sont en vMB, le hashrate en EH/s. Le ratio frais/transfert est affiché « — » si le montant vaut zéro. Les valeurs actuelles indisponibles sont signalées explicitement. Les libellés des widgets sont disponibles en français et en anglais ; les légendes historiques utilisent les noms des features dans Gladys. Après un changement de devise, l'historique existant n'est pas converti : choisissez une période postérieure au changement pour comparer des montants dans la même devise.

## Transports et fraîcheur des données

Le manifeste déclare uniquement **cloud**, car les mesures et les estimations du simulateur dépendent de l'API publique mempool.space. Chaque appareil publie son propre état :

- **Cloud** : toutes ses sources répondent et sont récentes.
- **Cloud dégradé** : certaines sources manquent ou ont échoué ; une explication accompagne le badge.
- **Inaccessible** : aucune de ses sources n'est disponible.

Les réglages du simulateur restent locaux et modifiables hors ligne. Les badges reviennent automatiquement à l'état normal après récupération ; ils sont renvoyés à la reconnexion à Gladys et après création ou mise à jour d'un appareil. Le statut général signale les réponses partielles et passe hors ligne après trois cycles rapides entièrement échoués.

Les valeurs constantes mais valides sont republiées lors de la première collecte après cinq minutes : cela évite que les frais Éco ou la taille TX disparaissent des historiques récents simplement parce qu'ils ne changent pas. Une source en échec n'est jamais republiée comme une mesure fraîche. Une source sans actualisation pendant deux intervalles plus 30 secondes est également masquée des valeurs courantes des widgets, sans effacer la dernière valeur mémorisée. Les widgets se rafraîchissent à partir du cache, sans multiplier les requêtes publiques.

## Configuration

- L'adresse de l'API est fixée à `https://mempool.space` et n'est pas modifiable dans Gladys. Les anciennes valeurs de configuration `api_base_url` sont ignorées.
- **Devise** : EUR, USD, GBP, CHF, CAD, AUD ou JPY. Ce sont les devises actuellement renvoyées par `/api/v1/prices`.
- **Actualisation rapide** : frais, blocs projetés, mempool, prix et hauteur, de 30 à 900 secondes (60 par défaut).
- **Actualisation difficulté** : de 300 à 3600 secondes (600 par défaut).
- **Actualisation hashrate** : de 600 à 21600 secondes (1800 par défaut).
- **Taille virtuelle par défaut** : de 50 à 10000 vB (250 par défaut).
- **Priorité par défaut** : Rapide, 30 minutes, 1 heure ou Économique.

Un changement de devise republie la découverte, car l'unité Gladys native ou le code ISO visible peut changer. Les appareils existants peuvent afficher un bouton **Mettre à jour** dans la découverte ; utilisez-le pour accepter cette évolution de structure.

Actions disponibles :

- **Tester la connexion** valide les réponses des frais précis et de la hauteur, puis affiche un résultat traduit.
- **Actualiser maintenant** lance immédiatement les trois familles de collecte.
- **Modifier le simulateur de transaction** enregistre localement la taille virtuelle et la priorité. Le montant BTC se saisit directement depuis un tableau de bord Gladys.

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

Gladys ne fournit pas de champ numérique générique modifiable pour une feature `sensor/decimal`. Bitcoin Monitor associe donc **Transfer amount (BTC)** au contrat de consigne numérique pris en charge par Gladys, avec un pas de `0,00000001 BTC`. Le montant et la priorité se modifient directement depuis un tableau de bord ; la vSize se règle dans l’action de configuration ou dans les réglages du widget Simulateur. Les trois valeurs sont enregistrées atomiquement dans `/data/simulator-state.json`.

Les valeurs sont arrondies avant publication : prix BTC et valeur du transfert à 2 décimales, frais fiat et pourcentages à 4, feerates à 3, valeurs BTC à 8, satoshis et vSize à l'entier. Gladys peut omettre un zéro final non significatif, mais aucun artefact de flottant JavaScript n'est publié.

## Polling, limites et pannes

Chaque famille de collecte utilise `setTimeout` uniquement après la fin de l'exécution précédente : les requêtes ne s'accumulent pas. Un léger jitter évite les rafales synchronisées. Le client HTTP applique un timeout et ne réessaie que les erreurs réseau, HTTP 429 et HTTP 5xx. Les délais utilisent un backoff exponentiel avec jitter, respectent `Retry-After` et sont plafonnés à 30 secondes.

Le service public mempool.space ne promet pas de quota public fixe. Conservez les intervalles par défaut afin de limiter les requêtes. Bitcoin Monitor ne télécharge jamais tous les txids de la mempool, toutes les transactions ni de longs historiques de blocs.

En cas de panne temporaire, les dernières valeurs valides restent en mémoire ; elles ne sont pas remplacées par zéro ou null. Après trois cycles rapides sans aucune requête importante réussie, Gladys affiche l'API mempool comme indisponible. La collecte reprend automatiquement au retour du service.

## Dépannage

- **Aucun appareil** : ouvrez l'onglet Découverte et lancez la recherche ; la création reste une action utilisateur.
- **Aucune valeur sur un appareil** : vérifiez que l'appareil et sa structure actuelle ont été créés. Utilisez **Mettre à jour** dans la découverte après un changement de devise ou une mise à niveau.
- **Échec du test de connexion** : vérifiez le DNS et l'accès du pare-feu à `https://mempool.space`.
- **HTTP 429 dans les logs** : augmentez l'intervalle d'actualisation rapide.
- **Certaines métriques restent anciennes** : l'endpoint peut être temporairement indisponible ou invalide. Bitcoin Monitor conserve volontairement la dernière bonne valeur.
- **Montant non modifiable après la mise à niveau** : mettez à jour l'appareil **Bitcoin Transaction Simulator** depuis la Découverte afin que Gladys reçoive la nouvelle définition modifiable. La vSize peut aussi être réglée dans le widget Simulateur, avec le bouton **Appliquer les réglages**.
- **Avertissement de persistance** : vérifiez que Gladys a monté le dossier `/data` de l'intégration et qu'il appartient à l'UID/GID 1000.

## Confidentialité

Il n'existe aucune télémétrie, mesure d'audience, tracker ni compte utilisateur. Seules des requêtes GET de données publiques sont envoyées à `https://mempool.space`. Le montant BTC, la vSize et la priorité restent locaux, ne figurent jamais dans ces requêtes et ne quittent pas le volume `/data`. Aucun secret n'est requis ni journalisé.
