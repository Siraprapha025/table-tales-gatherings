-- สำหรับโปรเจกต์ table-tales-gatherings ที่มีตารางเดิมแล้ว แต่ยังไม่มี events.bank_name
-- คัดลอกทั้งไฟล์ไปที่ Lovable > Database > Manage > SQL editor แล้ว Run ครั้งเดียว
-- ไม่สร้าง baseline/ข้อมูลตัวอย่างซ้ำ ไม่ลบรายการงานหรือการจองเดิม
-- Generated from booking_safety.sql + manual_payments.sql; do not run their originals again afterwards.
-- ตรวจฐานข้อมูลที่เลือกให้ตรงกับโปรเจกต์ และเก็บสำรองข้อมูลก่อนใช้งานจริง
begin;
do $preflight$
begin
  if to_regclass('public.events') is null or to_regclass('public.bookings') is null or to_regclass('public.event_tables') is null then
    raise exception 'ไม่พบโครงสร้างเดิมของโปรเจกต์นี้ กรุณาหยุดและตรวจฐานข้อมูลที่เลือก';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name in ('bank_name','bank_account_name','bank_account_number','deposit_percent','deposit_hours','balance_due_at','refund_policy'))
     or to_regclass('public.payment_submissions') is not null or to_regclass('public.manual_refunds') is not null then
    raise exception 'ตรวจพบส่วนรับเงินติดตั้งไว้แล้วหรือบางส่วน กรุณาหยุดและตรวจสอบ ไม่ต้องรันไฟล์นี้ซ้ำ';
  end if;
end $preflight$;
-- Apply AFTER drizzle/migrations/0000_migration.sql (do not rerun the baseline).
-- New signups can manage their own events, but cannot claim developer access or demo data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'manager');
  return new;
end $$;

-- Guard the storage boundary as well as the HTTP API. Paid events are deliberately
-- disabled until a verified payment provider and expiry worker exist.
create or replace function public.guard_booking_insert()
returns trigger language plpgsql set search_path = public as $$
declare mode text;
begin
  select payment_mode into mode from public.events where id = new.event_id;
  if mode <> 'none' then raise exception 'INVALID_STATE:ระบบชำระเงินยังไม่เปิดใช้งาน'; end if;
  if char_length(btrim(new.guest_name)) = 0 then raise exception 'VALIDATION:กรุณากรอกชื่อ'; end if;
  new.total_satang := 0;
  return new;
end $$;
do $install$ begin
  if not exists(select 1 from pg_trigger where tgname='bookings_free_phase' and tgrelid='public.bookings'::regclass) then
    create trigger bookings_free_phase before insert on public.bookings for each row execute function public.guard_booking_insert();
  end if;
end $install$;

-- Do not mutate the identity of a table or move it between events with history.
create or replace function public.guard_table_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.event_id <> old.event_id or new.id <> old.id then
    raise exception 'VALIDATION:ไม่สามารถย้ายโต๊ะไปงานอื่นหรือเปลี่ยนรหัสโต๊ะ';
  end if;
  return new;
end $$;
do $install$ begin
  if not exists(select 1 from pg_trigger where tgname='tables_identity' and tgrelid='public.event_tables'::regclass) then
    create trigger tables_identity before update on public.event_tables for each row execute function public.guard_table_identity();
  end if;
end $install$;

-- Serialize capacity edits with bookings (create_booking already locks the event).
create or replace function public.guard_event_capacity()
returns trigger language plpgsql set search_path = public as $$
declare guests bigint;
begin
  if new.max_attendees is not null then
    select coalesce(sum(guest_count),0) into guests from public.bookings
      where event_id = old.id and status in ('confirmed','pending_payment');
    if new.max_attendees < guests then raise exception 'CAPACITY_EXCEEDED:จำนวนคนสูงสุดต่ำกว่ายอดจองปัจจุบัน'; end if;
  end if;
  if new.payment_mode <> 'none' then raise exception 'INVALID_STATE:ระบบชำระเงินยังไม่เปิดใช้งาน'; end if;
  return new;
end $$;
do $install$ begin
  if not exists(select 1 from pg_trigger where tgname='events_capacity' and tgrelid='public.events'::regclass) then
    create trigger events_capacity before update on public.events for each row execute function public.guard_event_capacity();
  end if;
end $install$;

-- Run after both previous migrations. No live data is modified by the app build.
alter table public.events
  add column bank_name text not null default '',
  add column bank_account_name text not null default '',
  add column bank_account_number text not null default '',
  add column deposit_percent integer not null default 30 check (deposit_percent between 1 and 100),
  add column deposit_hours integer not null default 24 check (deposit_hours between 1 and 720),
  add column balance_due_at timestamptz,
  add column refund_policy text not null default '';

alter table public.bookings
  add column paid_satang integer not null default 0 check (paid_satang >= 0),
  add column refunded_satang integer not null default 0 check (refunded_satang >= 0 and refunded_satang <= paid_satang),
  add column deposit_due_satang integer not null default 0 check (deposit_due_satang >= 0),
  add column deposit_due_at timestamptz,
  add column balance_due_at timestamptz,
  add column bank_snapshot jsonb,
  add column refund_policy_snapshot text not null default '';

-- Immutable snapshots keep existing reservations unaffected by changes to an event's bank/rates.
create or replace function public.guard_booking_insert()
returns trigger language plpgsql set search_path = public as $$
declare ev public.events;
begin
  select * into ev from public.events where id = new.event_id;
  if char_length(btrim(new.guest_name)) = 0 then raise exception 'VALIDATION:กรุณากรอกชื่อ'; end if;
  if ev.payment_mode = 'none' then
    new.total_satang := 0; new.deposit_due_satang := 0;
    new.status := 'confirmed'; new.payment_status := 'not_required';
  else
    if ev.owner_id is null or ev.bank_name = '' or ev.bank_account_name = '' or ev.bank_account_number = '' then
      raise exception 'VALIDATION:ผู้จัดยังไม่ได้ตั้งค่าบัญชีรับเงิน';
    end if;
    if ev.balance_due_at is null or now() >= ev.balance_due_at then raise exception 'BOOKING_CLOSED:เลยกำหนดชำระเงินของงานแล้ว'; end if;
    if coalesce(btrim(new.contact),'') = '' then raise exception 'VALIDATION:กรุณาระบุช่องทางติดต่อสำหรับการชำระเงิน'; end if;
    if new.total_satang <= 0 then raise exception 'VALIDATION:งานเก็บเงินต้องกำหนดราคาโต๊ะมากกว่า 0'; end if;
    new.deposit_due_satang := ceil(new.total_satang::numeric * ev.deposit_percent / 100)::integer;
    new.deposit_due_at := least(now() + make_interval(hours => ev.deposit_hours), ev.balance_due_at);
    new.balance_due_at := ev.balance_due_at;
    new.bank_snapshot := jsonb_build_object('bank_name',ev.bank_name,'account_name',ev.bank_account_name,'account_number',ev.bank_account_number);
    new.refund_policy_snapshot := ev.refund_policy;
    new.status := 'pending_payment'; new.payment_status := 'pending';
  end if;
  return new;
end $$;

create or replace function public.guard_event_capacity()
returns trigger language plpgsql set search_path = public as $$
declare guests bigint;
begin
  if new.max_attendees is not null then
    select coalesce(sum(guest_count),0) into guests from public.bookings
      where event_id = old.id and status in ('confirmed','pending_payment');
    if new.max_attendees < guests then raise exception 'CAPACITY_EXCEEDED:จำนวนคนสูงสุดต่ำกว่ายอดจองปัจจุบัน'; end if;
  end if;
  return new;
end $$;

create function public.validate_payment_settings()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.payment_mode='required' then
    if btrim(new.bank_name)='' or btrim(new.bank_account_name)='' or new.bank_account_number !~ '^[0-9 -]{8,30}$' then
      raise exception 'VALIDATION:กรุณากรอกธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ';
    end if;
    if new.balance_due_at is null or new.balance_due_at < new.booking_closes_at or new.balance_due_at > new.starts_at then
      raise exception 'VALIDATION:กำหนดชำระส่วนที่เหลือต้องไม่ก่อนปิดรับจองและไม่หลังเริ่มงาน';
    end if;
    if char_length(btrim(new.refund_policy)) < 5 then raise exception 'VALIDATION:กรุณาระบุเงื่อนไขยกเลิกและคืนเงิน'; end if;
    new.contact_required := true;
  end if;
  return new;
end $$;
create trigger events_payment_settings before insert or update on public.events for each row execute function public.validate_payment_settings();

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  owner_id uuid not null,
  amount_satang integer not null check (amount_satang > 0 and amount_satang <= 100000000),
  paid_at timestamptz not null,
  proof_path text not null unique,
  proof_hash text not null,
  request_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  bank_reference text,
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(booking_id,request_id)
);
create index payment_submissions_event_idx on public.payment_submissions(event_id,created_at desc);
-- Do not accept the same exact proof or verified bank reference twice for one organizer.
create unique index payment_proof_once on public.payment_submissions(owner_id,proof_hash) where status <> 'rejected';
create unique index payment_reference_once on public.payment_submissions(owner_id,bank_reference) where status='approved';
alter table public.payment_submissions enable row level security;
grant select on public.payment_submissions to authenticated;
grant all on public.payment_submissions to service_role;
create policy "owner read submissions" on public.payment_submissions for select to authenticated
using (owner_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and e.owner_id=auth.uid()));

create table public.manual_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  owner_id uuid not null,
  amount_satang integer not null check(amount_satang>0),
  bank_reference text not null,
  note text not null,
  paid_at timestamptz not null,
  request_id uuid not null,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  unique(owner_id,bank_reference), unique(booking_id,request_id)
);
alter table public.manual_refunds enable row level security;
grant select on public.manual_refunds to authenticated;
grant all on public.manual_refunds to service_role;
create policy "owner read refunds" on public.manual_refunds for select to authenticated using(owner_id=auth.uid());

create function public.submit_payment(_token_hash text,_amount integer,_paid_at timestamptz,_path text,_hash text,_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings; ev public.events; p public.payment_submissions;
begin
  select * into b from public.bookings where manage_token_hash=_token_hash for update;
  if not found then raise exception 'NOT_FOUND:ไม่พบการจอง'; end if;
  select * into p from public.payment_submissions where booking_id=b.id and request_id=_request_id;
  if found then
    if p.amount_satang<>_amount or p.paid_at<>_paid_at or p.proof_hash<>_hash then raise exception 'IDEMPOTENCY_MISMATCH:คำขอเดิมถูกใช้กับข้อมูลอื่น'; end if;
    return jsonb_build_object('id',p.id,'replayed',true,'status',p.status);
  end if;
  if b.status not in ('confirmed','pending_payment') or b.payment_status='not_required' then raise exception 'INVALID_STATE:การจองนี้ไม่รับหลักฐานชำระเงิน'; end if;
  if _amount is null or _amount<=0 or _amount > b.total_satang-b.paid_satang then raise exception 'VALIDATION:จำนวนเงินต้องไม่เกินยอดค้างชำระ'; end if;
  if _paid_at is null or _paid_at>now()+interval '5 minutes' or _paid_at<b.created_at-interval '1 day' then raise exception 'VALIDATION:วันเวลาที่โอนไม่ถูกต้อง'; end if;
  select * into ev from public.events where id=b.event_id;
  if _path not like ev.owner_id::text||'/'||ev.id::text||'/'||b.id::text||'/%' or _hash !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION:หลักฐานไม่ถูกต้อง'; end if;
  insert into public.payment_submissions(booking_id,event_id,owner_id,amount_satang,paid_at,proof_path,proof_hash,request_id)
    values(b.id,b.event_id,ev.owner_id,_amount,_paid_at,_path,_hash,_request_id) returning * into p;
  insert into public.audit_logs(event_id,actor_type,action,details) values(b.event_id,'customer','payment.submitted',jsonb_build_object('payment_id',p.id,'booking_id',b.id,'amount_satang',_amount));
  return jsonb_build_object('id',p.id,'status',p.status,'replayed',false);
end $$;

create function public.review_payment(_id uuid,_approve boolean,_reference text,_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings; p public.payment_submissions; bid uuid; ref text:=upper(btrim(coalesce(_reference,'')));
begin
  select booking_id into bid from public.payment_submissions where id=_id and owner_id=auth.uid();
  if bid is null then raise exception 'NOT_FOUND:ไม่พบหลักฐาน'; end if;
  -- Shared lock order for submit/review/cancellation/refund: booking, then child.
  select * into b from public.bookings where id=bid for update;
  select * into p from public.payment_submissions where id=_id for update;
  if not exists(select 1 from public.events where id=b.event_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN:ไม่มีสิทธิ์'; end if;
  if p.status<>'pending' then
    if p.status=(case when _approve then 'approved' else 'rejected' end) and coalesce(p.bank_reference,'')=(case when _approve then ref else '' end) and coalesce(p.decision_note,'')=btrim(coalesce(_note,'')) then
      return jsonb_build_object('id',p.id,'status',p.status,'replayed',true);
    end if;
    raise exception 'INVALID_STATE:หลักฐานนี้พิจารณาแล้ว';
  end if;
  if _approve then
    if b.status not in ('confirmed','pending_payment') then raise exception 'INVALID_STATE:การจองถูกยกเลิกแล้ว ไม่สามารถรับเงินเพิ่ม'; end if;
    if length(ref)<3 or length(ref)>200 then raise exception 'VALIDATION:กรุณากรอกเลขอ้างอิงรายการจากบัญชีธนาคาร'; end if;
    if b.paid_satang+p.amount_satang>b.total_satang then raise exception 'VALIDATION:ยอดนี้เกินยอดค้างชำระ กรุณาปฏิเสธและตรวจสอบ'; end if;
    update public.bookings set paid_satang=paid_satang+p.amount_satang,
      status=case when paid_satang+p.amount_satang>=deposit_due_satang then 'confirmed'::public.booking_status else 'pending_payment'::public.booking_status end,
      payment_status=case when paid_satang+p.amount_satang=total_satang then 'paid'::public.payment_status else 'pending'::public.payment_status end where id=b.id;
  elsif char_length(btrim(coalesce(_note,'')))=0 then raise exception 'VALIDATION:กรุณาระบุเหตุผลที่ปฏิเสธ';
  end if;
  update public.payment_submissions set status=case when _approve then 'approved' else 'rejected' end,
    bank_reference=case when _approve then ref else null end,decision_note=btrim(coalesce(_note,'')),decided_by=auth.uid(),decided_at=now() where id=p.id;
  insert into public.audit_logs(event_id,actor_id,actor_type,action,details) values(b.event_id,auth.uid(),'manager',case when _approve then 'payment.approved' else 'payment.rejected' end,jsonb_build_object('payment_id',p.id,'booking_id',b.id,'amount_satang',p.amount_satang));
  return jsonb_build_object('id',p.id,'status',case when _approve then 'approved' else 'rejected' end);
end $$;

create function public.record_manual_refund(_booking_id uuid,_amount integer,_paid_at timestamptz,_reference text,_note text,_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings; r public.manual_refunds; ref text:=upper(btrim(coalesce(_reference,'')));
begin
  select * into b from public.bookings where id=_booking_id for update;
  if not found or not exists(select 1 from public.events where id=b.event_id and owner_id=auth.uid()) then raise exception 'NOT_FOUND:ไม่พบการจอง'; end if;
  select * into r from public.manual_refunds where booking_id=b.id and request_id=_request_id;
  if found then
    if r.amount_satang<>_amount or r.bank_reference<>ref or r.paid_at<>_paid_at or r.note<>btrim(coalesce(_note,'')) then raise exception 'IDEMPOTENCY_MISMATCH:คำขอเดิมมีข้อมูลต่างกัน'; end if;
    return jsonb_build_object('id',r.id,'replayed',true);
  end if;
  if b.status<>'cancelled' then raise exception 'INVALID_STATE:ต้องยกเลิกการจองก่อนบันทึกคืนเงิน'; end if;
  if _amount is null or _amount<=0 or _amount>b.paid_satang-b.refunded_satang then raise exception 'VALIDATION:ยอดคืนเกินเงินรับสุทธิ'; end if;
  if length(ref)<3 or length(ref)>200 or btrim(coalesce(_note,''))='' then raise exception 'VALIDATION:กรุณากรอกเลขอ้างอิงและเหตุผลคืนเงิน'; end if;
  if _paid_at is null or _paid_at>now()+interval '5 minutes' or _paid_at<b.created_at then raise exception 'VALIDATION:เวลาคืนเงินไม่ถูกต้อง'; end if;
  insert into public.manual_refunds(booking_id,event_id,owner_id,amount_satang,bank_reference,note,paid_at,request_id,recorded_by)
    values(b.id,b.event_id,auth.uid(),_amount,ref,btrim(_note),_paid_at,_request_id,auth.uid()) returning * into r;
  update public.bookings set refunded_satang=refunded_satang+_amount,
    payment_status=case when refunded_satang+_amount=paid_satang then 'refunded'::public.payment_status else 'refund_pending'::public.payment_status end where id=b.id;
  insert into public.audit_logs(event_id,actor_id,actor_type,action,details) values(b.event_id,auth.uid(),'manager','refund.recorded',jsonb_build_object('refund_id',r.id,'booking_id',b.id,'amount_satang',_amount));
  return jsonb_build_object('id',r.id,'replayed',false);
end $$;

-- Returns only the customer's own payment history. Paths and owner ids are not exposed.
create function public.booking_finances(_token_hash text)
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('total_satang',b.total_satang,'paid_satang',b.paid_satang,'refunded_satang',b.refunded_satang,
 'deposit_due_satang',b.deposit_due_satang,'deposit_due_at',b.deposit_due_at,'balance_due_at',b.balance_due_at,
 'bank',b.bank_snapshot,'refund_policy',b.refund_policy_snapshot,
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'amount_satang',p.amount_satang,'paid_at',p.paid_at,'status',p.status,'decision_note',p.decision_note,'created_at',p.created_at) order by p.created_at desc) from public.payment_submissions p where p.booking_id=b.id),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amount_satang',r.amount_satang,'paid_at',r.paid_at,'note',r.note) order by r.created_at desc) from public.manual_refunds r where r.booking_id=b.id),'[]'::jsonb))
from public.bookings b where b.manage_token_hash=_token_hash
$$;

revoke all on function public.submit_payment(text,integer,timestamptz,text,text,uuid),public.booking_finances(text) from public,anon,authenticated;
grant execute on function public.submit_payment(text,integer,timestamptz,text,text,uuid),public.booking_finances(text) to service_role;
revoke all on function public.review_payment(uuid,boolean,text,text),public.record_manual_refund(uuid,integer,timestamptz,text,text,uuid) from public,anon;
grant execute on function public.review_payment(uuid,boolean,text,text),public.record_manual_refund(uuid,integer,timestamptz,text,text,uuid) to authenticated;

-- Storage objects are accessible only through the server's authenticated, scoped API.
-- No public/authenticated storage policy is added for this bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png'];


create or replace function public.create_booking_v2(
  _slug text, _table_ids uuid[], _guest_name text, _guest_count integer,
  _organization text, _contact text, _idempotency_key text, _request_hash text,
  _token_hash text, _code text, _expected_total integer, _expected_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev public.events; existing public.bookings; b public.bookings;
  n_tables integer; cap integer; total bigint; booked integer; taken integer;
begin
  select * into ev from public.events where public_slug = _slug for update;
  if not found then raise exception 'NOT_FOUND:ไม่พบงานนี้'; end if;

  select * into existing from public.bookings where event_id = ev.id and idempotency_key = _idempotency_key;
  if found then
    if existing.request_hash <> _request_hash then
      raise exception 'IDEMPOTENCY_MISMATCH:Idempotency-Key นี้ถูกใช้กับข้อมูลอื่นแล้ว';
    end if;
    return jsonb_build_object('replayed', true, 'booking_id', existing.id, 'code', existing.code);
  end if;

  if (ev.payment_mode='required' and _expected_version is null) or (_expected_version is not null and _expected_version<>ev.version) then raise exception 'VERSION_CONFLICT:รายละเอียดงานหรือเงื่อนไขเปลี่ยนไป กรุณาตรวจสอบและยืนยันใหม่'; end if;
  if ev.status <> 'published' then raise exception 'BOOKING_CLOSED:งานนี้ไม่ได้เปิดรับจอง'; end if;
  if now() < ev.booking_opens_at then raise exception 'BOOKING_CLOSED:ยังไม่ถึงเวลาเปิดรับจอง'; end if;
  if now() > ev.booking_closes_at then raise exception 'BOOKING_CLOSED:ปิดรับจองแล้ว'; end if;
  if ev.contact_required and coalesce(btrim(_contact),'') = '' then raise exception 'VALIDATION:งานนี้ต้องกรอกช่องทางติดต่อ'; end if;
  if coalesce(array_length(_table_ids,1),0) = 0 then raise exception 'VALIDATION:กรุณาเลือกอย่างน้อย 1 โต๊ะ'; end if;
  if (select count(distinct x) from unnest(_table_ids) x) <> array_length(_table_ids,1) then raise exception 'VALIDATION:เลือกโต๊ะซ้ำ'; end if;

  perform 1 from public.event_tables where id = any(_table_ids) for update;
  select count(*), coalesce(sum(capacity),0), coalesce(sum(price_satang),0) into n_tables, cap, total
    from public.event_tables where id = any(_table_ids) and event_id = ev.id;
  if n_tables <> array_length(_table_ids,1) then raise exception 'VALIDATION:มีโต๊ะที่ไม่อยู่ในงานนี้'; end if;

  select count(*) into taken from public.event_tables t
   where t.id = any(_table_ids) and (t.status <> 'available' or exists (select 1 from public.booking_tables bt where bt.table_id = t.id and bt.active));
  if taken > 0 then raise exception 'TABLE_TAKEN:มีโต๊ะที่เลือกถูกจองหรือไม่พร้อมใช้งานแล้ว'; end if;

  if ev.payment_mode='required' and exists(select 1 from public.event_tables where id=any(_table_ids) and price_satang<=0) then raise exception 'VALIDATION:ผู้จัดยังไม่ได้กำหนดราคาโต๊ะ'; end if;
  if ev.payment_mode='none' then total:=0; end if;
  if total>100000000 then raise exception 'VALIDATION:ยอดต่อการจองเกิน 1,000,000 บาท'; end if;
  if _expected_total is null or total<>_expected_total then raise exception 'VERSION_CONFLICT:ราคาโต๊ะเปลี่ยนแล้ว กรุณาตรวจสอบยอดใหม่'; end if;
  if _guest_count > cap then raise exception 'VALIDATION:จำนวนผู้ร่วมงาน (%) เกินความจุโต๊ะที่เลือก (%)', _guest_count, cap; end if;
  if ev.max_attendees is not null then
    select coalesce(sum(guest_count),0) into booked from public.bookings where event_id = ev.id and status in ('confirmed','pending_payment');
    if booked + _guest_count > ev.max_attendees then raise exception 'CAPACITY_EXCEEDED:เกินจำนวนผู้เข้าร่วมสูงสุดของงาน (เหลือ % ที่)', greatest(ev.max_attendees - booked,0); end if;
  end if;

  insert into public.bookings(event_id, code, guest_name, guest_count, organization, contact, status, payment_status,
    total_satang, manage_token_hash, idempotency_key, request_hash)
  values (ev.id, _code, btrim(_guest_name), _guest_count, nullif(btrim(_organization),''), nullif(btrim(_contact),''),
    'confirmed', 'not_required', total, _token_hash, _idempotency_key, _request_hash)
  returning * into b;

  insert into public.booking_tables(booking_id, event_id, table_id, table_number, capacity, price_satang)
  select b.id, ev.id, t.id, t.number, t.capacity, t.price_satang from public.event_tables t where t.id = any(_table_ids);

  insert into public.audit_logs(event_id, actor_type, action, details)
  values (ev.id, 'customer', 'booking.created', jsonb_build_object('booking_id', b.id, 'code', b.code, 'tables', n_tables));

  return jsonb_build_object('replayed', false, 'booking_id', b.id, 'code', b.code);
end $$;
revoke all on function public.create_booking_v2(text,uuid[],text,integer,text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.create_booking_v2(text,uuid[],text,integer,text,text,text,text,text,text,integer,integer) to service_role;

create or replace function public.public_event(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,'deposit_hours',e.deposit_hours,'balance_due_at',e.balance_due_at,'refund_policy',e.refund_policy,
    'slug', e.public_slug, 'version',e.version,'title', e.title, 'description', e.description, 'cover_url', e.cover_url,
    'organizer_name', e.organizer_name, 'contact_info', e.contact_info,
    'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'booking_opens_at', e.booking_opens_at, 'booking_closes_at', e.booking_closes_at,
    'cancel_deadline', e.cancel_deadline, 'venue_name', e.venue_name, 'venue_address', e.venue_address,
    'map_url', e.map_url, 'latitude', e.latitude, 'longitude', e.longitude,
    'max_attendees', e.max_attendees, 'announcement', e.announcement, 'schedule', e.schedule,
    'contact_required', e.contact_required, 'status', e.status, 'layout_meta', e.layout_meta,
    'booking_open', (e.status = 'published' and now() between e.booking_opens_at and e.booking_closes_at),
    'booked_attendees', coalesce((select sum(b.guest_count) from public.bookings b where b.event_id = e.id and b.status in ('confirmed','pending_payment')),0),
    'organizations', coalesce((select jsonb_agg(o.name order by o.name) from public.participating_organizations o where o.event_id = e.id), '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'number', t.number, 'name', t.name, 'zone', t.zone, 'capacity', t.capacity,
        'price_satang', t.price_satang, 'x', t.x, 'y', t.y,
        'state', case when t.status = 'disabled' then 'disabled'
                      when exists (select 1 from public.booking_tables bt where bt.table_id = t.id and bt.active) then case when exists(select 1 from public.booking_tables bt join public.bookings b on b.id=bt.booking_id where bt.table_id=t.id and bt.active and b.status='pending_payment') then 'held' else 'booked' end
                      when t.status = 'held' then 'held' else 'available' end
      ) order by t.number) from public.event_tables t where t.event_id = e.id), '[]'::jsonb)
  )
  from public.events e
  where e.public_slug = _slug and e.status in ('published','closed','completed','cancelled')
$$;
create function public.manager_cancel_booking(_booking_id uuid,_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings;
begin
 select b0.* into b from public.bookings b0 join public.events e on e.id=b0.event_id where b0.id=_booking_id and e.owner_id=auth.uid() for update of b0;
 if not found then raise exception 'NOT_FOUND:ไม่พบการจอง'; end if;
 if b.status='cancelled' then return jsonb_build_object('id',b.id,'status','cancelled'); end if;
 if b.status not in ('confirmed','pending_payment') then raise exception 'INVALID_STATE:ยกเลิกสถานะนี้ไม่ได้'; end if;
 if char_length(btrim(coalesce(_note,''))) not between 1 and 1000 then raise exception 'VALIDATION:กรุณาระบุเหตุผล'; end if;
 if exists(select 1 from public.payment_submissions where booking_id=b.id and status='pending') then raise exception 'INVALID_STATE:กรุณาตรวจสลิปที่รอพิจารณาก่อนยกเลิก'; end if;
 update public.bookings set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),payment_status=case when paid_satang>refunded_satang then 'refund_pending'::public.payment_status else payment_status end where id=b.id;
 update public.booking_tables set active=false where booking_id=b.id;
 update public.cancellation_requests set status='approved',decided_by=auth.uid(),decided_at=now(),decision_note=_note where booking_id=b.id and status='pending';
 insert into public.audit_logs(event_id,actor_id,actor_type,action,details) values(b.event_id,auth.uid(),'manager','booking.cancelled',jsonb_build_object('booking_id',b.id,'note',_note));
 return jsonb_build_object('id',b.id,'status','cancelled');
end $$;
revoke all on function public.manager_cancel_booking(uuid,text) from public,anon;
grant execute on function public.manager_cancel_booking(uuid,text) to authenticated,service_role;

create or replace function public.decide_cancellation(_request_id uuid,_approve boolean,_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cr public.cancellation_requests; bid uuid;
begin
 select c.booking_id into bid from public.cancellation_requests c join public.events e on e.id=c.event_id where c.id=_request_id and e.owner_id=auth.uid();
 if not found then raise exception 'NOT_FOUND:ไม่พบคำขอ'; end if;
 perform 1 from public.bookings where id=bid for update;
 select * into cr from public.cancellation_requests where id=_request_id for update;
 if cr.status<>'pending' then raise exception 'INVALID_STATE:คำขอนี้ดำเนินการแล้ว'; end if;
 if _approve then perform public.manager_cancel_booking(bid,coalesce(nullif(btrim(_note),''),'อนุมัติคำขอยกเลิก'));
 else update public.cancellation_requests set status='rejected',decided_by=auth.uid(),decided_at=now(),decision_note=_note where id=cr.id;
 end if;
 insert into public.audit_logs(event_id,actor_id,actor_type,action,details) values(cr.event_id,auth.uid(),'manager',case when _approve then 'cancellation.approved' else 'cancellation.rejected' end,jsonb_build_object('request_id',cr.id));
 return jsonb_build_object('request_id',cr.id,'status',case when _approve then 'approved' else 'rejected' end);
end $$;

notify pgrst, 'reload schema';
commit;
select 'เพิ่มระบบรับเงินเรียบร้อยแล้ว กลับไปลองสร้างงานในเว็บได้' as result;
