// @vitest-environment node
import { it, expect } from "vitest";
import { boundedForm } from "./payment-api.server";
import { proofMime, PROOF_MAX_BYTES, paymentTotals, csvCell } from "./payment-contracts";
it("rejects fake MIME types, oversized content and non multipart uploads", async () => {
  expect(proofMime(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  expect(proofMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]))).toBe(
    "image/png",
  );
  const large = new Uint8Array(PROOF_MAX_BYTES + 65537);
  await expect(
    boundedForm(
      new Request("https://test.local", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        body: large,
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    boundedForm(new Request("https://test.local", { method: "POST", body: "{}" })),
  ).rejects.toMatchObject({ status: 400 });
});
it("reports net receipts and excludes cancelled liabilities from money owed", () => {
  expect(
    paymentTotals([
      { status: "confirmed", total_satang: 100000, paid_satang: 30000, refunded_satang: 0 },
      { status: "cancelled", total_satang: 100000, paid_satang: 30000, refunded_satang: 10000 },
    ]),
  ).toEqual({ received: 60000, refunded: 10000, net: 50000, outstanding: 70000 });
  expect(csvCell(' =HYPERLINK("evil")')).toBe('"\' =HYPERLINK(""evil"")"');
});
