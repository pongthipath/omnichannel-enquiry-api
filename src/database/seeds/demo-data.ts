import { Channel, ChatStatus, EnquiryType, Priority } from '../../common/constants/enums';

/**
 * Mock enquiries for demos and UI work (`npm run seed:demo`). Times are relative to "now" when the
 * script runs, so SLA timers look realistic. Every scenario has a fixed id → running again changes nothing.
 */
type Msg =
  | { from: 'customer' | 'staff'; text: string; at: number; staff?: string; channel?: Channel; internal?: boolean }
  | { from: 'event'; at: number; data: Record<string, unknown>; internal?: boolean; staff?: string };

export interface DemoScenario {
  key: number; // → fixed client_request_id
  customer: string; // customer.code
  type: EnquiryType;
  subType?: string;
  priority: Priority;
  product?: string; // product.code
  subject: string;
  channel: Channel;
  department: string; // department.code
  assignee?: string; // staff email
  status: ChatStatus;
  createdHoursAgo: number;
  reopenCount?: number;
  escalated?: boolean;
  messages: Msg[]; // `at` = minutes after creation; first customer message = the description
}

const SUDA = 'cs.agent@foodlink.test';
const SOMCHAI = 'qc.agent@foodlink.test';
const THANAPOL = 'sales.agent@foodlink.test';
const THANA = 'cs.supervisor@foodlink.test';

const assigned = (to: string, name: string, at: number) => ({ from: 'event' as const, at, staff: THANA, data: { kind: 'ASSIGNED', from: 'OPEN', to: 'ASSIGNED', staffName: name } });
const status = (from: ChatStatus, to: ChatStatus, at: number, staff?: string) => ({ from: 'event' as const, at, staff, data: { kind: 'STATUS_CHANGED', from, to } });

export const demoScenarios: DemoScenario[] = [
  // ---------- OPEN, unassigned (department queues) ----------
  {
    key: 1, customer: 'CUS-00310', type: EnquiryType.PRODUCT_INFORMATION, priority: Priority.NORMAL, product: 'CHS-MOZ-23',
    subject: 'Mozzarella 2.3kg มีสต็อกพอสำหรับ 40 ก้อนไหม', channel: Channel.MOBILE_APP, department: 'CS',
    status: ChatStatus.OPEN, createdHoursAgo: 1,
    messages: [{ from: 'customer', at: 0, text: 'สัปดาห์หน้าจะเปิดสาขาใหม่ ต้องใช้ Mozzarella 2.3kg ประมาณ 40 ก้อน มีของพอไหมคะ' }],
  },
  {
    key: 2, customer: 'CUS-00415', type: EnquiryType.COMPLAINT, subType: 'EXPIRED_PRODUCT', priority: Priority.URGENT, product: 'CRM-WHP-1L',
    subject: 'วิปปิ้งครีมหมดอายุก่อนกำหนด 6 กล่อง', channel: Channel.PHONE, department: 'QC',
    status: ChatStatus.OPEN, createdHoursAgo: 2, // urgent complaint 30 min → SLA breached
    messages: [
      { from: 'customer', at: 0, text: 'รับของเมื่อวาน วิปปิ้งครีม 6 กล่องวันหมดอายุเหลือแค่ 2 วัน ใช้ไม่ทันค่ะ (บันทึกจากโทรศัพท์)' },
    ],
  },
  {
    key: 3, customer: 'CUS-00077', type: EnquiryType.PRICING, priority: Priority.NORMAL, product: 'CHO-DRK-1KG',
    subject: 'ขอราคาช็อกโกแลต Callebaut 54% สั่ง 50 ถุง', channel: Channel.WEB_CHAT, department: 'SALES',
    status: ChatStatus.OPEN, createdHoursAgo: 3,
    messages: [{ from: 'customer', at: 0, text: 'ถ้าสั่ง Callebaut 54% 50 ถุงต่อเดือน มีราคาพิเศษไหมคะ' }],
  },

  // ---------- ASSIGNED ----------
  {
    key: 4, customer: 'CUS-00201', type: EnquiryType.ORDER_DELIVERY, subType: 'ORDER_STATUS', priority: Priority.HIGH,
    subject: 'ออเดอร์ SO-58812 จะส่งถึงกี่โมง', channel: Channel.FACEBOOK, department: 'CS', assignee: SUDA,
    status: ChatStatus.ASSIGNED, createdHoursAgo: 1.5,
    messages: [
      { from: 'customer', at: 0, text: 'ออเดอร์ SO-58812 วันนี้จะมาส่งกี่โมงครับ ครัวต้องเตรียมงานเลี้ยงเย็นนี้', channel: Channel.FACEBOOK },
      assigned(SUDA, 'สุดา (CS)', 10),
    ],
  },

  // ---------- IN_PROGRESS ----------
  {
    key: 5, customer: 'CUS-00128', type: EnquiryType.COMPLAINT, subType: 'DAMAGED_PRODUCT', priority: Priority.URGENT, product: 'BTR-FR-250',
    subject: 'เนยฝรั่งเศสกล่องบุบ 2 ลัง', channel: Channel.MOBILE_APP, department: 'QC', assignee: SOMCHAI,
    status: ChatStatus.IN_PROGRESS, createdHoursAgo: 0.3, escalated: true,
    messages: [
      { from: 'customer', at: 0, text: 'กล่องบุบ 2 ลัง เนยข้างในแตก ถ่ายรูปไว้แล้วค่ะ' },
      assigned(SUDA, 'สุดา (CS)', 2),
      { from: 'event', at: 5, staff: SUDA, internal: true, data: { kind: 'ESCALATED', toDepartmentName: 'ควบคุมคุณภาพ', reason: 'ต้องตรวจล็อตสินค้า' } },
      assigned(SOMCHAI, 'สมชาย (QC)', 7),
      { from: 'staff', at: 9, staff: SOMCHAI, text: 'รบกวนถ่ายรูปวันหมดอายุบนกล่องเพิ่มด้วยครับ' },
      status(ChatStatus.ASSIGNED, ChatStatus.IN_PROGRESS, 9),
      { from: 'customer', at: 14, text: 'ส่งให้แล้วค่ะ', channel: Channel.LINE },
    ],
  },
  {
    key: 6, customer: 'CUS-00201', type: EnquiryType.PRICING, subType: 'QUOTATION', priority: Priority.NORMAL, product: 'CHS-MOZ-23',
    subject: 'ขอใบเสนอราคา Mozzarella 20 ลัง', channel: Channel.FACEBOOK, department: 'SALES', assignee: THANAPOL,
    status: ChatStatus.IN_PROGRESS, createdHoursAgo: 2,
    messages: [
      { from: 'customer', at: 0, text: 'ขอใบเสนอราคา Mozzarella 20 ลังครับ ส่งโรงแรมสาขาริมน้ำ', channel: Channel.FACEBOOK },
      assigned(THANAPOL, 'ธนพล (Sales)', 15),
      { from: 'staff', at: 30, staff: THANAPOL, text: 'ได้ครับ ขอยืนยันว่าเป็นขนาด 2.3kg ใช่ไหมครับ' },
      status(ChatStatus.ASSIGNED, ChatStatus.IN_PROGRESS, 30),
      { from: 'customer', at: 42, text: 'ใช่ครับ 2.3kg', channel: Channel.FACEBOOK },
      { from: 'staff', at: 50, staff: THANAPOL, internal: true, text: 'ลูกค้ารายนี้มีสัญญาราคาปีนี้ เช็กกับฝ่ายการเงินก่อนส่ง' },
    ],
  },

  // ---------- WAITING_FOR_CUSTOMER ----------
  {
    key: 7, customer: 'CUS-00077', type: EnquiryType.ORDER_DELIVERY, subType: 'MISSING_ITEM', priority: Priority.HIGH, product: 'CHS-CRM-136',
    subject: 'ครีมชีสขาด 2 กล่องจากออเดอร์ล่าสุด', channel: Channel.MOBILE_APP, department: 'CS', assignee: SUDA,
    status: ChatStatus.WAITING_FOR_CUSTOMER, createdHoursAgo: 5,
    messages: [
      { from: 'customer', at: 0, text: 'สั่งครีมชีส 10 กล่อง ได้มาแค่ 8 กล่องค่ะ' },
      assigned(SUDA, 'สุดา (CS)', 20),
      { from: 'staff', at: 35, staff: SUDA, text: 'ขอโทษค่ะ รบกวนส่งรูปใบส่งของที่มีลายเซ็นรับของให้หน่อยนะคะ' },
      status(ChatStatus.ASSIGNED, ChatStatus.IN_PROGRESS, 35),
      status(ChatStatus.IN_PROGRESS, ChatStatus.WAITING_FOR_CUSTOMER, 36, SUDA),
    ],
  },

  // ---------- RESOLVED ----------
  {
    key: 8, customer: 'CUS-00310', type: EnquiryType.INVOICE_PAYMENT, priority: Priority.NORMAL,
    subject: 'ขอใบกำกับภาษีเต็มรูปเดือนที่แล้ว', channel: Channel.WEB_CHAT, department: 'FINANCE', assignee: THANA,
    status: ChatStatus.RESOLVED, createdHoursAgo: 26,
    messages: [
      { from: 'customer', at: 0, text: 'ขอใบกำกับภาษีเต็มรูปของเดือนที่แล้วครับ ชื่อบริษัท นานา พิซซ่า จำกัด' },
      assigned(THANA, 'ธนา (หัวหน้า CS)', 30),
      { from: 'staff', at: 60, staff: THANA, text: 'ส่งไฟล์ใบกำกับภาษีไปที่อีเมลแล้วครับ' },
      status(ChatStatus.ASSIGNED, ChatStatus.IN_PROGRESS, 60),
      status(ChatStatus.IN_PROGRESS, ChatStatus.RESOLVED, 61, THANA),
    ],
  },

  // ---------- CLOSED ----------
  {
    key: 9, customer: 'CUS-00128', type: EnquiryType.SAMPLE_REQUEST, priority: Priority.LOW, product: 'BTR-FR-1KG',
    subject: 'ขอตัวอย่างเนย Elle & Vire 1kg', channel: Channel.LINE, department: 'SALES', assignee: THANAPOL,
    status: ChatStatus.CLOSED, createdHoursAgo: 72,
    messages: [
      { from: 'customer', at: 0, text: 'ขอตัวอย่างเนย Elle & Vire 1kg ไปลองทำครัวซองต์ค่ะ', channel: Channel.LINE },
      assigned(THANAPOL, 'ธนพล (Sales)', 60),
      { from: 'staff', at: 90, staff: THANAPOL, text: 'จัดส่งตัวอย่างพร้อมรอบส่งของพรุ่งนี้ครับ' },
      status(ChatStatus.ASSIGNED, ChatStatus.IN_PROGRESS, 90),
      status(ChatStatus.IN_PROGRESS, ChatStatus.RESOLVED, 1500, THANAPOL),
      { from: 'event', at: 1600, data: { kind: 'STATUS_CHANGED', from: 'RESOLVED', to: 'CLOSED', by: 'CUSTOMER' } },
    ],
  },

  // ---------- reopened by the customer ----------
  {
    key: 10, customer: 'CUS-00415', type: EnquiryType.ORDER_DELIVERY, subType: 'LATE_DELIVERY', priority: Priority.HIGH, product: 'SLM-FLT-KG',
    subject: 'แซลมอนมาส่งช้ากว่านัด', channel: Channel.MOBILE_APP, department: 'LOGISTICS', assignee: SUDA,
    status: ChatStatus.OPEN, createdHoursAgo: 30, reopenCount: 1,
    messages: [
      { from: 'customer', at: 0, text: 'แซลมอนนัดส่ง 9 โมง แต่มาถึงเกือบเที่ยงค่ะ' },
      assigned(SUDA, 'สุดา (CS)', 10),
      { from: 'staff', at: 20, staff: SUDA, text: 'ขออภัยค่ะ รถติดฝนตกหนัก รอบหน้าจะจัดรถคันแรกให้นะคะ' },
      status(ChatStatus.ASSIGNED, ChatStatus.IN_PROGRESS, 20),
      status(ChatStatus.IN_PROGRESS, ChatStatus.RESOLVED, 25, SUDA),
      { from: 'customer', at: 1740, text: 'วันนี้ก็มาช้าอีกแล้วค่ะ ร้านต้องปิดเมนูแซลมอน' },
      { from: 'event', at: 1740, data: { kind: 'REOPENED', from: 'RESOLVED', to: 'OPEN', reopenCount: 1, by: 'CUSTOMER_MESSAGE' } },
    ],
  },
];

/** Team-made tags (settings page) and the demo enquiries (scenario keys) that carry them. */
export const demoTags: {
  name: string;
  color: string;
  appliesTo: 'ENQUIRY' | 'CUSTOMER' | 'BOTH';
  description: string;
  scenarios: number[];
}[] = [
  { name: 'ขนส่งล่าช้า', color: 'yellow', appliesTo: 'ENQUIRY', description: 'ของมาส่งช้ากว่าที่นัดลูกค้าไว้', scenarios: [10] },
  { name: 'ลูกค้าประจำ', color: 'blue', appliesTo: 'BOTH', description: 'สั่งซื้อต่อเนื่อง ให้ความสำคัญเป็นพิเศษ', scenarios: [10, 6] },
  { name: 'สินค้าเสียหาย', color: 'red', appliesTo: 'ENQUIRY', description: 'กล่องบุบ แตก หรือเสียระหว่างขนส่ง', scenarios: [5] },
  { name: 'รอเคลม', color: 'red', appliesTo: 'ENQUIRY', description: 'ต้องส่งเรื่องเคลมกับซัพพลายเออร์', scenarios: [] },
  { name: 'ขอใบเสนอราคา', color: 'green', appliesTo: 'ENQUIRY', description: 'ลูกค้าขอราคาสั่งจำนวนมาก', scenarios: [6, 3] },
  { name: 'ลูกค้าโรงแรม', color: 'cyan', appliesTo: 'CUSTOMER', description: 'กลุ่มลูกค้าโรงแรมและจัดเลี้ยง', scenarios: [] },
  { name: 'สต็อกไม่พอ', color: 'gray', appliesTo: 'ENQUIRY', description: 'ต้องเช็กกับคลังสินค้าก่อนตอบ', scenarios: [1] },
];

export interface DemoOrder {
  customer: string; // customer.code
  orderNo: string;
  daysAgo: number;
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
  totalAmount: string;
  itemsSummary: string;
  deliveredDaysAgo?: number;
}

/** Orders behind the Customer 360 panel — the numbers staff quote when answering "ของถึงไหนแล้ว". */
export const demoOrders: DemoOrder[] = [
  { customer: 'CUS-00128', orderNo: 'SO-58812', daysAgo: 2, status: 'DELIVERING', totalAmount: '18400.00', itemsSummary: 'Mozzarella 2.3kg ×8, เนยจืด 250g ×24' },
  { customer: 'CUS-00128', orderNo: 'SO-58690', daysAgo: 11, status: 'DELIVERED', totalAmount: '12750.00', itemsSummary: 'Mozzarella 2.3kg ×5, ครีมสด 1L ×12', deliveredDaysAgo: 9 },
  { customer: 'CUS-00128', orderNo: 'SO-58402', daysAgo: 33, status: 'DELIVERED', totalAmount: '9980.00', itemsSummary: 'ชีสเชดดาร์แผ่น ×20', deliveredDaysAgo: 31 },
  { customer: 'CUS-00201', orderNo: 'SO-58845', daysAgo: 1, status: 'CONFIRMED', totalAmount: '46200.00', itemsSummary: 'เนยจืด 250g ×120, ชีสเชดดาร์ 1kg ×30' },
  { customer: 'CUS-00201', orderNo: 'SO-58551', daysAgo: 20, status: 'DELIVERED', totalAmount: '38900.00', itemsSummary: 'ครีมสด 1L ×60, Mozzarella 2.3kg ×15', deliveredDaysAgo: 18 },
  { customer: 'CUS-00077', orderNo: 'SO-58877', daysAgo: 0, status: 'PENDING', totalAmount: '7350.00', itemsSummary: 'โยเกิร์ตถัง 5kg ×6' },
  { customer: 'CUS-00077', orderNo: 'SO-58318', daysAgo: 41, status: 'CANCELLED', totalAmount: '5200.00', itemsSummary: 'ชีสครีม 1kg ×10 (ลูกค้ายกเลิกเอง)' },
  { customer: 'CUS-00310', orderNo: 'SO-58801', daysAgo: 3, status: 'DELIVERED', totalAmount: '15600.00', itemsSummary: 'Mozzarella 2.3kg ×10', deliveredDaysAgo: 1 },
  { customer: 'CUS-00310', orderNo: 'SO-58620', daysAgo: 15, status: 'DELIVERED', totalAmount: '21400.00', itemsSummary: 'เนยจืด 250g ×48, ครีมสด 1L ×24', deliveredDaysAgo: 13 },
  { customer: 'CUS-00415', orderNo: 'SO-58860', daysAgo: 1, status: 'DELIVERING', totalAmount: '28750.00', itemsSummary: 'ชีสเชดดาร์ 1kg ×25, โยเกิร์ตถัง 5kg ×10' },
  { customer: 'CUS-00415', orderNo: 'SO-58733', daysAgo: 8, status: 'DELIVERED', totalAmount: '11200.00', itemsSummary: 'ครีมสด 1L ×30', deliveredDaysAgo: 6 },
];
