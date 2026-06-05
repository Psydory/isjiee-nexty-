// backend/services/certificates.js

import { nanoid } from 'nanoid';

import { rewardUser }
from './rewards.js';

import {
  createNotification
}
from './notifications.js';

/**
 * Générer code certificat unique
 */
function generateCertificateCode() {

  return (
    'CERT-' +
    nanoid(10).toUpperCase()
  );
}

/**
 * Créer certificat
 */
export async function createCertificate(
  db,
  {
    userId,
    title,
    description = null,
    category = 'general',
    rewardPoints = true
  }
) {

  if (!userId) {
    throw new Error('userId requis');
  }

  if (!title) {
    throw new Error('title requis');
  }

  const now = Date.now();

  const id = nanoid();

  const code =
    generateCertificateCode();

  // =========================
  // INSERT CERTIFICATE
  // =========================
  await db.prepare(`
    INSERT INTO certificates (
      id,
      user_id,
      certificate_code,
      title,
      description,
      category,
      issued_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  .bind(
    id,
    userId,
    code,
    title,
    description,
    category,
    now,
    now
  )
  .run();

  // =========================
  // UPDATE PROGRESSION
  // =========================
  await db.prepare(`
    UPDATE entrepreneur_progression
    SET
      certificates_count =
        certificates_count + 1,

      updated_at = ?
    WHERE user_id = ?
  `)
  .bind(
    now,
    userId
  )
  .run();

  // =========================
  // REWARD BAR
  // =========================
  if (rewardPoints) {

    await rewardUser(
      db,
      {
        userId,
        rewardKey:
          'certificate_earned',

        meta: {
          certificateId: id,
          category
        }
      }
    );
  }

  // =========================
  // NOTIFICATION
  // =========================
  await createNotification(
    db,
    {
      userId,
      type: 'certificate',
      message:
        `New certificate earned: ${title}`,

      expiresInDays: 30
    }
  );

  return {
    success: true,
    certificate: {
      id,
      code,
      title
    }
  };
}

/**
 * Vérifier certificat
 */
export async function verifyCertificate(
  db,
  certificateCode
) {

  if (!certificateCode) {
    throw new Error(
      'certificateCode requis'
    );
  }

  const certificate =
    await db.prepare(`
      SELECT
        c.*,
        u.email
      FROM certificates c
      LEFT JOIN users u
      ON c.user_id = u.id
      WHERE c.certificate_code = ?
      LIMIT 1
    `)
    .bind(certificateCode)
    .first();

  if (!certificate) {

    return {
      valid: false
    };
  }

  return {
    valid: true,
    certificate
  };
}

/**
 * Certificats utilisateur
 */
export async function getUserCertificates(
  db,
  userId
) {

  return await db.prepare(`
    SELECT *
    FROM certificates
    WHERE user_id = ?
    ORDER BY issued_at DESC
  `)
  .bind(userId)
  .all();
}