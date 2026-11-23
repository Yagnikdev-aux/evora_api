// Loads .env.<NODE_ENV> (development, testing, staging, production).
// Variables already set in the real environment (e.g. on the server) always win.
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export const ENVIRONMENTS = ['development', 'testing', 'staging', 'production'];

const nodeEnv = process.env.NODE_ENV || 'development';
if (!ENVIRONMENTS.includes(nodeEnv)) {
  throw new Error(`NODE_ENV must be one of ${ENVIRONMENTS.join(', ')} (got "${nodeEnv}")`);
}
process.env.NODE_ENV = nodeEnv;

const file = path.resolve(process.cwd(), `.env.${nodeEnv}`);
if (fs.existsSync(file)) {
  dotenv.config({ path: file, quiet: true });
} else if (nodeEnv === 'development') {
  console.warn(`${path.basename(file)} not found.`);
}
