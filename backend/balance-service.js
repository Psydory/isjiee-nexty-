// =========================
// BALANCE SERVICE
// =========================

import {
  getUserById,
  updateUserBalance,
  addTransaction,
  getTransactionsByUser
} from "./db.js";

// =========================
// CONSTANTES
// =========================
const MAX_GAIN = 1000;
const MAX_SPEND = 500;

// =========================
// GET BALANCE
// =========================
export async function getBalance(userId) {

  const user = await getUserById(userId);

  if (!user) {
    return { error: "Utilisateur introuvable" };
  }

  return {
    balance: user.balance || 0
  };
}

// =========================
// GAIN
// =========================
export async function gainBalance(userId, amount, reason = "system") {

  if (!amount || amount <= 0 || amount > MAX_GAIN) {
    return { error: "Montant invalide" };
  }

  const user = await getUserById(userId);

  if (!user) {
    return { error: "Utilisateur introuvable" };
  }

  const newBalance = (user.balance || 0) + amount;

  await updateUserBalance(userId, newBalance);

  const tx = await addTransaction(userId, amount, "gain", reason);

  return {
    success: true,
    balance: newBalance,
    transaction: tx
  };
}

// =========================
// SPEND
// =========================
export async function spendBalance(userId, amount, reason = "system") {

  if (!amount || amount <= 0 || amount > MAX_SPEND) {
    return { error: "Montant invalide" };
  }

  const user = await getUserById(userId);

  if (!user) {
    return { error: "Utilisateur introuvable" };
  }

  if ((user.balance || 0) < amount) {
    return { error: "Solde insuffisant" };
  }

  const newBalance = user.balance - amount;

  await updateUserBalance(userId, newBalance);

  const tx = await addTransaction(userId, amount, "spend", reason);

  return {
    success: true,
    balance: newBalance,
    transaction: tx
  };
}

// =========================
// HISTORY
// =========================
export async function getHistory(userId) {

  const history = await getTransactionsByUser(userId);

  return {
    history: history || []
  };
}
