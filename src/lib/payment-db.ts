import type { Event, Booking } from "./contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PaymentSubmission, Refund } from "./payment-contracts";
type Rpc<A> = { Args: A; Returns: Json };
type Relation<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };
type PaymentDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "events" | "bookings"> & {
      events: Relation<Event>;
      bookings: Relation<Booking>;
      payment_submissions: Relation<PaymentSubmission>;
      manual_refunds: Relation<Refund>;
    };
    Functions: Omit<
      Database["public"]["Functions"],
      | "create_booking_v2"
      | "booking_finances"
      | "submit_payment"
      | "review_payment"
      | "record_manual_refund"
      | "manager_cancel_booking"
    > & {
      create_booking_v2: Rpc<
        Database["public"]["Functions"]["create_booking"]["Args"] & {
          _expected_total: number;
          _expected_version: number | null;
        }
      >;
      booking_finances: Rpc<{ _token_hash: string }>;
      submit_payment: Rpc<{
        _token_hash: string;
        _amount: number;
        _paid_at: string;
        _path: string;
        _hash: string;
        _request_id: string;
      }>;
      review_payment: Rpc<{ _id: string; _approve: boolean; _reference: string; _note: string }>;
      record_manual_refund: Rpc<{
        _booking_id: string;
        _amount: number;
        _paid_at: string;
        _reference: string;
        _note: string;
        _request_id: string;
      }>;
      manager_cancel_booking: Rpc<{ _booking_id: string; _note: string }>;
    };
  };
};
// Keep generated Lovable types untouched; this extension matches the new SQL migration.
export const paymentsDb = (client: SupabaseClient<Database>) =>
  client as unknown as SupabaseClient<PaymentDatabase>;
