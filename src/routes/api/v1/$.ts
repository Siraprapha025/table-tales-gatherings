import { createFileRoute } from "@tanstack/react-router";

const serve = async ({ request }: { request: Request }) => {
  const { dispatchApi } = await import("@/lib/booking-api.server");
  return dispatchApi(request);
};
export const Route = createFileRoute("/api/v1/$")({
  server: { handlers: { GET: serve, POST: serve, PATCH: serve, DELETE: serve } },
});
