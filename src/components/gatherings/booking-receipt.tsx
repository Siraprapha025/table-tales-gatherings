import { CustomerPayments } from "./payments";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { BookingReceipt } from "@/lib/contracts";
import { BOOKING_STATUS_TH, CANCEL_STATUS_TH, formatThaiDateTime } from "@/lib/event-rules";
import { Field, Notice, Shell } from "./common";
export function BookingPage() {
  const [token, setToken] = useState("");
  const [booking, setBooking] = useState<BookingReceipt | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  async function load(t: string) {
    try {
      setBooking(await api<BookingReceipt>("/booking", { manageToken: t }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const t = window.location.hash.slice(1);
    setToken(t);
    if (t) void load(t);
    else setError("ลิงก์นี้ไม่มีรหัสส่วนตัว กรุณาเปิดลิงก์ที่ได้รับหลังจอง");
  }, []);
  return (
    <Shell>
      <main className="page narrow">
        <span className="eyebrow">YOUR RESERVATION</span>
        <h1>การจองของฉัน</h1>
        {error && <Notice error>{error}</Notice>}
        {booking && (
          <section className="panel receipt">
            <span className="status-pill">{BOOKING_STATUS_TH[booking.status]}</span>
            <h2>{booking.event.title}</h2>
            <p className="booking-code">{booking.code}</p>
            <dl>
              <dt>ผู้จอง</dt>
              <dd>{booking.guest_name}</dd>
              <dt>โต๊ะ</dt>
              <dd>{booking.tables.map((t) => t.number).join(", ")}</dd>
              <dt>จำนวนคน</dt>
              <dd>{booking.guest_count} คน</dd>
              <dt>หน่วยงาน</dt>
              <dd>{booking.organization || "-"}</dd>
              <dt>เวลา</dt>
              <dd>{formatThaiDateTime(booking.event.starts_at)}</dd>
              <dt>สถานที่</dt>
              <dd>{booking.event.venue_name}</dd>
            </dl>
            <Notice>เก็บลิงก์หน้านี้ไว้เป็นส่วนตัว ใช้เปิดดูหรือยื่นคำขอยกเลิกได้</Notice>
            <CustomerPayments token={token} status={booking.status} onRefresh={() => load(token)} />
            {booking.cancellation && (
              <Notice>
                คำขอยกเลิก: {CANCEL_STATUS_TH[booking.cancellation.status]}
                <p>{booking.cancellation.reason}</p>
                {booking.cancellation.decision_note && (
                  <p>หมายเหตุ: {booking.cancellation.decision_note}</p>
                )}
              </Notice>
            )}
            {["confirmed", "pending_payment"].includes(booking.status) &&
              booking.cancellation?.status !== "pending" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!review) {
                      setReview(true);
                      return;
                    }
                    setBusy(true);
                    try {
                      await api("/booking/cancellations", {
                        method: "POST",
                        manageToken: token,
                        body: { reason },
                      });
                      setReview(false);
                      await load(token);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <h3>ยื่นคำขอยกเลิกทั้งรายการ</h3>
                  <p className="muted">
                    โต๊ะจะถูกปล่อยเมื่อผู้จัดการอนุมัติ • กำหนดยื่นคำขอ{" "}
                    {formatThaiDateTime(booking.event.cancel_deadline)}
                  </p>
                  <Field label="เหตุผลในการยกเลิก">
                    <textarea
                      required
                      maxLength={1000}
                      value={reason}
                      disabled={busy || review}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  {review && (
                    <Notice>ยืนยันขอยกเลิกทุกโต๊ะในการจอง {booking.code} ใช่หรือไม่?</Notice>
                  )}
                  <button className="button danger" disabled={busy}>
                    {busy ? "กำลังส่ง…" : review ? "ยืนยันส่งคำขอ" : "ขอยกเลิกการจอง"}
                  </button>
                  {review && (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setReview(false)}
                    >
                      กลับ
                    </button>
                  )}
                </form>
              )}
            <button className="text-button" onClick={() => void load(token)}>
              อัปเดตสถานะ
            </button>
            <a className="text-button" href={`/e/${booking.event.slug}`}>
              กลับไปหน้างาน
            </a>
          </section>
        )}
      </main>
    </Shell>
  );
}
