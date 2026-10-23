import { EventSchedule } from "./event-schedule";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { z } from "zod";
import { BankPicker } from "./bank-picker";
import { useState, useRef } from "react";
import { bangkokLocalToISO, formatThaiDateTime } from "@/lib/event-rules";
import { eventInput, type Event } from "@/lib/contracts";
import { Field, Notice, FieldErrors } from "./common";
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<z.infer<typeof eventInput> | null>(null);
  const dirty = useRef(false);
  const attempted = useRef(false);
  const touched = useRef(new Set<string>());
  function validate(form: HTMLFormElement) {
    const f = new FormData(form);
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
      cancel_deadline: get("cancel_deadline") ? bangkokLocalToISO(get("cancel_deadline")) : null,
    };
    const result = eventInput.safeParse(body);
    const next: Record<string, string> = {};
    if (!result.success)
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key])
          next[key] = issue.code === "custom" ? issue.message : "กรุณากรอกข้อมูลให้ครบและถูกต้อง";
      }
    for (const el of Array.from(form.elements)) {
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) ||
        !el.name ||
        el.disabled
      )
        continue;
      if (el.validity.valueMissing) next[el.name] = "กรุณากรอกช่องนี้";
      else if (el.validity.rangeUnderflow || el.validity.rangeOverflow)
        next[el.name] = `กรอกค่าระหว่าง ${el.getAttribute("min")} ถึง ${el.getAttribute("max")}`;
      else if (el.validity.stepMismatch) next[el.name] = "กรุณากรอกจำนวนเต็ม";
      else if (el.validity.typeMismatch || el.validity.badInput || el.validity.patternMismatch)
        next[el.name] = "รูปแบบข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    }
    if (next["balance_due_at"] && body.booking_closes_at && body.starts_at)
      next["balance_due_at"] =
        `เลือกวันชำระตั้งแต่ ${formatThaiDateTime(body.booking_closes_at)} ถึง ${formatThaiDateTime(body.starts_at)} หากต้องการรับจองต่อให้ปรับวันหยุดรับจองด้วย`;
    if (next["booking_closes_at"] && body.booking_opens_at && body.ends_at)
      next["booking_closes_at"] =
        `เลือกเวลาหยุดรับจองหลัง ${formatThaiDateTime(body.booking_opens_at)} และไม่เกิน ${formatThaiDateTime(body.ends_at)}`;
    setErrors(
      attempted.current
        ? next
        : Object.fromEntries(Object.entries(next).filter(([k]) => touched.current.has(k))),
    );
    return { result, next };
  }
  return (
    <FieldErrors.Provider value={errors}>
      <form
        noValidate
        className="panel event-form"
        onBlur={(e) => {
          const el = e.target as unknown as HTMLInputElement;
          const field =
            el.name || el.closest<HTMLElement>("[data-field-name]")?.dataset["fieldName"];
          if (field) {
            touched.current.add(field);
            validate(e.currentTarget);
          }
        }}
        onChange={(e) => {
          dirty.current = true;
          setReview(null);
          const form = e.currentTarget;
          queueMicrotask(() => {
            if (form.isConnected) validate(form);
          });
        }}
        onSubmit={(e) => {
          e.preventDefault();
          attempted.current = true;
          const { result, next } = validate(e.currentTarget);
          if (Object.keys(next).length || !result.success) {
            const first = Object.keys(next)[0];
            const target = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "[data-field-name], [name]:not([type=hidden])",
              ),
            ).find((el) => el.getAttribute("name") === first || el.dataset["fieldName"] === first);
            target?.focus();
            target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
            return;
          }
          setReview(result.data);
        }}
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">EVENT DETAILS</span>
            <h2>{event ? "แก้ไขรายละเอียดงาน" : "เริ่มต้นงานเลี้ยงของคุณ"}</h2>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              if (
                !dirty.current ||
                window.confirm("ยังไม่ได้บันทึกการแก้ไข ต้องการออกจากหน้านี้หรือไม่?")
              )
                onBack();
            }}
          >
            กลับ
          </button>
        </div>
        {!!Object.keys(errors).length && (
          <Notice error>กรุณาตรวจช่องที่มีกรอบสีแดง {Object.keys(errors).length} ช่อง</Notice>
        )}
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
          <EventSchedule event={event} paid={mode === "required"} />
          <div className="form-grid">
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
            <input
              type="checkbox"
              name="contact_required"
              defaultChecked={event?.contact_required}
            />
            ให้ลูกค้ากรอกช่องทางติดต่อก่อนจอง
          </label>
          <h3>การรับเงินของผู้จัด</h3>
          <Field label="รูปแบบงาน">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setErrors({});
                attempted.current = false;
                touched.current.clear();
              }}
            >
              <option value="none">ไม่เก็บเงิน</option>
              <option value="required">โอนเงินต่อโต๊ะ · มัดจำและยอดคงเหลือ</option>
            </select>
          </Field>
          {mode === "required" && (
            <>
              <div className="form-grid">
                <Field label="ธนาคาร">
                  <BankPicker
                    name="bank_name"
                    defaultValue={event?.bank_name ?? ""}
                    disabled={busy}
                  />
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
      <AlertDialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
      >
        <AlertDialogContent className="event-review">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ตรวจรายละเอียดก่อน{event ? "บันทึกการแก้ไข" : "สร้างงาน"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              ตรวจวันเวลาและบัญชีรับเงินอีกครั้ง หากยังไม่ถูกต้องให้กลับไปแก้ไข
            </AlertDialogDescription>
          </AlertDialogHeader>
          {review && (
            <div className="review-details">
              <strong>{review.title}</strong>
              <dl>
                <dt>เริ่มงาน</dt>
                <dd>{formatThaiDateTime(review.starts_at)}</dd>
                <dt>เลิกงาน</dt>
                <dd>{formatThaiDateTime(review.ends_at)}</dd>
                <dt>เริ่มรับจองได้ตั้งแต่</dt>
                <dd>{formatThaiDateTime(review.booking_opens_at)} (ต้องเผยแพร่งานก่อน)</dd>
                <dt>หยุดรับจอง</dt>
                <dd>{formatThaiDateTime(review.booking_closes_at)}</dd>
                <dt>ขอยกเลิกได้ถึง</dt>
                <dd>
                  {review.cancel_deadline
                    ? formatThaiDateTime(review.cancel_deadline)
                    : "ไม่กำหนดวันสุดท้าย"}
                </dd>
                {review.payment_mode === "required" ? (
                  <>
                    <dt>บัญชีรับเงิน</dt>
                    <dd>
                      {review.bank_name} · {review.bank_account_name} · {review.bank_account_number}
                    </dd>
                    <dt>มัดจำ</dt>
                    <dd>
                      {review.deposit_percent}% ภายใน {review.deposit_hours} ชั่วโมงหลังจอง
                    </dd>
                    <dt>จ่ายส่วนที่เหลือภายใน</dt>
                    <dd>{formatThaiDateTime(review.balance_due_at)}</dd>
                  </>
                ) : (
                  <>
                    <dt>การชำระเงิน</dt>
                    <dd>ไม่เก็บเงิน</dd>
                  </>
                )}
              </dl>
              {event?.status === "published" && (
                <p>
                  งานนี้เผยแพร่แล้ว การแก้ไขจะเปลี่ยนข้อมูลที่ผู้จองใหม่เห็น กรุณาตรวจสอบก่อนยืนยัน
                </p>
              )}
              {!event && <p>บันทึกเป็นร่างก่อน ยังไม่เปิดให้ลูกค้าจอง</p>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>กลับไปแก้ไข</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                if (review) {
                  onSave(review);
                  setReview(null);
                }
              }}
            >
              ยืนยันบันทึก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FieldErrors.Provider>
  );
}
