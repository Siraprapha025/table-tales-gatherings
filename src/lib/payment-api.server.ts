import { z } from "zod";
import {
  admin,
  asUser,
  ApiError,
  fromDbError,
  json,
  parse,
  rateLimit,
  readJson,
  sha256Hex,
} from "./api-server";
import { tokenSchema, uuid } from "./contracts";
import { paymentsDb } from "./payment-db";
import {
  amountSchema,
  paymentReviewSchema,
  refundSchema,
  proofMime,
  PROOF_MAX_BYTES,
} from "./payment-contracts";
function unwrap<T>(r: {
  data: T;
  error: { message?: string; code?: string } | null;
}): NonNullable<T> {
  if (r.error) throw fromDbError(r.error);
  if (r.data == null) throw new ApiError(404, "NOT_FOUND", "ไม่พบรายการ");
  return r.data;
}
export async function boundedForm(request: Request) {
  const max = PROOF_MAX_BYTES + 65536;
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new ApiError(400, "VALIDATION", "ส่งไฟล์ด้วย multipart/form-data");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "VALIDATION", "ไม่พบไฟล์");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new ApiError(413, "FILE_TOO_LARGE", "สลิปต้องไม่เกิน 5 MB");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let pos = 0;
  for (const c of chunks) {
    bytes.set(c, pos);
    pos += c.length;
  }
  try {
    return await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new ApiError(400, "VALIDATION", "รูปแบบไฟล์ไม่ถูกต้อง");
  }
}
async function proof(path: string) {
  const sb = await admin();
  const file = unwrap(await sb.storage.from("payment-proofs").download(path));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = proofMime(bytes);
  if (!mime) throw new ApiError(400, "VALIDATION", "ไฟล์สลิปไม่ถูกต้อง");
  return new Response(bytes, {
    headers: {
      "content-type": mime,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": `attachment; filename="slip.${mime === "image/png" ? "png" : "jpg"}"`,
    },
  });
}
export async function paymentApi(request: Request, path: string[]): Promise<Response | undefined> {
  const customer = path[0] === "booking" && path[1] === "payments";
  const manager =
    path[0] === "manager" &&
    ((path[1] === "events" && path[3] === "payments") ||
      path[1] === "payments" ||
      (path[1] === "bookings" && ["refunds", "cancel"].includes(path[3] ?? "")));
  if (!customer && !manager) return;
  const method = request.method;
  if (customer) {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"])
      throw new ApiError(503, "SETUP_REQUIRED", "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์รับสลิป");
    await rateLimit(
      request,
      method === "GET" ? "payment-read" : "payment-upload",
      method === "GET" ? 120 : 10,
      60,
    );
    const sb = paymentsDb(await admin());
    const hash = await sha256Hex(parse(tokenSchema, request.headers.get("x-manage-token")));
    if (method === "GET" && path.length === 2)
      return json(unwrap(await sb.rpc("booking_finances", { _token_hash: hash })));
    const booking = unwrap(
      await sb.from("bookings").select("id,event_id").eq("manage_token_hash", hash).maybeSingle(),
    );
    if (method === "GET" && path.length === 4 && path[3] === "proof") {
      const row = unwrap(
        await sb
          .from("payment_submissions")
          .select("proof_path")
          .eq("id", parse(uuid, path[2]))
          .eq("booking_id", booking.id)
          .maybeSingle(),
      );
      return proof(row.proof_path);
    }
    if (method === "POST" && path.length === 2) {
      const f = await boundedForm(request);
      const file = f.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "VALIDATION", "กรุณาแนบรูปสลิป");
      const amount = parse(amountSchema, Number(f.get("amount_satang"))),
        paidAt = parse(z.string().datetime(), f.get("paid_at")),
        key = parse(uuid, f.get("request_id"));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = proofMime(bytes);
      if (!mime) throw new ApiError(400, "VALIDATION", "ใช้รูป JPEG หรือ PNG ขนาดไม่เกิน 5 MB");
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const prior = await sb
        .from("payment_submissions")
        .select("proof_path")
        .eq("booking_id", booking.id)
        .eq("request_id", key)
        .maybeSingle();
      if (prior.error) throw fromDbError(prior.error);
      const ev = unwrap(
        await sb.from("events").select("owner_id").eq("id", booking.event_id).single(),
      );
      const location =
        prior.data?.proof_path ??
        `${ev.owner_id}/${booking.event_id}/${booking.id}/${crypto.randomUUID()}.${mime === "image/png" ? "png" : "jpg"}`;
      if (!prior.data) {
        const upload = await sb.storage
          .from("payment-proofs")
          .upload(location, bytes, { contentType: mime, upsert: false });
        if (upload.error) throw new ApiError(503, "UPLOAD_FAILED", "อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
      }
      // Keep an orphan on an ambiguous database failure: never delete a possibly committed receipt.
      const result = unwrap(
        await sb.rpc("submit_payment", {
          _token_hash: hash,
          _amount: amount,
          _paid_at: paidAt,
          _path: location,
          _hash: digest,
          _request_id: key,
        }),
      );
      return json(result, 201);
    }
  } else {
    const { sb: base } = await asUser(request);
    const sb = paymentsDb(base);
    if (method === "GET" && path[1] === "events" && path.length === 4) {
      const id = parse(uuid, path[2]);
      unwrap(await sb.from("events").select("id").eq("id", id).maybeSingle());
      return json({
        submissions: unwrap(
          await sb
            .from("payment_submissions")
            .select(
              "id,booking_id,event_id,amount_satang,paid_at,status,bank_reference,decision_note,created_at",
            )
            .eq("event_id", id)
            .order("created_at", { ascending: false }),
        ),
        refunds: unwrap(
          await sb
            .from("manual_refunds")
            .select("id,booking_id,amount_satang,paid_at,bank_reference,note")
            .eq("event_id", id),
        ),
      });
    }
    if (path[1] === "payments" && path.length === 4) {
      const id = parse(uuid, path[2]);
      if (method === "GET" && path[3] === "proof") {
        const row = unwrap(
          await sb.from("payment_submissions").select("proof_path").eq("id", id).maybeSingle(),
        );
        return proof(row.proof_path);
      }
      if (method === "POST" && path[3] === "review") {
        const b = parse(paymentReviewSchema, await readJson(request));
        return json(
          unwrap(
            await sb.rpc("review_payment", {
              _id: id,
              _approve: b.approve,
              _reference: b.reference,
              _note: b.note,
            }),
          ),
        );
      }
    }
    if (method === "POST" && path[1] === "bookings" && path.length === 4) {
      const id = parse(uuid, path[2]);
      if (path[3] === "refunds") {
        const b = parse(refundSchema, await readJson(request));
        return json(
          unwrap(
            await sb.rpc("record_manual_refund", {
              _booking_id: id,
              _amount: b.amount_satang,
              _paid_at: b.paid_at,
              _reference: b.reference,
              _note: b.note,
              _request_id: b.request_id,
            }),
          ),
        );
      }
      if (path[3] === "cancel") {
        const b = parse(
          z.object({ note: z.string().trim().min(1).max(1000) }).strict(),
          await readJson(request),
        );
        return json(
          unwrap(await sb.rpc("manager_cancel_booking", { _booking_id: id, _note: b.note })),
        );
      }
    }
  }
  throw new ApiError(404, "NOT_FOUND", "ไม่พบ API");
}
