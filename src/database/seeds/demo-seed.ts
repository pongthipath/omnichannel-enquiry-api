import { ChatStatus, SenderType } from '../../common/constants/enums';
import dataSource from '../data-source';
import { demoScenarios } from './demo-data';

/**
 * Mock enquiries + conversations for demos (`npm run seed:demo`, after `npm run seed`).
 * Idempotent: each scenario has a fixed client_request_id, existing ones are skipped.
 * `npm run seed:demo:clean` first removes every other chat (e.g. left by `npm run smoke`) — dev only.
 */
const DEMO_ID_PREFIX = 'd0000000-';
const scenarioId = (key: number) => `${DEMO_ID_PREFIX}0000-4000-8000-${String(key).padStart(12, '0')}`;
const minutes = (n: number) => n * 60_000;
const clean = process.argv.includes('--clean');

async function seedDemo(): Promise<void> {
  if (clean && process.env.NODE_ENV === 'production') throw new Error('--clean is for local databases only');
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();
  await q.startTransaction();
  let created = 0;
  try {
    const ids = async (table: 'customer' | 'department' | 'product', col: string) =>
      new Map<string, string>((await q.query(`SELECT id, ${col} AS k FROM ${table}`)).map((r: { id: string; k: string }) => [r.k, r.id]));
    const customers = await ids('customer', 'code');
    const departments = await ids('department', 'code');
    const products = await ids('product', 'code');
    const staff = new Map<string, string>((await q.query(`SELECT id, email FROM staff`)).map((r: { id: string; email: string }) => [r.email, r.id]));
    const sla = await q.query(`SELECT enquiry_type, priority, target_minutes FROM sla_policy WHERE is_active`);
    if (!customers.size || !staff.size) throw new Error('run `npm run seed` first');

    if (clean) {
      // chat_message rows go with their chat (ON DELETE CASCADE)
      const [, removed] = await q.query(
        `DELETE FROM chat WHERE client_request_id IS NULL OR client_request_id::text NOT LIKE $1`,
        [`${DEMO_ID_PREFIX}%`],
      );
      console.log(`--clean: removed ${removed} non-demo chats`);
    }

    const slaMinutes = (type: string, priority: string) =>
      (sla.find((r: { enquiry_type: string; priority: string }) => r.enquiry_type === type && r.priority === priority) ??
        sla.find((r: { enquiry_type: string; priority: string | null }) => r.enquiry_type === type && r.priority === null) ??
        sla.find((r: { enquiry_type: string | null }) => r.enquiry_type === null))?.target_minutes ?? 1440;

    for (const s of demoScenarios) {
      const customerId = customers.get(s.customer)!;
      const clientRequestId = scenarioId(s.key);
      const [exists] = await q.query(`SELECT 1 FROM chat WHERE customer_id = $1 AND client_request_id = $2`, [customerId, clientRequestId]);
      if (exists) continue;

      const createdAt = new Date(Date.now() - s.createdHoursAgo * 3_600_000);
      const visible = s.messages.filter((m) => m.from !== 'event' && !m.internal);
      const last = visible[visible.length - 1] as { text: string; at: number; from: string; channel?: string };
      const lastAt = new Date(createdAt.getTime() + minutes(last.at));
      const description = (s.messages[0] as { text: string }).text;

      // SLA: reopened chats restart the cycle at the reopen time; waiting chats are paused
      const target = slaMinutes(s.type, s.priority);
      const reopenEvent = s.messages.find((m) => m.from === 'event' && m.data.kind === 'REOPENED');
      const slaStart = reopenEvent ? new Date(createdAt.getTime() + minutes(reopenEvent.at)) : createdAt;
      const slaDueAt = new Date(slaStart.getTime() + minutes(target));
      const done = s.status === ChatStatus.RESOLVED || s.status === ChatStatus.CLOSED;
      const waiting = s.status === ChatStatus.WAITING_FOR_CUSTOMER;
      const pausedAt = waiting ? new Date(createdAt.getTime() + minutes(s.messages[s.messages.length - 1].at)) : null;
      const breached = !done && !waiting && slaDueAt.getTime() < Date.now();
      const firstStaff = s.messages.find((m) => m.from === 'staff');
      const resolvedEvent = s.messages.find((m) => m.from === 'event' && m.data.to === 'RESOLVED');
      const unread = last.from === 'customer' ? visible.filter((m, i) => i >= visible.findLastIndex((x) => x.from === 'staff') + 1).length : 0;

      const [{ id: chatId }] = await q.query(
        `INSERT INTO chat (reference, customer_id, client_request_id, assigned_staff_id, department_id, product_id,
           origin_channel, enquiry_type, enquiry_sub_type, subject, description, priority, status,
           sla_minutes, sla_due_at, sla_paused_at, is_sla_breached, reopen_count, last_reopened_at, escalated_at,
           first_response_at, resolved_at, last_message_at, last_message_preview, last_message_sender_type,
           last_message_channel, unread_by_staff_count, created_at, updated_at)
         VALUES ('ENQ-' || extract(year from now()) || '-' || lpad(nextval('chat_reference_seq')::text, 6, '0'),
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$27)
         RETURNING id`,
        [
          customerId, clientRequestId, s.assignee ? staff.get(s.assignee) : null, departments.get(s.department),
          s.product ? products.get(s.product) : null, s.channel, s.type, s.subType ?? null, s.subject, description,
          s.priority, s.status, target, slaDueAt, pausedAt, breached, s.reopenCount ?? 0,
          reopenEvent ? slaStart : null, s.escalated ? new Date(createdAt.getTime() + minutes(5)) : null,
          firstStaff ? new Date(createdAt.getTime() + minutes(firstStaff.at)) : null,
          resolvedEvent && done ? new Date(createdAt.getTime() + minutes(resolvedEvent.at)) : null,
          lastAt, last.text.slice(0, 140), last.from === 'customer' ? SenderType.CUSTOMER : SenderType.STAFF,
          last.channel ?? s.channel, unread, createdAt,
        ],
      );

      for (const [i, m] of s.messages.entries()) {
        const at = new Date(createdAt.getTime() + minutes(m.at) + i); // +i ms keeps order stable
        const senderType = m.from === 'customer' ? 'CUSTOMER' : m.from === 'staff' ? 'STAFF' : m.staff ? 'STAFF' : 'SYSTEM';
        const senderId = m.from === 'customer' ? customerId : m.staff ? staff.get(m.staff) : null;
        await q.query(
          `INSERT INTO chat_message (chat_id, client_message_id, channel, sender_type, sender_id, message_type, body,
             event_data, is_internal, delivered_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            chatId, i === 0 ? clientRequestId : null, m.from === 'event' ? s.channel : (m.channel ?? s.channel),
            senderType, senderId, m.from === 'event' ? 'EVENT' : 'TEXT', m.from === 'event' ? null : m.text,
            m.from === 'event' ? JSON.stringify(m.data) : null, Boolean(m.internal), m.from === 'event' ? null : at, at,
          ],
        );
      }
      created++;
    }
    await q.commitTransaction();
    console.log(`demo data: ${created} enquiries added (${demoScenarios.length - created} already existed)`);
  } catch (e) {
    await q.rollbackTransaction();
    throw e;
  } finally {
    await q.release();
    await dataSource.destroy();
  }
}

seedDemo().catch((e) => {
  console.error(e);
  process.exit(1);
});
