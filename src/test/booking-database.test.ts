// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

describe("Booking database transactions and access boundaries", () => {
  let db: PGlite;
  let eventId: string;
  let tables: string[] = [];
  const owner = "11111111-1111-4111-8111-111111111111";
  const stranger = "22222222-2222-4222-8222-222222222222";
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;`);
    await db.exec(readFileSync("drizzle/migrations/0000_migration.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261022110000_booking_safety.sql", "utf8"));
    await db.query("insert into auth.users(id,email) values ($1,$2),($3,$4)", [
      owner,
      "owner@example.test",
      stranger,
      "other@example.test",
    ]);
    const ev = await db.query<{ id: string }>(
      `insert into public.events(owner_id,title,starts_at,ends_at,booking_opens_at,booking_closes_at,cancel_deadline,max_attendees,status,public_slug)
    values ($1,'Test',now()+interval '10 days',now()+interval '11 days',now()-interval '1 day',now()+interval '9 days',now()+interval '8 days',24,'published','test-event') returning id`,
      [owner],
    );
    eventId = ev.rows[0]!.id;
    for (let i = 1; i <= 5; i++) {
      const t = await db.query<{ id: string }>(
        "insert into public.event_tables(event_id,number,name,capacity,price_satang) values ($1,$2,$3,8,350000) returning id",
        [eventId, i, `Table ${i}`],
      );
      tables.push(t.rows[0]!.id);
    }
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  const book = (ids: string[], key: string, hash = key, count = 8) =>
    db.query<{ result: { booking_id: string; code: string; replayed: boolean } }>(
      "select public.create_booking($1,$2::uuid[],$3,$4,$5,$6,$7,$8,$9,$10) as result",
      ["test-event", ids, "Guest", count, "Org", "", key, hash, `token-${key}`, `BK-${key}`],
    );
  it("never grants developer or orphan demo ownership to new signups", async () => {
    expect(
      (await db.query("select * from public.user_roles where role='developer'")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select owner_id from public.events where public_slug='demo-gala'")).rows[0],
    ).toEqual({ owner_id: null });
  });
  it("competing reservations cannot occupy the same table twice", async () => {
    const results = await Promise.allSettled([
      book([tables[0]!], "first"),
      book([tables[0]!], "second"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (
        await db.query("select * from public.booking_tables where table_id=$1 and active", [
          tables[0],
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("rolls back a multi-table booking if one table is taken", async () => {
    await expect(book([tables[1]!, tables[0]!], "atomic")).rejects.toThrow("TABLE_TAKEN");
    expect(
      (await db.query("select * from public.booking_tables where table_id=$1", [tables[1]])).rows,
    ).toHaveLength(0);
  });
  it("replays the same request but rejects mismatched payloads", async () => {
    const a = await book([tables[1]!], "retry");
    const b = await book([tables[1]!], "retry");
    expect(b.rows[0]!.result.booking_id).toBe(a.rows[0]!.result.booking_id);
    expect(b.rows[0]!.result.replayed).toBe(true);
    await expect(book([tables[2]!], "retry", "other-payload")).rejects.toThrow(
      "IDEMPOTENCY_MISMATCH",
    );
  });
  it("does not charge a free event even when old table prices exist", async () => {
    const b = await db.query<{ total_satang: number }>(
      "select total_satang from public.bookings where idempotency_key='retry'",
    );
    expect(b.rows[0]!.total_satang).toBe(0);
  });
  it("rejects too many guests and capacity reductions below existing guests", async () => {
    await expect(book([tables[2]!], "too-many", "too-many", 9)).rejects.toThrow("VALIDATION");
    await expect(
      db.query("update public.events set max_attendees=1 where id=$1", [eventId]),
    ).rejects.toThrow("CAPACITY_EXCEEDED");
    await expect(
      db.query("update public.event_tables set capacity=4 where id=$1", [tables[1]]),
    ).rejects.toThrow("TABLE_HAS_BOOKING");
  });
  it("exposes public availability without customer identity or tokens", async () => {
    const r = await db.query<{ data: unknown }>("select public.public_event('test-event') as data");
    const json = JSON.stringify(r.rows[0]!.data);
    expect(json).toContain("booked");
    for (const secret of ["guest_name", "manage_token", "Guest", "token-retry"])
      expect(json).not.toContain(secret);
    expect((await db.query("select public.booking_by_token('wrong') as data")).rows[0]).toEqual({
      data: null,
    });
  });
  it("RLS blocks another manager from reading or changing this event", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; set local request.jwt.claim.sub='${stranger}';`);
      expect(
        (await tx.query("select * from public.events where id=$1", [eventId])).rows,
      ).toHaveLength(0);
      expect(
        (
          await tx.query("update public.events set title='stolen' where id=$1 returning id", [
            eventId,
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (await tx.query("select * from public.bookings where event_id=$1", [eventId])).rows,
      ).toHaveLength(0);
    });
  });
  it("a cancellation remains occupied until its owner approves it", async () => {
    const r = await db.query<{ data: { request_id: string } }>(
      "select public.request_cancellation('token-retry','Unable to attend') as data",
    );
    const id = r.rows[0]!.data.request_id;
    await expect(
      db.query("select public.request_cancellation('token-retry','Duplicate')"),
    ).rejects.toThrow("ALREADY_PENDING");
    await expect(book([tables[1]!], "before-approval")).rejects.toThrow("TABLE_TAKEN");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(
          `set local role authenticated; set local request.jwt.claim.sub='${stranger}';`,
        );
        await tx.query("select public.decide_cancellation($1,true,$2)", [id, ""]);
      }),
    ).rejects.toThrow("FORBIDDEN");
    await db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; set local request.jwt.claim.sub='${owner}';`);
      await tx.query("select public.decide_cancellation($1,true,$2)", [id, "approved"]);
    });
    await expect(book([tables[1]!], "after-approval")).resolves.toBeDefined();
  });
  it("refuses bookings after closing and does not enable payments", async () => {
    await db.query("update public.events set status='closed' where id=$1", [eventId]);
    await expect(book([tables[2]!], "closed")).rejects.toThrow("BOOKING_CLOSED");
    await expect(
      db.query("update public.events set payment_mode='required' where id=$1", [eventId]),
    ).rejects.toThrow("INVALID_STATE");
  });
});
