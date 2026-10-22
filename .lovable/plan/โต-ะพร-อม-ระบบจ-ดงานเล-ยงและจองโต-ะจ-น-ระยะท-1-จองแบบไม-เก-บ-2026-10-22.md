# โต๊ะพร้อม — ระบบจัดงานเลี้ยงและจองโต๊ะจีน (ระยะที่ 1: จองแบบไม่เก็บเงิน)

## สภาพโปรเจกต์ปัจจุบัน
โปรเจกต์ยังเป็นแม่แบบว่าง ไม่มีหน้าร้านวัสดุหรือ backend เดิม จึงจะสร้างใหม่ทั้งหมด โดยยึดหน้าตาจากเว็บอ้างอิง (โทนครีม–น้ำตาล การ์ดขอบมน เมนูเรียบ หน้า API Test แสดง Request/Response) และเปิดใช้ Lovable Cloud เป็นฐานข้อมูลและระบบเข้าสู่ระบบ

## ลำดับงาน
1. ฐานข้อมูล + สิทธิ์
2. หน้าผู้จัดการ (Manager)
3. หน้าลูกค้า (เปิดจาก LINE บนมือถือได้ดี)
4. หน้า API Test + OpenAPI
5. ทดสอบตามรายการในข้อ 12
ระยะถัดไป (ไม่อยู่ในรอบนี้ แต่เตรียมตารางไว้): LINE webhook, AI agent tools, payment sandbox — แสดงป้าย "ยังไม่เชื่อมต่อ" ชัดเจน

## หน้าจอ
- /login — Manager เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน
- /dashboard — รายการงานของฉัน
- /events/new, /events/{id}/edit — ฟอร์มงาน (ตรวจวันเวลาแบบเข้ม, เวลาไทย)
- /events/{id}/layout — ผังโต๊ะ: ลากวาง, สร้างเป็นแถว×คอลัมน์, เวที/ทางเข้า/สัญลักษณ์, มุมมองรายการบนมือถือ
- /events/{id}/bookings — รายชื่อการจองและรายละเอียด
- /events/{id}/cancellations — อนุมัติ/ปฏิเสธคำขอยกเลิก
- /events/{id}/share — สรุปงาน, เผยแพร่, ลิงก์ + QR หน้าจอง, QR แผนที่
- /e/{publicSlug} — หน้าจองของลูกค้า (เลือกโต๊ะ → กรอกข้อมูล → สรุป → ยืนยัน)
- /b/{token} — ผลการจอง/จัดการการจองส่วนตัว, ยื่นคำขอยกเลิก
- /dev/api-test — เฉพาะผู้มีสิทธิ์ developer

## กติกาสำคัญ
- จองทั้งโต๊ะ, หนึ่งการจองหลายโต๊ะได้, สำเร็จทั้งหมดหรือไม่สร้างเลย
- ตรวจจำนวนคน ≤ ความจุโต๊ะที่เลือก และไม่เกินเพดานงาน
- ชนกันพร้อมกัน → สำเร็จคนเดียว อีกคนได้ 409 และให้เลือกใหม่
- Idempotency key: ส่งซ้ำได้ผลเดิม, key เดิม payload ต่าง → ปฏิเสธ
- ลิงก์จัดการส่วนตัวใช้ token สุ่ม เก็บเฉพาะ hash
- คำขอยกเลิกค้างได้ครั้งละ 1 รายการ, ยังไม่ปล่อยโต๊ะจนอนุมัติ
- ข้อมูลสาธารณะ/realtime ไม่เปิดชื่อหรือช่องทางติดต่อผู้จองอื่น
- ห้ามลบโต๊ะที่มีการจอง, ห้ามลดความจุต่ำกว่าการจองเดิม
- ราคาเก็บเป็นสตางค์ (integer) ณ เวลาจอง คำนวณฝั่ง server
- สถานะงาน: draft, published, closed, cancelled, completed

## ข้อมูลเดโม
งานตัวอย่าง 1 งาน 20 โต๊ะ โต๊ะละ 8 คน มีโต๊ะว่าง จองแล้ว และปิดใช้งาน (ข้อมูลสมมติ)

## Technical details
- Lovable Cloud (Postgres + Auth). ตาม convention ของ TanStack Start ใช้ `createServerFn` และ server routes `src/routes/api/public/v1/*` แทน Edge Functions (API จริงที่ API Test เรียกได้)
- ตาราง: profiles, user_roles (enum manager/developer), events, event_tables, participating_organizations, bookings, booking_tables, cancellation_requests, audit_logs, idempotency_keys; ตารางเตรียมไว้: payments, line_account_links, agent_action_logs, check_ins — ทุกตารางมี FK, index, RLS, GRANT
- การจอง/อนุมัติยกเลิกเป็น Postgres function (SECURITY DEFINER) ทำงานใน transaction เดียว ใช้ `SELECT ... FOR UPDATE` + partial unique index บน booking_tables (active) กันจองซ้ำ
- Rate limit แบบเก็บในฐานข้อมูล, error format `{ error: { code, message } }`, ปกปิด token ใน log
- OpenAPI spec ที่ /api/public/v1/openapi.json และ schema ของ agent tools บนหน้า API Test
- Vitest: ทดสอบกติกา validation วันเวลา, ความจุ, ราคาเป็นสตางค์
- ความว่างอัปเดตด้วยการ refresh อัตโนมัติเป็นระยะ (ไม่ส่งข้อมูลส่วนตัว)
