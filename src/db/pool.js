import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl,
  max: env.db.max,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

/** Fails fast on startup if the database is unreachable. */
export async function checkConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
  return rows[0];
}
