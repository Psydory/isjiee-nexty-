// frontend/js/config.js
// Fichier central de configuration textuelle – version finale corrigée

// =========================
// 1. DÉTECTION ENVIRONNEMENT (local vs production)
// =========================
const isDev = () => location.hostname === 'localhost';

// =========================
// 2. ÉCHAPPEMENT HTML (anti-XSS)
// =========================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================
// 3. HELPERS D'AFFICHAGE (sécurisés)
// =========================
export function setText(element, textKey, texts) {
  if (!element) return;
  const value = texts[textKey];
  if (value === undefined) {
    if (isDev()) console.warn(`[config] Missing key: ${textKey}`);
    return;
  }
  element.textContent = value;
}

export function setHtmlText(element, textKey, texts) {
  if (!element) return;
  const raw = texts[textKey];
  if (raw === undefined) {
    if (isDev()) console.warn(`[config] Missing key: ${textKey}`);
    return;
  }
  const escaped = escapeHtml(raw);
  // Convertit les sauts de ligne en <br> pour le HTML
  element.innerHTML = escaped.replace(/\n/g, '<br>');
}

// =========================
// 4. TEXTES (structure modulaire par page)
// =========================
const TEXTS = {
  // Version française (par défaut)
  fr: {
    // ===== PAGE ACCUEIL (INDEX) =====
    index: {
      heroTitle: "ISJIEE-NXT",
      heroSubtitle: "Transforme ton savoir en pouvoir économique.",
      heroDesc1: "Une plateforme éducative et entrepreneuriale nouvelle génération conçue pour aider les étudiants, créateurs, entrepreneurs et jeunes leaders à apprendre, construire, vendre et évoluer dans un véritable environnement digital professionnel.",
      heroDesc2: "ISJIEE-NXT n'est pas seulement une école numérique. C'est un écosystème intelligent où : tes compétences deviennent des revenus, tes projets deviennent des entreprises, et ton évolution devient visible.",
      ctaPrimary: "Commencer l'aventure",
      ctaSecondary: "Découvrir la galerie",
      whyTitle: "Pourquoi ISJIEE-NXT ?",
      whyDesc: "Dans le monde actuel, apprendre sans appliquer ne suffit plus. ISJIEE-NXT a été créé pour connecter : l'éducation, la technologie, l'entrepreneuriat, et l'économie digitale. Notre mission est simple : Former des créateurs de valeur. Grâce à une expérience immersive, les membres peuvent : apprendre des compétences modernes, développer des projets réels, publier leurs créations, construire leur visibilité, collaborer avec d'autres talents, et accéder à des opportunités économiques.",
      livingTitle: "Une plateforme vivante",
      livingDesc: "Contrairement aux plateformes classiques, ISJIEE-NXT combine : galerie multimédia, progression intelligente, système BAR, projets entrepreneuriaux, missions interactives, gamification éducative, développement personnel, et outils digitaux modernes. Chaque action sur la plateforme peut devenir : une expérience, une progression, une réputation, ou une opportunité."
    },

    // ===== PAGE GALERIE =====
    gallery: {
      heroTitle: "Explore les talents.",
      heroSubtitle: "Découvre les projets. Entre dans l'univers ISJIEE-NXT.",
      heroDesc: "La galerie ISJIEE-NXT est un espace dynamique où les membres peuvent : publier leurs créations, présenter leurs projets, valoriser leurs compétences, et construire leur présence digitale.",
      evolutionTitle: "Une galerie conçue pour l'évolution",
      evolutionDesc: "Notre galerie ne sert pas uniquement à afficher du contenu. Elle permet aux utilisateurs de : partager des médias, développer leur audience, recevoir des interactions, gagner de la visibilité, et démontrer leurs capacités professionnelles. Photos, vidéos, présentations, démonstrations, créations artistiques, projets business, contenus éducatifs : tout peut devenir une vitrine de talent.",
      valueTitle: "Valorise ce que tu sais faire",
      valueDesc: "Chaque personne possède un potentiel. ISJIEE-NXT aide les utilisateurs à : transformer leurs idées en projets visibles, créer une identité digitale forte, construire une réputation basée sur les compétences, et développer une communauté autour de leurs talents. La plateforme encourage : la créativité, la discipline, la progression, et l'innovation.",
      networkTitle: "Plus qu'un simple réseau",
      networkDesc: "ISJIEE-NXT crée un environnement où : les étudiants rencontrent des entrepreneurs, les créateurs rencontrent des opportunités, les idées rencontrent des solutions, et les ambitions rencontrent des outils.",
      // UI galerie
      galleryTitle: "Galerie complète",
      gallerySubtitle: "Des milliers de médias à portée de clic. Filtrez, recherchez, triez.",
      likeBtn: "Like",
      downloadBtn: "Télécharger",
      shareBtn: "Partager"
    },

    // ===== PAGE BUSINESS / ENTREPRENEUR =====
    business: {
      heroTitle: "Business Free – Votre succès économique",
      heroDesc: "Profitez d'avantages économiques immédiats, construisez votre clientèle et bénéficiez d'un système de bonus proportionnel.",
      cta: "Démarrer maintenant",
      step1: "Créer votre boutique",
      step2: "Attirer des clients",
      step3: "Vendre & gagner",
      step4: "Développer votre réseau",
      bonusTitle: "Bonus proportionnel à vos actions",
      networkTitle: "Construisez votre réseau clientèle"
    },

    // ===== PAGE WIGGFLUENCEUR (intégré dans business via onglet) =====
    wigg: {
      heroTitle: "Wiggfluenceur – L'élite du style",
      heroDesc: "Transformez votre image en empire économique. Mannequinat, beauté capillaire, big sellers.",
      cta: "Devenir Wiggfluenceur",
      stat1: "+347% de revenus (1 an)",
      stat2: "45% de marge brute moyenne",
      stat3: "10k+ clients actifs",
      stat4: "50+ big sellers partenaires",
      marginTitle: "Marges et rentabilité",
      formationTitle: "Formations exclusives",
      networkTitle: "Votre réseau s'agrandit"
    },

    // ===== DASHBOARD ÉTUDIANT =====
    dashboard: {
      welcome: "Tableau de bord étudiant",
      points: "Points BAR",
      balance: "Solde disponible",
      level: "Niveau",
      nextLevel: "Prochain niveau",
      submitTask: "Soumettre une tâche",
      quiz: "Quiz intelligent",
      timer: "Chronomètre d'activité",
      agenda: "Agenda académique – Parcours 8 semaines",
      projects: "Projets d'entreprise"
    },

    // ===== ADMINISTRATION =====
    admin: {
      title: "Panneau d'administration",
      stats: "Statistiques globales",
      media: "Modération des médias",
      users: "Gestion des utilisateurs"
    },

    // ===== TEXTES COMMUNS (UI) =====
    common: {
      btnSubscribe: "S'abonner",
      btnRenew: "Renouveler",
      btnRefresh: "Actualiser",
      btnLogout: "Déconnexion",
      btnSave: "Enregistrer",
      btnCancel: "Annuler",
      btnDelete: "Supprimer",
      btnEdit: "Modifier",
      btnLike: "❤️ Like",
      btnDownload: "⬇️ Télécharger",
      btnShare: "🔗 Partager",
      btnStart: "Démarrer",
      btnPause: "Pause",
      btnReset: "Réinitialiser",
      btnConvert: "Convertir en points",
      loading: "Chargement...",
      errorGeneric: "Une erreur est survenue"
    }
  },

  // ===== PRÉPARATION POUR ANGLAIS (à compléter plus tard) =====
  en: {
    index: {},
    gallery: {},
    business: {},
    wigg: {},
    dashboard: {},
    admin: {},
    common: {}
  },

  // ===== PRÉPARATION POUR CRÉOLE (à compléter plus tard) =====
  ht: {
    index: {},
    gallery: {},
    business: {},
    wigg: {},
    dashboard: {},
    admin: {},
    common: {}
  }
};

// Langue par défaut (français)
let currentLang = 'fr';

// =========================
// 5. FONCTIONS D'ACCÈS AUX TEXTES
// =========================
export function setLanguage(lang) {
  if (TEXTS[lang]) {
    currentLang = lang;
    if (isDev()) console.log(`[config] Langue changée : ${lang}`);
  } else if (isDev()) {
    console.warn(`[config] Langue non supportée : ${lang}`);
  }
}

export function getCurrentLang() {
  return currentLang;
}

// Récupère les textes d'une page spécifique dans la langue courante
export function getPageTexts(page) {
  const pageTexts = TEXTS[currentLang]?.[page];
  if (!pageTexts && isDev()) {
    console.warn(`[config] Textes manquants pour page: ${page} (langue: ${currentLang})`);
    return {};
  }
  return pageTexts || {};
}

// Récupère les textes communs (UI)
export function getCommonTexts() {
  const common = TEXTS[currentLang]?.common;
  if (!common && isDev()) console.warn(`[config] Textes communs manquants (langue: ${currentLang})`);
  return common || {};
}

// Récupère un texte spécifique par chemin (ex: 'index.heroTitle')
export function getText(key) {
  const parts = key.split('.');
  let obj = TEXTS[currentLang];
  for (const part of parts) {
    if (!obj || obj[part] === undefined) {
      if (isDev()) console.warn(`[config] Clé manquante : ${key}`);
      return '';
    }
    obj = obj[part];
  }
  return obj;
}

// Helper pour obtenir les textes complets (pour une utilisation avancée)
export function getAllTexts() {
  return TEXTS[currentLang];
}