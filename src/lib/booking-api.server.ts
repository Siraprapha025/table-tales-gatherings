import { paymentApi } from "./payment-api.server";
import { paymentsDb } from "./payment-db";
import { z } from "zod";
import {
  admin,
  ApiError,
  asUser,
  bookingCode,
  fromDbError,
  handle,
  json,
  parse,
  rateLimit,
  readJson,
  sha256Hex,
} from "./api-server";
import {
  bookingInput,
  cancellationInput,
  decisionInput,
  eventInput,
  tableInput,
  tokenSchema,
  uuid,
} from "./contracts";

function unwrap<T>({
  data,
  error,
}: {
  data: T;
  error: { message?: string; code?: string } | null;
}): NonNullable<T> {
  if (error) throw fromDbError(error);
  if (data == null) throw new ApiError(404, "NOT_FOUND", "ไม่พบข้อมูลหรือไม่มีสิทธิ์เข้าถึง");
  return data;
}
const token = (r: Request) => parse(tokenSchema, r.headers.get("x-manage-token"));
const safeBookingColumns =
  "id,event_id,code,guest_name,guest_count,organization,contact,status,payment_status,total_satang,paid_satang,refunded_satang,deposit_due_satang,deposit_due_at,balance_due_at,created_at";

export async function dispatchApi(request: Request) {
  return handle(async () => {
    const path = new URL(request.url).pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
    const method = request.method;
    if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_PUBLISHABLE_KEY"])
      throw new ApiError(503, "SETUP_REQUIRED", "กรุณาตั้งค่า Supabase ตาม README ก่อนใช้งานจริง");

    const paymentResponse = await paymentApi(request, path);
    if (paymentResponse) return paymentResponse;
    if (path[0] !== "manager") {
      if (!process.env["SUPABASE_SERVICE_ROLE_KEY"])
        throw new ApiError(
          503,
          "SETUP_REQUIRED",
          "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ฝั่งเซิร์ฟเวอร์ กรุณาติดต่อผู้จัดการ",
        );
      await rateLimit(
        request,
        method === "GET" ? "read" : "write",
        method === "GET" ? 120 : 20,
        60,
      );
      const sb = await admin();
      if (method === "GET" && path.length === 3 && path[0] === "public" && path[1] === "events") {
        return json(unwrap(await sb.rpc("public_event", { _slug: decodeURIComponent(path[2]!) })));
      }
      if (method === "POST" && path.length === 1 && path[0] === "bookings") {
        const body = parse(bookingInput, await readJson(request));
        const key = parse(z.string().uuid(), request.headers.get("idempotency-key"));
        const manageToken = token(request);
        const tokenHash = await sha256Hex(manageToken);
        const requestHash = await sha256Hex(
          JSON.stringify({ ...body, table_ids: [...body.table_ids].sort(), token_hash: tokenHash }),
        );
        const result = unwrap(
          await paymentsDb(sb).rpc("create_booking_v2", {
            _expected_total: body.expected_total_satang,
            _expected_version: body.expected_event_version,
            _slug: body.slug,
            _table_ids: body.table_ids,
            _guest_name: body.guest_name,
            _guest_count: body.guest_count,
            _organization: body.organization,
            _contact: body.contact,
            _idempotency_key: key,
            _request_hash: requestHash,
            _token_hash: tokenHash,
            _code: bookingCode(),
          }),
        );
        return json(
          result,
          typeof result === "object" && !Array.isArray(result) && result["replayed"] ? 200 : 201,
        );
      }
      if (path[0] === "booking" && path.length <= 2) {
        const hash = await sha256Hex(token(request));
        if (method === "GET" && path.length === 1)
          return json(unwrap(await sb.rpc("booking_by_token", { _token_hash: hash })));
        if (method === "POST" && path[1] === "cancellations") {
          const body = parse(cancellationInput, await readJson(request));
          return json(
            unwrap(
              await sb.rpc("request_cancellation", { _token_hash: hash, _reason: body.reason }),
            ),
            201,
          );
        }
      }
    } else {
      const { sb: base, userId } = await asUser(request);
      const sb = paymentsDb(base);
      if (method === "GET" && path[1] === "developer" && path.length === 2) {
        const allowed = unwrap(await sb.rpc("has_role", { _user_id: userId, _role: "developer" }));
        if (!allowed) throw new ApiError(403, "FORBIDDEN", "บัญชีนี้ยังไม่มีสิทธิ์ Developer");
        return json({ developer: true });
      }
      if (path[1] === "events") {
        if (path.length === 2) {
          if (method === "GET")
            return json(
              unwrap(
                await sb
                  .from("events")
                  .select("*")
                  .eq("owner_id", userId)
                  .order("created_at", { ascending: false }),
              ),
            );
          if (method === "POST") {
            const body = parse(eventInput, await readJson(request));
            return json(
              unwrap(
                await sb
                  .from("events")
                  .insert({ ...body, owner_id: userId })
                  .select()
                  .single(),
              ),
              201,
            );
          }
        } else {
          const id = parse(uuid, path[2]);
          const event = unwrap(
            await sb.from("events").select("*").eq("id", id).eq("owner_id", userId).maybeSingle(),
          );
          if (path.length === 3 && method === "GET") {
            const [tables, bookings, cancellations, bookingTables, summary] = await Promise.all([
              sb.from("event_tables").select("*").eq("event_id", id).order("number"),
              sb
                .from("bookings")
                .select(safeBookingColumns)
                .eq("event_id", id)
                .order("created_at", { ascending: false }),
              sb
                .from("cancellation_requests")
                .select("*")
                .eq("event_id", id)
                .order("created_at", { ascending: false }),
              sb
                .from("booking_tables")
                .select("booking_id,table_id,table_number,active")
                .eq("event_id", id),
              sb.rpc("event_summary", { _event_id: id }),
            ]);
            const occupied = unwrap(bookingTables);
            return json({
              event,
              tables: unwrap(tables).map((t) => ({
                ...t,
                state: occupied.some((b) => b.table_id === t.id && b.active) ? "booked" : t.status,
              })),
              bookings: unwrap(bookings),
              cancellations: unwrap(cancellations),
              bookingTables: occupied,
              summary: unwrap(summary),
            });
          }
          if (method === "PATCH" && path.length === 3) {
            const raw = parse(
              z.object({ version: z.number().int().positive(), event: eventInput }).strict(),
              await readJson(request),
            );
            const result = await sb
              .from("events")
              .update(raw.event)
              .eq("id", id)
              .eq("version", raw.version)
              .select()
              .maybeSingle();
            if (result.error) throw fromDbError(result.error);
            if (!result.data)
              throw new ApiError(409, "VERSION_CONFLICT", "ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่");
            return json(result.data);
          }
          if (method === "POST" && path.length === 4 && ["publish", "close"].includes(path[3]!)) {
            const { version } = parse(
              z.object({ version: z.number().int().positive() }).strict(),
              await readJson(request),
            );
            if (path[3] === "publish")
              return json(
                unwrap(
                  await sb.rpc("publish_event", { _event_id: id, _expected_version: version }),
                ),
              );
            if (event.status !== "published")
              throw new ApiError(409, "INVALID_STATE", "งานนี้ไม่ได้เปิดรับจอง");
            const r = await sb
              .from("events")
              .update({ status: "closed" })
              .eq("id", id)
              .eq("version", version)
              .select()
              .maybeSingle();
            if (r.error) throw fromDbError(r.error);
            if (!r.data)
              throw new ApiError(409, "VERSION_CONFLICT", "ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่");
            return json(r.data);
          }
          if (path[3] === "tables") {
            if (method === "POST" && path.length === 4) {
              const { tables } = parse(
                z.object({ tables: z.array(tableInput).min(1).max(100) }).strict(),
                await readJson(request),
              );
              return json(
                unwrap(
                  await sb
                    .from("event_tables")
                    .insert(tables.map((t) => ({ ...t, event_id: id })))
                    .select(),
                ),
                201,
              );
            }
            if (path.length === 5) {
              const tid = parse(uuid, path[4]);
              if (method === "PATCH") {
                const body = parse(tableInput, await readJson(request));
                return json(
                  unwrap(
                    await sb
                      .from("event_tables")
                      .update(body)
                      .eq("id", tid)
                      .eq("event_id", id)
                      .select()
                      .maybeSingle(),
                  ),
                );
              }
              if (method === "DELETE")
                return json(
                  unwrap(
                    await sb
                      .from("event_tables")
                      .delete()
                      .eq("id", tid)
                      .eq("event_id", id)
                      .select("id")
                      .maybeSingle(),
                  ),
                );
            }
          }
        }
      }
      if (
        method === "POST" &&
        path.length === 4 &&
        path[1] === "cancellations" &&
        path[3] === "decision"
      ) {
        const body = parse(decisionInput, await readJson(request));
        return json(
          unwrap(
            await sb.rpc("decide_cancellation", {
              _request_id: parse(uuid, path[2]),
              _approve: body.approve,
              _note: body.note,
            }),
          ),
        );
      }
    }
    throw new ApiError(404, "NOT_FOUND", "ไม่พบ API นี้");
  });
}
