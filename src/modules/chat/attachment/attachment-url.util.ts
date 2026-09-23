import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * An `<img>` tag cannot send an Authorization header, so the link to a file carries its own
 * signature instead (design §17). The signature is issued only while building a message the caller
 * was already allowed to read, is tied to that one attachment, and expires — the bucket itself
 * stays private either way.
 */
export const ATTACHMENT_URL_TTL_MS = 6 * 60 * 60 * 1000;

const secret = (): string => process.env.ATTACHMENT_URL_SECRET || process.env.JWT_SECRET || '';

const digest = (id: string, expiresAt: number): string =>
  createHmac('sha256', secret()).update(`${id}.${expiresAt}`).digest('base64url');

/** `<attachmentId>/file?t=<expiry>.<signature>` — what the DTO hands to the app. */
export function signAttachmentPath(id: string, now = Date.now()): string {
  const expiresAt = now + ATTACHMENT_URL_TTL_MS;
  return `/attachments/${id}/file?t=${expiresAt}.${digest(id, expiresAt)}`;
}

export function verifyAttachmentToken(id: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== 'string' || !secret()) return false;
  const separator = token.indexOf('.');
  if (separator < 1) return false;

  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;

  const expected = Buffer.from(digest(id, expiresAt));
  const given = Buffer.from(token.slice(separator + 1));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
