// Creates the application database (DB_NAME) if it does not exist yet.
// Connects to the default "postgres" maintenance database to do so.
import pg from 'pg';
import '../src/config/loadEnv.js';

const dbName = process.env.DB_NAME || 'evora';

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
  console.error(`Invalid DB_NAME "${dbName}"`);
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres',
});

try {
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount) {
    console.log(`Database "${dbName}" already exists.`);
  } else {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created.`);
  }
} catch (err) {
  console.error('Failed to create database:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
