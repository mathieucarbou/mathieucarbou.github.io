# Page PRE+ — Installation et test local

## Fichiers

| Fichier | Description |
|---|---|
| `index.html` | Page HTML autonome |
| `prep.css` | Tous les styles |
| `prep.js` | Toute la logique JavaScript |
| `cloudflare-worker/prep-api.js` | Script du Cloudflare Worker |

---

## Installation du Cloudflare Worker

### 1. Créer un sous-domaine (DNS)

Dans le tableau de bord Cloudflare pour votre domaine :

1. Aller dans **DNS → Enregistrements**
2. Ajouter un enregistrement **A** pour le sous-domaine de l'API, par exemple :
   - Nom : `prep-api`
   - Cible : `192.0.2.1` (Cloudflare intercepte les requêtes via la route Worker — l'IP importe peu)
   - Statut proxy : **Proxié** (nuage orange)

> **Résultat :** `prep-api.macompagnie.com` est désormais un enregistrement DNS routé via Cloudflare.

---

### 2. Créer le Worker

1. Aller dans **Workers & Pages → Vue d'ensemble → Créer**
2. Choisir **« Créer un Worker »**
3. Lui donner un nom, par exemple `prep-api`
4. Cliquer sur **Déployer** (pour le créer), puis sur **Modifier le code**
5. Coller le contenu complet de `cloudflare-worker/prep-api.js`
6. Cliquer sur **Déployer**

> Vérifier que `DEV = false` dans le Worker avant tout déploiement en production.

---

### 3. Ajouter une route personnalisée

1. Aller dans **Workers & Pages → votre worker → Paramètres → Déclencheurs** (ou **Domaines & Routes**)
2. Sous **Routes**, cliquer sur **Ajouter une route**
3. Renseigner :
   - Route : `https://prep-api.macompagnie.com/api/*`
   - Zone : sélectionner votre domaine (ex. `macompagnie.com`)
4. Enregistrer

> Cela indique à Cloudflare d'intercepter toutes les requêtes vers `https://prep-api.macompagnie.com/api/*` et d'exécuter le Worker.

---

### 4. Désactiver workers.dev et les URLs de prévisualisation

Pour éviter d'exposer l'API sur l'URL `*.workers.dev` par défaut :

1. Aller dans **Workers & Pages → votre worker → Paramètres → Déclencheurs**
2. Sous **Route workers.dev**, basculer sur **Désactiver**
3. Désactiver également les **URLs de prévisualisation** si l'option est présente

> L'API n'est ainsi accessible que via la route personnalisée.

---

### 5. Adapter à votre propre domaine

Trois endroits sont à modifier pour utiliser un domaine différent.

**`cloudflare-worker/prep-api.js`** — CORS et validation de l'hôte entrant :

```js
const ALLOWED_ORIGIN  = "https://www.macompagnie.com";   // domaine du frontend
const ALLOWED_HOST_RE = /^prep-api(?:-[a-z0-9]+)?\.macompagnie\.com$/; // sous-domaine de l'API
```

Remplacer `www.macompagnie.com` par le domaine où la page est hébergée, et ajuster le regex pour correspondre à votre sous-domaine API.

**`prep.js`** — URL de base de l'API appelée par le frontend :

```js
var API_BASE_URL = "https://prep-api.macompagnie.com/api";
```

Remplacer `prep-api.macompagnie.com` par votre propre sous-domaine (celui créé à l'étape 1 et routé à l'étape 3).

> Ces trois valeurs doivent être cohérentes : le frontend (`API_BASE_URL`) appelle le sous-domaine de l'API, et le Worker n'accepte les requêtes que si elles viennent du bon domaine frontend (`ALLOWED_ORIGIN`) et arrivent sur le bon sous-domaine (`ALLOWED_HOST_RE`).

---

### 6. Tester l'API déployée

```bash
curl "https://prep-api.macompagnie.com/api/day?day=$(date +%Y-%m-%d)"
```

Résultat attendu : un objet JSON avec les tableaux `prep`, `spot`, `prd3` et le statut `erl`.

---

## Test en local

Pour tester la page localement contre le Worker de production, suivre ces étapes dans l'ordre.

### Étape 1 — S'assurer que DEV est désactivé dans le Worker

Le Worker doit impérativement avoir `DEV = false` pour fonctionner en production :

```js
const DEV = false;
```

Si vous venez de déployer avec `DEV = true` pour un test précédent, remettre `DEV = false` et redéployer avant de continuer.

> Ne pas oublier de remettre `DEV = false` ensuite.

---

### Étape 2 — Lancer un serveur HTTP local

```bash
cd prep/
python3 -m http.server 8080
```

---

### Étape 3 — Ouvrir Chrome avec le contournement CORS

Le Worker rejette les requêtes venant de `localhost` (vérification `ALLOWED_ORIGIN`). Il faut donc lancer une instance Chrome dédiée avec la sécurité web désactivée :

```bash
open -na "Google Chrome" --args \
  --user-data-dir=/tmp/chrome-dev-cors \
  --disable-web-security
```

> **Ne pas** utiliser cette fenêtre pour la navigation normale. La fermer après les tests.

---

### Étape 4 — Ouvrir la page

Dans la fenêtre Chrome ouverte à l'étape précédente, naviguer vers :

[http://localhost:8080](http://localhost:8080)

La page doit charger normalement et appeler le Worker de production sans erreur CORS.

