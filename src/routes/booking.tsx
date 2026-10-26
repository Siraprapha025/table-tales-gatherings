import { createFileRoute } from "@tanstack/react-router";
import { BookingPage } from "@/components/gatherings/booking-receipt";
export const Route = createFileRoute("/booking")({
  component: BookingPage,
  head: () => ({
    meta: [
      { title: "การจองของฉัน | โต๊ะพร้อม" },
      { name: "description", content: "ตรวจสอบการจองโต๊ะและสถานะชำระเงินของคุณ" },
      { property: "og:title", content: "การจองของฉัน | โต๊ะพร้อม" },
      { property: "og:description", content: "ตรวจสอบการจองโต๊ะและสถานะชำระเงินของคุณ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
});
