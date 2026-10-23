// Server-only helpers for /api/public/v1/* routes. Never imports the admin client at module scope.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const DB_CODE_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  TABLE_TAKEN: 409,
  CAPACITY_EXCEEDED: 409,
  IDEMPOTENCY_MISMATCH: 422,
  BOOKING_CLOSED: 403,
  DEADLINE_PASSED: 403,
  FORBIDDEN: 403,
  ALREADY_PENDING: 409,
  INVALID_STATE: 409,
  VERSION_CONFLICT: 409,
  TABLE_HAS_BOOKING: 409,
};

export function fromDbError(err: { message?: string; code?: string } | null): ApiError {
  const msg = err?.message ?? "Unknown error";
  const m = /^([A-Z_]+):(.*)$/s.exec(msg);
  const dbCode = m?.[1] ?? "";
  const dbStatus = DB_CODE_STATUS[dbCode];
  if (m && dbStatus) return new ApiError(dbStatus, dbCode, (m[2] ?? "").trim());
  if (err?.code === "23505") {
    if (msg.includes("booking_tables_active_uniq"))
      return new ApiError(409, "TABLE_TAKEN", "มีโต๊ะที่เลือกถูกจองไปแล้ว");
    if (msg.includes("payment_") || msg.includes("manual_refunds"))
      return new ApiError(
        409,
        "CONFLICT",
        "สลิปหรือเลขอ้างอิงธนาคารนี้เคยใช้แล้ว กรุณาตรวจรายการเดิม",
      );
    return new ApiError(409, "CONFLICT", "ข้อมูลซ้ำ (เช่น หมายเลขโต๊ะซ้ำในงานเดียวกัน)");
  }
  if (err?.code === "42501") return new ApiError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  if (err?.code === "23503")
    return new ApiError(409, "HAS_HISTORY", "โต๊ะนี้มีประวัติการจอง กรุณาปิดใช้งานแทนการลบ");
  console.error("db error", err?.code, msg);
  return new ApiError(500, "INTERNAL", "เกิดข้อผิดพลาดภายในระบบ");
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      return json(
        {
          error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) },
        },
        e.status,
      );
    }
    console.error("api error", e instanceof Error ? e.message : e);
    return json({ error: { code: "INTERNAL", message: "เกิดข้อผิดพลาดภายในระบบ" } }, 500);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "รูปแบบ JSON ไม่ถูกต้อง");
  }
}

export function parse<T>(
  schema: {
    safeParse: (
      v: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };
  },
  value: unknown,
): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new ApiError(
      400,
      "VALIDATION",
      "ข้อมูลไม่ถูกต้อง",
      r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return r.data;
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Supabase client acting as the caller (RLS applies). Throws 401 without a valid bearer. */
export async function asUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token)
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "ต้องเข้าสู่ระบบ (Authorization: Bearer <access_token>)",
    );
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "UNAUTHORIZED", "Session หมดอายุหรือไม่ถูกต้อง");
  const { data: isManager } = await sb.rpc("has_role", {
    _user_id: data.user.id,
    _role: "manager",
  });
  if (!isManager) throw new ApiError(403, "FORBIDDEN", "บัญชีนี้ไม่มีสิทธิ์ผู้จัดการ");
  return { sb, userId: data.user.id };
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = crypto.getRandomValues(new Uint8Array(6));
  return "TP-" + [...a].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function rateLimit(
  request: Request,
  bucket: string,
  max: number,
  windowSeconds: number,
) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const key = `${bucket}:${await sha256Hex(ip)}`;
  const sb = await admin();
  const { data, error } = await sb.rpc("rate_limit_hit", {
    _key: key,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error)
    throw new ApiError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "ระบบตรวจสอบคำขอยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
    );
  if (data) throw new ApiError(429, "RATE_LIMITED", "ส่งคำขอถี่เกินไป กรุณารอสักครู่");
}

export function manageTokenFrom(request: Request): string {
  const t = request.headers.get("x-manage-token") ?? "";
  if (t.length < 20 || t.length > 200)
    throw new ApiError(401, "INVALID_TOKEN", "ลิงก์จัดการการจองไม่ถูกต้อง");
  return t;
}
