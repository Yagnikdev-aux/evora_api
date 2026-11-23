import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

/** Requires a valid "Authorization: Bearer <token>" header from an active user. */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }

  // Re-check the user so deactivated users and role changes take effect immediately.
  const { rows } = await query('SELECT id, role, status FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user) return next(unauthorized('User no longer exists'));
  if (user.status !== 'active') return next(forbidden('Account is not active'));

  req.user = { id: user.id, role: user.role };
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};
