import { EventSchedule } from "@/components/gatherings/event-schedule";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันบันทึก" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      starts_at: "2026-11-01T01:00:00.000Z",
      ends_at: "2026-11-01T05:00:00.000Z",
    }),
  );
});
it("marks missing fields, focuses the first error, and clears a corrected field", async () => {
  const save = vi.fn();
  render(<EventForm busy={false} onSave={save} onBack={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "สร้างร่างงาน" }));
  const title = screen.getByLabelText("ชื่องาน *");
  expect(title).toHaveAttribute("aria-invalid", "true");
  expect(title).toHaveFocus();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(title, { target: { value: "งานเช้า" } });
  await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "false"));
});
it("shows reversed-time feedback without silently moving the end date", async () => {
  render(<EventForm event={morning} busy={false} onSave={() => {}} onBack={() => {}} />);
  const end = screen.getByLabelText("เลิกงาน ชั่วโมง");
  fireEvent.change(end, { target: { value: "00" } });
  fireEvent.blur(end);
  await screen.findByText("⚠ เวลาสิ้นสุดงานต้องอยู่หลังเวลาเริ่มงาน");
  expect(screen.getByLabelText("วันเลิกงาน")).toHaveValue("same");
  fireEvent.change(end, { target: { value: "12" } });
  await waitFor(() =>
    expect(screen.queryByText("⚠ เวลาสิ้นสุดงานต้องอยู่หลังเวลาเริ่มงาน")).not.toBeInTheDocument(),
  );
});
it("supports explicit overnight events and cancels review without saving", () => {
  const save = vi.fn();
  render(<EventForm event={morning} busy={false} onSave={save} onBack={() => {}} />);
  fireEvent.change(screen.getByLabelText("เริ่มงาน ชั่วโมง"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("เลิกงาน ชั่วโมง"), { target: { value: "00" } });
  fireEvent.change(screen.getByLabelText("วันเลิกงาน"), { target: { value: "next" } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
  fireEvent.click(screen.getByRole("button", { name: "กลับไปแก้ไข" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันบันทึก" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      starts_at: "2026-11-01T13:00:00.000Z",
      ends_at: "2026-11-01T17:00:00.000Z",
    }),
  );
});
it("uses Thai month and Buddhist year, and rejects impossible calendar dates", () => {
  const save = vi.fn();
  render(<EventForm event={morning} busy={false} onSave={save} onBack={() => {}} />);
  expect(screen.getByLabelText("วันจัดงาน เดือน")).toHaveDisplayValue("พฤศจิกายน");
  expect(screen.getByLabelText("วันจัดงาน ปี พ.ศ.")).toHaveDisplayValue("2569");
  fireEvent.change(screen.getByLabelText("วันจัดงาน วันที่"), { target: { value: "31" } });
  fireEvent.change(screen.getByLabelText("วันจัดงาน เดือน"), { target: { value: "02" } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
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

it("keeps preset deadlines aligned when the event date changes", () => {
  const { container } = render(
    <form>
      <EventSchedule paid={true} />
    </form>,
  );
  fireEvent.change(screen.getByLabelText("วันจัดงาน ปี พ.ศ."), { target: { value: "2027" } });
  fireEvent.change(screen.getByLabelText("วันจัดงาน เดือน"), { target: { value: "03" } });
  fireEvent.change(screen.getByLabelText("วันจัดงาน วันที่"), { target: { value: "01" } });
  const values = () => new FormData(container.querySelector("form")!);
  expect(values().get("booking_closes_at")).toBe("2027-02-28T08:00");
  expect(values().get("balance_due_at")).toBe("2027-03-01T08:00");
  fireEvent.change(screen.getByLabelText("วันจัดงาน วันที่"), { target: { value: "02" } });
  expect(values().get("booking_closes_at")).toBe("2027-03-01T08:00");
  expect(values().get("cancel_deadline")).toBe("2027-03-01T08:00");
  expect(values().get("balance_due_at")).toBe("2027-03-02T08:00");
});

it("keeps the reviewed data visible when saving fails and permits an explicit retry", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("ฐานข้อมูลยังไม่พร้อม"))
    .mockResolvedValueOnce(undefined);
  render(<EventForm event={morning} busy={false} onSave={save} onBack={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันบันทึก" }));
  await screen.findByText("ฐานข้อมูลยังไม่พร้อม");
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันบันทึก" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0]![0]).toEqual(save.mock.calls[1]![0]);
});
