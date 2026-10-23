import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicEventPage } from "@/components/gatherings/public-event";
import { EventForm } from "@/components/gatherings/event-form";
import { demoEvent } from "@/lib/demo-event";
import { api } from "@/lib/api-client";
import type { Event } from "@/lib/contracts";
vi.mock("@/lib/api-client", () => ({ api: vi.fn(), newManageToken: () => "a".repeat(64) }));
const mockedApi = vi.mocked(api);
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());
describe("Customer booking UI", () => {
  it("reserves only after review and retains identity on an uncertain retry", async () => {
    let writes = 0;
    mockedApi.mockImplementation(async (path) => {
      if (path.startsWith("/public/")) return { ...demoEvent, booking_open: true };
      if (path === "/bookings") {
        if (++writes === 1) throw new Error("เครือข่ายขัดข้อง");
        return { code: "TP-TEST01" };
      }
      throw new Error("Unexpected request");
    });
    render(<PublicEventPage slug="test-event" />);
    fireEvent.click(await screen.findByRole("button", { name: "โต๊ะ 03 8 คน ว่าง" }));
    fireEvent.change(screen.getByLabelText("ชื่อผู้จอง *"), { target: { value: "ผู้จองทดสอบ" } });
    fireEvent.change(screen.getByLabelText("จำนวนผู้ร่วมงาน *"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /ตรวจสอบการจอง/ }));
    expect(writes).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันการจอง" }));
    await screen.findByText("เครือข่ายขัดข้อง");
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันการจอง" }));
    await screen.findByText("จองโต๊ะเรียบร้อยแล้ว");
    const calls = mockedApi.mock.calls.filter(([path]) => path === "/bookings");
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]!.requestId).toBe(calls[1]![1]!.requestId);
    expect(calls[0]![1]!.manageToken).toBe(calls[1]![1]!.manageToken);
    expect(screen.getByRole("link", { name: /ดูการจองของฉัน/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/booking#"),
    );
  });
  it("labels preview data and never submits a demo booking", () => {
    render(<PublicEventPage slug="demo-gala" preview />);
    expect(screen.getByRole("button", { name: /ตรวจสอบการจอง/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "ดูรายการโต๊ะ" }));
    expect(screen.getByRole("button", { name: /โต๊ะ 03 8 คน/ })).toBeInTheDocument();
    expect(mockedApi).not.toHaveBeenCalled();
  });
});
describe("Manager event editor", () => {
  it("submits Bangkok wall time as UTC and never includes owner fields", async () => {
    const save = vi.fn();
    const event = {
      ...demoEvent,
      payment_mode: "none",
      id: "test",
      version: 1,
    } as unknown as Event;
    render(<EventForm event={event} busy={false} onSave={save} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]![0].starts_at).toBe("2026-12-20T11:00:00.000Z");
    expect(save.mock.calls[0]![0]).not.toHaveProperty("owner_id");
  });
});
