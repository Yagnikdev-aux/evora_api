// Creates the first super admin from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
// Does nothing if a user with that email already exists.
import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || 'Evora Admin';

try {
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin seed.');
  } else {
    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (existing.rowCount) {
      console.log(`Admin ${email} already exists.`);
    } else {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'super_admin')`,
        [name, email.toLowerCase(), hash],
      );
      console.log(`Super admin ${email} created.`);
    }
  }
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
