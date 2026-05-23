// =========================
// RANKING ENGINE (ADVANCED)
// =========================

// clamp sécurité
function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

// normalisation logarithmique
function normalize(value) {
  return Math.log10(1 + value);
}

// decay exponentiel
function timeDecay(createdAt) {
  const now = Date.now();
  const created = new Date(createdAt).getTime();

  const ageHours = (now - created) / (1000 * 60 * 60);

  return Math.exp(-ageHours / 36); // plus rapide que avant
}

// engagement réel
function engagementRate(views, likes) {
  if (!views) return 0;
  return clamp(likes / views, 0, 1);
}

// score principal
export function computeScore(m) {

  const views = m.views || 0;
  const likes = m.likes || 0;

  const v = normalize(views);
  const l = normalize(likes);

  const decay = timeDecay(m.created_at);
  const engagement = engagementRate(views, likes);

  // 🔥 boost viral
  const viralBoost =
    engagement > 0.15 ? 1.8 :
    engagement > 0.08 ? 1.4 :
    1;

  // ⚖️ score final
  return (v * 0.5 + l * 1.2) * decay * viralBoost;
}

// tri global
export function rankMedia(list = []) {
  return [...list].sort((a, b) => computeScore(b) - computeScore(a));
}

// personnalisation
export function personalize(list = [], user) {

  if (!user) return rankMedia(list);

  return [...list].sort((a, b) => {

    let scoreA = computeScore(a);
    let scoreB = computeScore(b);

    // 🎯 exemple simple : boost contenu récent
    if (user.role === "user") {
      if (a.created_at) scoreA *= 1.1;
      if (b.created_at) scoreB *= 1.1;
    }

    return scoreB - scoreA;
  });
}

// fallback sécurisé
export function safeRank(list) {
  try {
    return rankMedia(list);
  } catch {
    return list || [];
  }
}