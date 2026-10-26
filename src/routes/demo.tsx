import { createFileRoute } from "@tanstack/react-router";
import { PublicEventPage } from "@/components/gatherings/public-event";
export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [
    { title: "งานตัวอย่างและผังโต๊ะ | โต๊ะพร้อม" },
    { name: "description", content: "ชมงานตัวอย่างและผังโต๊ะสำหรับการจองงานเลี้ยง" },
    { property: "og:title", content: "งานตัวอย่างและผังโต๊ะ | โต๊ะพร้อม" },
    { property: "og:description", content: "ชมงานตัวอย่างและผังโต๊ะสำหรับการจองงานเลี้ยง" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <PublicEventPage slug="demo-gala" preview />,
});
