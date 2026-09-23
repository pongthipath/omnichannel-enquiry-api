import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Channel signatures (design §8.3). Always compare in constant time, and always over the RAW body —
 * re-serialising the parsed JSON changes bytes and breaks the check.
 */
export function verifyHmac(
  raw: Buffer | undefined,
  header: string | undefined,
  secret: string | undefined,
  format: 'line' | 'facebook',
): boolean {
  if (!raw || !header || !secret) return false;
  const expected =
    format === 'line'
      ? createHmac('sha256', secret).update(raw).digest('base64')
      : `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
