import { useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Armchair, ArrowUpRight, Copy, Check } from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-icon">
        <Armchair size={24} />
      </span>
      <span>
        โต๊ะพร้อม<small>TABLE TALES</small>
      </span>
    </a>
  );
}
export function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="gatherings">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          {right ?? (
            <a className="quiet-link" href="/">
              สำหรับผู้จัดการ <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <span>โต๊ะพร้อม · ทุกที่นั่ง คือช่วงเวลาดี ๆ</span>
        <span>ระบบจองทั้งโต๊ะ · เวลาไทย (GMT+7)</span>
      </footer>
    </div>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`notice ${error ? "notice-error" : ""}`} role={error ? "alert" : "status"}>
      {children}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Share({ url, label }: { url: string; label: string }) {
  const [message, setMessage] = useState("");
  return (
    <section className="share-box">
      <QRCodeSVG value={url} size={140} title={label} />
      <div>
        <h3>{label}</h3>
        <p className="muted">สแกน QR หรือคัดลอกลิงก์เพื่อแชร์</p>
        <input aria-label={label} readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setMessage("คัดลอกแล้ว");
            } catch {
              setMessage("เลือกข้อความในช่องแล้วคัดลอกได้เลย");
            }
          }}
        >
          {message === "คัดลอกแล้ว" ? <Check size={16} /> : <Copy size={16} />}{" "}
          {message || "คัดลอกลิงก์"}
        </button>
      </div>
    </section>
  );
}
