import { env } from '../config/env.js';

/**
 * Sends the OTP SMS. Add a real provider (MSG91, Twilio, AWS SNS, ...) as a new case.
 * "console" only logs the code and is refused in production.
 */
export async function sendOtpSms(phone, code) {
  const minutes = Math.round(env.otp.ttlSeconds / 60);
  const text = `${code} is your Evora verification code. It expires in ${minutes} minutes. Do not share it with anyone.`;

  switch (env.sms.provider) {
    case 'console':
      if (env.nodeEnv === 'production') {
        throw new Error('SMS_PROVIDER=console cannot be used in production');
      }
      console.log(`[sms:console] to ${phone}: ${text}`);
      return;
    default:
      throw new Error(`Unknown SMS_PROVIDER "${env.sms.provider}"`);
  }
}
