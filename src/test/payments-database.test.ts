// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
let db: PGlite, event: string, table: string, bid: string, token: string;
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const path of [
    "drizzle/migrations/0000_migration.sql",
    "supabase/migrations/20261022110000_booking_safety.sql",
    "supabase/migrations/20261023090000_manual_payments.sql",
  ])
    await db.exec(readFileSync(path, "utf8"));
  await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    owner,
    "owner@test.local",
    other,
    "other@test.local",
  ]);
}, 30000);
beforeEach(async () => {
  await db.exec("reset role");
  await user(owner);
  event = (
    await db.query<{ id: string }>(
      `insert into public.events(owner_id,title,starts_at,ends_at,booking_opens_at,booking_closes_at,cancel_deadline,status,public_slug,payment_mode,bank_name,bank_account_name,bank_account_number,balance_due_at,refund_policy)
 values($1,'Paid banquet',now()+interval '10 days',now()+interval '11 days',now()-interval '1 day',now()+interval '8 days',now()+interval '7 days','published',$2,'required','Bank','Owner','1234567890',now()+interval '9 days','คืนมัดจำเมื่อยกเลิกก่อนกำหนด') returning id`,
      [owner, randomUUID()],
    )
  ).rows[0]!.id;
  table = (
    await db.query<{ id: string }>(
      "insert into public.event_tables(event_id,number,name,capacity,price_satang) values($1,1,'A',8,100000) returning id",
      [event],
    )
  ).rows[0]!.id;
  token = randomUUID();
  bid = (await book()).rows[0]!.result.booking_id;
});
afterAll(async () => {
  await db?.close();
});
const user = (id: string) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
const book = (expected = 100000, key = randomUUID()) =>
  db.query<{ result: { booking_id: string } }>(
    `select public.create_booking_v2((select public_slug from public.events where id=$1),array[$2::uuid],'Guest',8,'Agency','0800000000',$3,$3,$4,$3,$5,(select version from public.events where id=$1)) result`,
    [event, table, key, token, expected],
  );
const state = async () =>
  (
    await db.query<{
      paid_satang: number;
      refunded_satang: number;
      status: string;
      payment_status: string;
      deposit_due_satang: number;
      bank_snapshot: { account_number: string };
    }>("select * from public.bookings where id=$1", [bid])
  ).rows[0]!;
async function submit(
  amount = 30000,
  hash = randomUUID().replaceAll("-", "").repeat(2),
  key = randomUUID(),
  date = new Date().toISOString(),
) {
  return (
    await db.query<{ result: { id: string; replayed?: boolean } }>(
      "select public.submit_payment($1,$2,$3,$4,$5,$6) result",
      [token, amount, date, `${owner}/${event}/${bid}/${key}.png`, hash, key],
    )
  ).rows[0]!.result;
}
const review = (id: string, reference = randomUUID(), approve = true, note = "") =>
  db.query("select public.review_payment($1,$2,$3,$4)", [id, approve, reference, note]);
const cancel = () =>
  db.query("select public.manager_cancel_booking($1,$2)", [bid, "ยกเลิกตามคำขอ"]);
const refund = (
  amount: number,
  key = randomUUID(),
  date = new Date().toISOString(),
  ref = randomUUID(),
) =>
  db.query("select public.record_manual_refund($1,$2,$3,$4,$5,$6)", [
    bid,
    amount,
    date,
    ref,
    "คืนเข้าบัญชีลูกค้า",
    key,
  ]);
it("snapshots bank and deposit while redacting the public event", async () => {
  expect(await state()).toMatchObject({
    paid_satang: 0,
    deposit_due_satang: 30000,
    status: "pending_payment",
    bank_snapshot: { account_number: "1234567890" },
  });
  await db.query(
    "update public.events set bank_account_number='9999999999',deposit_percent=50 where id=$1",
    [event],
  );
  expect(await state()).toMatchObject({
    deposit_due_satang: 30000,
    bank_snapshot: { account_number: "1234567890" },
  });
  const pub = (
    await db.query<{ data: unknown }>(
      "select public.public_event((select public_slug from public.events where id=$1)) data",
      [event],
    )
  ).rows[0]!.data;
  expect(JSON.stringify(pub)).not.toMatch(/1234567890|9999999999|Guest|0800000000/);
});
it("rejects a changed price quote without creating a booking", async () => {
  await cancel();
  await expect(book(99999)).rejects.toThrow("VERSION_CONFLICT");
  expect(
    (await db.query("select * from public.bookings where event_id=$1", [event])).rows,
  ).toHaveLength(1);
});
it("counts only confirmed receipts, confirms at deposit and caps the balance", async () => {
  const a = await submit(20000);
  expect((await state()).paid_satang).toBe(0);
  await review(a.id);
  expect(await state()).toMatchObject({ paid_satang: 20000, status: "pending_payment" });
  const b = await submit(10000);
  const ref = randomUUID();
  await review(b.id, ref);
  await review(b.id, ref);
  expect(await state()).toMatchObject({
    paid_satang: 30000,
    status: "confirmed",
    payment_status: "pending",
  });
  await expect(submit(70001)).rejects.toThrow("VALIDATION");
  const c = await submit(70000);
  await review(c.id);
  expect(await state()).toMatchObject({ paid_satang: 100000, payment_status: "paid" });
});
it("blocks duplicate proof/references and preserves retry identity", async () => {
  const hash = "a".repeat(64),
    key = randomUUID(),
    date = new Date().toISOString();
  const a = await submit(30000, hash, key, date);
  expect((await submit(30000, hash, key, date)).replayed).toBe(true);
  await expect(submit(20000, hash, key, date)).rejects.toThrow("IDEMPOTENCY_MISMATCH");
  await expect(submit(30000, hash)).rejects.toThrow("duplicate key");
  const ref = randomUUID();
  await review(a.id, ref);
  const b = await submit(30000);
  await expect(review(b.id, ref)).rejects.toThrow("duplicate key");
  expect((await state()).paid_satang).toBe(30000);
});
it("isolates organizers with RLS and denies client access to service RPCs", async () => {
  const a = await submit();
  await user(other);
  await db.exec("set role authenticated");
  expect(
    (await db.query("select * from public.payment_submissions where id=$1", [a.id])).rows,
  ).toHaveLength(0);
  await expect(review(a.id)).rejects.toThrow("NOT_FOUND");
  await expect(cancel()).rejects.toThrow("NOT_FOUND");
  await expect(db.query("select public.booking_finances($1)", [token])).rejects.toThrow(
    "permission denied",
  );
  await db.exec("reset role");
});
it("requires pending proofs reviewed before cancellation and supports bounded idempotent refunds", async () => {
  const a = await submit();
  await expect(cancel()).rejects.toThrow("INVALID_STATE");
  await review(a.id);
  await cancel();
  expect(await state()).toMatchObject({
    status: "cancelled",
    payment_status: "refund_pending",
    paid_satang: 30000,
  });
  expect(
    (await db.query("select * from public.booking_tables where booking_id=$1 and active", [bid]))
      .rows,
  ).toHaveLength(0);
  await expect(submit(10000)).rejects.toThrow("INVALID_STATE");
  await expect(refund(30001)).rejects.toThrow("VALIDATION");
  const key = randomUUID(),
    date = new Date().toISOString(),
    ref = randomUUID();
  await refund(10000, key, date, ref);
  await refund(10000, key, date, ref);
  expect((await state()).refunded_satang).toBe(10000);
  await refund(20000);
  expect(await state()).toMatchObject({ refunded_satang: 30000, payment_status: "refunded" });
});
it("customer cancellation approval preserves partial payments as refund pending", async () => {
  const a = await submit(10000);
  await review(a.id);
  await db.query("select public.request_cancellation($1,'ไม่สามารถร่วมงาน')", [token]);
  const id = (
    await db.query<{ id: string }>(
      "select id from public.cancellation_requests where booking_id=$1",
      [bid],
    )
  ).rows[0]!.id;
  await db.query("select public.decide_cancellation($1,true,'อนุมัติ')", [id]);
  expect(await state()).toMatchObject({
    status: "cancelled",
    payment_status: "refund_pending",
    paid_satang: 10000,
  });
});
