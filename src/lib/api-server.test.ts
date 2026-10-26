// @vitest-environment node
import { expect, it } from "vitest";
import { fromDbError } from "./api-server";
it("reports missing schema as a setup problem instead of an internal error", () => {
  for (const code of ["42703", "42P01", "42883", "PGRST202", "PGRST204", "PGRST205"])
    expect(fromDbError({ code, message: "missing database structure" })).toMatchObject({
      status: 503,
      code: "DATABASE_SETUP_REQUIRED",
    });
  expect(fromDbError({ message: "INVALID_STATE:ระบบชำระเงินยังไม่เปิดใช้งาน" })).toMatchObject({
    status: 503,
    code: "DATABASE_SETUP_REQUIRED",
  });
  expect(fromDbError({ message: "INVALID_STATE:คำขอนี้ดำเนินการแล้ว" })).toMatchObject({
    status: 409,
    code: "INVALID_STATE",
  });
});
