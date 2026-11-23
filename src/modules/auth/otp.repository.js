import { query } from '../../db/pool.js';

/** Latest OTP for this phone and app. Only the latest one can be verified. */
export async function findLatest(phone, role) {
  const { rows } = await query(
    `SELECT id, code_hash, attempts, consumed_at,
            expires_at <= now() AS expired,
            EXTRACT(EPOCH FROM now() - created_at)::int AS age_seconds
       FROM otp_codes
      WHERE phone = $1 AND role = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone, role],
  );
  return rows[0] || null;
}

export async function countSentSince(phone, role, seconds) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM otp_codes
      WHERE phone = $1 AND role = $2 AND created_at > now() - make_interval(secs => $3)`,
    [phone, role, seconds],
  );
  return rows[0].n;
}

export async function create({ phone, role, codeHash, ttlSeconds }) {
  const { rows } = await query(
    `INSERT INTO otp_codes (phone, role, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4))
     RETURNING id`,
    [phone, role, codeHash, ttlSeconds],
  );
  return rows[0];
}

export async function remove(id) {
  await query('DELETE FROM otp_codes WHERE id = $1', [id]);
}

/** Counts one verify attempt. Returns the new count, or null if the code is used up or locked. */
export async function registerAttempt(id, maxAttempts) {
  const { rows } = await query(
    `UPDATE otp_codes SET attempts = attempts + 1
      WHERE id = $1 AND consumed_at IS NULL AND attempts < $2
      RETURNING attempts`,
    [id, maxAttempts],
  );
  return rows[0]?.attempts ?? null;
}

/** Marks the code as used. Returns false if another request already used it. */
export async function consume(id) {
  const { rowCount } = await query(
    'UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL',
    [id],
  );
  return rowCount === 1;
}
