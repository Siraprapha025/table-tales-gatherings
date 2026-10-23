import { describe, it, expect } from "vitest";
import { bookingInput, eventInput, tableInput, tokenSchema } from "./contracts";
describe("HTTP input boundaries", () => {
  it("rejects duplicate tables, blank names and unexpected privilege fields", () => {
    const table = "11111111-1111-4111-8111-111111111111";
    const b = { slug: "demo", table_ids: [table], guest_name: "A", guest_count: 1 };
    expect(bookingInput.safeParse(b).success).toBe(true);
    expect(bookingInput.safeParse({ ...b, table_ids: [table, table] }).success).toBe(false);
    expect(bookingInput.safeParse({ ...b, guest_name: "  " }).success).toBe(false);
    expect(bookingInput.safeParse({ ...b, owner_id: table }).success).toBe(false);
  });
  it("requires a strong capability token and bounded table prices", () => {
    expect(tokenSchema.safeParse("BK-123456").success).toBe(false);
    expect(tokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    const t = { number: 1, name: "A", zone: "", capacity: 8, x: 10, y: 100 };
    expect(tableInput.safeParse(t).success).toBe(true);
    expect(tableInput.safeParse({ ...t, price_satang: 100 }).success).toBe(true);
  });
  it("rejects executable map URLs, payment mode, and invalid times", () => {
    const b = {
      title: "Event",
      starts_at: "2026-12-20T11:00:00Z",
      ends_at: "2026-12-20T15:00:00Z",
      booking_opens_at: "2026-10-01T02:00:00Z",
      booking_closes_at: "2026-12-15T16:59:00Z",
    };
    expect(eventInput.safeParse(b).success).toBe(true);
    expect(eventInput.safeParse({ ...b, map_url: "javascript:alert(1)" }).success).toBe(false);
    expect(eventInput.safeParse({ ...b, payment_mode: "required" }).success).toBe(false);
    expect(eventInput.safeParse({ ...b, ends_at: b.starts_at }).success).toBe(false);
  });
});
