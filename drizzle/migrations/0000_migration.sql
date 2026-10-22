
-- ========== ROLES & PROFILES ==========
create type public.app_role as enum ('manager', 'developer');
create type public.event_status as enum ('draft','published','closed','cancelled','completed');
create type public.table_status as enum ('available','held','disabled');
create type public.booking_status as enum ('confirmed','pending_payment','cancelled','expired');
create type public.payment_status as enum ('not_required','pending','paid','refund_pending','refunded','failed');
create type public.cancel_status as enum ('pending','approved','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ========== EVENTS ==========
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  cover_url text,
  organizer_name text not null default '',
  contact_info text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booking_opens_at timestamptz not null,
  booking_closes_at timestamptz not null,
  cancel_deadline timestamptz,
  venue_name text not null default '',
  venue_address text not null default '',
  map_url text,
  latitude double precision,
  longitude double precision,
  max_attendees integer check (max_attendees is null or max_attendees > 0),
  announcement text not null default '',
  schedule text not null default '',
  contact_required boolean not null default false,
  payment_mode text not null default 'none' check (payment_mode in ('none','required')),
  status public.event_status not null default 'draft',
  public_slug text unique,
  layout_meta jsonb not null default '{"stage":{"x":350,"y":20,"w":300,"h":60},"entrance":{"x":440,"y":560,"w":120,"h":30}}'::jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_owner_idx on public.events(owner_id);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "owner select events" on public.events for select to authenticated using (owner_id = auth.uid());
create policy "owner insert events" on public.events for insert to authenticated with check (owner_id = auth.uid() and public.has_role(auth.uid(),'manager'));
create policy "owner update events" on public.events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner delete draft events" on public.events for delete to authenticated using (owner_id = auth.uid() and status = 'draft');

create or replace function public.validate_event()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ends_at <= new.starts_at then raise exception 'VALIDATION:เวลาสิ้นสุดงานต้องอยู่หลังเวลาเริ่มงาน'; end if;
  if new.booking_closes_at <= new.booking_opens_at then raise exception 'VALIDATION:เวลาปิดรับจองต้องอยู่หลังเวลาเปิดรับจอง'; end if;
  if new.booking_closes_at > new.ends_at then raise exception 'VALIDATION:ต้องปิดรับจองก่อนงานสิ้นสุด'; end if;
  if new.cancel_deadline is not null and new.cancel_deadline > new.starts_at then raise exception 'VALIDATION:กำหนดยื่นคำขอยกเลิกต้องไม่เกินเวลาเริ่มงาน'; end if;
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id and old.owner_id is not null then raise exception 'VALIDATION:ไม่สามารถเปลี่ยนเจ้าของงาน'; end if;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger events_validate before insert or update on public.events for each row execute function public.validate_event();

-- ========== TABLES ==========
create table public.event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  number integer not null check (number > 0),
  name text not null default '',
  zone text not null default '',
  capacity integer not null check (capacity between 1 and 30),
  price_satang integer not null default 0 check (price_satang >= 0),
  x integer not null default 0,
  y integer not null default 0,
  status public.table_status not null default 'available',
  created_at timestamptz not null default now(),
  unique (event_id, number)
);
create index event_tables_event_idx on public.event_tables(event_id);
grant select, insert, update, delete on public.event_tables to authenticated;
grant all on public.event_tables to service_role;
alter table public.event_tables enable row level security;
create policy "owner all tables" on public.event_tables for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create table public.participating_organizations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (event_id, name)
);
grant select, insert, update, delete on public.participating_organizations to authenticated;
grant all on public.participating_organizations to service_role;
alter table public.participating_organizations enable row level security;
create policy "owner all orgs" on public.participating_organizations for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

-- ========== BOOKINGS ==========
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null unique,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  guest_count integer not null check (guest_count > 0),
  organization text,
  contact text,
  status public.booking_status not null default 'confirmed',
  payment_status public.payment_status not null default 'not_required',
  total_satang integer not null default 0 check (total_satang >= 0),
  currency text not null default 'THB',
  manage_token_hash text not null unique,
  idempotency_key text not null,
  request_hash text not null,
  expires_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_at timestamptz not null default now(),
  unique (event_id, idempotency_key)
);
create index bookings_event_idx on public.bookings(event_id);
grant select, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "owner read bookings" on public.bookings for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create table public.booking_tables (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  table_id uuid not null references public.event_tables(id) on delete restrict,
  table_number integer not null,
  capacity integer not null,
  price_satang integer not null,
  active boolean not null default true
);
create unique index booking_tables_active_uniq on public.booking_tables(table_id) where active;
create index booking_tables_booking_idx on public.booking_tables(booking_id);
grant select on public.booking_tables to authenticated;
grant all on public.booking_tables to service_role;
alter table public.booking_tables enable row level security;
create policy "owner read booking tables" on public.booking_tables for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create or replace function public.guard_table_changes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.booking_tables where table_id = old.id and active) then
      raise exception 'TABLE_HAS_BOOKING:ไม่สามารถลบโต๊ะ % ที่มีการจองอยู่', old.number;
    end if;
    return old;
  end if;
  if new.capacity < old.capacity and exists (select 1 from public.booking_tables where table_id = old.id and active) then
    raise exception 'TABLE_HAS_BOOKING:ลดจำนวนที่นั่งโต๊ะ % ไม่ได้ เพราะมีการจองอยู่', old.number;
  end if;
  if new.status = 'disabled' and old.status <> 'disabled' and exists (select 1 from public.booking_tables where table_id = old.id and active) then
    raise exception 'TABLE_HAS_BOOKING:ปิดใช้งานโต๊ะ % ไม่ได้ เพราะมีการจองอยู่', old.number;
  end if;
  return new;
end $$;
create trigger event_tables_guard before update or delete on public.event_tables for each row execute function public.guard_table_changes();

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  status public.cancel_status not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create unique index cancel_one_pending on public.cancellation_requests(booking_id) where status = 'pending';
create index cancel_event_idx on public.cancellation_requests(event_id);
grant select on public.cancellation_requests to authenticated;
grant all on public.cancellation_requests to service_role;
alter table public.cancellation_requests enable row level security;
create policy "owner read cancels" on public.cancellation_requests for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  actor_id uuid,
  actor_type text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_event_idx on public.audit_logs(event_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "owner read audit" on public.audit_logs for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;

-- ========== FUTURE EXTENSIONS (owner-readable only) ==========
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null default 'sandbox',
  provider_ref text unique,
  amount_satang integer not null check (amount_satang >= 0),
  currency text not null default 'THB',
  status public.payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now()
);
create table public.line_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  line_user_id text not null unique,
  linked_at timestamptz not null default now()
);
create table public.agent_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  event_id uuid references public.events(id) on delete cascade,
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  confirmed_version integer,
  result jsonb,
  created_at timestamptz not null default now()
);
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid
);
grant select on public.payments, public.agent_action_logs, public.check_ins to authenticated;
grant select on public.line_account_links to authenticated;
grant all on public.payments, public.line_account_links, public.agent_action_logs, public.check_ins to service_role;
alter table public.payments enable row level security;
alter table public.line_account_links enable row level security;
alter table public.agent_action_logs enable row level security;
alter table public.check_ins enable row level security;
create policy "owner read payments" on public.payments for select to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
create policy "own line link" on public.line_account_links for select to authenticated using (user_id = auth.uid());
create policy "owner read agent logs" on public.agent_action_logs for select to authenticated using (actor_id = auth.uid());
create policy "owner read checkins" on public.check_ins for select to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

-- ========== SIGNUP TRIGGER ==========
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'manager');
  select not exists (select 1 from public.user_roles where role = 'developer') into is_first;
  if is_first then
    insert into public.user_roles(user_id, role) values (new.id, 'developer');
    update public.events set owner_id = new.id where owner_id is null;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ========== BUSINESS FUNCTIONS (service_role only; called by server API) ==========
create or replace function public.rate_limit_hit(_key text, _max integer, _window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits as rl(key, window_start, count) values (_key, now(), 1)
  on conflict (key) do update set
    count = case when rl.window_start < now() - make_interval(secs => _window_seconds) then 1 else rl.count + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => _window_seconds) then now() else rl.window_start end
  returning * into r;
  return r.count > _max;
end $$;

create or replace function public.public_event(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', e.public_slug, 'title', e.title, 'description', e.description, 'cover_url', e.cover_url,
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
                      when exists (select 1 from public.booking_tables bt where bt.table_id = t.id and bt.active) then 'booked'
                      when t.status = 'held' then 'held' else 'available' end
      ) order by t.number) from public.event_tables t where t.event_id = e.id), '[]'::jsonb)
  )
  from public.events e
  where e.public_slug = _slug and e.status in ('published','closed','completed','cancelled')
$$;

create or replace function public.create_booking(
  _slug text, _table_ids uuid[], _guest_name text, _guest_count integer,
  _organization text, _contact text, _idempotency_key text, _request_hash text,
  _token_hash text, _code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev public.events; existing public.bookings; b public.bookings;
  n_tables integer; cap integer; total integer; booked integer; taken integer;
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

create or replace function public.booking_by_token(_token_hash text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', b.code, 'guest_name', b.guest_name, 'guest_count', b.guest_count, 'organization', b.organization,
    'contact', b.contact, 'status', b.status, 'payment_status', b.payment_status, 'total_satang', b.total_satang,
    'created_at', b.created_at, 'cancelled_at', b.cancelled_at,
    'tables', (select jsonb_agg(jsonb_build_object('number', bt.table_number, 'capacity', bt.capacity, 'price_satang', bt.price_satang) order by bt.table_number) from public.booking_tables bt where bt.booking_id = b.id),
    'cancellation', (select jsonb_build_object('status', c.status, 'reason', c.reason, 'created_at', c.created_at, 'decided_at', c.decided_at, 'decision_note', c.decision_note)
                     from public.cancellation_requests c where c.booking_id = b.id order by c.created_at desc limit 1),
    'event', jsonb_build_object('slug', e.public_slug, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
                                'venue_name', e.venue_name, 'venue_address', e.venue_address, 'map_url', e.map_url,
                                'cancel_deadline', e.cancel_deadline, 'contact_info', e.contact_info)
  ) from public.bookings b join public.events e on e.id = b.event_id where b.manage_token_hash = _token_hash
$$;

create or replace function public.request_cancellation(_token_hash text, _reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings; ev public.events; cr public.cancellation_requests;
begin
  select * into b from public.bookings where manage_token_hash = _token_hash for update;
  if not found then raise exception 'NOT_FOUND:ไม่พบการจอง'; end if;
  if b.status not in ('confirmed','pending_payment') then raise exception 'INVALID_STATE:การจองนี้ถูกยกเลิกแล้ว'; end if;
  select * into ev from public.events where id = b.event_id;
  if ev.cancel_deadline is not null and now() > ev.cancel_deadline then raise exception 'DEADLINE_PASSED:เลยกำหนดยื่นคำขอยกเลิกแล้ว'; end if;
  if exists (select 1 from public.cancellation_requests where booking_id = b.id and status = 'pending') then
    raise exception 'ALREADY_PENDING:มีคำขอยกเลิกที่รอดำเนินการอยู่แล้ว';
  end if;
  insert into public.cancellation_requests(booking_id, event_id, reason) values (b.id, b.event_id, btrim(_reason)) returning * into cr;
  insert into public.audit_logs(event_id, actor_type, action, details) values (b.event_id, 'customer', 'cancellation.requested', jsonb_build_object('booking_id', b.id, 'request_id', cr.id));
  return jsonb_build_object('request_id', cr.id, 'status', cr.status);
end $$;

-- Manager functions (authenticated; check ownership inside)
create or replace function public.decide_cancellation(_request_id uuid, _approve boolean, _note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cr public.cancellation_requests; ev public.events;
begin
  select * into cr from public.cancellation_requests where id = _request_id for update;
  if not found then raise exception 'NOT_FOUND:ไม่พบคำขอ'; end if;
  select * into ev from public.events where id = cr.event_id;
  if ev.owner_id is distinct from auth.uid() then raise exception 'FORBIDDEN:ไม่มีสิทธิ์จัดการคำขอนี้'; end if;
  if cr.status <> 'pending' then raise exception 'INVALID_STATE:คำขอนี้ดำเนินการแล้ว'; end if;
  update public.cancellation_requests set status = case when _approve then 'approved'::public.cancel_status else 'rejected'::public.cancel_status end,
    decided_by = auth.uid(), decided_at = now(), decision_note = nullif(btrim(coalesce(_note,'')),'') where id = cr.id;
  if _approve then
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      payment_status = case when payment_status = 'paid' then 'refund_pending'::public.payment_status else payment_status end
      where id = cr.booking_id;
    update public.booking_tables set active = false where booking_id = cr.booking_id;
  end if;
  insert into public.audit_logs(event_id, actor_id, actor_type, action, details)
  values (cr.event_id, auth.uid(), 'manager', case when _approve then 'cancellation.approved' else 'cancellation.rejected' end, jsonb_build_object('request_id', cr.id, 'booking_id', cr.booking_id));
  return jsonb_build_object('request_id', cr.id, 'status', case when _approve then 'approved' else 'rejected' end);
end $$;

create or replace function public.publish_event(_event_id uuid, _expected_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.events; slug text;
begin
  select * into ev from public.events where id = _event_id for update;
  if not found or ev.owner_id is distinct from auth.uid() then raise exception 'NOT_FOUND:ไม่พบงาน'; end if;
  if _expected_version is not null and ev.version <> _expected_version then raise exception 'VERSION_CONFLICT:ข้อมูลงานถูกแก้ไขหลังจากที่คุณตรวจสอบ กรุณาตรวจสอบอีกครั้ง'; end if;
  if ev.status not in ('draft','closed') then raise exception 'INVALID_STATE:สถานะงานปัจจุบันเผยแพร่ไม่ได้'; end if;
  if not exists (select 1 from public.event_tables where event_id = ev.id and status <> 'disabled') then raise exception 'VALIDATION:ต้องมีโต๊ะที่เปิดใช้งานอย่างน้อย 1 โต๊ะ'; end if;
  slug := coalesce(ev.public_slug, lower(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
  update public.events set status = 'published', public_slug = slug, published_at = coalesce(published_at, now()) where id = ev.id;
  insert into public.audit_logs(event_id, actor_id, actor_type, action, details) values (ev.id, auth.uid(), 'manager', 'event.published', jsonb_build_object('slug', slug));
  return jsonb_build_object('slug', slug, 'status', 'published');
end $$;

create or replace function public.event_summary(_event_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'event_id', e.id, 'title', e.title, 'status', e.status, 'slug', e.public_slug, 'version', e.version,
    'tables_total', (select count(*) from public.event_tables where event_id = e.id),
    'tables_disabled', (select count(*) from public.event_tables where event_id = e.id and status = 'disabled'),
    'tables_booked', (select count(*) from public.booking_tables where event_id = e.id and active),
    'seats_total', (select coalesce(sum(capacity),0) from public.event_tables where event_id = e.id and status <> 'disabled'),
    'bookings_active', (select count(*) from public.bookings where event_id = e.id and status in ('confirmed','pending_payment')),
    'guests_booked', (select coalesce(sum(guest_count),0) from public.bookings where event_id = e.id and status in ('confirmed','pending_payment')),
    'revenue_satang', (select coalesce(sum(total_satang),0) from public.bookings where event_id = e.id and status in ('confirmed','pending_payment')),
    'cancellations_pending', (select count(*) from public.cancellation_requests where event_id = e.id and status = 'pending'),
    'max_attendees', e.max_attendees
  ) from public.events e where e.id = _event_id and e.owner_id = auth.uid()
$$;

revoke execute on function public.rate_limit_hit(text,integer,integer) from public, anon, authenticated;
revoke execute on function public.public_event(text) from public, anon, authenticated;
revoke execute on function public.create_booking(text,uuid[],text,integer,text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.booking_by_token(text) from public, anon, authenticated;
revoke execute on function public.request_cancellation(text,text) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text,integer,integer), public.public_event(text),
  public.create_booking(text,uuid[],text,integer,text,text,text,text,text,text),
  public.booking_by_token(text), public.request_cancellation(text,text) to service_role;
revoke execute on function public.decide_cancellation(uuid,boolean,text), public.publish_event(uuid,integer), public.event_summary(uuid) from public, anon;
grant execute on function public.decide_cancellation(uuid,boolean,text), public.publish_event(uuid,integer), public.event_summary(uuid) to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ========== DEMO DATA (owner assigned to first signed-up manager) ==========
do $$
declare eid uuid := gen_random_uuid(); i integer; tid uuid; bid uuid;
begin
  insert into public.events(id, owner_id, title, description, organizer_name, contact_info, starts_at, ends_at,
    booking_opens_at, booking_closes_at, cancel_deadline, venue_name, venue_address, map_url, max_attendees,
    announcement, schedule, status, public_slug, published_at)
  values (eid, null, 'งานเลี้ยงขอบคุณเครือข่ายประจำปี 2569 (ตัวอย่าง)',
    'งานเลี้ยงโต๊ะจีนตัวอย่างสำหรับทดลองระบบ ข้อมูลทั้งหมดเป็นข้อมูลสมมติ',
    'สมาคมตัวอย่าง', 'โทร 02-000-0000 (สมมติ)',
    '2026-12-20 18:00:00+07', '2026-12-20 22:00:00+07',
    '2026-10-01 09:00:00+07', '2026-12-15 23:59:00+07', '2026-12-13 23:59:00+07',
    'ห้องบอลรูม โรงแรมตัวอย่าง', '123 ถนนสมมติ เขตตัวอย่าง กรุงเทพฯ', 'https://maps.google.com/?q=13.7563,100.5018', 160,
    'แต่งกายสุภาพ โทนสีแดงทอง', E'18:00 ลงทะเบียน\n18:30 พิธีเปิด\n19:00 รับประทานอาหาร\n21:30 จับรางวัล',
    'published', 'demo-gala', now());
  insert into public.participating_organizations(event_id, name) values (eid,'บริษัท ก (สมมติ)'),(eid,'บริษัท ข (สมมติ)'),(eid,'ชมรม ค (สมมติ)');
  for i in 1..20 loop
    insert into public.event_tables(event_id, number, name, zone, capacity, price_satang, x, y, status)
    values (eid, i, 'โต๊ะ ' || i, case when i <= 5 then 'VIP' else 'ทั่วไป' end, 8,
      case when i <= 5 then 600000 else 350000 end,
      120 + ((i-1) % 5) * 180, 140 + ((i-1) / 5) * 105,
      case when i in (19,20) then 'disabled'::public.table_status else 'available'::public.table_status end)
    returning id into tid;
    if i in (1,2,7) then
      insert into public.bookings(event_id, code, guest_name, guest_count, organization, status, total_satang, manage_token_hash, idempotency_key, request_hash)
      values (eid, 'DEMO-' || lpad(i::text,3,'0'), 'ผู้จองตัวอย่าง ' || i, 8, 'บริษัท ก (สมมติ)', 'confirmed',
        case when i <= 5 then 600000 else 350000 end, md5(gen_random_uuid()::text), 'seed-' || i, 'seed')
      returning id into bid;
      insert into public.booking_tables(booking_id, event_id, table_id, table_number, capacity, price_satang)
      values (bid, eid, tid, i, 8, case when i <= 5 then 600000 else 350000 end);
    end if;
  end loop;
end $$;
