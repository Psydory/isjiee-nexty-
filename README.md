🚀 MagazStars — Media Platform SaaS

MagazStars est une plateforme moderne de gestion et de diffusion de médias (images / vidéos), avec un système complet de dashboard utilisateur, admin avancé, et architecture scalable.

---

✨ Fonctionnalités principales

🎬 Media

- Upload via URL sécurisée (R2 ready)
- Galerie publique avec lazy loading
- Dashboard utilisateur (gestion médias)
- Like / view tracking

🛠 Admin Panel

- Modération (approve / reject)
- Mise en avant (featured)
- Gestion utilisateurs (ban / roles)
- Statistiques de base

🔐 Authentification

- JWT sécurisé
- Refresh token automatique
- Middleware backend
- Protection des routes frontend

⚡ Performance

- Pagination backend
- Lazy loading frontend
- Cache API (GET)
- Retry + timeout réseau

🎨 UI / UX

- Design system (tokens CSS)
- Animations fluides
- Skeleton loading
- Toast / modal / loader system

---

🧠 Architecture

Frontend

/js

- api-core.js → requêtes API avancées
- app.js → orchestration globale
- uisystem.js → UX centralisé
- url.js → routing + versioning

Pages :

- index.html → landing / MagazStars
- gallery.html → galerie publique
- dashboard.html → espace utilisateur
- admin.html → back-office

---

Backend (Cloudflare Worker)

/backend

- router.js → routing principal
- middleware.js → sécurité globale
- auth-system.js → JWT + refresh
- modules/ → logique métier (media, user…)

---

🔗 API (v1)

Base :
/api/v1

Auth

- POST /auth/login
- POST /auth/refresh
- GET /me

Media

- GET /media
- POST /media
- POST /media/delete
- POST /media/like
- POST /media/view

Admin

- GET /admin/media
- POST /admin/media/moderate
- POST /admin/media/feature
- GET /admin/users
- POST /admin/users/ban

---

⚙️ Installation

1. Cloner le projet

git clone <repo>
cd magazstars

2. Installer dépendances

npm install

3. Lancer en local (Cloudflare Workers)

wrangler dev

---

🌍 Configuration

Variables importantes

- JWT_SECRET
- ENV (dev / prod)

---

🚀 Déploiement

wrangler deploy

---

🔐 Sécurité

- Middleware global (auth + rate limit)
- Validation backend
- JWT avec expiration
- Protection admin

⚠️ À améliorer (post-MVP) :

- hash password (bcrypt)
- stockage refresh token DB
- rotation token

---

📊 Performance

- Pagination SQL
- Lazy loading images
- Cache API
- UI optimisée

---

📱 UX

- responsive design
- animations fluides
- feedback utilisateur constant

---

🧪 Tests recommandés

- login / logout
- refresh token
- upload media
- admin actions
- rate limit

---

📈 Roadmap

- Algorithme trending
- Followers system
- Monétisation
- AI moderation

---

🧾 Licence

Projet libre pour usage éducatif / startup MVP.

---

👨‍💻 Auteur

Projet conçu pour construire une plateforme SaaS moderne, scalable et prête à évoluer.

---
