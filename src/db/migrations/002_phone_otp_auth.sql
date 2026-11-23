-- Mobile number + OTP login for the customer and partner apps.

-- OTP sign-ups only have a phone number; name, email and password come later (or never).
ALTER TABLE users
  ALTER COLUMN full_name     DROP NOT NULL,
  ALTER COLUMN email         DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Every account must be reachable by email or phone.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone_chk;
ALTER TABLE users ADD CONSTRAINT users_email_or_phone_chk CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- One account per phone per app: the same number can be both a customer and a partner.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_role_uq ON users (phone, role) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS otp_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        VARCHAR(20) NOT NULL,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'partner')),
  code_hash    TEXT NOT NULL,
  attempts     SMALLINT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_phone_role_created_idx ON otp_codes (phone, role, created_at DESC);
