import { createFileRoute } from "@tanstack/react-router";
import { BookingPage } from "@/components/gatherings/booking-receipt";
export const Route = createFileRoute("/booking")({
  component: BookingPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
});
