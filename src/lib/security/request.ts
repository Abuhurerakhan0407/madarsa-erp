export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function isJsonRequest(request: Request): boolean {
  return request.headers
    .get("content-type")
    ?.toLowerCase()
    .split(";")[0].trim() === "application/json";
}

export async function readBoundedJson(request: Request, maxBytes = 32_768): Promise<
  { ok: true; value: unknown } | { ok: false; status: 400 | 413; error: string }
> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: "Invalid JSON body." };
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Request body is too large." };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return { ok: true, value: JSON.parse(text + decoder.decode()) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  } finally {
    reader.releaseLock();
  }
}
