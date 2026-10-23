# API v1

Base URL: same-origin `/api/v1`. Responses are JSON (proof downloads are JPEG/PNG) with `Cache-Control: no-store`.
Errors: `{ "error": { "code": "...", "message": "...", "details": [] } }`.
400 validation, 401 missing session, 403 access denied, 404 missing resource,
409 table/capacity/version conflict, 422 idempotency mismatch, 429 rate limited,
503 backend configuration/limiter unavailable. Never put credentials in query strings.

| Method       | Path                                    | Access                               |
| ------------ | --------------------------------------- | ------------------------------------ |
| GET          | `/public/events/{slug}`                 | Public, redacted event/availability  |
| POST         | `/bookings`                             | `X-Manage-Token` + `Idempotency-Key` |
| GET          | `/booking`                              | `X-Manage-Token`                     |
| POST         | `/booking/cancellations`                | `X-Manage-Token`                     |
| GET/POST     | `/manager/events`                       | Manager bearer session               |
| GET/PATCH    | `/manager/events/{id}`                  | Owning manager                       |
| POST         | `/manager/events/{id}/tables`           | Owning manager                       |
| PATCH/DELETE | `/manager/events/{id}/tables/{tableId}` | Owning manager                       |
| POST         | `/manager/events/{id}/publish`          | Owning manager                       |
| POST         | `/manager/events/{id}/close`            | Owning manager                       |
| POST         | `/manager/cancellations/{id}/decision`  | Owning manager                       |
| GET          | `/manager/developer`                    | Manager + Developer                  |

## Booking

Client generates a cryptographically random 32-byte token (hex is supported) and UUID
idempotency key before submitting. Retain both for retries with the same payload.
Never reuse them for a different customer or changed request. Token possession grants
access to that booking; return a private link to the customer, never a public chat/group.

```http
POST /api/v1/bookings
Content-Type: application/json
X-Manage-Token: <64-character random hex>
Idempotency-Key: <UUID>
```

```json
{
  "slug": "your-published-slug",
  "table_ids": ["00000000-0000-4000-8000-000000000001"],
  "guest_name": "ผู้จองตัวอย่าง",
  "guest_count": 8,
  "organization": "บริษัทตัวอย่าง",
  "contact": ""
}
```

201 created or 200 replayed: `{ "booking_id": "uuid", "code": "TP-...", "replayed": false }`.
The private URL is `/booking#<token>`; the API never returns stored raw tokens.
Reusing a key with a different payload/token returns 422. Conflicting tables return 409.
All selected tables belong to the same event and reserve atomically. Free bookings remain supported.
Paid bookings require contact, expected_total_satang and expected_event_version from the displayed public quote; mismatches return 409.

`GET /booking` returns the owner's receipt including its last cancellation request.
`POST /booking/cancellations` body: `{ "reason": "ไม่สะดวกเข้าร่วม" }`.
`POST /manager/cancellations/{id}/decision`: `{ "approve": true, "note": "อนุมัติ" }`.

## Manager writes

Use `Authorization: Bearer <Supabase access_token>` for all manager operations.
Create event body: title, description, organizer_name, contact_info, starts_at, ends_at,
booking_opens_at, booking_closes_at (ISO UTC strings), optional cancel_deadline,
venue_name/address, map_url (http/https), max_attendees, announcement, schedule,
contact_required, payment_mode (`none` or `required`). Unknown fields are rejected.
Paid settings: bank_name, bank_account_name, bank_account_number, deposit_percent (1–100),
deposit_hours (1–720), balance_due_at, refund_policy. See MANUAL_PAYMENTS.md.

Edit event: `{ "version": 1, "event": { ...complete editable event fields... } }`.
Publish/close: `{ "version": 1 }`. On 409 reload, review changed data, and retry.
Manager event detail includes tables, bookings, bookingTables, cancellations and summary;
it deliberately omits manage_token_hash, idempotency_key and request_hash.

Add tables: `{ "tables": [{ "number": 1, "name": "โต๊ะ 1", "zone": "ทั่วไป",
"capacity": 8, "price_satang": 0, "x": 50, "y": 130, "status": "available" }] }`.
Patch table sends one full table input without id or event_id. x: 0–920, y: 90–700,
capacity: 1–30. Status: available/held/disabled. Max 100 new tables per request.
IDs are immutable and scoped to the owning event. Foreign keys preserve booking history.

## Agent integration contract (not connected yet)

Map get_event_details to public event GET, get_event_summary to owning manager detail GET,
create_event_draft to event POST, generate_table_layout to tables POST,
and publish_event to publish POST. Booking/cancellation use the customer APIs above.
Bind each invocation to a verified manager session or customer capability;
do not expose a global service role credential to the agent.
Require confirmation of the exact payload before publishing, reserving or cancelling.
LINE account linking, webhook signature verification, deduplication, tool execution,
and confirmation version binding must be implemented before enabling the chatbot.

## Manual transfer APIs

There are 23 method/path combinations, including the 8 additions documented in [MANUAL_PAYMENTS.md](MANUAL_PAYMENTS.md).
`event_summary.revenue_satang` is legacy quoted booking value, **not received money**.
Use booking paid_satang/refunded_satang or the finance screen for actual verified receipts.
