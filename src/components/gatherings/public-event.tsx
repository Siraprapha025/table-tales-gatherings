import { useEffect, useRef, useState } from "react";
import { CalendarDays, MapPin, Users, ArrowRight, RefreshCw } from "lucide-react";
import { api, newManageToken } from "@/lib/api-client";
import type { PublicEvent as EventData } from "@/lib/contracts";
import { formatThaiDateTime, formatBaht, guestCountFits } from "@/lib/event-rules";
import { demoEvent } from "@/lib/demo-event";
import { Empty, Field, Notice, Share, Shell } from "./common";
import { TableMap } from "./table-map";

export function PublicEventPage({ slug, preview = false }: { slug: string; preview?: boolean }) {
  const [event, setEvent] = useState<EventData | null>(preview ? demoEvent : null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState({
    guest_name: "",
    guest_count: 1,
    organization: "",
    contact: "",
  });
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState<{ code: string; url: string } | null>(null);
  const attempt = useRef<{ body: string; key: string; token: string } | null>(null);
  async function load() {
    try {
      setEvent(await api<EventData>(`/public/events/${encodeURIComponent(slug)}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (preview) return;
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [slug, preview]);
  useEffect(() => {
    if (!event) return;
    const available = new Set(event.tables.filter((t) => t.state === "available").map((t) => t.id));
    const next = selected.filter((id) => available.has(id));
    if (next.length !== selected.length) {
      setSelected(next);
      setReview(false);
    }
  }, [event, selected]);
  const tables = event?.tables.filter((t) => selected.includes(t.id)) ?? [];
  const total =
    event?.payment_mode === "required" ? tables.reduce((n, t) => n + t.price_satang, 0) : 0;
  const quote = JSON.stringify([event?.version, ...tables.map((t) => [t.id, t.price_satang])]);
  useEffect(() => {
    setReview(false);
  }, [quote]);
  const capacity = tables.reduce((n, t) => n + t.capacity, 0);
  const selectable = !!event?.booking_open && !preview;
  async function book() {
    if (!event) return;
    setBusy(true);
    setError("");
    const body = {
      slug,
      table_ids: [...selected].sort(),
      expected_total_satang: total,
      expected_event_version: event.version,
      ...guest,
    };
    const serialized = JSON.stringify(body);
    if (!attempt.current || attempt.current.body !== serialized)
      attempt.current = { body: serialized, key: crypto.randomUUID(), token: newManageToken() };
    const a = attempt.current;
    try {
      const result = await api<{ code: string }>("/bookings", {
        method: "POST",
        body,
        requestId: a.key,
        manageToken: a.token,
      });
      setReceipt({ code: result.code, url: `${window.location.origin}/booking#${a.token}` });
      setSelected([]);
      setReview(false);
      attempt.current = null;
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <main className="page public-page">
        {preview && (
          <Notice>ตัวอย่างหน้าจอ • ข้อมูลสมมติสำหรับดูรูปแบบ ยังไม่รับจองและไม่บันทึกข้อมูล</Notice>
        )}
        {error && (
          <Notice error>
            {error}{" "}
            <button className="text-button" onClick={() => void load()}>
              ลองใหม่
            </button>
          </Notice>
        )}
        {!event ? (
          <Empty>กำลังโหลดรายละเอียดงาน…</Empty>
        ) : (
          <>
            <div className="event-hero">
              <div className="hero-copy">
                <span className="eyebrow">A SEAT FOR EVERY STORY</span>
                <span className="status-pill">
                  {preview
                    ? "งานตัวอย่าง"
                    : event.booking_open
                      ? "เปิดรับจอง"
                      : "ยังไม่เปิด / ปิดรับจอง"}
                </span>
                <h1>{event.title}</h1>
                <p>{event.description}</p>
                <div className="hero-meta">
                  <span>
                    <CalendarDays size={18} />
                    {formatThaiDateTime(event.starts_at)}
                  </span>
                  <span>
                    <MapPin size={18} />
                    {event.venue_name}
                  </span>
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="art-table">
                  <span>
                    พร้อม
                    <br />
                    <b>พบกัน</b>
                  </span>
                </div>
                <span className="art-caption">GOOD FOOD. GREAT COMPANY.</span>
              </div>
            </div>
            <div className="stats">
              <div>
                <span>โต๊ะทั้งหมด</span>
                <strong>
                  {event.tables.length}
                  <small> โต๊ะ</small>
                </strong>
              </div>
              <div>
                <span>พร้อมให้จอง</span>
                <strong>
                  {event.tables.filter((t) => t.state === "available").length}
                  <small> โต๊ะ</small>
                </strong>
              </div>
              <div>
                <span>ผู้ร่วมงานที่จองแล้ว</span>
                <strong>
                  {event.booked_attendees}
                  <small>{event.max_attendees ? ` / ${event.max_attendees} คน` : " คน"}</small>
                </strong>
              </div>
            </div>
            {receipt ? (
              <section className="panel receipt">
                <span className="eyebrow">RESERVATION</span>
                <h2>
                  {event.payment_mode === "required"
                    ? "บันทึกการจองแล้ว · รอชำระมัดจำ"
                    : "จองโต๊ะเรียบร้อยแล้ว"}
                </h2>
                <p>
                  รหัสการจอง <strong className="booking-code">{receipt.code}</strong>
                </p>
                <Notice>
                  บันทึกลิงก์ส่วนตัวนี้ไว้ ใช้ดูรายละเอียดและขอยกเลิก ห้ามส่งต่อให้ผู้อื่น
                </Notice>
                <Share url={receipt.url} label="ลิงก์จัดการการจองส่วนตัว" />
                <a className="button primary" href={receipt.url}>
                  ดูการจองของฉัน <ArrowRight size={16} />
                </a>
              </section>
            ) : (
              <div className="booking-layout">
                <TableMap
                  tables={event.tables}
                  selected={selected}
                  onSelect={(t) => {
                    if (!selectable) return;
                    setSelected((s) =>
                      s.includes(t.id) ? s.filter((id) => id !== t.id) : [...s, t.id],
                    );
                    setReview(false);
                  }}
                />
                <aside className="panel booking-form">
                  <div className="section-heading">
                    <h2>การจองของคุณ</h2>
                    <Users size={20} />
                  </div>
                  <p className="muted">
                    {selected.length
                      ? `เลือก ${selected.length} โต๊ะ • รองรับ ${capacity} คน`
                      : "เลือกโต๊ะจากผังเพื่อเริ่มจอง"}
                  </p>
                  <div className="selected-tags">
                    {tables.map((t) => (
                      <span key={t.id}>{t.name || `โต๊ะ ${t.number}`}</span>
                    ))}
                  </div>
                  {!selectable && (
                    <Notice>
                      {preview
                        ? "ตัวอย่างผังเท่านั้น หากต้องการรับจองจริง ให้ผู้จัดการสร้างและเผยแพร่งาน"
                        : "งานนี้ยังไม่เปิดรับจองหรือปิดรับจองแล้ว"}
                    </Notice>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (
                        !guestCountFits(
                          guest.guest_count,
                          tables.map((t) => t.capacity),
                        )
                      ) {
                        setError("กรุณาเลือกโต๊ะให้เพียงพอกับจำนวนคน");
                        return;
                      }
                      setError("");
                      setReview(true);
                    }}
                  >
                    <fieldset disabled={busy || !selectable || review}>
                      <Field label="ชื่อผู้จอง *">
                        <input
                          required
                          maxLength={120}
                          value={guest.guest_name}
                          onChange={(e) => setGuest({ ...guest, guest_name: e.target.value })}
                          placeholder="ชื่อ–นามสกุล"
                        />
                      </Field>
                      <Field label="จำนวนผู้ร่วมงาน *">
                        <input
                          type="number"
                          required
                          min={1}
                          max={capacity || 1}
                          value={guest.guest_count}
                          onChange={(e) =>
                            setGuest({ ...guest, guest_count: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="หน่วยงาน / บริษัท">
                        <input
                          maxLength={200}
                          list="organizations"
                          value={guest.organization}
                          onChange={(e) => setGuest({ ...guest, organization: e.target.value })}
                        />
                        <datalist id="organizations">
                          {event.organizations.map((o) => (
                            <option key={o} value={o} />
                          ))}
                        </datalist>
                      </Field>
                      <Field
                        label={`ช่องทางติดต่อ${event.contact_required ? " *" : " (ไม่บังคับ)"}`}
                      >
                        <input
                          required={event.contact_required}
                          maxLength={200}
                          value={guest.contact}
                          onChange={(e) => setGuest({ ...guest, contact: e.target.value })}
                        />
                      </Field>
                    </fieldset>
                    <div className="booking-total">
                      <span>ค่าใช้จ่าย</span>
                      <strong>
                        {event.payment_mode === "required" ? formatBaht(total) : "ไม่เก็บเงิน"}
                      </strong>
                    </div>
                    {event.payment_mode === "required" && (
                      <Notice>
                        {tables.map((t) => (
                          <p key={t.id}>
                            โต๊ะ {t.number}: {formatBaht(t.price_satang)}
                          </p>
                        ))}
                        มัดจำ {event.deposit_percent}% ={" "}
                        {formatBaht(Math.ceil((total * event.deposit_percent) / 100))} ภายใน{" "}
                        {event.deposit_hours} ชั่วโมง (ไม่เกินกำหนดชำระส่วนที่เหลือ)
                        <p>ชำระส่วนที่เหลือภายใน {formatThaiDateTime(event.balance_due_at)}</p>
                        <p className="pre-line">{event.refund_policy}</p>
                        <p>แนบสลิปหลังจอง ผู้จัดยืนยันเมื่อได้รับเงินเข้าบัญชี</p>
                        <label>
                          <input type="checkbox" required /> ยอมรับราคาและเงื่อนไขยกเลิก / คืนเงิน
                        </label>
                      </Notice>
                    )}
                    {review ? (
                      <div className="review">
                        <p>
                          ยืนยันการจองในชื่อ <b>{guest.guest_name}</b> จำนวน {guest.guest_count} คน
                          สำหรับโต๊ะ {tables.map((t) => t.number).join(", ")}
                        </p>
                        <button
                          type="button"
                          className="button primary full"
                          disabled={busy}
                          onClick={(e) => {
                            if (e.currentTarget.form?.reportValidity()) void book();
                          }}
                        >
                          {busy ? "กำลังจอง…" : "ยืนยันการจอง"}
                        </button>
                        <button
                          type="button"
                          className="button secondary full"
                          disabled={busy}
                          onClick={() => setReview(false)}
                        >
                          กลับไปแก้ไข
                        </button>
                      </div>
                    ) : (
                      <button
                        className="button primary full"
                        disabled={!selectable || !selected.length}
                      >
                        ตรวจสอบการจอง <ArrowRight size={17} />
                      </button>
                    )}
                  </form>
                  <small className="muted">
                    การเลือกโต๊ะยังไม่กันโต๊ะ ระบบจะตรวจความว่างอีกครั้งเมื่อยืนยัน
                  </small>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (!preview) void load();
                    }}
                  >
                    <RefreshCw size={14} /> อัปเดตข้อมูล
                  </button>
                </aside>
              </div>
            )}
            <div className="detail-grid">
              <section className="panel">
                <h2>รายละเอียดงาน</h2>
                <p className="pre-line">{event.announcement || "ไม่มีประกาศเพิ่มเติม"}</p>
                <dl>
                  <dt>จัดโดย</dt>
                  <dd>{event.organizer_name || "-"}</dd>
                  <dt>เริ่ม–สิ้นสุด</dt>
                  <dd>
                    {formatThaiDateTime(event.starts_at)} – {formatThaiDateTime(event.ends_at)}
                  </dd>
                  <dt>รับจองถึง</dt>
                  <dd>{formatThaiDateTime(event.booking_closes_at)}</dd>
                  <dt>ขอยกเลิกได้ถึง</dt>
                  <dd>{formatThaiDateTime(event.cancel_deadline)}</dd>
                  <dt>ติดต่อ</dt>
                  <dd>{event.contact_info || "-"}</dd>
                </dl>
              </section>
              <section className="panel">
                <h2>กำหนดการและสถานที่</h2>
                <p className="pre-line">{event.schedule || "ยังไม่ระบุกำหนดการ"}</p>
                <h3>{event.venue_name}</h3>
                <p className="muted">{event.venue_address}</p>
                {event.map_url && /^https?:\/\//i.test(event.map_url) && (
                  <>
                    <a
                      className="button secondary"
                      href={event.map_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={16} /> เปิดแผนที่
                    </a>
                    <Share url={event.map_url} label="QR สถานที่จัดงาน" />
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}
