import { Channel, EnquiryType, Priority } from '../../common/constants/enums';
import { Permission as P } from '../../common/permissions/permission.enum';

/** Dev/demo data (design "ส่งต่อ web-dev"). Password for every seeded account: DEV_PASSWORD. */
export const DEV_PASSWORD = 'Password123!';

export const departments = [
  { code: 'CS', nameTh: 'ฝ่ายบริการลูกค้า', nameEn: 'Customer Service', isDefault: true },
  { code: 'SALES', nameTh: 'ฝ่ายขาย', nameEn: 'Sales' },
  { code: 'WAREHOUSE', nameTh: 'คลังสินค้า', nameEn: 'Warehouse' },
  { code: 'LOGISTICS', nameTh: 'ขนส่ง', nameEn: 'Logistics' },
  { code: 'FINANCE', nameTh: 'การเงิน', nameEn: 'Finance' },
  { code: 'QC', nameTh: 'ควบคุมคุณภาพ', nameEn: 'Quality Control' },
  { code: 'PURCHASING', nameTh: 'จัดซื้อ', nameEn: 'Purchasing' },
];

const AGENT = [
  P.DASHBOARD_PAGE_VIEW,
  P.DASHBOARD_KPI_VIEW,
  P.INBOX_PAGE_VIEW,
  P.INBOX_SCOPE_OWN,
  P.INBOX_SCOPE_DEPARTMENT,
  P.INBOX_CHAT_REPLY,
  P.INBOX_ASSIGN_SELF,
  P.INBOX_STATUS_CHANGE,
  P.INBOX_STATUS_ESCALATE,
  P.INBOX_CUSTOMER_CHAT_VIEW,
  P.INBOX_TAG_APPLY,
  P.CUSTOMER_PANEL_CONTACT_EDIT,
  P.CUSTOMER_PANEL_CHANNEL_LINK,
  P.CUSTOMER_PANEL_HISTORY_VIEW,
  P.CUSTOMER_PANEL_ORDERS_VIEW,
  P.CUSTOMER_PANEL_NOTE_EDIT,
  P.CUSTOMER_PANEL_TAG_APPLY,
];
const SUPERVISOR = [
  ...AGENT,
  P.DASHBOARD_CATEGORY_VIEW,
  P.DASHBOARD_NEAR_BREACH,
  P.INBOX_CHAT_INTERNAL_VIEW,
  P.INBOX_ASSIGN_OTHERS,
  P.INBOX_STATUS_REOPEN,
  P.INBOX_STATUS_CHANGE_ANY,
  P.INBOX_ENQUIRY_CREATE,
  P.INBOX_ENQUIRY_EDIT,
  P.INBOX_CUSTOMER_CHAT_SEARCH_MESSAGES,
  P.INBOX_TAG_CREATE_INLINE,
  P.CUSTOMER_PANEL_SALESPERSON_ASSIGN,
  P.CUSTOMER_PANEL_CHANNEL_UNLINK,
  P.CUSTOMER_PANEL_MERGE,
  P.CUSTOMERS_PAGE_VIEW,
  P.CUSTOMERS_PLACEHOLDER_VIEW,
  P.CUSTOMERS_PLACEHOLDER_MERGE,
  P.SETTINGS_SLA_VIEW,
];
const MANAGER = [...SUPERVISOR, P.INBOX_SCOPE_ALL, P.SETTINGS_SLA_EDIT];
const ADMIN = Object.values(P).filter((v): v is P => typeof v === 'number');

export const roles = [
  { code: 'AGENT', name: 'Agent', permissions: AGENT },
  { code: 'SUPERVISOR', name: 'Supervisor', permissions: SUPERVISOR },
  { code: 'MANAGER', name: 'Manager', permissions: MANAGER },
  { code: 'ADMIN', name: 'Admin', permissions: ADMIN },
];

export const staff = [
  { email: 'admin@foodlink.test', name: 'ผู้ดูแลระบบ', role: 'ADMIN', department: 'CS' },
  { email: 'manager@foodlink.test', name: 'วิภา (ผู้จัดการ)', role: 'MANAGER', department: 'CS' },
  {
    email: 'cs.supervisor@foodlink.test',
    name: 'ธนา (หัวหน้า CS)',
    role: 'SUPERVISOR',
    department: 'CS',
  },
  { email: 'cs.agent@foodlink.test', name: 'สุดา (CS)', role: 'AGENT', department: 'CS' },
  { email: 'qc.agent@foodlink.test', name: 'สมชาย (QC)', role: 'AGENT', department: 'QC' },
  { email: 'sales.agent@foodlink.test', name: 'ธนพล (Sales)', role: 'AGENT', department: 'SALES' },
];

export const customers = [
  {
    code: 'CUS-00128',
    companyName: 'Bangkok Bistro Co.',
    contactName: 'คุณมาลี',
    phone: '0812345678',
    email: 'malee@bkkbistro.test',
    salesperson: 'sales.agent@foodlink.test',
    channels: [{ channel: Channel.LINE, externalId: 'U8f2a-malee', displayName: 'Malee' }],
  },
  {
    code: 'CUS-00201',
    companyName: 'Siam Riverside Hotel',
    contactName: 'คุณวิชัย',
    phone: '0895551122',
    email: 'purchasing@siamriverside.test',
    salesperson: 'sales.agent@foodlink.test',
    channels: [
      { channel: Channel.FACEBOOK, externalId: 'psid-2001', displayName: 'Wichai Purchasing' },
    ],
  },
  {
    code: 'CUS-00077',
    companyName: 'Chiang Mai Bakehouse',
    contactName: 'คุณแอน',
    phone: '053111222',
    email: 'ann@cmbakehouse.test',
    salesperson: null,
    channels: [],
  },
  {
    code: 'CUS-00310',
    companyName: 'Nana Pizza',
    contactName: 'คุณโจ้',
    phone: '0861239876',
    email: 'jo@nanapizza.test',
    salesperson: null,
    channels: [],
  },
  {
    code: 'CUS-00415',
    companyName: 'Phuket Seafood House',
    contactName: 'คุณนิด',
    phone: '0769998888',
    email: 'nid@phuketseafood.test',
    salesperson: null,
    channels: [],
  },
];

export const products = [
  ['BTR-FR-250', 'President เนยจืด 250g (French Butter)', 'Dairy', 'President', '250 g', 'pack'],
  ['BTR-FR-1KG', 'Elle & Vire French Butter 1kg', 'Dairy', 'Elle & Vire', '1 kg', 'block'],
  ['BTR-SLT-250', 'Anchor Salted Butter 250g', 'Dairy', 'Anchor', '250 g', 'pack'],
  ['CHS-MOZ-23', 'Galbani Mozzarella Cheese 2.3kg', 'Cheese', 'Galbani', '2.3 kg', 'block'],
  ['CHS-CRM-136', 'Philadelphia Cream Cheese 1.36kg', 'Cheese', 'Philadelphia', '1.36 kg', 'block'],
  ['CHS-PAR-1KG', 'Grana Padano Parmesan 1kg', 'Cheese', 'Grana Padano', '1 kg', 'wedge'],
  ['CHS-CHD-2KG', 'Mainland Cheddar 2kg', 'Cheese', 'Mainland', '2 kg', 'block'],
  ['CRM-WHP-1L', 'Elle & Vire Whipping Cream 1L', 'Dairy', 'Elle & Vire', '1 L', 'carton'],
  ['MLK-UHT-1L', 'Meiji UHT Milk 1L', 'Dairy', 'Meiji', '1 L', 'carton'],
  ['FLR-BRD-25', 'Bread Flour 25kg', 'Bakery', 'UFM', '25 kg', 'sack'],
  ['FLR-CAK-1KG', 'Cake Flour 1kg', 'Bakery', 'UFM', '1 kg', 'bag'],
  ['SGR-ICG-1KG', 'Icing Sugar 1kg', 'Bakery', 'Mitr Phol', '1 kg', 'bag'],
  ['CHO-DRK-1KG', 'Callebaut Dark Chocolate 54% 1kg', 'Bakery', 'Callebaut', '1 kg', 'bag'],
  ['OIL-OLV-5L', 'Extra Virgin Olive Oil 5L', 'Pantry', 'Bertolli', '5 L', 'tin'],
  ['PST-SPG-500', 'Spaghetti No.5 500g', 'Pantry', 'Barilla', '500 g', 'pack'],
  ['TOM-PLD-2.5', 'Peeled Tomatoes 2.5kg', 'Pantry', 'Mutti', '2.5 kg', 'can'],
  ['SAU-SOY-1L', 'Kikkoman Soy Sauce 1L', 'Pantry', 'Kikkoman', '1 L', 'bottle'],
  ['BEF-RIB-KG', 'Australian Beef Ribeye (per kg)', 'Frozen Meat', 'Stanbroke', '1 kg', 'kg'],
  ['CHK-BRS-2KG', 'Frozen Chicken Breast 2kg', 'Frozen Meat', 'CP', '2 kg', 'pack'],
  ['PRK-BCN-1KG', 'Smoked Bacon 1kg', 'Frozen Meat', 'Betagro', '1 kg', 'pack'],
  ['SLM-FLT-KG', 'Norwegian Salmon Fillet (per kg)', 'Seafood', 'Mowi', '1 kg', 'kg'],
  ['SHP-VAN-1KG', 'Frozen Vannamei Shrimp 1kg', 'Seafood', 'Thai Union', '1 kg', 'pack'],
  ['FRY-SHS-2.5', 'Shoestring French Fries 2.5kg', 'Frozen', 'Lamb Weston', '2.5 kg', 'bag'],
  ['ICE-VAN-5L', 'Vanilla Ice Cream 5L', 'Frozen', 'Magnolia', '5 L', 'tub'],
  ['EGG-L-30', 'Fresh Eggs Size L (30)', 'Fresh', 'CP', '30 pcs', 'tray'],
  ['VEG-ROM-KG', 'Romaine Lettuce (per kg)', 'Fresh', 'Local Farm', '1 kg', 'kg'],
  ['BEV-CLA-24', 'Sparkling Water 330ml x24', 'Beverage', 'San Pellegrino', '24 x 330 ml', 'case'],
  ['BEV-COF-1KG', 'Espresso Coffee Beans 1kg', 'Beverage', 'Lavazza', '1 kg', 'bag'],
  ['PKG-BOX-100', 'Pizza Box 12" (100 pcs)', 'Packaging', 'PackPro', '100 pcs', 'bundle'],
  ['CLN-DSH-5L', 'Dishwashing Liquid 5L', 'Cleaning', 'Sunlight', '5 L', 'gallon'],
] as const;

export const slaPolicies = [
  { enquiryType: EnquiryType.COMPLAINT, priority: Priority.URGENT, targetMinutes: 30 },
  { enquiryType: EnquiryType.COMPLAINT, priority: null, targetMinutes: 120 },
  { enquiryType: EnquiryType.PRODUCT_INFORMATION, priority: null, targetMinutes: 240 },
  { enquiryType: EnquiryType.PRICING, priority: null, targetMinutes: 240 },
  { enquiryType: EnquiryType.ORDER_DELIVERY, priority: null, targetMinutes: 240 },
  { enquiryType: EnquiryType.INVOICE_PAYMENT, priority: null, targetMinutes: 480 },
  { enquiryType: EnquiryType.SAMPLE_REQUEST, priority: null, targetMinutes: 480 },
  { enquiryType: null, priority: null, targetMinutes: 1440 },
];
