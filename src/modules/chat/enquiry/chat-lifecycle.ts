import { ChatStatus as S } from '../../../common/constants/enums';
import { addMinutes } from '../sla/sla-policy.resolver';
import { Chat } from './chat.entity';

/**
 * Field changes that come with a status change (pure — no DB). Used by status changes, assignment
 * and the automatic transitions triggered by customer messages.
 */
export function applyStatusChange(
  chat: Chat,
  to: S,
  now: Date,
  reopenSla?: { slaMinutes: number },
): void {
  const from = chat.status;

  // SLA pauses while waiting for the customer; the due time moves by the paused duration
  if (to === S.WAITING_FOR_CUSTOMER) chat.slaPausedAt = now;
  if (from === S.WAITING_FOR_CUSTOMER && chat.slaPausedAt) {
    const pausedSeconds = Math.round((now.getTime() - chat.slaPausedAt.getTime()) / 1000);
    chat.slaPausedSeconds += pausedSeconds;
    chat.slaDueAt = new Date(chat.slaDueAt.getTime() + pausedSeconds * 1000);
    chat.slaPausedAt = null;
  }

  if (to === S.RESOLVED) chat.resolvedAt = now;
  if (from === S.RESOLVED && to !== S.CLOSED) chat.resolvedAt = null;

  // reopened by the customer (or by hand): new SLA cycle, owner kept (design §6.2)
  if (to === S.OPEN && (from === S.RESOLVED || from === S.CLOSED)) {
    chat.reopenCount += 1;
    chat.lastReopenedAt = now;
    chat.resolvedAt = null;
    chat.isSlaBreached = false;
    if (reopenSla) {
      chat.slaMinutes = reopenSla.slaMinutes;
      chat.slaDueAt = addMinutes(now, reopenSla.slaMinutes);
    }
  }

  chat.status = to;
}
