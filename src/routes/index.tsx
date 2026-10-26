import { createFileRoute } from "@tanstack/react-router";
import { ManagerPage } from "@/components/gatherings/manager";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: "โต๊ะพร้อม | จัดการงานและการจองโต๊ะ" },
    { name: "description", content: "จัดการงานเลี้ยง ผังโต๊ะ การจอง และรายการรับเงินด้วยโต๊ะพร้อม" },
    { property: "og:title", content: "โต๊ะพร้อม | จัดการงานและการจองโต๊ะ" },
    { property: "og:description", content: "จัดการงานเลี้ยง ผังโต๊ะ การจอง และรายการรับเงินด้วยโต๊ะพร้อม" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <ManagerPage />;
}
