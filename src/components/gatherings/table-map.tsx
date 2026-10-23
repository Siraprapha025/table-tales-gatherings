import { useState } from "react";
import { LayoutGrid, List, Users } from "lucide-react";
import { TABLE_STATE_TH } from "@/lib/event-rules";
import type { PublicTable } from "@/lib/contracts";

export function TableMap({
  tables,
  selected = [],
  onSelect,
  editable = false,
  onMove,
}: {
  tables: PublicTable[];
  selected?: string[];
  onSelect: (t: PublicTable) => void;
  editable?: boolean;
  onMove?: (t: PublicTable, x: number, y: number) => void;
}) {
  const [mode, setMode] = useState<"map" | "list">("map");
  return (
    <section className="panel map-panel">
      <div className="section-heading">
        <div>
          <h2>{editable ? "จัดผังโต๊ะ" : "เลือกโต๊ะที่ใช่"}</h2>
          <p className="muted">
            {editable
              ? "ลากเพื่อย้ายตำแหน่ง หรือกดโต๊ะเพื่อแก้ไข"
              : "จองทั้งโต๊ะ • แตะโต๊ะว่างเพื่อเลือก"}
          </p>
        </div>
        <div className="segmented">
          <button
            aria-label="ดูผังโต๊ะ"
            aria-pressed={mode === "map"}
            onClick={() => setMode("map")}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            aria-label="ดูรายการโต๊ะ"
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <div className="legend">
        {["available", "selected", "booked", "held", "disabled"].map((s) => (
          <span key={s}>
            <i className={`dot ${s}`} />
            {s === "selected" ? "ที่เลือก" : TABLE_STATE_TH[s]}
          </span>
        ))}
      </div>
      {mode === "map" ? (
        <div className="map-scroll">
          <div
            className="floorplan"
            onDragOver={(e) => {
              if (editable) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const t = tables.find((t) => t.id === e.dataTransfer.getData("text/plain"));
              if (!t || !onMove) return;
              const rect = e.currentTarget.getBoundingClientRect();
              onMove(
                t,
                Math.round(Math.max(0, Math.min(920, e.clientX - rect.left - 40))),
                Math.round(Math.max(90, Math.min(700, e.clientY - rect.top - 40))),
              );
            }}
          >
            <div className="stage">เวที / STAGE</div>
            <span className="floor-zone">พื้นที่รับประทานอาหาร</span>
            {tables.map((t) => (
              <button
                key={t.id}
                draggable={editable}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                className={`round-table ${t.state} ${selected.includes(t.id) ? "selected" : ""}`}
                style={{ left: t.x, top: t.y }}
                disabled={!editable && t.state !== "available"}
                onClick={() => onSelect(t)}
                aria-pressed={selected.includes(t.id)}
                aria-label={`${t.name || `โต๊ะ ${t.number}`} ${t.capacity} คน ${TABLE_STATE_TH[t.state]}`}
              >
                <span>{String(t.number).padStart(2, "0")}</span>
                <small>{t.capacity} ที่นั่ง</small>
              </button>
            ))}
            <div className="entrance">↑ ทางเข้า</div>
          </div>
        </div>
      ) : (
        <div className="table-list">
          {tables.map((t) => (
            <button
              key={t.id}
              className={`table-list-item ${selected.includes(t.id) ? "chosen" : ""}`}
              disabled={!editable && t.state !== "available"}
              onClick={() => onSelect(t)}
            >
              <strong>{t.name || `โต๊ะ ${t.number}`}</strong>
              <span>
                <Users size={14} /> {t.capacity} คน · {t.zone || "ทั่วไป"}
              </span>
              <span>{TABLE_STATE_TH[t.state]}</span>
            </button>
          ))}
        </div>
      )}
      {tables.length === 0 && <p className="empty-state">ยังไม่มีโต๊ะ เพิ่มโต๊ะเพื่อเริ่มจัดผัง</p>}
    </section>
  );
}
