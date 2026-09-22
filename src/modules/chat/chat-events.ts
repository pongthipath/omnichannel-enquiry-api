import { rooms } from '../../common/realtime/realtime.publisher';
import { Chat } from './enquiry/chat.entity';

export const ChatEvent = {
  CHAT_CREATED: 'chat.created',
  CHAT_UPDATED: 'chat.updated',
  MESSAGE_CREATED: 'chat.message.created',
} as const;

/**
 * Rooms that may see this chat: the customer, its owner, its department and people with "all" scope.
 * Sent in ONE emit so a socket in several rooms receives it once (design §16.5).
 */
export function chatRooms(
  chat: Pick<Chat, 'customerId' | 'assignedStaffId' | 'departmentId'>,
  opts: { includeCustomer: boolean },
) {
  const list = [rooms.department(chat.departmentId), rooms.all];
  if (chat.assignedStaffId) list.push(rooms.staff(chat.assignedStaffId));
  if (opts.includeCustomer) list.push(rooms.customer(chat.customerId));
  return list;
}
