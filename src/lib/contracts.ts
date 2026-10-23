import { z } from "zod";
import { validateEventTimes } from "./event-rules";
import type { Database } from "@/integrations/supabase/types";

export type Event = Database["public"]["Tables"]["events"]["Row"] & {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  deposit_percent: number;
  deposit_hours: number;
  balance_due_at: string | null;
  refund_policy: string;
};
export type Table = Database["public"]["Tables"]["event_tables"]["Row"] & { state?: string };
export type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  paid_satang: number;
  refunded_satang: number;
  deposit_due_satang: number;
  deposit_due_at: string | null;
  balance_due_at: string | null;
};
export type Cancellation = Database["public"]["Tables"]["cancellation_requests"]["Row"];
export type PublicTable = Pick<
  Table,
  "id" | "number" | "name" | "zone" | "capacity" | "price_satang" | "x" | "y"
> & { state: string };
export type PublicEvent = Pick<
  Event,
  | "title"
  | "description"
  | "organizer_name"
  | "contact_info"
  | "starts_at"
  | "ends_at"
  | "booking_opens_at"
  | "booking_closes_at"
  | "cancel_deadline"
  | "venue_name"
  | "venue_address"
  | "map_url"
  | "announcement"
  | "schedule"
  | "status"
  | "contact_required"
  | "max_attendees"
  | "payment_mode"
  | "deposit_percent"
  | "deposit_hours"
  | "balance_due_at"
  | "refund_policy"
> & {
  version: number;
  slug: string;
  booking_open: boolean;
  booked_attendees: number;
  organizations: string[];
  tables: PublicTable[];
};
export type BookingReceipt = Pick<
  Booking,
  | "code"
  | "guest_name"
  | "guest_count"
  | "organization"
  | "contact"
  | "status"
  | "payment_status"
  | "total_satang"
  | "created_at"
> & {
  tables: { number: number; capacity: number; price_satang: number }[];
  event: Pick<
    PublicEvent,
    "slug" | "title" | "starts_at" | "ends_at" | "venue_name" | "cancel_deadline"
  >;
  cancellation: { status: string; reason: string; decision_note: string | null } | null;
};
export const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const webUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => !v || /^https?:\/\//i.test(v), "ใช้ลิงก์ http หรือ https เท่านั้น");
export const eventInput = z
  .object({
    title: text(200).min(1),
    description: text(5000).default(""),
    organizer_name: text(200).default(""),
    contact_info: text(500).default(""),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    booking_opens_at: z.string().datetime(),
    booking_closes_at: z.string().datetime(),
    cancel_deadline: z.string().datetime().nullable().default(null),
    venue_name: text(200).default(""),
    venue_address: text(1000).default(""),
    map_url: webUrl.nullable().default(null),
    max_attendees: z.number().int().min(1).max(100000).nullable().default(null),
    announcement: text(3000).default(""),
    schedule: text(5000).default(""),
    contact_required: z.boolean().default(false),
    payment_mode: z.enum(["none", "required"]).default("none"),
    bank_name: text(100).default(""),
    bank_account_name: text(200).default(""),
    bank_account_number: text(30).default(""),
    deposit_percent: z.number().int().min(1).max(100).default(30),
    deposit_hours: z.number().int().min(1).max(720).default(24),
    balance_due_at: z.string().datetime().nullable().default(null),
    refund_policy: text(3000).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const message of validateEventTimes(v)) ctx.addIssue({ code: "custom", message });
    if (v.payment_mode === "required") {
      if (!v.bank_name || !v.bank_account_name || !/^[0-9 -]{8,30}$/.test(v.bank_account_number))
        ctx.addIssue({ code: "custom", message: "กรุณากรอกธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ" });
      if (
        !v.balance_due_at ||
        Date.parse(v.balance_due_at) < Date.parse(v.booking_closes_at) ||
        Date.parse(v.balance_due_at) > Date.parse(v.starts_at)
      )
        ctx.addIssue({
          code: "custom",
          message: "กำหนดชำระส่วนที่เหลือต้องไม่ก่อนปิดรับจองและไม่หลังเริ่มงาน",
        });
      if (v.refund_policy.length < 5)
        ctx.addIssue({ code: "custom", message: "กรุณาระบุเงื่อนไขยกเลิกและคืนเงิน" });
    }
  });
export const tableInput = z
  .object({
    number: z.number().int().min(1).max(10000),
    name: text(100),
    zone: text(100),
    capacity: z.number().int().min(1).max(30),
    price_satang: z.number().int().min(0).max(100000000).default(0),
    x: z.number().int().min(0).max(920),
    y: z.number().int().min(90).max(700),
    status: z.enum(["available", "held", "disabled"]).default("available"),
  })
  .strict();
export const bookingInput = z
  .object({
    slug: z.string().min(1).max(100),
    table_ids: z.array(uuid).min(1).max(100),
    guest_name: text(120).min(1),
    guest_count: z.number().int().min(1).max(3000),
    organization: text(200).default(""),
    contact: text(200).default(""),
    expected_event_version: z.number().int().positive().nullable().default(null),
    expected_total_satang: z.number().int().min(0).max(100000000).default(0),
  })
  .strict()
  .refine((v) => new Set(v.table_ids).size === v.table_ids.length, "เลือกโต๊ะซ้ำ");
export const cancellationInput = z.object({ reason: text(1000).min(1) }).strict();
export const decisionInput = z
  .object({ approve: z.boolean(), note: text(1000).default("") })
  .strict();
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);

export const API_BASE = "/api/v1";
export const endpoints = [
  ["GET", "/public/events/{slug}", "ข้อมูลงานและโต๊ะว่าง", "public"],
  ["POST", "/bookings", "สร้างการจอง • Idempotency-Key + X-Manage-Token", "customer"],
  ["GET", "/booking", "ดูการจอง • X-Manage-Token", "customer"],
  ["POST", "/booking/cancellations", "ขอยกเลิก • X-Manage-Token", "customer"],
  ["GET", "/manager/events", "รายการงาน", "manager"],
  ["POST", "/manager/events", "สร้างร่างงาน", "manager"],
  ["GET", "/manager/events/{id}", "รายละเอียด ผัง รายชื่อ และคำขอยกเลิก", "manager"],
  ["PATCH", "/manager/events/{id}", "แก้รายละเอียด พร้อม version", "manager"],
  ["POST", "/manager/events/{id}/tables", "เพิ่มโต๊ะเป็นชุด { tables: [...] }", "manager"],
  ["PATCH", "/manager/events/{id}/tables/{tableId}", "แก้โต๊ะ", "manager"],
  ["DELETE", "/manager/events/{id}/tables/{tableId}", "ลบโต๊ะที่ไม่เคยมีการจอง", "manager"],
  ["POST", "/manager/events/{id}/publish", "เผยแพร่ พร้อม version", "manager"],
  ["POST", "/manager/events/{id}/close", "ปิดรับจอง พร้อม version", "manager"],
  ["POST", "/manager/cancellations/{id}/decision", "อนุมัติ/ปฏิเสธ { approve, note }", "manager"],
  ["GET", "/manager/developer", "ตรวจสิทธิ์ Developer", "developer"],
  ["GET", "/booking/payments", "ยอดชำระ บัญชีรับเงิน และประวัติ • X-Manage-Token", "customer"],
  ["POST", "/booking/payments", "แนบสลิปผ่านหน้าการจอง (multipart/form-data)", "customer"],
  ["GET", "/booking/payments/{id}/proof", "สลิปส่วนตัวของลูกค้า (รูปภาพ)", "customer"],
  ["GET", "/manager/events/{id}/payments", "รายการตรวจรับเงินและคืนเงิน", "manager"],
  ["GET", "/manager/payments/{id}/proof", "สลิปส่วนตัวของผู้จัด (รูปภาพ)", "manager"],
  [
    "POST",
    "/manager/payments/{id}/review",
    "ตรวจรับ/ปฏิเสธเงิน { approve, reference, note }",
    "manager",
  ],
  ["POST", "/manager/bookings/{id}/refunds", "บันทึกเงินที่โอนคืนแล้ว (ไม่โอนเงินจริง)", "manager"],
  ["POST", "/manager/bookings/{id}/cancel", "ยกเลิกโดยผู้จัด พร้อมเหตุผล", "manager"],
] as const;
