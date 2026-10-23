import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { EventForm } from "@/components/gatherings/event-form";
import { BankPicker } from "@/components/gatherings/bank-picker";
import { demoEvent } from "@/lib/demo-event";
import type { Event } from "@/lib/contracts";
afterEach(cleanup);
const morning = {
  ...demoEvent,
  starts_at: "2026-11-01T01:00:00Z",
  ends_at: "2026-11-01T05:00:00Z",
  booking_opens_at: "2026-10-23T01:00:00Z",
  booking_closes_at: "2026-10-31T01:00:00Z",
  cancel_deadline: null,
} as unknown as Event;
it("saves a same-day 08:00 to 12:00 event", () => {
  const save = vi.fn();
  render(<EventForm event={morning} busy={false} onSave={save} onBack={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      starts_at: "2026-11-01T01:00:00.000Z",
      ends_at: "2026-11-01T05:00:00.000Z",
    }),
  );
});
it("marks missing fields, focuses the first error, and clears a corrected field", () => {
  const save = vi.fn();
  render(<EventForm busy={false} onSave={save} onBack={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "สร้างร่างงาน" }));
  const title = screen.getByLabelText("ชื่องาน *");
  expect(title).toHaveAttribute("aria-invalid", "true");
  expect(title).toHaveFocus();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(title, { target: { value: "งานเช้า" } });
  expect(title).toHaveAttribute("aria-invalid", "false");
});
it("attaches reversed-time feedback to the end field and clears it after correction", () => {
  render(<EventForm event={morning} busy={false} onSave={() => {}} onBack={() => {}} />);
  const end = screen.getByLabelText("สิ้นสุดงาน *");
  fireEvent.change(end, { target: { value: "2026-11-01T00:00" } });
  fireEvent.blur(end);
  expect(end).toHaveAttribute("aria-invalid", "true");
  expect(end).toHaveAccessibleDescription("⚠ เวลาสิ้นสุดงานต้องอยู่หลังเวลาเริ่มงาน");
  fireEvent.change(end, { target: { value: "2026-11-01T12:00" } });
  expect(end).toHaveAttribute("aria-invalid", "false");
});
it("preserves custom bank names and submits a selected bank with its logo", () => {
  const { unmount } = render(
    <form aria-label="bank">
      <BankPicker name="bank_name" defaultValue="ธนาคารเดิม" />
    </form>,
  );
  expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("bank_name")).toBe(
    "ธนาคารเดิม",
  );
  unmount();
  const { container } = render(
    <form aria-label="bank">
      <BankPicker name="bank_name" defaultValue="ธนาคารกสิกรไทย" />
    </form>,
  );
  expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("bank_name")).toBe(
    "ธนาคารกสิกรไทย",
  );
  expect(container.querySelector("img")).toHaveAttribute("src", "/banks/kbank.svg");
});
