import { query } from '../../db/pool.js';

// Columns that are safe to return to clients (never password_hash).
export const PUBLIC_COLUMNS =
  'id, full_name, email, phone, phone_verified_at, role, status, last_login_at, created_at, updated_at';

const SORTABLE = {
  createdAt: 'created_at',
  fullName: 'full_name',
  email: 'email',
  lastLoginAt: 'last_login_at',
};

export function toUserDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    phoneVerifiedAt: row.phone_verified_at,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function findByEmailWithPassword(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] || null;
}

/** `phone` must already be normalized (+91XXXXXXXXXX). */
export async function findByPhone(phone, role) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE phone = $1 AND role = $2`, [phone, role]);
  return rows[0] || null;
}

/** Account created by OTP sign-up: phone only, verified now. */
export async function createWithPhone({ phone, role }) {
  const { rows } = await query(
    `INSERT INTO users (phone, role, phone_verified_at) VALUES ($1, $2, now()) RETURNING ${PUBLIC_COLUMNS}`,
    [phone, role],
  );
  return rows[0];
}

export async function markPhoneLogin(id) {
  const { rows } = await query(
    `UPDATE users SET last_login_at = now(), phone_verified_at = COALESCE(phone_verified_at, now())
      WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id],
  );
  return rows[0];
}

export async function findPasswordHash(id) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
  return rows[0]?.password_hash ?? null;
}

export async function create({ fullName, email, phone, passwordHash, role = 'customer', status = 'active' }) {
  const { rows } = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, status)
     VALUES ($1, lower($2), $3, $4, $5, $6)
     RETURNING ${PUBLIC_COLUMNS}`,
    [fullName, email, phone ?? null, passwordHash, role, status],
  );
  return rows[0];
}

/** Updates only the provided fields. `fields` uses camelCase keys. */
export async function update(id, fields) {
  const map = {
    fullName: 'full_name',
    email: 'email',
    phone: 'phone',
    role: 'role',
    status: 'status',
    passwordHash: 'password_hash',
  };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] === undefined) continue;
    values.push(key === 'email' ? fields[key].toLowerCase() : fields[key]);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return findById(id);

  values.push(id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${PUBLIC_COLUMNS}`,
    values,
  );
  return rows[0] || null;
}

export async function touchLastLogin(id) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

/** Paginated, filterable, searchable list for the admin panel. */
export async function list({ page, limit, search, role, status, sortBy, order }) {
  const where = [];
  const values = [];

  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const p = `$${values.length}`;
    where.push(`(full_name ILIKE ${p} OR email ILIKE ${p} OR phone ILIKE ${p})`);
  }
  if (role) {
    values.push(role);
    where.push(`role = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortColumn = SORTABLE[sortBy] || 'created_at';
  const direction = order === 'asc' ? 'ASC' : 'DESC';

  values.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, COUNT(*) OVER() AS total_count
       FROM users
       ${whereSql}
      ORDER BY ${sortColumn} ${direction} NULLS LAST, id
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  let total = rows.length ? Number(rows[0].total_count) : 0;
  // Page past the end returns no rows; count separately so the total stays correct.
  if (!rows.length && page > 1) {
    const countRes = await query(`SELECT COUNT(*)::int AS n FROM users ${whereSql}`, values.slice(0, -2));
    total = countRes.rows[0].n;
  }
  return { rows, total };
}
