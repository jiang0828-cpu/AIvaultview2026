export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && !path.startsWith('/share-links/'))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      response.status,
      body?.error?.message || "请求失败，请稍后重试",
      body?.error?.retryAfter,
    );
  }
  return body as T;
}
