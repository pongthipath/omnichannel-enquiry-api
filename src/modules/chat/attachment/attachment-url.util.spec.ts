import { ATTACHMENT_URL_TTL_MS, signAttachmentPath, verifyAttachmentToken } from './attachment-url.util';

const ID = '2ed50d88-d8f0-4a7e-a17e-74e907ae43cd';
const OTHER = 'ffffffff-d8f0-4a7e-a17e-74e907ae43cd';
const tokenOf = (path: string) => decodeURIComponent(path.split('?t=')[1]);

describe('attachment links', () => {
  const now = 1_790_000_000_000;
  beforeAll(() => {
    process.env.ATTACHMENT_URL_SECRET = 'a-test-secret-long-enough-to-sign';
  });

  it('ลิงก์ที่เซ็นเองใช้ได้ และชี้ไปที่ไฟล์ของ attachment นั้น', () => {
    const path = signAttachmentPath(ID, now);
    expect(path.startsWith(`/attachments/${ID}/file?t=`)).toBe(true);
    expect(verifyAttachmentToken(ID, tokenOf(path), now)).toBe(true);
  });

  it('ลายเซ็นของไฟล์หนึ่ง ใช้กับอีกไฟล์ไม่ได้', () => {
    const token = tokenOf(signAttachmentPath(ID, now));
    expect(verifyAttachmentToken(OTHER, token, now)).toBe(false);
  });

  it('หมดอายุแล้วใช้ไม่ได้', () => {
    const token = tokenOf(signAttachmentPath(ID, now));
    expect(verifyAttachmentToken(ID, token, now + ATTACHMENT_URL_TTL_MS - 1)).toBe(true);
    expect(verifyAttachmentToken(ID, token, now + ATTACHMENT_URL_TTL_MS + 1)).toBe(false);
  });

  it('แก้วันหมดอายุให้ยาวขึ้นเองไม่ได้ ลายเซ็นจะไม่ตรง', () => {
    const token = tokenOf(signAttachmentPath(ID, now));
    const forged = `${now + 10 * ATTACHMENT_URL_TTL_MS}.${token.split('.')[1]}`;
    expect(verifyAttachmentToken(ID, forged, now)).toBe(false);
  });

  it('ไม่มี token, รูปแบบผิด หรือไม่ใช่ string → ไม่ผ่าน', () => {
    expect(verifyAttachmentToken(ID, undefined, now)).toBe(false);
    expect(verifyAttachmentToken(ID, '', now)).toBe(false);
    expect(verifyAttachmentToken(ID, 'no-dot', now)).toBe(false);
    expect(verifyAttachmentToken(ID, `${now + 1000}.`, now)).toBe(false);
    expect(verifyAttachmentToken(ID, 12345, now)).toBe(false);
  });
});
