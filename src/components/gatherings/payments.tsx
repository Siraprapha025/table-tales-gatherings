import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { API_BASE, type Booking } from "@/lib/contracts";
import {
  csvCell,
  paymentStage,
  paymentTotals,
  type PaymentHistory,
  type PaymentSubmission,
  type Refund,
} from "@/lib/payment-contracts";
import {
  bahtToSatang,
  bangkokLocalToISO,
  formatBaht,
  formatThaiDateTime,
  isoToBangkokLocal,
} from "@/lib/event-rules";
import { Field, Notice } from "./common";
const statusText = { pending: "รอตรวจยอด", approved: "ยืนยันเงินเข้าแล้ว", rejected: "ปฏิเสธ" };
async function downloadProof(path: string, auth: { accessToken?: string; manageToken?: string }) {
  const r = await fetch(API_BASE + path, {
    headers: auth.accessToken
      ? { Authorization: `Bearer ${auth.accessToken}` }
      : { "X-Manage-Token": auth.manageToken! },
  });
  if (!r.ok) throw new Error("เปิดสลิปไม่ได้ กรุณาลองใหม่");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = blob.type === "image/png" ? "slip.png" : "slip.jpg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function nowLocal() {
  return isoToBangkokLocal(new Date().toISOString());
}
export function CustomerPayments({
  token,
  status,
  onRefresh,
}: {
  token: string;
  status: string;
  onRefresh: () => Promise<void>;
}) {
  const [data, setData] = useState<PaymentHistory | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const attempt = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    setData(await api<PaymentHistory>("/booking/payments", { manageToken: token }));
  }, [token]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load, status]);
  if (!data) return <Notice error={!!error}>{error || "กำลังโหลดข้อมูลชำระเงิน…"}</Notice>;
  if (!data.total_satang) return null;
  const remaining = data.total_satang - data.paid_satang;
  return (
    <section className="payment-section">
      <h3>ชำระเงินให้ผู้จัด</h3>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <dl>
        <dt>ราคารวม</dt>
        <dd>{formatBaht(data.total_satang)}</dd>
        <dt>ยืนยันรับแล้ว</dt>
        <dd>{formatBaht(data.paid_satang)}</dd>
        <dt>ยอดคงเหลือ</dt>
        <dd>{formatBaht(Math.max(0, remaining))}</dd>
        <dt>คืนเงินแล้ว</dt>
        <dd>{formatBaht(data.refunded_satang)}</dd>
      </dl>
      <Notice>
        {paymentStage({ ...data, status })}
        <p>
          มัดจำ {formatBaht(data.deposit_due_satang)} ภายใน{" "}
          {formatThaiDateTime(data.deposit_due_at)}
        </p>
        <p>ส่วนที่เหลือภายใน {formatThaiDateTime(data.balance_due_at)}</p>
      </Notice>
      {data.bank && (
        <div className="panel">
          <strong>{data.bank.bank_name}</strong>
          <p>ชื่อบัญชี {data.bank.account_name}</p>
          <p>
            เลขบัญชี <b>{data.bank.account_number}</b>
          </p>
        </div>
      )}
      <p className="pre-line">เงื่อนไขยกเลิก / คืนเงิน: {data.refund_policy}</p>
      {["confirmed", "pending_payment"].includes(status) && remaining > 0 && (
        <form
          onChange={() => {
            attempt.current = crypto.randomUUID();
            setMessage("");
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const amount = bahtToSatang(String(f.get("amount")));
            const date = bangkokLocalToISO(String(f.get("date")));
            if (!amount || !date) {
              setError("กรอกยอดโอนและเวลาที่ถูกต้อง");
              return;
            }
            f.delete("amount");
            f.delete("date");
            f.set("amount_satang", String(amount));
            f.set("paid_at", date);
            f.set("request_id", attempt.current);
            setBusy(true);
            setError("");
            try {
              await api("/booking/payments", { method: "POST", manageToken: token, body: f });
              attempt.current = crypto.randomUUID();
              form.reset();
              setMessage("ส่งสลิปแล้ว รอผู้จัดตรวจยอดเงินเข้าบัญชี");
              await load();
              await onRefresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Field label="ยอดที่โอนจริง (บาท)">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remaining / 100}
                  required
                  defaultValue={
                    Math.max(0, data.deposit_due_satang - data.paid_satang) / 100 || remaining / 100
                  }
                />
              </Field>
              <Field label="วันเวลาโอน · เวลาไทย">
                <input name="date" type="datetime-local" required defaultValue={nowLocal()} />
              </Field>
            </div>
            <Field label="รูปสลิป JPEG / PNG ไม่เกิน 5 MB">
              <input name="file" type="file" accept="image/jpeg,image/png" required />
            </Field>
            <p className="muted">
              สลิปเปิดดูได้เฉพาะผู้ถือหน้าการจองนี้และผู้จัดงาน
              สลิปที่ส่งยังไม่นับเป็นยอดชำระจนผู้จัดยืนยัน อย่าโอนซ้ำระหว่างรอตรวจ
            </p>
            <button className="button primary">{busy ? "กำลังส่ง…" : "แจ้งโอนและส่งสลิป"}</button>
          </fieldset>
        </form>
      )}
      <h4>ประวัติแจ้งโอน</h4>
      {!data.submissions.length && <p>ยังไม่มีสลิป</p>}
      {data.submissions.map((p) => (
        <div className="payment-row" key={p.id}>
          <b>
            {formatBaht(p.amount_satang)} · {statusText[p.status]}
          </b>
          <p>
            {formatThaiDateTime(p.paid_at)} {p.decision_note}
          </p>
          <button
            className="text-button"
            onClick={() =>
              void downloadProof(`/booking/payments/${p.id}/proof`, { manageToken: token }).catch(
                (e) => setError(e.message),
              )
            }
          >
            ดาวน์โหลดสลิปของฉัน
          </button>
        </div>
      ))}
      {data.refunds.map((r) => (
        <p key={r.id}>
          คืนเงิน {formatBaht(r.amount_satang)} · {formatThaiDateTime(r.paid_at)} · {r.note}
        </p>
      ))}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() =>
          void load()
            .then(onRefresh)
            .catch((e) => setError(e.message))
        }
      >
        อัปเดตยอดเงิน
      </button>
    </section>
  );
}
type FinanceList = { submissions: PaymentSubmission[]; refunds: Refund[] };
export function ManagerPayments({
  eventId,
  bookings,
  accessToken,
  onRefresh,
}: {
  eventId: string;
  bookings: Booking[];
  accessToken: string;
  onRefresh: () => Promise<void>;
}) {
  const [data, setData] = useState<FinanceList | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(
    async () =>
      setData(await api<FinanceList>(`/manager/events/${eventId}/payments`, { accessToken })),
    [eventId, accessToken],
  );
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  const totals = paymentTotals(bookings);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
      await onRefresh();
      setMessage("บันทึกแล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const rows = [
      ["รหัส", "ผู้จอง", "สถานะ", "ราคาสุทธิ", "ยืนยันรับแล้ว", "คืนเงินแล้ว", "คงค้าง"],
      ...bookings.map((b) => [
        b.code,
        b.guest_name,
        paymentStage(b),
        b.total_satang / 100,
        b.paid_satang / 100,
        b.refunded_satang / 100,
        ["confirmed", "pending_payment"].includes(b.status)
          ? (b.total_satang - b.paid_satang) / 100
          : 0,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "booking-payments.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel">
      <h2>รับเงิน / คืนเงิน</h2>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="form-grid">
        {[
          ["ยืนยันรับแล้ว", totals.received],
          ["คืนเงินแล้ว", totals.refunded],
          ["รับสุทธิ", totals.net],
          ["คงค้าง (รายการยังใช้งาน)", totals.outstanding],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <span>{label}</span>
            <h3>{formatBaht(Number(value))}</h3>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button className="button secondary" onClick={exportCsv}>
          ส่งออกรายงาน CSV
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void run(async () => {})}
        >
          อัปเดตข้อมูล
        </button>
      </div>
      <Notice>
        ตรวจเงินเข้าจากบัญชีธนาคารจริงก่อนยืนยัน สลิปไม่ใช่หลักฐานว่าเงินเข้าบัญชีแล้ว
        ระบบนี้ไม่ตรวจสลิปหรือโอนคืนให้อัตโนมัติ
      </Notice>
      <h3>สลิปรอตรวจ ({data?.submissions.filter((p) => p.status === "pending").length ?? 0})</h3>
      {data?.submissions.map((p) => {
        const b = bookings.find((b) => b.id === p.booking_id);
        return (
          <div className="payment-row" key={p.id}>
            <b>
              {b?.code} · {b?.guest_name} · {formatBaht(p.amount_satang)}
            </b>
            <p>
              {statusText[p.status]} · โอน {formatThaiDateTime(p.paid_at)}
            </p>
            <button
              className="text-button"
              onClick={() =>
                void downloadProof(`/manager/payments/${p.id}/proof`, { accessToken }).catch((e) =>
                  setError(e.message),
                )
              }
            >
              ดาวน์โหลดสลิปเพื่อตรวจสอบ
            </button>
            {p.status === "pending" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const approve = f.get("decision") === "approve";
                  if (approve && !f.has("verified")) {
                    setError("กรุณายืนยันว่าตรวจเงินเข้าบัญชีจริงแล้ว");
                    return;
                  }
                  void run(() =>
                    api(`/manager/payments/${p.id}/review`, {
                      method: "POST",
                      accessToken,
                      body: {
                        approve,
                        reference: String(f.get("reference") ?? ""),
                        note: String(f.get("note") ?? ""),
                      },
                    }),
                  );
                }}
              >
                <fieldset disabled={busy}>
                  <div className="form-grid">
                    <Field label="ผลตรวจ">
                      <select name="decision">
                        <option value="approve">ยืนยันเงินเข้าแล้ว</option>
                        <option value="reject">ปฏิเสธสลิป</option>
                      </select>
                    </Field>
                    <Field label="เลขอ้างอิงธนาคารของรายการเงินเข้า">
                      <input name="reference" maxLength={200} />
                    </Field>
                    <Field label="หมายเหตุ (ต้องระบุเมื่อปฏิเสธ)">
                      <input name="note" maxLength={1000} />
                    </Field>
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" name="verified" />{" "}
                    ตรวจยอดเงินเข้าบัญชีจริงและเลขอ้างอิงตรงกันแล้ว
                  </label>
                  <button className="button primary">บันทึกผลตรวจ</button>
                </fieldset>
              </form>
            ) : (
              <p>
                {p.bank_reference} · {p.decision_note}
              </p>
            )}
          </div>
        );
      })}
      <h3>ติดตามยอดและยกเลิก</h3>
      {bookings.map((b) => (
        <div className="payment-row" key={b.id}>
          <b>
            {b.code} · {b.guest_name}
          </b>
          <p>
            {paymentStage(b)} · รับแล้ว {formatBaht(b.paid_satang)} / {formatBaht(b.total_satang)}
          </p>
          {["confirmed", "pending_payment"].includes(b.status) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  !window.confirm(
                    `ยกเลิก ${b.code} และปล่อยโต๊ะ? หากรับเงินแล้วต้องจัดการคืนเงินแยกตามเงื่อนไข`,
                  )
                )
                  return;
                void run(() =>
                  api(`/manager/bookings/${b.id}/cancel`, {
                    method: "POST",
                    accessToken,
                    body: { note: String(f.get("note")) },
                  }),
                );
              }}
            >
              <Field label="เหตุผลยกเลิก (เช่น เกินกำหนดชำระ)">
                <input name="note" required maxLength={1000} />
              </Field>
              <button className="button danger" disabled={busy}>
                ยกเลิกและปล่อยโต๊ะ
              </button>
            </form>
          )}
          {b.status === "cancelled" && b.paid_satang > b.refunded_satang && (
            <RefundForm
              booking={b}
              busy={busy}
              onSave={(body) =>
                run(() =>
                  api(`/manager/bookings/${b.id}/refunds`, { method: "POST", accessToken, body }),
                )
              }
            />
          )}
          {data?.refunds
            .filter((r) => r.booking_id === b.id)
            .map((r) => (
              <p key={r.id}>
                คืนแล้ว {formatBaht(r.amount_satang)} · {formatThaiDateTime(r.paid_at)} · อ้างอิง{" "}
                {r.bank_reference} · {r.note}
              </p>
            ))}
        </div>
      ))}
    </section>
  );
}
function RefundForm({
  booking,
  busy,
  onSave,
}: {
  booking: Booking;
  busy: boolean;
  onSave: (body: unknown) => Promise<void>;
}) {
  const key = useRef(crypto.randomUUID());
  return (
    <form
      onChange={() => (key.current = crypto.randomUUID())}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          amount_satang: bahtToSatang(String(f.get("amount"))),
          paid_at: bangkokLocalToISO(String(f.get("date"))),
          reference: String(f.get("reference")),
          note: String(f.get("note")),
          request_id: key.current,
        });
      }}
    >
      <fieldset disabled={busy}>
        <h4>บันทึกเงินที่โอนคืนจริง</h4>
        <div className="form-grid">
          <Field label="จำนวนที่คืน (บาท)">
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              max={(booking.paid_satang - booking.refunded_satang) / 100}
            />
          </Field>
          <Field label="วันเวลาโอนคืน · เวลาไทย">
            <input name="date" type="datetime-local" required defaultValue={nowLocal()} />
          </Field>
          <Field label="เลขอ้างอิงธนาคาร">
            <input name="reference" minLength={3} maxLength={200} required />
          </Field>
          <Field label="หมายเหตุ">
            <input name="note" maxLength={1000} required />
          </Field>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" required /> ได้โอนคืนและตรวจบัญชีผู้รับแล้ว
        </label>
        <button className="button primary">บันทึกการคืนเงิน</button>
      </fieldset>
    </form>
  );
}
