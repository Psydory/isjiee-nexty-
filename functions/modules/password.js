// functions/modules/password.js
import { ok, badRequest, tooManyRequests, withErrorHandler } from "../core/errorHandler.js";
import { getUserByEmail, updateUser } from "../core/db.js";
import { checkRateLimitD1 } from "../core/rate-limit.js";
import bcrypt from "bcryptjs";

function generateToken() {
  return crypto.randomUUID();
}

function hashToken(token) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(hash =>
    Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  );
}

async function sendResetEmail(email, token, env) {
  const resetLink = `https://${env.DOMAIN || 'localhost:8788'}/reset-password.html?token=${token}`;
  // Utilisation de Resend (vous devez avoir RESEND_API_KEY dans env)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'noreply@isjiee.com',
      to: email,
      subject: 'Réinitialisation de votre mot de passe ISJIEE',
      html: `<p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valable 1 heure) :</p>
             <a href="${resetLink}">${resetLink}</a>
             <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`
    })
  });
  if (!res.ok) console.error("Email sending failed", await res.text());
}

export const requestPasswordReset = withErrorHandler(async (request, env) => {
  const { email } = await request.json();
  if (!email) return badRequest("Email requis");

  // Rate limiting par IP et email
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rateKey = `reset:${ip}:${email.toLowerCase()}`;
  const allowed = await checkRateLimitD1(env, rateKey, 3, 3600000); // 3 requêtes par heure
  if (!allowed.allowed) return tooManyRequests("Trop de demandes. Réessayez plus tard.");

  const user = await getUserByEmail(env, email);
  if (!user) {
    // On répond quand même "ok" pour ne pas révéler l'existence de l'email
    return ok({ message: "Si cet email existe, un lien vous a été envoyé." });
  }

  const rawToken = generateToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = Date.now() + 3600000; // 1 heure

  // Supprimer les anciens tokens pour cet email
  await env.DB.prepare("DELETE FROM password_resets WHERE email = ?").bind(email).run();

  // Insérer le nouveau token (hashé)
  await env.DB.prepare(`
    INSERT INTO password_resets (email, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(email, tokenHash, expiresAt, Date.now()).run();

  // Envoi de l'email (asynchrone, ne pas attendre)
  sendResetEmail(email, rawToken, env).catch(console.error);

  return ok({ message: "Si cet email existe, un lien vous a été envoyé." });
});

export const resetPassword = withErrorHandler(async (request, env) => {
  const { token, newPassword } = await request.json();
  if (!token || !newPassword) return badRequest("Token et nouveau mot de passe requis");

  // Validation forte du mot de passe
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(newPassword)) {
    return badRequest("Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.");
  }

  const tokenHash = await hashToken(token);
  const reset = await env.DB.prepare(`
    SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();

  if (!reset) return badRequest("Lien invalide ou expiré");

  // Mise à jour du mot de passe (avec bcrypt)
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await updateUser(env, reset.email, { password: hashedPassword });

  // Marquer le token comme utilisé
  await env.DB.prepare("UPDATE password_resets SET used = 1 WHERE token_hash = ?").bind(tokenHash).run();

  return ok({ message: "Mot de passe modifié avec succès. Vous pouvez vous connecter." });
});
