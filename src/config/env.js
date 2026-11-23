import './loadEnv.js';

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV;

// Staging and production must not run with the example secret.
if (['staging', 'production'].includes(nodeEnv)) {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || /^change_me/i.test(secret)) {
    throw new Error(`JWT_SECRET must be a random string of at least 32 characters in ${nodeEnv}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || '*',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'evora',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX) || 10,
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  otp: {
    length: Number(process.env.OTP_LENGTH) || 6,
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS) || 300,
    resendSeconds: Number(process.env.OTP_RESEND_SECONDS) || 30,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    maxPerHour: Number(process.env.OTP_MAX_PER_HOUR) || 5,
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'console',
  },
};
