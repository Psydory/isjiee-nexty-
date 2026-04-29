import { rateLimit, requireAuth, safeHandler } from "./security.js";

// =========================
// CONFIG GAINS (SERVEUR ONLY)
// =========================
const EARN_RULES = {
  referral: 5,
  content: 3,
  premium: 10
};

// =========================
// ANTI-SPAM (par utilisateur)
// =========================
const actionStore = new Map();

function canPerformAction(userId, action, cooldownMs = 30000) {
  const key = userId + ":" + action;
  const now = Date.now();

  if (!actionStore.has(key)) {
    actionStore.set(key, now);
    return true;
  }

  const last = actionStore.get(key);

  if (now - last < cooldownMs) {
    return false;
  }

  actionStore.set(key, now);
  return true;
}

// =========================
// HANDLER
// =========================
export const earnHandler = safeHandler(async (request) => {

  const ip = request.headers.get("CF-Connecting-IP");

  // 🔒 Rate limit global
  if (!rateLimit(ip, 10, 60000)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  }

  // 🔑 Auth
  const user = requireAuth(request);

  // 📦 Body
  const body = await request.json();
  const { source } = body;

  // ❗ Validation stricte
  if (!source || !EARN_RULES[source]) {
    throw new Error("Invalid earn source");
  }

  // 🛑 Anti-spam utilisateur
  if (!canPerformAction(user.id, source)) {
    throw new Error("Action too fast");
  }

  // 💰 Calcul sécurisé (serveur uniquement)
  const amount = EARN_RULES[source];

  // 🧠 Simulation DB (à remplacer)
  const transaction = {
    userId: user.id,
    source,
    amount,
    createdAt: new Date().toISOString()
  };

  // 👉 ici tu dois :
  // await DB.insert(transaction)

  return new Response(JSON.stringify({
    success: true,
    transaction
  }), {
    headers: { "Content-Type": "application/json" }
  });

});