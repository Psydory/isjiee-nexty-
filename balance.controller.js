// =========================
// IMPORTS
// =========================
import {
  getUserBalance,
  addTransaction,
  getTransactions
} from "../db.js";

// =========================
// GET BALANCE
// =========================
export async function getBalance(request, env) {

  try {

    const user = request.user;

    if (!user) {
      return json({ error: "Non autorisé" }, 401);
    }

    const balance = await getUserBalance(env, user.id);

    return json({
      success: true,
      amount: balance
    });

  } catch (err) {

    console.error("Balance Error:", err);

    return json({ error: "Erreur récupération solde" }, 500);
  }
}

// =========================
// GAIN
// =========================
export async function gain(request, env) {

  try {

    const user = request.user;
    const body = await request.json();

    const { amount } = body;

    if (!amount || amount <= 0) {
      return json({ error: "Montant invalide" }, 400);
    }

    const tx = await addTransaction(env, user.id, amount, "gain");

    if (!tx) {
      return json({ error: "Erreur transaction" }, 400);
    }

    return json({
      success: true,
      message: "Gain ajouté",
      transaction: tx
    });

  } catch (err) {

    console.error("Gain Error:", err);

    return json({ error: "Erreur gain" }, 500);
  }
}

// =========================
// SPEND
// =========================
export async function spend(request, env) {

  try {

    const user = request.user;
    const body = await request.json();

    const { amount } = body;

    if (!amount || amount <= 0) {
      return json({ error: "Montant invalide" }, 400);
    }

    const tx = await addTransaction(env, user.id, amount, "spend");

    if (!tx) {
      return json({ error: "Solde insuffisant" }, 400);
    }

    return json({
      success: true,
      message: "Paiement effectué",
      transaction: tx
    });

  } catch (err) {

    console.error("Spend Error:", err);

    return json({ error: "Erreur paiement" }, 500);
  }
}

// =========================
// HISTORY
// =========================
export async function history(request, env) {

  try {

    const user = request.user;

    const list = await getTransactions(env, user.id);

    return json({
      success: true,
      transactions: list.results || []
    });

  } catch (err) {

    console.error("History Error:", err);

    return json({ error: "Erreur historique" }, 500);
  }
}

// =========================
// JSON HELPER
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}