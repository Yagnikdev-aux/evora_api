import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { unauthorized, forbidden } from '../../utils/httpError.js';
import * as users from '../users/users.repository.js';
import { ADMIN_PANEL_ROLES } from '../../config/roles.js';
import { createOtpAuthRouter } from './otp.routes.js';

const router = Router();

// Mobile number + OTP login/sign-up for the two apps.
// POST /api/auth/customer/send-otp, /api/auth/customer/verify-otp
// POST /api/auth/partner/send-otp,  /api/auth/partner/verify-otp
router.use('/customer', createOtpAuthRouter('customer'));
router.use('/partner', createOtpAuthRouter('partner'));

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

// POST /api/auth/admin/login  { email, password }  — admin panel only (super_admin, admin)
router.post('/admin/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await users.findByEmailWithPassword(email);

  // Only admin-panel users log in with a password; customers and partners use OTP.
  // Same message for every failure so the response doesn't reveal which emails exist.
  if (!ADMIN_PANEL_ROLES.includes(user?.role) || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    throw unauthorized('Invalid email or password');
  }
  if (user.status !== 'active') throw forbidden('Account is not active');

  await users.touchLastLogin(user.id);
  res.json({ success: true, data: { token: signToken(user), user: users.toUserDto(user) } });
});

export default router;
