import { createFileRoute } from "@tanstack/react-router";
import { PublicEventPage } from "@/components/gatherings/public-event";
export const Route = createFileRoute("/e/$slug")({
  component: Page,
  head: () => ({ meta: [
    { title: "จองโต๊ะร่วมงาน | โต๊ะพร้อม" },
    { name: "description", content: "เลือกโต๊ะและจองที่นั่งร่วมงานเลี้ยงกับโต๊ะพร้อม" },
    { property: "og:title", content: "จองโต๊ะร่วมงาน | โต๊ะพร้อม" },
    { property: "og:description", content: "เลือกโต๊ะและจองที่นั่งร่วมงานเลี้ยงกับโต๊ะพร้อม" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});
function Page() {
  const { slug } = Route.useParams();
  return <PublicEventPage slug={slug} />;
}
