// Pure business rules shared by browser, server API and tests.
export const TZ = "Asia/Bangkok";

/** "2026-12-20T18:00" (Bangkok wall time) -> ISO string, or null when malformed. */
export function bangkokLocalToISO(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local?.trim() ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const utc = Date.UTC(y, mo - 1, d, h - 7, mi);
  const check = new Date(utc + 7 * 3600_000);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null; // e.g. 31 Feb
  return new Date(utc).toISOString();
}

/** ISO -> "YYYY-MM-DDTHH:mm" in Bangkok time, for datetime-local inputs. */
export function isoToBangkokLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 16);
}

export function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export interface EventTimes {
  starts_at: string;
  ends_at: string;
  booking_opens_at: string;
  booking_closes_at: string;
  cancel_deadline?: string | null;
}

/** Returns Thai error messages; empty array = valid. */
export function validateEventTimes(t: EventTimes): string[] {
  const errs: string[] = [];
  const ms = (v?: string | null) => (v ? new Date(v).getTime() : NaN);
  const s = ms(t.starts_at), e = ms(t.ends_at), o = ms(t.booking_opens_at), c = ms(t.booking_closes_at);
  if ([s, e, o, c].some(Number.isNaN)) {
    errs.push("กรุณากรอกวันเวลาให้ครบและถูกต้อง");
    return errs;
  }
  if (e <= s) errs.push("เวลาสิ้นสุดงานต้องอยู่หลังเวลาเริ่มงาน");
  if (c <= o) errs.push("เวลาปิดรับจองต้องอยู่หลังเวลาเปิดรับจอง");
  if (c > e) errs.push("ต้องปิดรับจองก่อนงานสิ้นสุด");
  if (t.cancel_deadline) {
    const d = ms(t.cancel_deadline);
    if (Number.isNaN(d)) errs.push("กำหนดยื่นคำขอยกเลิกไม่ถูกต้อง");
    else if (d > s) errs.push("กำหนดยื่นคำขอยกเลิกต้องไม่เกินเวลาเริ่มงาน");
  }
  return errs;
}

/** "3,500.50" -> 350050 satang. Null for invalid / negative / >2 decimals. */
export function bahtToSatang(input: string | number): number | null {
  const s = String(input).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatBaht(satang: number): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);
}

export function guestCountFits(guestCount: number, capacities: number[]): boolean {
  const cap = capacities.reduce((a, b) => a + b, 0);
  return Number.isInteger(guestCount) && guestCount >= 1 && guestCount <= cap;
}

export const EVENT_STATUS_TH: Record<string, string> = {
  draft: "ร่าง",
  published: "เผยแพร่แล้ว",
  closed: "ปิดรับจอง",
  cancelled: "ยกเลิกงาน",
  completed: "จบงานแล้ว",
};
export const BOOKING_STATUS_TH: Record<string, string> = {
  confirmed: "ยืนยันแล้ว",
  pending_payment: "รอชำระเงิน",
  cancelled: "ยกเลิกแล้ว",
  expired: "หมดอายุ",
};
export const CANCEL_STATUS_TH: Record<string, string> = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};
export const TABLE_STATE_TH: Record<string, string> = {
  available: "ว่าง",
  held: "กันไว้",
  booked: "จองแล้ว",
  disabled: "ปิดใช้งาน",
};
