// =========================
// GET DB INSTANCE
// =========================
export function getDB(env) {
  return env.DB;
}

// =========================
// CREATE USER
// =========================
export async function createUser(env, { email, password, role }) {

  const db = getDB(env);

  const result = await db.prepare(`
    INSERT INTO users (email, password, role, created_at)
    VALUES (?, ?, ?, ?)
  `)
  .bind(email, password, role, Date.now())
  .run();

  return {
    id: result.meta.last_row_id,
    email,
    role
  };
}

// =========================
// GET USER BY EMAIL
// =========================
export async function getUserByEmail(env, email) {

  const db = getDB(env);

  return await db.prepare(`
    SELECT * FROM users WHERE email = ?
  `)
  .bind(email)
  .first();
}

// =========================
// GET USER BY ID
// =========================
export async function getUserById(env, userId) {

  const db = getDB(env);

  return await db.prepare(`
    SELECT id, email, role, balance
    FROM users
    WHERE id = ?
  `)
  .bind(userId)
  .first();
}

// =========================
// UPDATE USER
// =========================
export async function updateUser(env, userId, fields = {}) {

  const db = getDB(env);

  const keys = Object.keys(fields);

  if (!keys.length) return null;

  const values = Object.values(fields);

  const setClause = keys.map(k => `${k} = ?`).join(", ");

  await db.prepare(`
    UPDATE users
    SET ${setClause}
    WHERE id = ?
  `)
  .bind(...values, userId)
  .run();

  return true;
}

// =========================
// GET BALANCE
// =========================
export async function getUserBalance(env, userId) {

  const db = getDB(env);

  const user = await db.prepare(`
    SELECT balance FROM users WHERE id = ?
  `)
  .bind(userId)
  .first();

  return user ? user.balance : 0;
}

// =========================
// ADD TRANSACTION
// =========================
export async function addTransaction(env, userId, amount, type) {

  const db = getDB(env);

  // Vérifier balance si spend
  if (type === "spend") {

    const current = await getUserBalance(env, userId);

    if (current < amount) {
      return null;
    }

    await db.prepare(`
      UPDATE users
      SET balance = balance - ?
      WHERE id = ?
    `)
    .bind(amount, userId)
    .run();

  } else if (type === "gain") {

    await db.prepare(`
      UPDATE users
      SET balance = balance + ?
      WHERE id = ?
    `)
    .bind(amount, userId)
    .run();
  }

  // Enregistrer transaction
  const result = await db.prepare(`
    INSERT INTO transactions (user_id, amount, type, created_at)
    VALUES (?, ?, ?, ?)
  `)
  .bind(userId, amount, type, Date.now())
  .run();

  return {
    id: result.meta.last_row_id,
    userId,
    amount,
    type
  };
}

// =========================
// GET TRANSACTIONS
// =========================
export async function getTransactions(env, userId) {

  const db = getDB(env);

  return await db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `)
  .bind(userId)
  .all();
}

// =========================
// ANALYTICS (ADMIN)
// =========================
export async function getAnalyticsData(env) {

  const db = getDB(env);

  const users = await db.prepare(`SELECT COUNT(*) as total FROM users`).first();
  const premium = await db.prepare(`SELECT COUNT(*) as total FROM users WHERE role = 'premium'`).first();
  const revenue = await db.prepare(`SELECT SUM(amount) as total FROM transactions WHERE type = 'spend'`).first();
  const quiz = await db.prepare(`SELECT COUNT(*) as total FROM transactions WHERE type = 'quiz'`).first();

  return {
    users: users?.total || 0,
    premium: premium?.total || 0,
    revenue: revenue?.total || 0,
    quiz: quiz?.total || 0
  };
}
