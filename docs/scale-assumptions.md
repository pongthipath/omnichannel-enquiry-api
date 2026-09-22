# Scale assumptions — Omnichannel Enquiry

ยืนยันโดย user: 2026-09-22 — เลือก "Prototype + โตได้"

| # | หัวข้อ | สมมติฐาน |
|---|---|---|
| 1 | ลูกค้า (registered) | demo ~500 · ปีที่ 3 ~20,000 (ร้านอาหาร/โรงแรม/ร้านค้าที่ซื้อจากบริษัทจัดจำหน่าย) |
| 2 | agent | demo ~20 · ปีที่ 3 ~150 ใน 7 แผนก |
| 3 | concurrent ช่วงพีค | demo < 100 · ปีที่ 3 ~1,500 socket connection |
| 4 | request/วินาที ช่วงพีค | demo < 20 · ปีที่ 3 ~150 |
| 5 | ปริมาณข้อมูล | enquiry ~300/วัน · message ~3,000/วัน (≈1M message/ปี ในปีที่ 3) · ไฟล์แนบ ~5 GB/เดือน |
| 6 | งาน async | คำนวณ SLA breach, แจ้งเตือน, ประมวลผลรูป (thumbnail), รับข้อความจาก channel ภายนอก |
| 7 | ความพร้อมใช้ | prototype: best effort · production: 99.5% |
| 8 | module ที่จะโตก่อน | `channel-gateway` (ข้อความจาก LINE/FB จริง) และ `realtime` gateway |
| 9 | งบ infra | prototype: รันบนเครื่อง (docker compose) · production: ระดับ VPS/managed กลาง ๆ |
| 10 | ภาษา / timezone | th (ค่าเริ่ม) + en · Asia/Bangkok, เก็บเวลาเป็น UTC (`timestamptz`) |

## ผลต่อการออกแบบ
- เริ่ม **modular monolith** 1 API + 1 worker; ไม่แยก microservice ในรอบนี้
- Socket.IO ใช้ Redis adapter ตั้งแต่แรก (รองรับหลาย instance เมื่อถึง ~1.5k connection)
- channel-gateway รับ inbound ผ่าน RMQ อยู่แล้ว → วันที่ต่อ LINE/FB จริงแยกเป็น service ได้ทันที
- Postgres เดียวพอ; เพิ่ม read replica เมื่อ dashboard/search เริ่มหน่วง (> ~5M message)

## อัปเดต 2026-09-22 — ต้องรองรับ scale + load balance
- user ต้องการให้ระบบ scale แนวนอนและมี load balancer ตั้งแต่แบบแรก → ดู `design.md` §15
- ขั้นต่ำ production: `api` 2 instance (HA) หลัง LB, autoscale ถึง 3–4 ในปีที่ 3 · `worker` autoscale ตามความยาวคิว
