import {
  useState,
  createContext,
  useContext,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
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
export const FieldErrors = createContext<Record<string, string>>({});
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const errors = useContext(FieldErrors);
  const uid = useId();
  const control = Children.toArray(children).find(
    (child) => isValidElement<{ name?: string }>(child) && child.props.name,
  );
  const name = isValidElement<{ name?: string }>(control) ? control.props.name : undefined;
  const error = name ? errors[name] : undefined;
  if (!name)
    return (
      <label className="field">
        <span>{label}</span>
        {children}
      </label>
    );
  return (
    <div className={`field ${error ? "field-invalid" : ""}`}>
      <label htmlFor={uid}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement<{
          name?: string;
          id?: string;
          "aria-invalid"?: boolean;
          "aria-describedby"?: string | undefined;
        }>(child) &&
        (child === control || child.props.name === name) &&
        name
          ? cloneElement(child, {
              id: uid,
              "aria-invalid": !!error,
              "aria-describedby": error ? `${uid}-error` : undefined,
            })
          : child,
      )}
      {error && (
        <span id={`${uid}-error`} className="field-error" role="alert">
          ⚠ {error}
        </span>
      )}
    </div>
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
