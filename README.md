# โต๊ะพร้อม — Table Tales Gatherings

เว็บภาษาไทยสำหรับจัดงานเลี้ยงและจองโต๊ะจีน พัฒนาต่อจาก Lovable
ด้วย React 19, TanStack Start, Supabase Auth/PostgreSQL และ server API

## เปิดจาก GitHub Desktop โดยไม่ใช้เครดิต Lovable

1. เลือก repository นี้ใน GitHub Desktop → Repository → Open in Terminal
2. ใช้ Node.js 24 แล้วรัน `npm ci`
3. คัดลอก `.env.example` เป็น `.env.local` และกรอกค่าของ Supabase project เดียวกันทั้งหมด
4. รัน `npm run dev -- --host 127.0.0.1 --port 5173`
5. เปิด `http://127.0.0.1:5173` หรือ `/demo` เพื่อดูหน้าตัวอย่างแบบอ่านอย่างเดียว

`.env.local` ถูก ignore อยู่แล้ว ห้าม commit server key หรือใส่ใน `VITE_*`
ไฟล์ `.env` ที่ติดมากับโปรเจกต์มีค่า public ของ backend เดิม แต่ไม่มี server key
ถ้าใช้ backend เดิม ต้องตั้ง server secret ที่ตรงกันก่อน API ลูกค้าจะทำงาน
ถ้าเข้า backend เดิมไม่ได้ ให้สร้าง Supabase project ของคุณแล้วติดตั้ง schema ตามด้านล่าง
ห้ามนำ secret มาวางในแชต, API Test หรือ commit

## ตั้งค่าฐานข้อมูล

ไม่มีการรัน migration หรือแก้ฐานข้อมูลจริงอัตโนมัติในขั้นตอน build/test

- ฐานข้อมูลใหม่: รัน `drizzle/migrations/0000_migration.sql` ใน Supabase SQL Editor
  แล้วรัน `supabase/migrations/20261022110000_booking_safety.sql`
  และ `supabase/migrations/20261023090000_manual_payments.sql` ตามลำดับ
- ฐานข้อมูลที่มี schema นี้แล้ว: รันเฉพาะ migration ที่ยังไม่เคยใช้ตามลำดับเวลา หนึ่งครั้ง
  อย่ารัน baseline ซ้ำ ตรวจ/สำรองข้อมูลก่อนเปลี่ยนฐานข้อมูลที่ใช้งานจริง
- อย่าใช้ drizzle-kit push/generate กับ `drizzle/schema.ts` ที่ว่างอยู่
  ไฟล์นี้เป็น placeholder จาก Lovable ไม่ใช่ source of truth
- migrations อยู่สองโฟลเดอร์เพื่อรักษา baseline เดิมไว้
  `supabase db push` อย่างเดียวบนฐานข้อมูลใหม่จะไม่ติดตั้ง baseline ให้

ตั้งค่า Auth Site URL/Redirect URLs ให้ตรงกับ localhost และโดเมนจริง
สมัครบัญชีจากหน้าเว็บ และยืนยันอีเมลตามการตั้งค่า Supabase
บัญชีใหม่เป็น Manager เฉพาะงานของตนเอง ไม่ได้เป็น Developer อัตโนมัติ

หลังตรวจ UUID ของบัญชีตัวเองใน Supabase Authentication ผู้ดูแลฐานข้อมูลสามารถรัน:

```sql
insert into public.user_roles(user_id, role)
values ('YOUR_AUTH_USER_UUID'::uuid, 'developer')
on conflict (user_id, role) do nothing;
```

หากต้องการจัดการงาน seed demo-gala ให้กำหนด owner ด้วย UUID ที่ตรวจแล้ว:

```sql
update public.events set owner_id = 'YOUR_AUTH_USER_UUID'::uuid
where public_slug = 'demo-gala' and owner_id is null;
```

Migration ใหม่หยุดการให้ Developer/ยึดงาน seed อัตโนมัติกับคนสมัครคนแรก
แต่ไม่ถอนสิทธิ์เดิม: ตรวจ user_roles และ owner ของ seed เดิมด้วย
ข้อมูล seed เป็นข้อมูลสมมติและมีวันงานคงที่ ส่วน `/demo` เป็น fixture อ่านอย่างเดียว
สร้างงานใหม่ที่วันรับจองยังไม่หมดอายุสำหรับทดสอบธุรกรรม

## สิ่งที่ทำงานเมื่อตั้งค่า backend ครบ

- สมัคร/เข้าสู่ระบบผู้จัดการ สร้างและแก้ไขงาน วันเวลา สถานที่ แผนที่ กำหนดการ
- เพิ่มโต๊ะเป็นชุด ลากตำแหน่ง เปลี่ยนชื่อ โซน ความจุ กันโต๊ะ และปิดใช้งาน
- เผยแพร่/ปิดรับจอง แชร์ลิงก์และ QR เปิดหน้าจอง รวมถึง QR แผนที่
- ลูกค้าจองหลายโต๊ะ รับรหัสและลิงก์ส่วนตัวโดยไม่ต้องสมัคร
- API ตรวจสิทธิ์และ schema; จองแบบ transaction; ป้องกันโต๊ะซ้ำด้วย unique index
- Idempotency ผูกกับ payload และ hash ของ capability token; retry เดิมคืน booking เดิม
- ลูกค้าขอยกเลิก ผู้จัดการอนุมัติ/ปฏิเสธ; อนุมัติแล้วปล่อยโต๊ะใน transaction เดียวกัน
- รายชื่อผู้จอง/ค้นหาหน่วยงาน และ API Test เฉพาะ Developer
- ผู้จัดแต่ละรายตั้งบัญชีรับเงินของตน ราคาต่อโต๊ะ มัดจำและวันครบกำหนด
- สลิปส่วนตัว ยืนยันเงินเข้าด้วยเลขอ้างอิงธนาคาร รายงานยอดรับ/คืน/คงค้าง และ CSV
- บันทึกการคืนเงินจริงหลังยกเลิก พร้อมประวัติและป้องกันการบันทึกซ้ำ
- หน้าสาธารณะ refresh ทุก 15 วินาที; ไม่เผยข้อมูลผู้จองหรือ token

ลิงก์จัดการเป็น `/booking#TOKEN`: fragment ไม่ส่งไปใน request URL/referrer
ส่ง token ผ่าน X-Manage-Token; ฐานข้อมูลเก็บ SHA-256 เท่านั้น
ลูกค้าต้องเก็บลิงก์เอง ยังไม่มีการกู้ลิงก์ผ่านอีเมล/OTP
Retry หน้าเดิมใช้ token/key เดิม หากปิดหน้าระหว่าง request ที่ผลไม่แน่ชัด
ให้ติดต่อผู้จัดการก่อนจองซ้ำ ยังไม่ส่งใบยืนยันอัตโนมัติ

## ขอบเขตที่ยังไม่เปิดใช้

- รับเงินแบบโอนตรงให้ผู้จัด แนบสลิป และตรวจยอดเองแล้ว: ดู `docs/MANUAL_PAYMENTS.md`
- LINE, AI Agent, นำเข้าจาก URL, ตรวจสลิปอัตโนมัติ, payment gateway และเช็กอินยังไม่เชื่อมต่อ
- ยังไม่มีอัปโหลดภาพปก/จัดการรายชื่อหน่วยงานล่วงหน้า แต่ลูกค้ากรอกหน่วยงานได้
- แก้ conflict รายละเอียดงานด้วย version; การย้ายโต๊ะใช้ค่าล่าสุดที่บันทึก
- โต๊ะที่มีประวัติการจองลบไม่ได้ ให้ปิดใช้งานเพื่อเก็บประวัติ

## API และการเผยแพร่

ดู `docs/API.md` และ `public/openapi.json`
API อยู่ที่ `/api/v1/*` บน TanStack Start server ไม่ใช่ Supabase Edge Functions
Static hosting/GitHub Pages อย่างเดียวให้บริการ API นี้ไม่ได้
Server ใช้ service role สำหรับ customer RPC และ private Storage; manager writes ใช้ session และ RLS
ไฟล์สลิปถูกตรวจสิทธิ์ก่อนให้ server อ่านจาก private bucket ไม่เปิด public URL
จำกัด public write 20 ครั้ง/นาทีต่อ IP, อัปโหลดสลิป 10 ครั้ง/นาที, read 120 ครั้ง/นาที
Reverse proxy ที่ใช้ deploy ต้องลบ/เขียนทับ IP headers ที่ client ปลอม

## ตรวจสอบและ build

```sh
npm test
npx tsc --noEmit
npm run build
```

Tests ใช้ PostgreSQL ผ่าน PGlite ใน memory ไม่ติดต่อฐานข้อมูลจริง
ตรวจ atomic multi-table booking, uniqueness, retry, RLS, cancellation และ capacity guards
PGlite ใช้ connection เดียว จึงไม่จำลอง lock contention ระหว่าง PostgreSQL หลาย connection
ควรทดสอบการจองพร้อมกันบน staging ก่อนเปิดรับลูกค้าจริง

Build ตาม config Lovable เดิมเป็น Cloudflare/Nitro SSR
Push ไป branch ที่ Lovable เชื่อมอยู่ทำให้โค้ด sync กลับ editor
แต่ไม่ได้ยืนยันว่าเว็บ live หรือ migrations ถูก deploy แล้ว
อย่า force-push/rewrite published history ตาม AGENTS.md

## ทดสอบก่อนเปิดใช้

สร้าง Manager สองบัญชี → สร้างงาน/เพิ่มโต๊ะ/เผยแพร่ → เปิดหน้าลูกค้าต่าง browser
→ จองหลายโต๊ะ → เก็บลิงก์ส่วนตัว → ขอยกเลิก → ผู้จัดการอนุมัติ → ตรวจโต๊ะว่าง
ตรวจว่า Manager อีกบัญชีอ่านงานแรกไม่ได้ และ public API ไม่คืนชื่อผู้จอง
ทดสอบลูกค้าสองคนจองโต๊ะเดียวกันพร้อมกันบน staging PostgreSQL
