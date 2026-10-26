// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it.each([false, true])(
  "installs missing payment schema and preserves existing data (safety present: %s)",
  async (safety) => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
      await db.exec(readFileSync("drizzle/migrations/0000_migration.sql", "utf8"));
      if (safety)
        await db.exec(
          readFileSync("supabase/migrations/20261022110000_booking_safety.sql", "utf8"),
        );
      const before = (await db.query("select id,title from public.events order by id")).rows;
      const sql = readFileSync("docs/setup-manual-payments.sql", "utf8");
      await db.exec(sql);
      expect((await db.query("select id,title from public.events order by id")).rows).toEqual(
        before,
      );
      expect(
        (
          await db.query(
            "select column_name from information_schema.columns where table_schema='public' and table_name='events' and column_name='bank_name'",
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select tgname from pg_trigger where tgname='bookings_free_phase'")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select public from storage.buckets where id='payment-proofs'")).rows,
      ).toEqual([{ public: false }]);
      await expect(db.exec(sql)).rejects.toThrow("ตรวจพบส่วนรับเงินติดตั้งไว้แล้ว");
      await db.exec("rollback");
      expect((await db.query("select id,title from public.events order by id")).rows).toEqual(
        before,
      );
    } finally {
      await db.close();
    }
  },
  30000,
);
