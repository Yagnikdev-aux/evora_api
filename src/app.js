import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { checkConnection } from './db/pool.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import adminUserRoutes from './modules/admin/adminUsers.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin === '*' ? '*' : env.corsOrigin.split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '1mb' }));
if (env.nodeEnv !== 'testing') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// GET /api/health  — reports API and database status.
app.get('/api/health', async (_req, res) => {
  try {
    const { db } = await checkConnection();
    res.json({ success: true, status: 'ok', database: { connected: true, name: db } });
  } catch (err) {
    res.status(503).json({ success: false, status: 'degraded', database: { connected: false, error: err.message } });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/users', adminUserRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
