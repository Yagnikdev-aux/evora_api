/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts "+91 98765 43210", "919876543210", "09876543210" or "9876543210".
 * Returns null if the input is not a valid Indian mobile number.
 */
export function normalizeIndianMobile(input) {
  let s = String(input ?? '').replace(/[\s\-().]/g, '');
  if (s.startsWith('+91')) s = s.slice(3);
  else if (/^91\d{10}$/.test(s)) s = s.slice(2);
  else if (/^0\d{10}$/.test(s)) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? `+91${s}` : null;
}

/** "+919876543210" -> "+91 98765 43210" (as shown on the Verify OTP screen). */
export function formatIndianMobile(e164) {
  const n = e164.slice(3);
  return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
}
