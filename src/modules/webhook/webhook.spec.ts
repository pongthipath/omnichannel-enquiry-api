import { createHmac } from 'node:crypto';
import { Channel } from '../../common/constants/enums';
import { InboundService } from './inbound/inbound.service';
import { verifyHmac } from './inbound/signature.util';

describe('verifyHmac', () => {
  const raw = Buffer.from('{"events":[]}');
  const secret = 'shhh';

  it('accepts a LINE signature (base64 of the raw body)', () => {
    const sig = createHmac('sha256', secret).update(raw).digest('base64');
    expect(verifyHmac(raw, sig, secret, 'line')).toBe(true);
  });

  it('accepts a Facebook signature (sha256=<hex>)', () => {
    const sig = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    expect(verifyHmac(raw, sig, secret, 'facebook')).toBe(true);
  });

  it('rejects a tampered body, a wrong secret and a missing header', () => {
    const sig = createHmac('sha256', secret).update(raw).digest('base64');
    expect(verifyHmac(Buffer.from('{"events":[1]}'), sig, secret, 'line')).toBe(false);
    expect(verifyHmac(raw, sig, 'other', 'line')).toBe(false);
    expect(verifyHmac(raw, undefined, secret, 'line')).toBe(false);
  });
});

describe('InboundService payload normalisation', () => {
  it('reads text and image events from LINE and skips the rest', () => {
    const messages = InboundService.fromLine({
      events: [
        { type: 'message', source: { userId: 'U1' }, message: { id: '10', type: 'text', text: 'สวัสดีครับ' } },
        { type: 'message', source: { userId: 'U1' }, message: { id: '11', type: 'image', contentUrl: 'https://cdn.test/a.jpg' } },
        { type: 'follow', source: { userId: 'U2' } },
        { type: 'message', message: { id: '12', type: 'text', text: 'no sender' } },
      ],
    });
    expect(messages).toEqual([
      { channel: Channel.LINE, externalUserId: 'U1', externalMessageId: 'line:10', text: 'สวัสดีครับ', imageUrl: undefined },
      { channel: Channel.LINE, externalUserId: 'U1', externalMessageId: 'line:11', text: undefined, imageUrl: 'https://cdn.test/a.jpg' },
    ]);
  });

  it('flattens Facebook entries and picks the image attachment', () => {
    const messages = InboundService.fromFacebook({
      entry: [
        {
          messaging: [
            { sender: { id: 'PSID' }, message: { mid: 'm1', text: 'ของถึงไหนแล้ว' } },
            { sender: { id: 'PSID' }, message: { mid: 'm2', attachments: [{ type: 'image', payload: { url: 'https://cdn.test/b.jpg' } }] } },
            { sender: { id: 'PSID' } }, // delivery receipt — no message
          ],
        },
      ],
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ channel: Channel.FACEBOOK, externalMessageId: 'fb:m1', text: 'ของถึงไหนแล้ว' });
    expect(messages[1].imageUrl).toBe('https://cdn.test/b.jpg');
  });

  it('needs a user id on the web chat payload', () => {
    expect(InboundService.fromWebChat({ text: 'hi' })).toEqual([]);
    expect(InboundService.fromWebChat({ userId: 'w1', name: 'มาลี', text: 'hi', messageId: 'x' })[0]).toMatchObject({
      channel: Channel.WEB_CHAT,
      externalUserId: 'w1',
      displayName: 'มาลี',
      externalMessageId: 'web:x',
    });
  });
});
