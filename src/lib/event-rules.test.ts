import { describe, expect, it } from "vitest";
import { bahtToSatang, bangkokLocalToISO, guestCountFits, isoToBangkokLocal, validateEventTimes } from "./event-rules";

describe("event rules", () => {
  it("interprets form times as Asia/Bangkok", () => {
    expect(bangkokLocalToISO("2026-12-20T18:00")).toBe("2026-12-20T11:00:00.000Z");
    expect(isoToBangkokLocal("2026-12-20T11:00:00.000Z")).toBe("2026-12-20T18:00");
  });
  it("rejects ambiguous or impossible dates instead of guessing", () => {
    expect(bangkokLocalToISO("2026-02-31T10:00")).toBeNull();
    expect(bangkokLocalToISO("20/12/2026")).toBeNull();
  });
  it("requires end after start and booking window before the event ends", () => {
    const base = {
      starts_at: "2026-12-20T11:00:00Z",
      ends_at: "2026-12-20T15:00:00Z",
      booking_opens_at: "2026-10-01T00:00:00Z",
      booking_closes_at: "2026-12-15T00:00:00Z",
    };
    expect(validateEventTimes(base)).toEqual([]);
    expect(validateEventTimes({ ...base, ends_at: "2026-12-20T10:00:00Z" })).toContain("เวลาสิ้นสุดงานต้องอยู่หลังเวลาเริ่มงาน");
    expect(validateEventTimes({ ...base, booking_closes_at: "2026-12-21T00:00:00Z" })).toContain("ต้องปิดรับจองก่อนงานสิ้นสุด");
  });
  it("stores money as integer satang", () => {
    expect(bahtToSatang("3,500")).toBe(350000);
    expect(bahtToSatang("12.5")).toBe(1250);
    expect(bahtToSatang("-1")).toBeNull();
    expect(bahtToSatang("1.234")).toBeNull();
  });
  it("guest count must fit selected tables", () => {
    expect(guestCountFits(16, [8, 8])).toBe(true);
    expect(guestCountFits(17, [8, 8])).toBe(false);
  });
});
