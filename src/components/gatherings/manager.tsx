import { ManagerPayments } from "./payments";
import { bahtToSatang } from "@/lib/event-rules";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Plus,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  LogOut,
  Armchair,
  RefreshCw,
  Code2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api-client";
import type { Event, Table, Booking, Cancellation, PublicTable } from "@/lib/contracts";
import {
  BOOKING_STATUS_TH,
  CANCEL_STATUS_TH,
  EVENT_STATUS_TH,
  formatThaiDateTime,
} from "@/lib/event-rules";
import { Empty, Field, Notice, Share, Shell } from "./common";
import { EventForm } from "./event-form";
import { TableMap } from "./table-map";
import { ApiTester } from "./api-tester";

type Detail = {
  event: Event;
  tables: Table[];
  bookings: Booking[];
  cancellations: Cancellation[];
  bookingTables: { booking_id: string; table_id: string; table_number: number; active: boolean }[];
  summary: Record<string, number>;
};
export function ManagerPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [view, setView] = useState<"list" | "create" | "detail" | "edit" | "api">("list");
  const [tab, setTab] = useState("layout");
  const [developer, setDeveloper] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [query, setQuery] = useState("");
  const accessToken = session?.access_token ?? "";
  useEffect(() => {
    let live = true;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        if (live) {
          setSession(s);
          setReady(true);
        }
      });
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (live) {
            if (error) setError(error.message);
            setSession(data.session);
            setReady(true);
          }
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            setReady(true);
          }
        });
      return () => {
        live = false;
        data.subscription.unsubscribe();
      };
    } catch (e) {
      setError("ยังไม่ได้ตั้งค่า Supabase กรุณาดู README เพื่อเริ่มใช้งาน หรือเปิดหน้าตัวอย่าง");
      setReady(true);
      return () => {
        live = false;
      };
    }
  }, []);
  async function loadList() {
    const list = await api<Event[]>("/manager/events", { accessToken });
    setEvents(list);
  }
  async function loadDetail(id: string) {
    const d = await api<Detail>(`/manager/events/${id}`, { accessToken });
    setDetail(d);
    return d;
  }
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setDetail(null);
    setEvents([]);
    setView("list");
    setDeveloper(false);
    if (!accessToken) return;
    void loadList().catch((e) => setError(e.message));
    void api<{ developer: boolean }>("/manager/developer", { accessToken })
      .then((v) => setDeveloper(v.developer))
      .catch(() => setDeveloper(false));
  }, [accessToken]);
  async function saveEvent(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    let saved: Event;
    try {
      saved = await api<Event>(
        detail && view === "edit" ? `/manager/events/${detail.event.id}` : "/manager/events",
        {
          method: detail && view === "edit" ? "PATCH" : "POST",
          body: detail && view === "edit" ? { event: body, version: detail.event.version } : body,
          accessToken,
        },
      );
    } catch (e) {
      setBusy(false);
      throw e;
    }
    // A successful write must not be presented as a failed save if refreshing the view fails.
    setView("list");
    setMessage("บันทึกงานแล้ว เพิ่มโต๊ะและเผยแพร่เพื่อรับจองได้เลย");
    try {
      await loadList();
      await loadDetail(saved.id);
      setView("detail");
    } catch {
      setError(
        "บันทึกงานสำเร็จแล้ว แต่โหลดหน้ารายการไม่สำเร็จ กรุณาอัปเดตรายการงาน ไม่ต้องสร้างงานซ้ำ",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updateTable(t: Table, changes: Partial<Table>) {
    const { number, name, zone, capacity, x, y, status } = t;
    await api(`/manager/events/${detail!.event.id}/tables/${t.id}`, {
      method: "PATCH",
      accessToken,
      body: {
        number,
        name,
        zone,
        capacity,
        x,
        y,
        status,
        price_satang: t.price_satang,
        ...changes,
      },
    });
    await loadDetail(detail!.event.id);
  }
  const ev = detail?.event;
  return (
    <Shell
      right={
        session ? (
          <>
            <span className="account-name">{session.user.email}</span>
            <button
              className="icon-button"
              aria-label="ออกจากระบบ"
              onClick={() =>
                void run(async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <a className="quiet-link" href="/demo">
            ดูตัวอย่างหน้าจอง <ArrowUpRight size={16} />
          </a>
        )
      }
    >
      <main className="page">
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        {!session ? (
          <div className="welcome-layout">
            <section className="welcome-copy">
              <span className="eyebrow">BRING EVERYONE TO THE TABLE</span>
              <h1>
                ทุกงานเลี้ยง
                <br />
                เริ่มจาก<span>ที่นั่งดี ๆ</span>
              </h1>
              <p>
                สร้างงาน จัดโต๊ะ และแชร์ลิงก์จอง
                <br />
                ให้ช่วงเวลาพิเศษของคุณเป็นเรื่องง่าย
              </p>
              <div className="welcome-points">
                <span>
                  <Armchair /> จัดผังโต๊ะได้เอง
                </span>
                <span>
                  <CalendarDays /> จัดการงานในที่เดียว
                </span>
                <span>
                  <ArrowUpRight /> แชร์ลิงก์พร้อมรับจอง
                </span>
              </div>
              <a className="button secondary" href="/demo">
                ดูตัวอย่างหน้าจอง <ArrowUpRight size={16} />
              </a>
            </section>
            <section className="panel login-panel">
              <span className="eyebrow">MANAGER SPACE</span>
              <h2>{signup ? "สร้างบัญชีผู้จัดการ" : "ยินดีต้อนรับกลับ"}</h2>
              <p className="muted">
                {signup
                  ? "เริ่มจัดงานของคุณ บัญชีใหม่ได้รับสิทธิ์ Manager"
                  : "เข้าสู่ระบบเพื่อจัดการงานเลี้ยงของคุณ"}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void run(async () => {
                    const credentials = {
                      email: String(form.get("email")).trim(),
                      password: String(form.get("password")),
                    };
                    if (signup) {
                      const { data, error } = await supabase.auth.signUp(credentials);
                      if (error) throw error;
                      setMessage(
                        data.session
                          ? "สร้างบัญชีแล้ว"
                          : "กรุณาตรวจอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ",
                      );
                    } else {
                      const { error } = await supabase.auth.signInWithPassword(credentials);
                      if (error) throw error;
                    }
                  });
                }}
              >
                <Field label="อีเมล">
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="รหัสผ่าน">
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={signup ? 8 : 1}
                    autoComplete={signup ? "new-password" : "current-password"}
                  />
                </Field>
                <button className="button primary full" disabled={!ready || busy}>
                  {busy ? "กำลังดำเนินการ…" : signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
                </button>
              </form>
              <button
                className="text-button"
                onClick={() => {
                  setSignup(!signup);
                  setError("");
                }}
              >
                {signup ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครเป็นผู้จัดการ"}
              </button>
              <p className="login-footnote">
                ลูกค้าไม่ต้องสมัครสมาชิก เปิดลิงก์จากผู้จัดการเพื่อจองได้เลย
              </p>
            </section>
          </div>
        ) : (
          <>
            <nav className="manager-nav">
              <button
                className={view === "list" ? "active" : ""}
                onClick={() => {
                  setView("list");
                  void run(loadList);
                }}
              >
                งานเลี้ยงของฉัน
              </button>
              {developer && (
                <button className={view === "api" ? "active" : ""} onClick={() => setView("api")}>
                  <Code2 size={16} /> API Test
                </button>
              )}
              <a href="/demo">
                ตัวอย่างหน้าจอง <ArrowUpRight size={14} />
              </a>
            </nav>
            {view === "list" && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR GATHERINGS</span>
                    <h1>งานเลี้ยงของฉัน</h1>
                    <p className="muted">สร้างช่วงเวลาที่น่าจดจำ แล้วให้เราช่วยดูแลที่นั่ง</p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => {
                      setDetail(null);
                      setView("create");
                    }}
                  >
                    <Plus size={18} /> สร้างงานเลี้ยง
                  </button>
                </div>
                {!events.length ? (
                  <Empty>
                    <Armchair size={40} />
                    <h2>พร้อมจัดงานแรกแล้วหรือยัง?</h2>
                    <p>เริ่มจากรายละเอียดงาน แล้วเพิ่มโต๊ะและแชร์ลิงก์จอง</p>
                    <button className="button primary" onClick={() => setView("create")}>
                      สร้างงานแรก
                    </button>
                  </Empty>
                ) : (
                  <div className="event-grid">
                    {events.map((e, i) => (
                      <button
                        key={e.id}
                        className="event-card"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await loadDetail(e.id);
                            setView("detail");
                            setTab("layout");
                            setEditTable(null);
                          })
                        }
                      >
                        <div className={`event-card-art tone-${i % 3}`}>
                          <span className="status-pill">{EVENT_STATUS_TH[e.status]}</span>
                          <Armchair size={76} strokeWidth={1} />
                          <span className="card-no">
                            GATHERING / {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="event-card-body">
                          <h2>{e.title}</h2>
                          <p>
                            <CalendarDays size={15} />
                            {formatThaiDateTime(e.starts_at)}
                          </p>
                          <p>
                            <MapPin size={15} />
                            {e.venue_name || "ยังไม่ระบุสถานที่"}
                          </p>
                          <div className="card-action">
                            จัดการงาน <ArrowUpRight size={19} />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="integration-list">
                  <span>
                    จองทั้งโต๊ะ ·{" "}
                    {ev?.payment_mode === "required" ? "โอนเงินให้ผู้จัด" : "ไม่เก็บเงิน"}
                  </span>
                  <span>LINE / AI / Payment: ยังไม่เชื่อมต่อ</span>
                </div>
              </>
            )}
            {(view === "create" || view === "edit") && (
              <EventForm
                {...(view === "edit" && ev ? { event: ev } : {})}
                busy={busy}
                onSave={saveEvent}
                onBack={() => setView(view === "edit" ? "detail" : "list")}
              />
            )}
            {view === "api" && developer && <ApiTester accessToken={accessToken} />}
            {view === "detail" && detail && ev && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="status-pill">{EVENT_STATUS_TH[ev.status]}</span>
                    <h1>{ev.title}</h1>
                    <p className="muted">
                      {formatThaiDateTime(ev.starts_at)} · {ev.venue_name}
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await loadDetail(ev.id);
                          setMessage("อัปเดตข้อมูลแล้ว");
                        })
                      }
                    >
                      <RefreshCw size={16} /> อัปเดต
                    </button>
                    <button className="button secondary" onClick={() => setView("edit")}>
                      แก้ไขงาน
                    </button>
                  </div>
                </div>
                <div className="stats">
                  <div>
                    <span>โต๊ะทั้งหมด</span>
                    <strong>{detail.tables.length}</strong>
                  </div>
                  <div>
                    <span>โต๊ะที่จองแล้ว</span>
                    <strong>{detail.summary["tables_booked"] ?? 0}</strong>
                  </div>
                  <div>
                    <span>ผู้เข้าร่วม</span>
                    <strong>
                      {detail.summary["guests_booked"] ?? 0}
                      <small> คน</small>
                    </strong>
                  </div>
                  <div>
                    <span>คำขอยกเลิกรอพิจารณา</span>
                    <strong>
                      {detail.cancellations.filter((c) => c.status === "pending").length}
                    </strong>
                  </div>
                </div>
                <nav className="detail-tabs">
                  {[
                    ["layout", "ผังโต๊ะ"],
                    ["bookings", "รายชื่อผู้จอง"],
                    ["cancellations", "คำขอยกเลิก"],
                    ["payments", "รับเงิน / คืนเงิน"],
                    ["share", "เผยแพร่และแชร์"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={tab === key ? "active" : ""}
                      onClick={() => setTab(key!)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                {tab === "layout" && (
                  <>
                    <div className="panel generator">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            const count = Number(f.get("count"));
                            const columns = Number(f.get("columns"));
                            const capacity = Number(f.get("capacity"));
                            const start = Math.max(0, ...detail.tables.map((t) => t.number)) + 1;
                            const tables = Array.from({ length: count }, (_, i) => ({
                              number: start + i,
                              name: `โต๊ะ ${start + i}`,
                              zone: String(f.get("zone") ?? ""),
                              capacity,
                              price_satang:
                                bahtToSatang(String(f.get("price") ?? "0")) ?? Number.NaN,
                              x: 50 + (i % columns) * 180,
                              y: 130 + Math.floor(i / columns) * 110,
                              status: "available",
                            }));
                            await api(`/manager/events/${ev.id}/tables`, {
                              method: "POST",
                              accessToken,
                              body: { tables },
                            });
                            await loadDetail(ev.id);
                            setMessage("เพิ่มโต๊ะแล้ว สามารถลากปรับตำแหน่งได้");
                          });
                        }}
                      >
                        <Field label="จำนวนโต๊ะ">
                          <input
                            name="count"
                            type="number"
                            defaultValue={20}
                            min={1}
                            max={30}
                            required
                          />
                        </Field>
                        <Field label="โต๊ะต่อแถว">
                          <input
                            name="columns"
                            type="number"
                            defaultValue={5}
                            min={1}
                            max={5}
                            required
                          />
                        </Field>
                        <Field label="คนต่อโต๊ะ">
                          <input
                            name="capacity"
                            type="number"
                            defaultValue={8}
                            min={1}
                            max={30}
                            required
                          />
                        </Field>
                        <Field label="ราคาต่อโต๊ะ (บาท)">
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            min={0}
                            max={1000000}
                            defaultValue={0}
                            required
                          />
                        </Field>
                        <Field label="โซน">
                          <input name="zone" placeholder="ทั่วไป / VIP" maxLength={100} />
                        </Field>
                        <button className="button primary" disabled={busy}>
                          <Plus size={16} /> เพิ่มโต๊ะ
                        </button>
                      </form>
                      <small className="muted">
                        ระบบจะตรวจพื้นที่ผัง หากแถวเกินพื้นที่ ให้ลดจำนวนโต๊ะหรือเพิ่มโต๊ะต่อแถว
                      </small>
                    </div>
                    <TableMap
                      tables={detail.tables.map((t) => ({ ...t, state: t.state ?? t.status }))}
                      editable
                      selected={editTable ? [editTable.id] : []}
                      onSelect={(t) => {
                        setEditTable(detail.tables.find((row) => row.id === t.id) ?? null);
                      }}
                      onMove={(t: PublicTable, x, y) =>
                        void run(async () => {
                          const row = detail.tables.find((row) => row.id === t.id)!;
                          await updateTable(row, { x, y });
                          setEditTable(null);
                        })
                      }
                    />
                    {editTable && (
                      <form
                        key={editTable.id}
                        className="panel table-editor"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            await updateTable(editTable, {
                              name: String(f.get("name")),
                              zone: String(f.get("zone")),
                              capacity: Number(f.get("capacity")),
                              price_satang:
                                bahtToSatang(String(f.get("price") ?? "0")) ?? Number.NaN,
                              x: Number(f.get("x")),
                              y: Number(f.get("y")),
                              status: String(f.get("status")) as Table["status"],
                            });
                            setEditTable(null);
                            setMessage("บันทึกโต๊ะแล้ว");
                          });
                        }}
                      >
                        <h3>แก้ไขโต๊ะ {editTable.number}</h3>
                        <Field label="ราคาต่อโต๊ะ (บาท)">
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            min={0}
                            max={1000000}
                            defaultValue={editTable.price_satang / 100}
                            required
                          />
                        </Field>
                        <div className="form-grid">
                          <Field label="ชื่อโต๊ะ">
                            <input
                              name="name"
                              required
                              maxLength={100}
                              defaultValue={editTable.name}
                            />
                          </Field>
                          <Field label="โซน">
                            <input name="zone" maxLength={100} defaultValue={editTable.zone} />
                          </Field>
                          <Field label="จำนวนคน">
                            <input
                              name="capacity"
                              type="number"
                              min={1}
                              max={30}
                              required
                              defaultValue={editTable.capacity}
                            />
                          </Field>
                          <Field label="สถานะ">
                            <select name="status" defaultValue={editTable.status}>
                              <option value="available">เปิดให้จอง</option>
                              <option value="held">กันโต๊ะไว้</option>
                              <option value="disabled">ปิดใช้งาน</option>
                            </select>
                          </Field>
                          <Field label="ตำแหน่ง X">
                            <input
                              name="x"
                              type="number"
                              min={0}
                              max={920}
                              required
                              defaultValue={editTable.x}
                            />
                          </Field>
                          <Field label="ตำแหน่ง Y">
                            <input
                              name="y"
                              type="number"
                              min={90}
                              max={700}
                              required
                              defaultValue={editTable.y}
                            />
                          </Field>
                        </div>
                        <div className="button-row">
                          <button className="button primary" disabled={busy}>
                            บันทึกโต๊ะ
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => setEditTable(null)}
                          >
                            ปิด
                          </button>
                          <button
                            type="button"
                            className="button danger"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`ลบ ${editTable.name} ออกจากผัง?`)) return;
                              void run(async () => {
                                await api(`/manager/events/${ev.id}/tables/${editTable.id}`, {
                                  method: "DELETE",
                                  accessToken,
                                });
                                setEditTable(null);
                                await loadDetail(ev.id);
                              });
                            }}
                          >
                            ลบโต๊ะ
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
                {tab === "payments" && (
                  <ManagerPayments
                    eventId={ev.id}
                    bookings={detail.bookings}
                    accessToken={accessToken}
                    onRefresh={async () => {
                      await loadDetail(ev.id);
                    }}
                  />
                )}
                {tab === "bookings" && (
                  <section className="panel">
                    <div className="section-heading">
                      <h2>รายชื่อผู้จอง</h2>
                      <input
                        className="search-input"
                        aria-label="ค้นหาผู้จอง"
                        placeholder="ชื่อ / รหัส / หน่วยงาน"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="data-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>รหัส / ผู้จอง</th>
                            <th>โต๊ะ</th>
                            <th>จำนวนคน</th>
                            <th>หน่วยงาน / ติดต่อ</th>
                            <th>สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.bookings
                            .filter((b) =>
                              `${b.code} ${b.guest_name} ${b.organization ?? ""}`
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                            )
                            .map((b) => (
                              <tr key={b.id}>
                                <td>
                                  <strong>{b.guest_name}</strong>
                                  <small>{b.code}</small>
                                </td>
                                <td>
                                  {detail.bookingTables
                                    .filter((t) => t.booking_id === b.id)
                                    .map((t) => t.table_number)
                                    .join(", ")}
                                </td>
                                <td>{b.guest_count}</td>
                                <td>
                                  {b.organization || "-"}
                                  <small>{b.contact || ""}</small>
                                </td>
                                <td>
                                  <span className="status-pill">{BOOKING_STATUS_TH[b.status]}</span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {!detail.bookings.length && (
                      <Empty>ยังไม่มีการจอง แชร์ลิงก์งานเพื่อเริ่มรับจอง</Empty>
                    )}
                  </section>
                )}
                {tab === "cancellations" && (
                  <section className="panel">
                    <h2>คำขอยกเลิก</h2>
                    {!detail.cancellations.length && <Empty>ยังไม่มีคำขอยกเลิก</Empty>}
                    {detail.cancellations.map((c) => {
                      const b = detail.bookings.find((b) => b.id === c.booking_id);
                      return (
                        <article key={c.id} className="cancellation-card">
                          <div>
                            <span className="status-pill">{CANCEL_STATUS_TH[c.status]}</span>
                            <h3>
                              {b?.guest_name} · {b?.code}
                            </h3>
                            <p>{c.reason}</p>
                            <small className="muted">{formatThaiDateTime(c.created_at)}</small>
                            {c.decision_note && <p>หมายเหตุ: {c.decision_note}</p>}
                          </div>
                          {c.status === "pending" && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const f = new FormData(form);
                                const approve =
                                  (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                                    "value",
                                  ) === "approve";
                                if (
                                  !window.confirm(
                                    approve
                                      ? "อนุมัติยกเลิกและปล่อยทุกโต๊ะในรายการนี้?"
                                      : "ปฏิเสธคำขอยกเลิกนี้?",
                                  )
                                )
                                  return;
                                void run(async () => {
                                  await api(`/manager/cancellations/${c.id}/decision`, {
                                    method: "POST",
                                    accessToken,
                                    body: { approve, note: String(f.get("note") ?? "") },
                                  });
                                  await loadDetail(ev.id);
                                  setMessage("บันทึกผลพิจารณาแล้ว");
                                });
                              }}
                            >
                              <input
                                name="note"
                                aria-label="หมายเหตุการพิจารณา"
                                placeholder="หมายเหตุ (ไม่บังคับ)"
                                maxLength={1000}
                              />
                              <div className="button-row">
                                <button className="button primary" value="approve" disabled={busy}>
                                  อนุมัติ
                                </button>
                                <button className="button secondary" value="reject" disabled={busy}>
                                  ปฏิเสธ
                                </button>
                              </div>
                            </form>
                          )}
                        </article>
                      );
                    })}
                  </section>
                )}
                {tab === "share" && (
                  <section className="panel">
                    <h2>เผยแพร่และแชร์งาน</h2>
                    <p className="muted">
                      ตรวจรายละเอียดและผังโต๊ะก่อนเปิดรับจอง ลูกค้าจะเห็นเฉพาะงานที่เผยแพร่แล้ว
                    </p>
                    {["draft", "closed"].includes(ev.status) && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("ยืนยันเผยแพร่งานนี้และเปิดลิงก์ให้ลูกค้าจอง?"))
                            return;
                          void run(async () => {
                            await api(`/manager/events/${ev.id}/publish`, {
                              method: "POST",
                              accessToken,
                              body: { version: ev.version },
                            });
                            await loadDetail(ev.id);
                            await loadList();
                            setMessage("เผยแพร่งานแล้ว คัดลอกลิงก์ด้านล่างเพื่อแชร์");
                          });
                        }}
                      >
                        เผยแพร่ / เปิดรับจอง
                      </button>
                    )}
                    {ev.status === "published" && (
                      <button
                        className="button danger"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("ปิดรับการจองใหม่? การจองเดิมจะยังอยู่")) return;
                          void run(async () => {
                            await api(`/manager/events/${ev.id}/close`, {
                              method: "POST",
                              accessToken,
                              body: { version: ev.version },
                            });
                            await loadDetail(ev.id);
                            await loadList();
                          });
                        }}
                      >
                        ปิดรับจอง
                      </button>
                    )}
                    {ev.public_slug && (
                      <>
                        <Share
                          url={`${window.location.origin}/e/${ev.public_slug}`}
                          label="ลิงก์จองโต๊ะสำหรับลูกค้า"
                        />
                        <a
                          className="button secondary"
                          href={`/e/${ev.public_slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          เปิดหน้าลูกค้า <ArrowUpRight size={16} />
                        </a>
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </Shell>
  );
}
