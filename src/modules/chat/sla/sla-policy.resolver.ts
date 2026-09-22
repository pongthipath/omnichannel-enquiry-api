import { EnquiryType, Priority } from '../../../common/constants/enums';

export interface SlaRule {
  enquiryType: EnquiryType | null;
  priority: Priority | null;
  targetMinutes: number;
}

/** Most specific rule wins: (type + priority) → (type) → default (design §11). */
export function resolveSlaMinutes(rules: SlaRule[], type: EnquiryType, priority: Priority): number {
  const exact = rules.find((r) => r.enquiryType === type && r.priority === priority);
  const byType = rules.find((r) => r.enquiryType === type && r.priority === null);
  const fallback = rules.find((r) => r.enquiryType === null && r.priority === null);
  const rule = exact ?? byType ?? fallback;
  return rule?.targetMinutes ?? 24 * 60;
}

export const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);
