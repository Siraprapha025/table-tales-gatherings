-- These organizer-only records must not inherit anonymous Data API privileges.
revoke all on public.payment_submissions, public.manual_refunds from anon;
revoke insert, update, delete, truncate, references, trigger on public.payment_submissions, public.manual_refunds from authenticated;
grant select on public.payment_submissions, public.manual_refunds to authenticated;
grant all on public.payment_submissions, public.manual_refunds to service_role;