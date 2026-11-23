import app from './app.js';
import { env } from './config/env.js';
import { pool, checkConnection } from './db/pool.js';

async function start() {
  try {
    const info = await checkConnection();
    console.log(`Connected to PostgreSQL database "${info.db}"`);
  } catch (err) {
    console.error(`Could not connect to PostgreSQL: ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`Evora API listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
