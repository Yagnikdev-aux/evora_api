-- Two admin-panel roles: super_admin (full access, manages admins) and admin (manages customers and partners).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'customer', 'partner'));

-- The first (seeded) admin becomes the super admin, if there is none yet.
UPDATE users SET role = 'super_admin'
 WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
   AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'super_admin');
