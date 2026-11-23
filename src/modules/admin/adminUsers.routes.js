import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { ROLES, ADMIN_PANEL_ROLES, canManageRole } from '../../config/roles.js';
import * as users from '../users/users.repository.js';

const router = Router();
// super_admin: everything. admin: can view all users but only create/edit customers and partners.
router.use(authenticate, requireRole(...ADMIN_PANEL_ROLES));

const STATUSES = ['active', 'inactive', 'suspended'];

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(STATUSES).optional(),
  sortBy: z.enum(['createdAt', 'fullName', 'email', 'lastLoginAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const idSchema = z.object({ id: z.uuid('Invalid user id') });

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(255),
  phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number').optional(),
  password: z.string().min(8).max(72),
  role: z.enum(ROLES).default('customer'),
  status: z.enum(STATUSES).default('active'),
});

const updateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.email().max(255).optional(),
    phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number').nullable().optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(STATUSES).optional(),
  })
  .strict();

// GET /api/admin/users?page=1&limit=20&search=&role=&status=&sortBy=createdAt&order=desc
router.get('/', validate(listSchema, 'query'), async (req, res) => {
  const params = req.validatedQuery;
  const { rows, total } = await users.list(params);

  res.json({
    success: true,
    data: rows.map(users.toUserDto),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  });
});

// GET /api/admin/users/:id
router.get('/:id', validate(idSchema, 'params'), async (req, res) => {
  const user = await users.findById(req.params.id);
  if (!user) throw notFound('User not found');
  res.json({ success: true, data: users.toUserDto(user) });
});

// POST /api/admin/users
router.post('/', validate(createSchema), async (req, res) => {
  const { password, ...rest } = req.body;
  if (!canManageRole(req.user.role, rest.role)) throw forbidden('Only a super admin can create admin accounts');
  if (await users.findByEmailWithPassword(rest.email)) throw conflict('Email is already registered');

  const user = await users.create({ ...rest, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ success: true, data: users.toUserDto(user) });
});

// PATCH /api/admin/users/:id  (edit details, change role, activate/deactivate/suspend)
router.patch('/:id', validate(idSchema, 'params'), validate(updateSchema), async (req, res) => {
  const { id } = req.params;

  const target = await users.findById(id);
  if (!target) throw notFound('User not found');
  if (!canManageRole(req.user.role, target.role) || (req.body.role && !canManageRole(req.user.role, req.body.role))) {
    throw forbidden('Only a super admin can manage admin accounts');
  }

  // Prevent an admin from locking themselves out.
  if (id === req.user.id && ((req.body.role && req.body.role !== req.user.role) || (req.body.status && req.body.status !== 'active'))) {
    throw badRequest('You cannot change your own role or deactivate your own account');
  }

  const user = await users.update(id, req.body);
  if (!user) throw notFound('User not found');
  res.json({ success: true, data: users.toUserDto(user) });
});

export default router;
