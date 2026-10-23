import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { ManagerPayments, CustomerPayments } from "@/components/gatherings/payments";
import { api } from "@/lib/api-client";
import type { Booking } from "@/lib/contracts";
vi.mock("@/lib/api-client", () => ({ api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("does not submit approval until the organizer confirms real bank receipt", async () => {
  vi.mocked(api).mockImplementation(async () => ({
    submissions: [
      {
        id: "p1",
        booking_id: "b1",
        amount_satang: 30000,
        status: "pending",
        paid_at: "2026-10-23T02:00:00Z",
      },
    ],
    refunds: [],
  }));
  const booking = {
    id: "b1",
    code: "TP-TEST",
    guest_name: "Guest",
    status: "pending_payment",
    total_satang: 100000,
    paid_satang: 0,
    refunded_satang: 0,
    deposit_due_satang: 30000,
    deposit_due_at: null,
    balance_due_at: null,
  } as Booking;
  render(
    <ManagerPayments
      eventId="e1"
      bookings={[booking]}
      accessToken="manager"
      onRefresh={async () => {}}
    />,
  );
  await screen.findByText("สลิปรอตรวจ (1)");
  fireEvent.change(screen.getByLabelText("เลขอ้างอิงธนาคารของรายการเงินเข้า"), {
    target: { value: "BANK-001" },
  });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกผลตรวจ" }));
  expect(vi.mocked(api).mock.calls.filter(([p]) => p.endsWith("/review"))).toHaveLength(0);
  fireEvent.click(screen.getByLabelText("ตรวจยอดเงินเข้าบัญชีจริงและเลขอ้างอิงตรงกันแล้ว"));
  fireEvent.click(screen.getByRole("button", { name: "บันทึกผลตรวจ" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/manager/payments/p1/review",
      expect.objectContaining({ body: { approve: true, reference: "BANK-001", note: "" } }),
    ),
  );
});
it("shows a submitted slip as pending while the received amount remains zero", async () => {
  vi.mocked(api).mockResolvedValue({
    total_satang: 100000,
    paid_satang: 0,
    refunded_satang: 0,
    deposit_due_satang: 30000,
    deposit_due_at: null,
    balance_due_at: null,
    bank: { bank_name: "Test Bank", account_name: "Organizer", account_number: "1234567890" },
    refund_policy: "คืนตามเงื่อนไข",
    submissions: [
      { id: "p1", amount_satang: 30000, paid_at: "2026-10-23T02:00:00Z", status: "pending" },
    ],
    refunds: [],
  });
  render(
    <CustomerPayments token="private-token" status="pending_payment" onRefresh={async () => {}} />,
  );
  await screen.findByText("ชื่อบัญชี Organizer");
  expect(screen.getByText(/รอตรวจยอด/)).toBeInTheDocument();
  expect(screen.getByText("ยืนยันรับแล้ว").nextElementSibling?.textContent).toMatch(/0\.00/);
  expect(screen.getByLabelText("ยอดที่โอนจริง (บาท)")).toHaveValue(300);
});
