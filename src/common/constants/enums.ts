/** Fixed system values (stored as varchar). User-editable lists such as departments and tags are tables. */

export enum UserType {
  CUSTOMER = 'customer',
  STAFF = 'staff',
}

export enum ChatStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER = 'WAITING_FOR_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum EnquiryType {
  PRODUCT_INFORMATION = 'PRODUCT_INFORMATION',
  PRICING = 'PRICING',
  COMPLAINT = 'COMPLAINT',
  ORDER_DELIVERY = 'ORDER_DELIVERY',
  INVOICE_PAYMENT = 'INVOICE_PAYMENT',
  SAMPLE_REQUEST = 'SAMPLE_REQUEST',
  GENERAL = 'GENERAL',
}

export enum Channel {
  MOBILE_APP = 'MOBILE_APP',
  WEB_CHAT = 'WEB_CHAT',
  LINE = 'LINE',
  FACEBOOK = 'FACEBOOK',
  PHONE = 'PHONE',
}

export enum SenderType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  SYSTEM = 'SYSTEM',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  EVENT = 'EVENT',
}

export enum ChatEventKind {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  ASSIGNED = 'ASSIGNED',
  REASSIGNED = 'REASSIGNED',
  ESCALATED = 'ESCALATED',
  REOPENED = 'REOPENED',
  /** details edited in the Context Panel (type, priority, product, subject) */
  UPDATED = 'UPDATED',
  /** tags added / removed (names kept, so the history reads well after a tag is renamed or deleted) */
  TAGS_CHANGED = 'TAGS_CHANGED',
}
