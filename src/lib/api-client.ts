import { API_BASE } from "./contracts";
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    accessToken?: string;
    manageToken?: string;
    requestId?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.body instanceof FormData) delete headers["Content-Type"];
  if (options.accessToken) headers["Authorization"] = `Bearer ${options.accessToken}`;
  if (options.manageToken) headers["X-Manage-Token"] = options.manageToken;
  if (options.requestId) headers["Idempotency-Key"] = options.requestId;
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined
      ? {}
      : { body: options.body instanceof FormData ? options.body : JSON.stringify(options.body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      data?.error?.message ?? "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่",
      response.status,
    );
  return data as T;
}
export function newManageToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
