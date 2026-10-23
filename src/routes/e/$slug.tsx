import { createFileRoute } from "@tanstack/react-router";
import { PublicEventPage } from "@/components/gatherings/public-event";
export const Route = createFileRoute("/e/$slug")({ component: Page });
function Page() {
  const { slug } = Route.useParams();
  return <PublicEventPage slug={slug} />;
}
