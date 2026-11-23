import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import * as users from './users.repository.js';

const router = Router();
router.use(authenticate);

const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number').nullable().optional(),
  })
  .strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

// GET /api/users/me
router.get('/me', async (req, res) => {
  const user = await users.findById(req.user.id);
  if (!user) throw notFound('User not found');
  res.json({ success: true, data: users.toUserDto(user) });
});

// PATCH /api/users/me
router.patch('/me', validate(updateMeSchema), async (req, res) => {
  const user = await users.update(req.user.id, req.body);
  res.json({ success: true, data: users.toUserDto(user) });
});

// POST /api/users/me/change-password
router.post('/me/change-password', validate(changePasswordSchema), async (req, res) => {
  const hash = await users.findPasswordHash(req.user.id);
  if (!hash) throw badRequest('This account signs in with a mobile number and has no password');
  if (!(await bcrypt.compare(req.body.currentPassword, hash))) {
    throw badRequest('Current password is incorrect');
  }
  await users.update(req.user.id, { passwordHash: await bcrypt.hash(req.body.newPassword, 12) });
  res.json({ success: true, message: 'Password updated' });
});

export default router;
