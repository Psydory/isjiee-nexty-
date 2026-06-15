# ⭐ MagazStars – ISJIEE-NEXT

**Plateforme de formation, entrepreneuriat et mise en relation pour talents**  
*Version 1.0 – Juin 2026*

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![D1](https://img.shields.io/badge/Cloudflare-D1-blue)](https://developers.cloudflare.com/d1/)
[![R2](https://img.shields.io/badge/Cloudflare-R2-red)](https://developers.cloudflare.com/r2/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Sommaire

- [Présentation](#présentation)
- [Technologies](#technologies)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [API](#api)
- [Système BAR (Points & Récompenses)](#système-bar)
- [Rôles & Permissions](#rôles--permissions)
- [Frontend](#frontend)
- [Déploiement](#déploiement)
- [Tests & Développement local](#tests--développement-local)
- [Sécurité](#sécurité)
- [Maintenance](#maintenance)
- [Services tiers](#services-tiers)
- [Limitations connues](#limitations-connues)
- [Roadmap](#roadmap)
- [Équipe](#équipe)
- [Licence](#licence)

---

## 🎯 Présentation

**MagazStars** est une plateforme complète dédiée aux entrepreneurs, talents et formateurs. Elle permet de :

- 🎓 **Se former** via des certifications et formations
- 💼 **Gérer ses projets entrepreneuriaux** (mini, muni, grand)
- 📸 **Publier et partager des médias** (images, vidéos, audio)
- 🏆 **Gagner des points et monter en niveau** (système BAR)
- 📊 **Suivre son classement** dans le leaderboard
- 🎁 **Obtenir des récompenses** et achievements

---

## 🛠️ Technologies

| Catégorie | Technologie |
|-----------|-------------|
| **Backend** | Cloudflare Workers (JavaScript) |
| **Base de données** | Cloudflare D1 (SQLite) |
| **Stockage média** | Cloudflare R2 |
| **Authentification** | JWT (access + refresh tokens) |
| **Hachage** | PBKDF2 (crypto.subtle) |
| **Frontend** | HTML5 + JavaScript modules + CSS3 |
| **API** | REST (150+ endpoints) |

---
```markdown
# ⭐ MagazStars – ISJIEE-NEXT

**Plateforme de formation, entrepreneuriat et mise en relation pour talents**  
*Version 1.0 – Juin 2026*

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![D1](https://img.shields.io/badge/Cloudflare-D1-blue)](https://developers.cloudflare.com/d1/)
[![R2](https://img.shields.io/badge/Cloudflare-R2-red)](https://developers.cloudflare.com/r2/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Sommaire

- [Présentation](#présentation)
- [Technologies](#technologies)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [API](#api)
- [Système BAR (Points & Récompenses)](#système-bar)
- [Rôles & Permissions](#rôles--permissions)
- [Frontend](#frontend)
- [Déploiement](#déploiement)
- [Tests & Développement local](#tests--développement-local)
- [Sécurité](#sécurité)
- [Maintenance](#maintenance)
- [Services tiers](#services-tiers)
- [Limitations connues](#limitations-connues)
- [Roadmap](#roadmap)
- [Équipe](#équipe)
- [Licence](#licence)

---

## 🎯 Présentation

**MagazStars** est une plateforme complète dédiée aux entrepreneurs, talents et formateurs. Elle permet de :

- 🎓 **Se former** via des certifications et formations
- 💼 **Gérer ses projets entrepreneuriaux** (mini, muni, grand)
- 📸 **Publier et partager des médias** (images, vidéos, audio)
- 🏆 **Gagner des points et monter en niveau** (système BAR)
- 📊 **Suivre son classement** dans le leaderboard
- 🎁 **Obtenir des récompenses** et achievements

---

## 🛠️ Technologies

| Catégorie | Technologie |
|-----------|-------------|
| **Backend** | Cloudflare Workers (JavaScript) |
| **Base de données** | Cloudflare D1 (SQLite) |
| **Stockage média** | Cloudflare R2 |
| **Authentification** | JWT (access + refresh tokens) |
| **Hachage** | PBKDF2 (crypto.subtle) |
| **Frontend** | HTML5 + JavaScript modules + CSS3 |
| **API** | REST (150+ endpoints) |

---

## 🏗️ Architecture

```

┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare Workers                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  API Router  │  │   Auth       │  │   Middleware │           │
│  │ [[path]].js  │  │ auth-system  │  │ middleware.js│           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Modules    │  │   Services   │  │    Core      │           │
│  │ admin.js     │  │ entrepreneur │  │ errorHandler │           │
│  │ media.js     │  │ rewards.js   │  │ rate-limit   │           │
│  │ tasks.js     │  │ certificates │  │ security.js  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare D1                            │
├─────────────────────────────────────────────────────────────────┤
│  users | projects | media | tasks | earnings | subscriptions    │
│  entrepreneur_progression | leaderboard | certificates | etc.   │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (HTML/CSS/JS)                      │
├─────────────────────────────────────────────────────────────────┤
│  index.html | entrepreneur.html | gallery.html | leaderboard    │
│  certificates.html | dashboard.html | login.html | register.html│
└─────────────────────────────────────────────────────────────────┘

```

---

## 📦 Installation

### 1. Prérequis

- Node.js (v18+)
- Compte Cloudflare (Workers + D1 + R2)
- Wrangler CLI (`npm install -g wrangler`)

### 2. Cloner le projet

```bash
git clone https://github.com/isjiee/magazstars.git
cd magazstars
```

3. Installer les dépendances

```bash
npm install
```

4. Configurer Wrangler

```bash
cp wrangler.example.toml wrangler.toml
# Éditer wrangler.toml avec vos IDs
```

5. Configurer R2

```toml
# wrangler.toml
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "magazstars-media"

[vars]
R2_ACCOUNT_ID = "votre_account_id"
R2_ACCESS_KEY_ID = "votre_access_key"
R2_SECRET_ACCESS_KEY = "votre_secret_key"
R2_PUBLIC_URL = "https://pub-votre-bucket.r2.dev"
```

6. Initialiser la base de données

```bash
# Créer la base D1
npx wrangler d1 create isjiee-nexty-db

# Appliquer le schéma
npx wrangler d1 execute isjiee-nexty-db --file=./schema.sql
```

7. Déployer

```bash
npx wrangler deploy
```

---

⚙️ Configuration

Variables d’environnement (wrangler.toml)

```toml
[vars]
JWT_SECRET = "votre_secret_long_32_caracteres_minimum"
SEED_KEY = "cle_seed_secrete"
ENVIRONMENT = "production"
R2_PUBLIC_URL = "https://votre-bucket.r2.cloudflarestorage.com"
```

Développement local (.dev.vars)

```bash
# Créer le fichier .dev.vars
cat > .dev.vars << EOF
JWT_SECRET=dev_secret_32_caracteres_minimum
SEED_KEY=dev_seed_key
ENVIRONMENT=development
EOF
```

---

🗄️ Base de données

21 tables principales

Table Description
users Utilisateurs (auth, rôle, points, niveau)
projects Projets entrepreneur (mini, muni, grand)
media Médias (images, vidéos, audio)
media_likes Likes sur les médias
media_views Vues des médias
tasks Définition des tâches
user_tasks Progression des tâches
earnings Gains / récompenses (points)
subscriptions Abonnements
notifications Notifications
entrepreneur_progression Progression entrepreneur
leaderboard Classement général
certificates Certificats obtenus
achievements Succès débloqués
admin_logs Logs d’administration
rate_limits Rate limiting
refresh_tokens Gestion des refresh tokens
api_logs Logs des appels API
password_resets Demandes de réinitialisation
settings Paramètres globaux
api_keys Clés API (future utilisation)

Schéma SQL

Le script complet est disponible dans schema.sql.

Migrations

```bash
# Appliquer une migration
npx wrangler d1 execute isjiee-nexty-db --file=./migrations/002_add_column.sql
```

---

🌐 API

Authentification

Méthode Endpoint Description
POST /auth/register Inscription (user, student, entrepreneur)
POST /auth/login Connexion
POST /auth/refresh Rafraîchir le token
GET /auth/me Profil connecté
POST /auth/logout Déconnexion
POST /auth/change-password Changer mot de passe
POST /auth/forgot-password Demande de réinitialisation
POST /auth/reset-password Réinitialisation

Utilisateur

Méthode Endpoint Description
GET /user/profile Profil utilisateur
PUT /user/profile Mettre à jour le profil

Entrepreneur

Méthode Endpoint Description
GET /entrepreneur/dashboard Tableau de bord
GET /entrepreneur/progress Progression détaillée
GET /entrepreneur/certificates Certificats obtenus
GET /entrepreneur/ranking Classement
GET /entrepreneur/achievements Succès débloqués

Médias

Méthode Endpoint Description
GET /media Galerie publique
GET /media/trending Tendance
GET /media/featured Médias en avant
GET /media/:id Détail d’un média
POST /media/upload-url URL d’upload (R2)
POST /media/validate Valider après upload
POST /media/:id/like Liker un média
DELETE /media/:id/like Retirer un like

Projets

Méthode Endpoint Description
GET /projects Liste des projets
GET /projects/:id Détail d’un projet
POST /projects Créer un projet
PUT /projects/:id Mettre à jour
DELETE /projects/:id Supprimer

Tâches

Méthode Endpoint Description
GET /tasks Liste des tâches
POST /tasks Soumettre une tâche
POST /admin/task/validate Valider une tâche (admin)

Admin

Méthode Endpoint Description
GET /admin/stats Statistiques
GET /admin/media Liste des médias
POST /admin/media/moderate Modérer un média
POST /admin/users/ban Bannir un utilisateur
PUT /admin/users/role Changer le rôle

Codes d’erreur HTTP

Code Signification
200 Succès
201 Créé
400 Requête invalide
401 Non authentifié
403 Accès interdit
404 Ressource non trouvée
409 Conflit (déjà existant)
422 Validation échouée
429 Trop de requêtes
500 Erreur serveur

Documentation complète : docs/API.md (150+ endpoints)

---

🎮 Système BAR

Points (BAR)

Source Points Condition
Tâche validée 10-250 Validation admin
Upload média approuvé 25 Modération admin
Certificat obtenu 500 Automatique
Défi Fourmi 10+5 Soumission
Quotidien (login) 15 1x/jour
Parrainage 300 Actif
Bonus 10k points 1000 Jalon
Bonus 50k points 5000 Jalon

Niveaux (INTEGER)

Niveau Points requis
1 0-499
2 500-999
3 1000-1499
4 1500-1999
... ...

Leaderboard

· Score = points + bonus (tâches, certificats, projets, likes, vues, revenus)
· Mise à jour en temps réel après chaque gain

Achievements

· Débloqués automatiquement (points, tâches, projets, certificats, niveaux)
· Rareté : common, rare, epic, legendary

---

🔐 Rôles & Permissions

Rôle Création Accès
user Inscription Basique
student Inscription Formation
entrepreneur Inscription Dashboard entrepreneur
moderator Admin Modération
admin Super admin Administration
super_admin Seed / Manuel Administration complète

Middlewares

```javascript
requireAuth()        // Vérifie token + compte non banni
requireAdmin()       // Admin ou super_admin
requireModerator()   // Moderator, admin, super_admin
requireSuperAdmin()  // super_admin uniquement
```

---

🖥️ Frontend

Pages disponibles

Page URL Description
Accueil /index.html Page d’accueil publique
Entrepreneur /entrepreneur.html Dashboard entrepreneur
MagazStars /magazstars.html Slider premium
Galerie /gallery.html Explorer les médias
Classement /leaderboard.html Top entrepreneurs
Certificats /certificates.html Mes certificats
Dashboard /dashboard.html Dashboard principal
Connexion /login.html Login
Inscription /register.html Register
Confidentialité /privacy.html Politique RGPD
Conditions /terms.html CGU

Modules JavaScript

Module Rôle
api.js Client API
auth.js Gestion token, login, register
ui.js Toasts, modals, loaders
entrepreneur-dashboard.js Dashboard entrepreneur
gallery.js Galerie média
magazstars.js Slider MagazStars
dashboard.js Dashboard principal
ant-game.js Défi Fourmi
cookies.js Consentement cookies

---

🚀 Déploiement

Production

```bash
# Déployer le worker
npx wrangler deploy

# Exécuter le seed (admin + médias de démonstration)
curl -X POST https://votre-site.com/api/seed/media \
  -H "Authorization: Bearer <admin_token>" \
  -H "x-seed-key: votre_seed_key"
```

Seed initial

Le seed crée :

· Admin : admin@isjiee.com / changeMe123! (à changer immédiatement)
· 42 médias de démonstration (images + vidéos)
· Configuration initiale (settings)

---

🧪 Tests & Développement local

Lancer en mode développement

```bash
npx wrangler dev
```

Accédez à http://localhost:8788 pour tester l’API localement.

Exemples d’appels curl

```bash
# Inscription
curl -X POST http://localhost:8788/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","role":"entrepreneur"}'

# Connexion
curl -X POST http://localhost:8788/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# Dashboard entrepreneur (avec token)
curl -X GET http://localhost:8788/api/entrepreneur/dashboard \
  -H "Authorization: Bearer <token>"

# Classement
curl -X GET http://localhost:8788/api/entrepreneur/ranking?limit=10
```

---

🛡️ Sécurité

Mesure Implémentation
Authentification JWT (access 15min, refresh 7d)
Hachage PBKDF2 (100 000 itérations)
Rate limiting IP + utilisateur + route (D1 + mémoire)
CORS Origines autorisées strictes
Headers CSP, X-Frame-Options, X-XSS-Protection
Sanitization escapeHtml, sanitizeString, sanitizeObject
Masquage email maskEmail() dans les réponses publiques
XSS échappement HTML complet
SQL injection Requêtes préparées D1

---

🔧 Maintenance

Logs d’audit

· Table admin_logs : toutes les actions admin
· Table api_logs : durée des requêtes (optionnel)

Nettoyage périodique

```sql
-- Nettoyer les rate_limits (7 jours)
DELETE FROM rate_limits WHERE created_at < strftime('%s', 'now', '-7 days') * 1000;

-- Nettoyer les logs API (si activé)
DELETE FROM api_logs WHERE created_at < strftime('%s', 'now', '-30 days') * 1000;
```

Tâches programmées (Cron Worker)

```javascript
// Exemple de nettoyage automatique
export async function cleanup() {
  await env.DB.prepare(`DELETE FROM rate_limits WHERE created_at < ?`)
    .bind(Date.now() - 7 * 24 * 3600000).run();
}
```

---

🔗 Services tiers

Service Utilisation Configuration
R2 Stockage médias MEDIA_BUCKET binding + clés d’accès
Stripe Paiements (à venir) À configurer ultérieurement
Turnstile Anti-bot (optionnel) À configurer si activé

---

⚠️ Limitations connues

Limite Valeur
Taille max d’upload (R2) 10 MB
Rate limiting global 200 requêtes / minute
Rate limiting par route 5-500 requêtes / minute
D1 (gratuit) 50 000 lectures / jour
Pagination max 100 éléments par page
Nombre max de médias par utilisateur 500

---

🗺️ Roadmap (versions futures)

· Portefeuille virtuel (wallet)
· Cartes virtuelles prépayées
· API publique (clés API)
· Application mobile (React Native)
· Chat en temps réel (WebSockets)
· Webhooks pour les événements
· Dashboard analytics avancé

---

👥 Équipe

Rôle Personne
Porteur du projet ISJIEE
Développeur principal [À compléter]
Stagiaire [À compléter]
Support technique support@magazstars.com

---

📄 Licence

MIT License – voir le fichier LICENSE pour plus de détails.

---

🙏 Remerciements

· Cloudflare (Workers, D1, R2)
· Unsplash (images de démonstration)
· Toute l’équipe ISJIEE

---

🚀 MagazStars – Construisez votre succès, un point à la fois !

```
## 🏗️ Architecture
