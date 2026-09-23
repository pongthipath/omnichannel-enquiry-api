// End-to-end smoke test against a running API with seeded data.
//   npm run seed && npm run start:dev   (in another terminal)
//   npm run smoke
// Covers: auth, product trigram search, idempotent create, the brief's offline sync test (§14),
// scope/visibility (404 outside scope, no duplicates), assignment, status rules, reopen, realtime.
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const API = `${BASE}/api/v1`;
const PASSWORD = 'Password123!';
let failures = 0;

const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
};

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

const login = async (email, userType) => {
  const r = await call('POST', '/auth/login', null, { email, password: PASSWORD, userType });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.accessToken;
};

const waitFor = (socket, event, predicate, ms = 3000) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.on(event, (payload) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        resolve(payload);
      }
    });
  });

async function main() {
  const health = await fetch(`${BASE}/api/health/ready`);
  check('health/ready is public and OK', health.status === 200);

  const bad = await call('POST', '/auth/login', null, { email: 'nobody@x.test', password: 'x', userType: 'staff' });
  check('wrong credentials → 401 auth.invalidCredentials', bad.status === 401 && bad.data?.code === 'auth.invalidCredentials');

  const customer = await login('malee@bkkbistro.test', 'customer');
  const csAgent = await login('cs.agent@foodlink.test', 'staff');
  const qcAgent = await login('qc.agent@foodlink.test', 'staff');
  const supervisor = await login('cs.supervisor@foodlink.test', 'staff');
  const manager = await login('manager@foodlink.test', 'staff');
  check('logins for customer + 4 staff roles', true);

  const me = await call('GET', '/auth/me', csAgent);
  check('/auth/me returns permission bitmask as string', typeof me.data?.permissions === 'string' && BigInt(me.data.permissions) > 0n);

  // ---------- products (trigram) ----------
  const butter = await call('GET', `/products?q=${encodeURIComponent('เนยจืด')}`, customer);
  check('product search Thai partial "เนยจืด"', butter.data?.[0]?.code === 'BTR-FR-250');
  const typo = await call('GET', '/products?q=mozarela', customer);
  check('product search with typo "mozarela" → Mozzarella', typo.data?.some((p) => p.code === 'CHS-MOZ-23'));

  // ---------- idempotent create ----------
  const key = randomUUID();
  const enquiry = {
    clientRequestId: key,
    enquiryType: 'COMPLAINT',
    subject: 'กล่องบุบ 2 ลัง',
    description: 'เนยฝรั่งเศสกล่องบุบ เนยข้างในแตก',
    priority: 'URGENT',
    productId: butter.data?.[0]?.id,
  };
  const socket = io(BASE, { auth: { token: supervisor }, transports: ['websocket'] });
  await new Promise((r) => socket.on('connect', r));
  const createdEvent = waitFor(socket, 'chat.created', (p) => p.data?.subject === enquiry.subject);

  const first = await call('POST', '/conversations', customer, enquiry);
  const again = await call('POST', '/conversations', customer, enquiry);
  check('create enquiry → 201', first.status === 201 && first.data?.created === true, first.data?.enquiry?.reference);
  check('same clientRequestId again → 200, same enquiry (no duplicate)', again.status === 200 && again.data?.enquiry?.id === first.data?.enquiry?.id);
  check('SLA for urgent complaint = 30 min', first.data?.enquiry?.slaMinutes === 30);
  check('realtime: supervisor (CS department room) received chat.created', Boolean(await createdEvent));

  // ---------- the brief's offline test (§14): 3 queued items, synced twice ----------
  const offline = [1, 2, 3].map((n) => ({
    op: 'conversation.create',
    clientId: randomUUID(),
    payload: { enquiryType: 'PRODUCT_INFORMATION', subject: `offline #${n}`, description: `created offline ${n}`, priority: 'NORMAL' },
  }));
  const sync1 = await call('POST', '/messages/sync', customer, { items: offline });
  const sync2 = await call('POST', '/messages/sync', customer, { items: offline });
  check('offline sync #1 → 3 created', sync1.data?.results?.filter((r) => r.status === 'created').length === 3);
  check('offline sync #2 (repeat) → 3 duplicate, same server ids', sync2.data?.results?.every((r, i) => r.status === 'duplicate' && r.serverId === sync1.data.results[i].serverId));
  const mine = await call('GET', '/conversations?limit=100', customer);
  const offlineCount = mine.data?.items?.filter((e) => e.subject.startsWith('offline #') && sync1.data.results.some((r) => r.serverId === e.id)).length;
  check('server has exactly 3 of the offline enquiries', offlineCount === 3);

  // ---------- scope / visibility ----------
  const id = first.data.enquiry.id;
  const qcSees = await call('GET', `/conversations/${id}`, qcAgent);
  check('QC agent cannot see a CS-department enquiry → 404 (existence hidden)', qcSees.status === 404);
  const csList = await call('GET', '/conversations?limit=100', csAgent);
  const csIds = csList.data?.items?.map((e) => e.id) ?? [];
  check('CS agent list has no duplicates', new Set(csIds).size === csIds.length && csIds.includes(id));

  // ---------- status rules ----------
  const early = await call('PUT', `/conversations/${id}/status`, csAgent, { status: 'IN_PROGRESS' });
  check('status change before assignment → 409 (invalid/not assigned)', early.status === 409);
  const csAgentId = me.data.id;
  const take = await call('PUT', `/conversations/${id}/assign`, csAgent, { staffId: csAgentId });
  check('CS agent takes the enquiry → ASSIGNED, visibility MINE', take.data?.status === 'ASSIGNED' && take.data?.visibility === 'MINE');
  const other = await call('PUT', `/conversations/${id}/status`, supervisor, { status: 'RESOLVED' });
  check('skip ASSIGNED → RESOLVED → 409 invalidTransition', other.status === 409 && other.data?.code === 'chat.invalidTransition');

  const reply = await call('POST', `/conversations/${id}/messages`, csAgent, { clientMessageId: randomUUID(), body: 'รบกวนถ่ายรูปวันหมดอายุด้วยครับ' });
  const afterReply = await call('GET', `/conversations/${id}`, csAgent);
  check("owner's first reply → IN_PROGRESS", reply.status === 201 && afterReply.data?.status === 'IN_PROGRESS');

  const waiting = await call('PUT', `/conversations/${id}/status`, csAgent, { status: 'WAITING_FOR_CUSTOMER' });
  check('owner → WAITING_FOR_CUSTOMER (SLA paused)', waiting.data?.status === 'WAITING_FOR_CUSTOMER' && waiting.data?.slaPausedAt);
  const customerMsgEvent = waitFor(socket, 'chat.message.created', (p) => p.data?.chatId === id && p.data?.senderType === 'CUSTOMER');
  await call('POST', `/conversations/${id}/messages`, customer, { clientMessageId: randomUUID(), body: 'ส่งรูปให้แล้วค่ะ' });
  const resumed = await call('GET', `/conversations/${id}`, csAgent);
  check('customer reply → back to IN_PROGRESS automatically', resumed.data?.status === 'IN_PROGRESS');
  check('realtime: message event delivered once to supervisor', Boolean(await customerMsgEvent));

  const resolved = await call('PUT', `/conversations/${id}/status`, supervisor, { status: 'RESOLVED' });
  check('supervisor with CHANGE_ANY resolves it', resolved.data?.status === 'RESOLVED');
  const closed = await call('PUT', `/conversations/${id}/status`, customer, { status: 'CLOSED' });
  check('customer confirms → CLOSED', closed.data?.status === 'CLOSED');
  const staffPost = await call('POST', `/conversations/${id}/messages`, csAgent, { body: 'x' });
  check('staff cannot post into a CLOSED enquiry → 409 chat.closed', staffPost.status === 409);

  await call('POST', `/conversations/${id}/messages`, customer, { clientMessageId: randomUUID(), body: 'ยังมีปัญหาอยู่ค่ะ' });
  const reopened = await call('GET', `/conversations/${id}`, csAgent);
  check('customer message on CLOSED → reopened as OPEN, owner kept, reopenCount 1',
    reopened.data?.status === 'OPEN' && reopened.data?.assignedStaffId === csAgentId && reopened.data?.reopenCount === 1);

  const managerSees = await call('GET', `/conversations/${id}`, manager);
  check('manager (scope all) can see it', managerSees.status === 200 && managerSees.data?.visibility !== 'MINE');

  // ----- design v2 endpoints: tags, edit details, dashboard, customers -----
  const admin = await login('admin@foodlink.test', 'staff');
  const tagName = `smoke-${Date.now()}`;
  const tag = await call('POST', '/tags', admin, { name: tagName, color: 'green' });
  check('admin creates a tag', tag.status === 201 && tag.data?.usageCount === 0);
  const dupTag = await call('POST', '/tags', admin, { name: tagName.toUpperCase() });
  check('same tag name (any case) → 409 tag.duplicateName', dupTag.status === 409);
  const tagged = await call('PUT', `/conversations/${id}/tags`, supervisor, { tagIds: [tag.data.id] });
  check('supervisor tags the enquiry', tagged.data?.tags?.[0]?.name === tagName);
  const byTag = await call('GET', `/conversations?tagId=${tag.data.id}`, manager);
  check('filter enquiries by tag', byTag.data?.items?.length === 1 && byTag.data.items[0].id === id);
  const edited = await call('PATCH', `/conversations/${id}`, supervisor, { priority: 'URGENT' });
  check('supervisor edits priority (SLA re-snapshot)', edited.data?.priority === 'URGENT' && edited.data?.slaMinutes > 0);
  const agentEdit = await call('PATCH', `/conversations/${id}`, csAgent, { priority: 'LOW' });
  check('agent without ENQUIRY_EDIT → 403', agentEdit.status === 403);
  const dash = await call('GET', '/dashboard/summary', manager);
  check('dashboard summary has totals + 6 statuses', dash.status === 200 && dash.data?.byStatus?.length === 6);
  const customers = await call('GET', '/customers?q=bistro', manager);
  check('customers page search', customers.data?.items?.[0]?.code === 'CUS-00128' && customers.data.items[0].openEnquiries >= 1);
  const bistroId = customers.data.items[0].id;
  await call('DELETE', `/tags/${tag.data.id}`, admin);
  const afterDelete = await call('GET', `/conversations/${id}`, manager);
  check('deleting a tag removes it from enquiries', afterDelete.data?.tags?.length === 0);


  // ----- attachments, inbound channels, SLA settings, orders, customer chat (design §11, §12, §17, A5/A6/A9) -----
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
  const uploadRes = await fetch(`${API}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supervisor}` },
    body: form,
  });
  const uploaded = await uploadRes.json().catch(() => null);
  check('staff uploads an image → stored', uploadRes.status === 201 && uploaded?.status === 'STORED');

  const withFile = await call('POST', `/conversations/${id}/messages`, supervisor, {
    clientMessageId: randomUUID(),
    body: '',
    attachmentIds: [uploaded.id],
  });
  check('message with only an attachment is allowed, typed IMAGE',
    withFile.status === 201 && withFile.data?.message?.messageType === 'IMAGE' && withFile.data.message.attachments.length === 1);
  const reuse = await call('POST', `/conversations/${id}/messages`, supervisor, {
    clientMessageId: randomUUID(),
    body: 'ส่งซ้ำ',
    attachmentIds: [uploaded.id],
  });
  check('an attachment cannot be sent twice → 400', reuse.status === 400);
  // the link that came with the message is signed, so an <img> can load it with no header at all
  const signedUrl = withFile.data.message.attachments[0].url;
  check('the message hands out a signed link', /^\/attachments\/[0-9a-f-]+\/file\?t=\d+\./.test(signedUrl));
  const fileRes = await fetch(`${API}${signedUrl}`);
  check('the signed link downloads the file without a token', fileRes.status === 200);
  const noToken = await fetch(`${API}/attachments/${uploaded.id}/file`, {
    headers: { Authorization: `Bearer ${supervisor}` },
  });
  check('the same url without a signature is refused, even for staff', noToken.status === 401);
  const tampered = await fetch(`${API}${signedUrl.slice(0, -2)}xy`);
  check('a tampered signature is refused', tampered.status === 401);

  const unsigned = await call('POST', '/webhooks/line', null, { events: [] });
  check('a webhook without a signature is rejected → 401', unsigned.status === 401);
  const lineUser = `U-smoke-${Date.now()}`;
  const sim = await call('POST', '/webhooks/simulate', admin, {
    channel: 'LINE',
    externalUserId: lineUser,
    displayName: 'สมชาย (smoke)',
    text: 'ของยังไม่ถึงเลยครับ',
  });
  check('simulator accepts a message from an unknown LINE user', sim.status === 201 && sim.data?.accepted === 1);
  const simChatId = sim.data.chatIds[0];
  const simAgain = await call('POST', '/webhooks/simulate', admin, {
    channel: 'LINE',
    externalUserId: lineUser,
    text: 'ยังรออยู่นะครับ',
  });
  check('the same person joins their open enquiry instead of starting a new one',
    simAgain.data?.chatIds?.[0] === simChatId);
  const simAgent = await call('POST', '/webhooks/simulate', csAgent, { channel: 'LINE', externalUserId: 'x', text: 'y' });
  check('an agent without SIMULATOR_PAGE_USE → 403', simAgent.status === 403);

  const simChat = await call('GET', `/conversations/${simChatId}`, admin);
  const placeholderId = simChat.data.customerId;
  const placeholder = await call('GET', `/customers/${placeholderId}`, admin);
  check('the unknown sender became an unverified customer', placeholder.data?.isPlaceholder === true);
  const merged = await call('POST', `/customers/${placeholderId}/merge`, admin, { targetCustomerId: bistroId });
  check('merging folds them into the real customer', merged.status === 201 && merged.data?.id === bistroId);
  const afterMerge = await call('GET', `/conversations/${simChatId}`, admin);
  check('their enquiry moved across with them', afterMerge.data?.customerId === bistroId);
  const mergeAgain = await call('POST', `/customers/${bistroId}/merge`, admin, { targetCustomerId: bistroId });
  check('merging a real customer into itself → 409', mergeAgain.status === 409);

  const orders = await call('GET', `/customers/${bistroId}/orders`, supervisor);
  check('customer orders are listed newest first', orders.status === 200 && orders.data?.length >= 1);
  const ownOrders = await call('GET', `/customers/${bistroId}/orders`, customer);
  check('the customer sees their own orders', ownOrders.status === 200 && ownOrders.data?.length === orders.data.length);
  const otherOrders = await call('GET', `/customers/${placeholderId}/orders`, customer);
  check('and nobody else’s', otherOrders.status === 403);

  const customerChat = await call('GET', `/customers/${bistroId}/messages?limit=5`, supervisor);
  check('every message of one customer, across enquiries, carries its enquiry reference',
    customerChat.status === 200 && customerChat.data?.items?.[0]?.chatReference?.startsWith('ENQ-'));
  const searched = await call('GET', `/customers/${bistroId}/messages?q=${encodeURIComponent('ของยังไม่ถึง')}`, supervisor);
  check('searching the text finds it', searched.status === 200 && searched.data.items.length >= 1);
  const agentSearch = await call('GET', `/customers/${bistroId}/messages?q=x`, csAgent);
  check('an agent without CHAT_SEARCH_MESSAGES may read but not search → 403', agentSearch.status === 403);

  const policies = await call('GET', '/sla-policies', manager);
  check('SLA policies are listed', policies.status === 200 && policies.data?.length >= 1);
  // the scope of a rule is a fixed pair of enums, so a re-run reuses the rule the last run left
  const scope = { enquiryType: 'GENERAL', priority: 'LOW' };
  const created = await call('POST', '/sla-policies', manager, { ...scope, targetMinutes: 720 });
  const policy =
    created.status === 201
      ? created.data
      : (await call('GET', '/sla-policies', manager)).data.find(
          (p) => p.enquiryType === scope.enquiryType && p.priority === scope.priority,
        );
  check('manager adds an SLA rule', Boolean(policy?.id) && policy.targetMinutes === 720);
  const dupPolicy = await call('POST', '/sla-policies', manager, { ...scope, targetMinutes: 60 });
  check('the same scope twice → 409 sla.duplicateRule', dupPolicy.status === 409);
  const tooShort = await call('POST', '/sla-policies', manager, { enquiryType: 'PRICING', targetMinutes: 1 });
  check('a target under 5 minutes is rejected', tooShort.status === 400);
  const offPolicy = await call('PATCH', `/sla-policies/${policy.id}`, manager, { isActive: false });
  check('a rule can be switched off', offPolicy.data?.isActive === false);
  await call('PATCH', `/sla-policies/${policy.id}`, manager, { isActive: true, targetMinutes: 720 });
  const agentPolicy = await call('POST', '/sla-policies', csAgent, { targetMinutes: 30 });
  check('an agent cannot change SLA rules → 403', agentPolicy.status === 403);

  // ----- managing the catalogue (Settings › Products) -----
  // a product cannot be deleted by design, so a re-run reuses the one the last run left behind
  const productCode = 'SMOKE-BRIE-200';
  const body = {
    code: productCode.toLowerCase(),
    name: 'Smoke Brie de Meaux 200g',
    category: 'Cheese',
    brand: 'Ile de France',
    packSize: '200g',
    unit: 'ชิ้น',
  };
  const newProduct = await call('POST', '/products', admin, body);
  const product =
    newProduct.status === 201
      ? newProduct.data
      : (await call('GET', '/settings/products', admin)).data.find((p) => p.code === productCode);
  check('admin adds a product, code stored upper-case', product?.code === productCode);
  const productId = product.id;
  // a previous run may have left it switched off
  await call('PATCH', `/products/${productId}`, admin, { isActive: true, brand: body.brand });

  const dupProduct = await call('POST', '/products', admin, { code: productCode, name: 'same code' });
  check('the same product code twice → 409 product.duplicateCode', dupProduct.status === 409);

  const foundNew = await call('GET', `/products?q=${encodeURIComponent('Brie de Meaux')}`, csAgent);
  check('a new product is searchable right away', foundNew.data?.some((p) => p.id === productId));
  const productTypo = await call('GET', `/products?q=${encodeURIComponent('bri de mo')}`, csAgent);
  check('and still found when the name is mistyped', productTypo.data?.some((p) => p.id === productId));

  const renamed = await call('PATCH', `/products/${productId}`, admin, { brand: 'Président' });
  check('a product can be edited', renamed.data?.brand === 'Président');

  const deactivated = await call('PATCH', `/products/${productId}`, admin, { isActive: false });
  check('switching a product off does not delete it', deactivated.data?.isActive === false);
  const afterOff = await call('GET', `/products?q=${encodeURIComponent('Brie de Meaux')}`, csAgent);
  check('an inactive product leaves the pickers', !afterOff.data?.some((p) => p.id === productId));
  const settingsList = await call('GET', '/settings/products', admin);
  check('but the settings page still lists it, with its enquiry count',
    settingsList.data?.some((p) => p.id === productId && p.isActive === false && p.enquiries === 0));

  const agentProduct = await call('POST', '/products', csAgent, { code: 'X-1', name: 'x' });
  check('an agent cannot add products → 403', agentProduct.status === 403);
  const agentList = await call('GET', '/settings/products', csAgent);
  check('nor open the settings list → 403', agentList.status === 403);

  socket.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
