import { useContext, useId, useState } from "react";
import type { Event } from "@/lib/contracts";
import { bangkokLocalToISO, isoToBangkokLocal, formatThaiDateTime } from "@/lib/event-rules";
import { FieldErrors } from "./common";
export const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const pad = (n: number) => String(n).padStart(2, "0");
export function shiftDay(date: string, days: number) {
  if (!date) return "";
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(+d)) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function spokenTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return "";
  const nums = [
    "ศูนย์",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
    "สิบ",
    "สิบเอ็ด",
  ];
  const base =
    h === 0
      ? "เที่ยงคืน"
      : h < 6
        ? `ตี${nums[h]}`
        : h < 12
          ? `${nums[h]}โมงเช้า`
          : h === 12
            ? "เที่ยงวัน"
            : h < 16
              ? `บ่าย${nums[h - 12]}โมง`
              : h < 19
                ? `${nums[h - 12]}โมงเย็น`
                : h === 19
                  ? "หนึ่งทุ่ม"
                  : `${nums[h - 18]}ทุ่ม`;
  return base + (m ? ` ${m} นาที` : "");
}
export function ThaiDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [year = "", month = "", day = ""] = value.split("-");
  const current = new Date().getFullYear();
  const years = Array.from(
    new Set([
      ...(year ? [Number(year)] : []),
      ...Array.from({ length: 12 }, (_, i) => current - 1 + i),
    ]),
  ).sort((a, b) => a - b);
  const change = (y: string, mo: string, d: string) => onChange(`${y}-${mo}-${d}`);
  return (
    <div className="thai-date-parts">
      <select
        aria-label={`${label} วันที่`}
        value={day}
        onChange={(e) => change(year, month, e.target.value)}
      >
        <option value="">วัน</option>
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i} value={pad(i + 1)}>
            {i + 1}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} เดือน`}
        value={month}
        onChange={(e) => change(year, e.target.value, day)}
      >
        <option value="">เดือน</option>
        {thaiMonths.map((m, i) => (
          <option key={m} value={pad(i + 1)}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} ปี พ.ศ.`}
        value={year}
        onChange={(e) => change(e.target.value, month, day)}
      >
        <option value="">ปี พ.ศ.</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y + 543}
          </option>
        ))}
      </select>
    </div>
  );
}
export function ThaiTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [h = "08", m = "00"] = value.split(":");
  return (
    <div>
      <div className="thai-time-parts">
        <select
          aria-label={`${label} ชั่วโมง`}
          value={h}
          onChange={(e) => onChange(`${e.target.value}:${m}`)}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
        <span>:</span>
        <select
          aria-label={`${label} นาที`}
          value={m}
          onChange={(e) => onChange(`${h}:${e.target.value}`)}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
        <span>น.</span>
      </div>
      <small className="time-reading">{spokenTime(value)}</small>
    </div>
  );
}
function ScheduleField({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
}) {
  const errors = useContext(FieldErrors);
  const id = useId();
  return (
    <fieldset
      className={`schedule-field ${errors[name] ? "field-invalid" : ""}`}
      data-field-name={name}
      tabIndex={-1}
      aria-invalid={!!errors[name]}
      aria-describedby={errors[name] ? id : undefined}
    >
      <legend>{label}</legend>
      {children}
      {errors[name] && (
        <p id={id} className="field-error" role="alert">
          ⚠ {errors[name]}
        </p>
      )}
    </fieldset>
  );
}
function CustomDateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [d = "", t = "08:00"] = value.split("T");
  return (
    <>
      <ThaiDate label={label} value={d} onChange={(v) => onChange(v + "T" + t)} />
      <ThaiTime label={label} value={t} onChange={(v) => onChange(d + "T" + v)} />
    </>
  );
}
export function EventSchedule({ event, paid }: { event?: Event | undefined; paid: boolean }) {
  const initialStart = isoToBangkokLocal(event?.starts_at),
    initialEnd = isoToBangkokLocal(event?.ends_at);
  const [date, setDate] = useState(initialStart.slice(0, 10)),
    [startTime, setStartTime] = useState(initialStart.slice(11) || "08:00"),
    [endTime, setEndTime] = useState(initialEnd.slice(11) || "12:00");
  const [endMode, setEndMode] = useState(
    initialEnd && initialEnd.slice(0, 10) !== initialStart.slice(0, 10) ? "custom" : "same",
  );
  const [endDate, setEndDate] = useState(initialEnd.slice(0, 10));
  const [opened] = useState(() => isoToBangkokLocal(new Date().toISOString()));
  const [openMode, setOpenMode] = useState(event ? "custom" : "now"),
    [closeMode, setCloseMode] = useState(event ? "custom" : "1"),
    [cancelMode, setCancelMode] = useState(
      event ? (event.cancel_deadline ? "custom" : "none") : "close",
    ),
    [dueMode, setDueMode] = useState(event?.balance_due_at ? "custom" : "start");
  const [customOpen, setCustomOpen] = useState(isoToBangkokLocal(event?.booking_opens_at)),
    [customClose, setCustomClose] = useState(isoToBangkokLocal(event?.booking_closes_at)),
    [customCancel, setCustomCancel] = useState(isoToBangkokLocal(event?.cancel_deadline)),
    [customDue, setCustomDue] = useState(isoToBangkokLocal(event?.balance_due_at));
  const start = `${date}T${startTime}`,
    end = `${endMode === "same" ? date : endMode === "next" ? shiftDay(date, 1) : endDate}T${endTime}`;
  const open = openMode === "now" ? opened : customOpen,
    close =
      closeMode === "custom" ? customClose : `${shiftDay(date, -Number(closeMode))}T${startTime}`,
    cancel = cancelMode === "none" ? "" : cancelMode === "close" ? close : customCancel,
    due =
      dueMode === "custom"
        ? customDue
        : dueMode === "start"
          ? start
          : `${shiftDay(date, -1)}T${startTime}`;
  const display = (s: string) => {
    const iso = bangkokLocalToISO(s);
    return iso ? formatThaiDateTime(iso) : "กรุณาเลือกวันให้ครบและถูกต้อง";
  };
  const startISO = bangkokLocalToISO(start),
    endISO = bangkokLocalToISO(end);
  const hours = startISO && endISO ? (Date.parse(endISO) - Date.parse(startISO)) / 3600000 : 0;
  return (
    <section className="event-schedule">
      <h3>วันและเวลาจัดงาน</h3>
      <p className="muted">เลือกวัน เดือน ปี พ.ศ. และเวลาไทยแบบ 24 ชั่วโมง</p>
      <ScheduleField name="starts_at" label="งานจัดวันไหน และเริ่มกี่โมง? *">
        <ThaiDate label="วันจัดงาน" value={date} onChange={setDate} />
        <ThaiTime label="เริ่มงาน" value={startTime} onChange={setStartTime} />
      </ScheduleField>
      <ScheduleField name="ends_at" label="งานเลิกกี่โมง? *">
        <ThaiTime label="เลิกงาน" value={endTime} onChange={setEndTime} />
        <select
          aria-label="วันเลิกงาน"
          value={endMode}
          onChange={(e) => setEndMode(e.target.value)}
        >
          <option value="same">เลิกวันเดียวกับวันจัดงาน</option>
          <option value="next">เลิกวันถัดไป (งานข้ามคืน)</option>
          <option value="custom">เลือกวันเลิกงานเอง</option>
        </select>
        {endMode === "custom" && (
          <ThaiDate label="วันเลิกงาน" value={endDate} onChange={setEndDate} />
        )}
        {hours <= 0 && startISO && endISO && (
          <p className="schedule-tip">
            เวลาเลิกอยู่ก่อนหรือเท่ากับเวลาเริ่ม ถ้าเป็นงานข้ามคืนให้เลือก “เลิกวันถัดไป”
          </p>
        )}
      </ScheduleField>
      <div className="schedule-summary" aria-live="polite">
        <strong>
          งานของคุณ: {display(start)} ถึง {display(end)}
        </strong>
        {hours > 0 && (
          <p>
            ระยะเวลา {Math.floor(hours)} ชั่วโมง {Math.round((hours % 1) * 60)} นาที
          </p>
        )}
      </div>
      <h3>การจองและการยกเลิก</h3>
      <div className="form-grid">
        <ScheduleField name="booking_opens_at" label="เริ่มให้คนจองเมื่อไร?">
          <select
            aria-label="เริ่มให้คนจอง"
            value={openMode}
            onChange={(e) => setOpenMode(e.target.value)}
          >
            <option value="now">เริ่มเมื่อเผยแพร่งาน</option>
            <option value="custom">เลือกวันเวลาเอง</option>
          </select>
          {openMode === "custom" && (
            <CustomDateTime label="เปิดรับจอง" value={customOpen} onChange={setCustomOpen} />
          )}
          <small>
            {openMode === "now" ? "ยังไม่มีใครจองได้จนกว่าจะเผยแพร่งาน" : display(open)}
          </small>
        </ScheduleField>
        <ScheduleField name="booking_closes_at" label="หยุดรับจองเมื่อไร?">
          <select
            aria-label="หยุดรับจอง"
            value={closeMode}
            onChange={(e) => setCloseMode(e.target.value)}
          >
            <option value="1">ก่อนวันงาน 1 วัน</option>
            <option value="3">ก่อนวันงาน 3 วัน</option>
            <option value="0">ตอนเริ่มงาน</option>
            <option value="custom">เลือกวันเวลาเอง</option>
          </select>
          {closeMode === "custom" && (
            <CustomDateTime label="ปิดรับจอง" value={customClose} onChange={setCustomClose} />
          )}
          <small>{display(close)}</small>
        </ScheduleField>
        <ScheduleField name="cancel_deadline" label="ลูกค้าขอยกเลิกได้ถึงเมื่อไร?">
          <select
            aria-label="ขอยกเลิกได้ถึง"
            value={cancelMode}
            onChange={(e) => setCancelMode(e.target.value)}
          >
            <option value="close">วันเดียวกับที่หยุดรับจอง</option>
            <option value="custom">เลือกวันเวลาเอง</option>
            <option value="none">ไม่กำหนดวันสุดท้าย</option>
          </select>
          {cancelMode === "custom" && (
            <CustomDateTime label="กำหนดขอยกเลิก" value={customCancel} onChange={setCustomCancel} />
          )}
          <small>{cancel ? display(cancel) : "ยังต้องรอผู้จัดอนุมัติคำขอยกเลิก"}</small>
        </ScheduleField>
        {paid && (
          <ScheduleField name="balance_due_at" label="จ่ายเงินที่เหลือให้ครบเมื่อไร?">
            <select
              aria-label="จ่ายเงินที่เหลือให้ครบ"
              value={dueMode}
              onChange={(e) => setDueMode(e.target.value)}
            >
              <option value="start">ภายในเวลาเริ่มงาน</option>
              <option value="1">ก่อนวันงาน 1 วัน</option>
              <option value="custom">เลือกวันเวลาเอง</option>
            </select>
            {dueMode === "custom" && (
              <CustomDateTime label="ชำระส่วนที่เหลือ" value={customDue} onChange={setCustomDue} />
            )}
            <small>{display(due)}</small>
          </ScheduleField>
        )}
      </div>
      {Object.entries({
        starts_at: start,
        ends_at: end,
        booking_opens_at: open,
        booking_closes_at: close,
        cancel_deadline: cancel,
        balance_due_at: paid ? due : "",
      }).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </section>
  );
}
