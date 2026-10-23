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
create trigger bookings_free_phase before insert on public.bookings for each row execute function public.guard_booking_insert();

-- Do not mutate the identity of a table or move it between events with history.
create or replace function public.guard_table_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.event_id <> old.event_id or new.id <> old.id then
    raise exception 'VALIDATION:ไม่สามารถย้ายโต๊ะไปงานอื่นหรือเปลี่ยนรหัสโต๊ะ';
  end if;
  return new;
end $$;
create trigger tables_identity before update on public.event_tables for each row execute function public.guard_table_identity();

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
create trigger events_capacity before update on public.events for each row execute function public.guard_event_capacity();
