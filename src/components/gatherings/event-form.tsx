import { useState } from "react";
import { bangkokLocalToISO, isoToBangkokLocal } from "@/lib/event-rules";
import { eventInput, type Event } from "@/lib/contracts";
import { Field, Notice } from "./common";
export function EventForm({
  event,
  onSave,
  onBack,
  busy,
}: {
  event?: Event;
  onSave: (data: unknown) => void;
  onBack: () => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState(event?.payment_mode ?? "none");
  const [error, setError] = useState("");
  return (
    <form
      className="panel event-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) ?? "").trim();
        const body = {
          title: get("title"),
          description: get("description"),
          organizer_name: get("organizer_name"),
          contact_info: get("contact_info"),
          venue_name: get("venue_name"),
          venue_address: get("venue_address"),
          map_url: get("map_url") || null,
          announcement: get("announcement"),
          schedule: get("schedule"),
          contact_required: mode === "required" || f.has("contact_required"),
          max_attendees: get("max_attendees") ? Number(get("max_attendees")) : null,
          payment_mode: mode,
          bank_name: get("bank_name"),
          bank_account_name: get("bank_account_name"),
          bank_account_number: get("bank_account_number"),
          deposit_percent: Number(get("deposit_percent") || 30),
          deposit_hours: Number(get("deposit_hours") || 24),
          balance_due_at: get("balance_due_at") ? bangkokLocalToISO(get("balance_due_at")) : null,
          refund_policy: get("refund_policy"),
          starts_at: bangkokLocalToISO(get("starts_at")),
          ends_at: bangkokLocalToISO(get("ends_at")),
          booking_opens_at: bangkokLocalToISO(get("booking_opens_at")),
          booking_closes_at: bangkokLocalToISO(get("booking_closes_at")),
          cancel_deadline: get("cancel_deadline")
            ? bangkokLocalToISO(get("cancel_deadline"))
            : null,
        };
        const result = eventInput.safeParse(body);
        if (!result.success) {
          setError(result.error.issues.map((i) => i.message).join(" • "));
          return;
        }
        setError("");
        onSave(result.data);
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">EVENT DETAILS</span>
          <h2>{event ? "แก้ไขรายละเอียดงาน" : "เริ่มต้นงานเลี้ยงของคุณ"}</h2>
        </div>
        <button type="button" className="button secondary" onClick={onBack}>
          กลับ
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      <fieldset disabled={busy}>
        <div className="form-grid">
          <Field label="ชื่องาน *">
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={event?.title}
              placeholder="เช่น งานเลี้ยงขอบคุณประจำปี"
            />
          </Field>
          <Field label="ชื่อผู้จัด / หน่วยงาน">
            <input name="organizer_name" maxLength={200} defaultValue={event?.organizer_name} />
          </Field>
        </div>
        <Field label="รายละเอียดงาน">
          <textarea name="description" maxLength={5000} defaultValue={event?.description} />
        </Field>
        <h3>วันเวลา · เวลาไทย (GMT+7)</h3>
        <div className="form-grid">
          {(
            [
              ["starts_at", "เริ่มงาน *"],
              ["ends_at", "สิ้นสุดงาน *"],
              ["booking_opens_at", "เปิดรับจอง *"],
              ["booking_closes_at", "ปิดรับจอง *"],
              ["cancel_deadline", "กำหนดขอยกเลิก"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="datetime-local"
                name={key}
                required={key !== "cancel_deadline"}
                defaultValue={isoToBangkokLocal(event?.[key])}
              />
            </Field>
          ))}
          <Field label="จำนวนผู้ร่วมงานสูงสุด">
            <input
              type="number"
              name="max_attendees"
              min={1}
              max={100000}
              defaultValue={event?.max_attendees ?? ""}
              placeholder="ไม่ระบุ = ตามความจุโต๊ะ"
            />
          </Field>
        </div>
        <h3>สถานที่และการติดต่อ</h3>
        <div className="form-grid">
          <Field label="ชื่อสถานที่">
            <input name="venue_name" maxLength={200} defaultValue={event?.venue_name} />
          </Field>
          <Field label="ช่องทางติดต่อผู้จัด">
            <input name="contact_info" maxLength={500} defaultValue={event?.contact_info} />
          </Field>
          <Field label="ที่อยู่">
            <input name="venue_address" maxLength={1000} defaultValue={event?.venue_address} />
          </Field>
          <Field label="ลิงก์แผนที่ (https://…)">
            <input name="map_url" type="url" defaultValue={event?.map_url ?? ""} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="ประกาศ / การแต่งกาย">
            <textarea name="announcement" maxLength={3000} defaultValue={event?.announcement} />
          </Field>
          <Field label="กำหนดการ">
            <textarea name="schedule" maxLength={5000} defaultValue={event?.schedule} />
          </Field>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" name="contact_required" defaultChecked={event?.contact_required} />
          ให้ลูกค้ากรอกช่องทางติดต่อก่อนจอง
        </label>
        <h3>การรับเงินของผู้จัด</h3>
        <Field label="รูปแบบงาน">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="none">ไม่เก็บเงิน</option>
            <option value="required">โอนเงินต่อโต๊ะ · มัดจำและยอดคงเหลือ</option>
          </select>
        </Field>
        {mode === "required" && (
          <>
            <div className="form-grid">
              <Field label="ธนาคาร">
                <input name="bank_name" required maxLength={100} defaultValue={event?.bank_name} />
              </Field>
              <Field label="ชื่อบัญชี">
                <input
                  name="bank_account_name"
                  required
                  maxLength={200}
                  defaultValue={event?.bank_account_name}
                />
              </Field>
              <Field label="เลขบัญชี">
                <input
                  name="bank_account_number"
                  required
                  pattern="[0-9 -]{8,30}"
                  maxLength={30}
                  defaultValue={event?.bank_account_number}
                />
              </Field>
              <Field label="มัดจำ (%)">
                <input
                  name="deposit_percent"
                  type="number"
                  required
                  min={1}
                  max={100}
                  defaultValue={event?.deposit_percent ?? 30}
                />
              </Field>
              <Field label="ชำระมัดจำภายใน (ชั่วโมง)">
                <input
                  name="deposit_hours"
                  type="number"
                  required
                  min={1}
                  max={720}
                  defaultValue={event?.deposit_hours ?? 24}
                />
              </Field>
              <Field label="กำหนดชำระส่วนที่เหลือ · เวลาไทย">
                <input
                  name="balance_due_at"
                  type="datetime-local"
                  required
                  defaultValue={isoToBangkokLocal(event?.balance_due_at)}
                />
              </Field>
            </div>
            <Field label="เงื่อนไขยกเลิกและคืนเงิน">
              <textarea
                name="refund_policy"
                required
                minLength={5}
                maxLength={3000}
                defaultValue={event?.refund_policy}
                placeholder="ระบุเงื่อนไข จำนวนเงินที่คืน และระยะเวลาคืนให้ชัดเจน"
              />
            </Field>
            <Notice>
              ตรวจสอบบัญชีรับเงินก่อนเผยแพร่ แล้วตั้งราคาแต่ละโต๊ะในผัง •
              ผู้จัดตรวจเงินเข้าบัญชีและยืนยันสลิปเอง การจองเกินกำหนดจะยังกันโต๊ะจนผู้จัดยกเลิก
            </Notice>
          </>
        )}
        <Notice>บัญชีและเงื่อนไขที่แก้ไขมีผลต่อการจองใหม่เท่านั้น</Notice>
        <button className="button primary" disabled={busy}>
          {busy ? "กำลังบันทึก…" : event ? "บันทึกการแก้ไข" : "สร้างร่างงาน"}
        </button>
      </fieldset>
    </form>
  );
}
