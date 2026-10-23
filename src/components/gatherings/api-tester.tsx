import { useState } from "react";
import { API_BASE, endpoints } from "@/lib/contracts";
import { Field, Notice } from "./common";
export function ApiTester({ accessToken }: { accessToken: string }) {
  const [index, setIndex] = useState(0);
  const [path, setPath] = useState("/public/events/demo-gala");
  const [body, setBody] = useState("{}");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [manageToken, setManageToken] = useState("");
  const [key, setKey] = useState("");
  const [confirm, setConfirm] = useState(false);
  const endpoint = endpoints[index]!;
  const fileEndpoint =
    endpoint[1].endsWith("/proof") ||
    (endpoint[0] === "POST" && endpoint[1] === "/booking/payments");
  return (
    <section className="panel">
      <span className="eyebrow">DEVELOPER WORKSPACE</span>
      <h2>API Test</h2>
      <Notice>
        คำสั่งในหน้านี้เรียก backend จริง และอาจเปลี่ยนข้อมูลจริง ใช้กับงานทดสอบของคุณเท่านั้น
      </Notice>
      <div className="api-grid">
        <div>
          <Field label="คำสั่ง">
            <select
              value={index}
              onChange={(e) => {
                const n = Number(e.target.value);
                setIndex(n);
                setPath(endpoints[n]![1]);
                setConfirm(false);
              }}
            >
              {endpoints.map((ep, i) => (
                <option key={ep[1] + ep[0]} value={i}>
                  {ep[0]} {ep[1]}
                </option>
              ))}
            </select>
          </Field>
          <p>{endpoint[2]}</p>
          {fileEndpoint && (
            <Notice>
              คำสั่งนี้ใช้ไฟล์ กรุณาทดสอบผ่านหน้าการจอง / รับเงิน หรือทำตาม docs/MANUAL_PAYMENTS.md
            </Notice>
          )}
          <Field label={`Endpoint ภายใต้ ${API_BASE}`}>
            <input
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setConfirm(false);
              }}
            />
          </Field>
          {endpoint[3] === "customer" && (
            <>
              <Field label="X-Manage-Token (ส่วนตัว)">
                <input
                  type="password"
                  value={manageToken}
                  onChange={(e) => setManageToken(e.target.value)}
                />
              </Field>
              {endpoint[0] === "POST" && endpoint[1] === "/bookings" && (
                <Field label="Idempotency-Key (UUID)">
                  <input value={key} onChange={(e) => setKey(e.target.value)} />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setKey(crypto.randomUUID())}
                  >
                    สร้าง UUID
                  </button>
                </Field>
              )}
            </>
          )}
          {endpoint[0] !== "GET" && endpoint[0] !== "DELETE" && (
            <Field label="Request JSON">
              <textarea
                className="code-input"
                rows={12}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setConfirm(false);
                }}
              />
            </Field>
          )}
          {endpoint[0] !== "GET" && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              ยืนยันส่งคำสั่งเปลี่ยนข้อมูล
            </label>
          )}
          <button
            className="button primary"
            disabled={fileEndpoint || busy || (endpoint[0] !== "GET" && !confirm)}
            onClick={async () => {
              setBusy(true);
              const started = performance.now();
              try {
                if (!/^\/(public|manager|bookings?)(\/|$)/.test(path) || /[{}?#]|\.\./.test(path))
                  throw new Error("ระบุ endpoint และแทนค่า {id} ให้ครบ");
                const headers: Record<string, string> = {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                };
                if (manageToken) headers["X-Manage-Token"] = manageToken;
                if (key) headers["Idempotency-Key"] = key;
                const write = endpoint[0] !== "GET" && endpoint[0] !== "DELETE";
                if (write) JSON.parse(body);
                const r = await fetch(API_BASE + path, {
                  method: endpoint[0],
                  headers,
                  ...(write ? { body } : {}),
                });
                const data = await r.json();
                setResult(
                  `HTTP ${r.status} · ${Math.round(performance.now() - started)} ms\n${JSON.stringify(data, null, 2)}`,
                );
              } catch (e) {
                setResult((e as Error).message);
              } finally {
                setBusy(false);
                setConfirm(false);
              }
            }}
          >
            {busy ? "กำลังส่ง…" : "Send request"}
          </button>
        </div>
        <div>
          <h3>Response</h3>
          <pre className="response">{result || "ผลลัพธ์จะแสดงที่นี่หลังส่งคำขอ"}</pre>
          <p className="muted">ไม่มีการบันทึก token ลง log • บัญชีและสิทธิ์เดียวกับหน้า Manager</p>
        </div>
      </div>
      <h3>สถานะการเชื่อมต่อ</h3>
      <div className="integration-list">
        <span>เว็บ ↔ API: เรียก endpoint จริง</span>
        <span>LINE: ยังไม่เชื่อมต่อ</span>
        <span>AI Agent: ยังไม่เชื่อมต่อ</span>
        <span>Payment: โอนตรงและผู้จัดตรวจยอดเอง</span>
      </div>
    </section>
  );
}
