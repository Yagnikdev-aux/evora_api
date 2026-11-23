import crypto from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { sendOtpSms } from '../../services/sms.js';
import { normalizeIndianMobile, formatIndianMobile } from '../../utils/phone.js';
import { HttpError, badRequest, forbidden, tooManyRequests } from '../../utils/httpError.js';
import * as otps from './otp.repository.js';
import * as users from '../users/users.repository.js';

const phoneField = z.string().transform((value, ctx) => {
  const phone = normalizeIndianMobile(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit mobile number' });
    return z.NEVER;
  }
  return phone;
});

const sendSchema = z.object({ phone: phoneField });
const verifySchema = z.object({
  phone: phoneField,
  otp: z.string().trim().regex(new RegExp(`^\\d{${env.otp.length}}$`), `Enter the ${env.otp.length}-digit code`),
});

const hashCode = (role, phone, code) =>
  crypto.createHmac('sha256', env.jwt.secret).update(`${role}:${phone}:${code}`).digest('hex');

const sameHash = (a, b) => crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

/**
 * Mobile number + OTP login/sign-up for one app.
 * `role` is the account type the app logs into: 'customer' or 'partner'.
 */
export function createOtpAuthRouter(role) {
  const router = Router();
  const { length, ttlSeconds, resendSeconds, maxAttempts, maxPerHour } = env.otp;

  // POST /send-otp  { phone }   (also used for "Resend code")
  router.post('/send-otp', validate(sendSchema), async (req, res) => {
    const { phone } = req.body;

    console.log('phone', phone);  console.log('role', role);

    const latest = await otps.findLatest(phone, role);
    if (latest && latest.age_seconds < resendSeconds) {
      const retryAfterSeconds = resendSeconds - latest.age_seconds;
      throw tooManyRequests(`Please wait ${retryAfterSeconds}s before requesting a new code`, { retryAfterSeconds });
    }
    if ((await otps.countSentSince(phone, role, 3600)) >= maxPerHour) {
      throw tooManyRequests('Too many codes requested. Please try again in an hour.', { retryAfterSeconds: 3600 });
    }

    const code = crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
    const otp = await otps.create({ phone, role, codeHash: hashCode(role, phone, code), ttlSeconds });

    try {
      await sendOtpSms(phone, code);
    } catch (err) {
      await otps.remove(otp.id);
      console.error('OTP SMS failed:', err.message);
      throw new HttpError(502, 'Could not send the code. Please try again.');
    }

    res.json({
      success: true,
      message: `Code sent to ${formatIndianMobile(phone)}`,
      data: {
        phone,
        expiresInSeconds: ttlSeconds,
        resendAfterSeconds: resendSeconds,
        // Lets developers log in without an SMS provider. Never sent in production.
        ...(env.nodeEnv !== 'production' && env.sms.provider === 'console' && { devOtp: code }),
      },
    });
  });

  // POST /verify-otp  { phone, otp }
  router.post('/verify-otp', validate(verifySchema), async (req, res) => {
    const { phone, otp: code } = req.body;

    const otp = await otps.findLatest(phone, role);
    if (!otp || otp.consumed_at || otp.expired) {
      throw badRequest('This code has expired. Please request a new one.');
    }

    const attempts = await otps.registerAttempt(otp.id, maxAttempts);
    if (attempts === null) {
      throw tooManyRequests('Too many wrong attempts. Please request a new code.');
    }
    if (!sameHash(otp.code_hash, hashCode(role, phone, code))) {
      const attemptsLeft = maxAttempts - attempts;
      throw badRequest(
        attemptsLeft ? 'Incorrect code. Please try again.' : 'Too many wrong attempts. Please request a new code.',
        { attemptsLeft },
      );
    }
    if (!(await otps.consume(otp.id))) {
      throw badRequest('This code has already been used. Please request a new one.');
    }

    let user = await users.findByPhone(phone, role);
    const isNewUser = !user;
    if (!user) {
      try {
        user = await users.createWithPhone({ phone, role });
      } catch (err) {
        // Two verifies for the same number at once: the other request created the account.
        if (err.code !== '23505') throw err;
        user = await users.findByPhone(phone, role);
      }
    }
    if (user.status !== 'active') throw forbidden('Your account is not active. Please contact support.');

    user = await users.markPhoneLogin(user.id);
    res.json({
      success: true,
      data: {
        token: signToken(user),
        isNewUser,
        // false until the user has a name; the app should then show the profile step.
        isProfileComplete: Boolean(user.full_name),
        user: users.toUserDto(user),
      },
    });
  });

  return router;
}
