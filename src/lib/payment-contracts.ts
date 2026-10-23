import { z } from "zod";
export type PaymentSubmission = {
  id: string;
  booking_id: string;
  event_id: string;
  owner_id: string;
  amount_satang: number;
  paid_at: string;
  proof_path: string;
  proof_hash: string;
  request_id: string;
  status: "pending" | "approved" | "rejected";
  bank_reference: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};
export type Refund = {
  id: string;
  booking_id: string;
  event_id: string;
  owner_id: string;
  amount_satang: number;
  paid_at: string;
  bank_reference: string;
  note: string;
  request_id: string;
  recorded_by: string;
  created_at: string;
};
export type PaymentHistory = {
  total_satang: number;
  paid_satang: number;
  refunded_satang: number;
  deposit_due_satang: number;
  deposit_due_at: string | null;
  balance_due_at: string | null;
  bank: { bank_name: string; account_name: string; account_number: string } | null;
  refund_policy: string;
  submissions: Pick<
    PaymentSubmission,
    "id" | "amount_satang" | "paid_at" | "status" | "decision_note" | "created_at"
  >[];
  refunds: Pick<Refund, "id" | "amount_satang" | "paid_at" | "note">[];
};
export const amountSchema = z.number().int().positive().max(100000000);
export const paymentReviewSchema = z
  .object({
    approve: z.boolean(),
    reference: z.string().trim().max(200).default(""),
    note: z.string().trim().max(1000).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.approve && v.reference.length < 3)
      ctx.addIssue({ code: "custom", message: "กรอกเลขอ้างอิงจากรายการเงินเข้าบัญชี" });
    if (!v.approve && !v.note)
      ctx.addIssue({ code: "custom", message: "กรุณาระบุเหตุผลที่ปฏิเสธ" });
  });
export const refundSchema = z
  .object({
    amount_satang: amountSchema,
    paid_at: z.string().datetime(),
    reference: z.string().trim().min(3).max(200),
    note: z.string().trim().min(1).max(1000),
    request_id: z.string().uuid(),
  })
  .strict();
export function paymentTotals(
  rows: { status: string; total_satang: number; paid_satang: number; refunded_satang: number }[],
) {
  return rows.reduce(
    (s, b) => ({
      received: s.received + b.paid_satang,
      refunded: s.refunded + b.refunded_satang,
      net: s.net + b.paid_satang - b.refunded_satang,
      outstanding:
        s.outstanding +
        (["confirmed", "pending_payment"].includes(b.status)
          ? Math.max(0, b.total_satang - b.paid_satang)
          : 0),
    }),
    { received: 0, refunded: 0, net: 0, outstanding: 0 },
  );
}
export function paymentStage(
  b: {
    status: string;
    total_satang: number;
    paid_satang: number;
    deposit_due_satang: number;
    deposit_due_at: string | null;
    balance_due_at: string | null;
  },
  now = Date.now(),
) {
  if (b.status === "cancelled") return "ยกเลิกแล้ว";
  if (!b.total_satang) return "ไม่เก็บเงิน";
  if (b.paid_satang >= b.total_satang) return "ชำระครบแล้ว";
  const deposit = b.paid_satang < b.deposit_due_satang;
  const deadline = deposit ? b.deposit_due_at : b.balance_due_at;
  return `${deposit ? "รอมัดจำ" : "รอส่วนที่เหลือ"}${deadline && Date.parse(deadline) < now ? " • เกินกำหนด" : ""}`;
}
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export function proofMime(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length > PROOF_MAX_BYTES || bytes.length < 12) return null;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  return null;
}
// Escape spreadsheet formulas in exported user-controlled text.
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
