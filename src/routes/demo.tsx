import { createFileRoute } from "@tanstack/react-router";
import { PublicEventPage } from "@/components/gatherings/public-event";
export const Route = createFileRoute("/demo")({
  component: () => <PublicEventPage slug="demo-gala" preview />,
});
