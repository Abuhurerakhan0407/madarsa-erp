import { describe, expect, it } from "vitest";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "./request";

describe("mutation request guards", () => {
  it("enforces actual bytes even with a forged small Content-Length", async () => {
    const request = new Request("https://app.example.com/api", {
      method: "POST", headers: { "content-length": "1" }, body: JSON.stringify({ note: "ا".repeat(10) })
    });
    expect(await readBoundedJson(request, 24)).toMatchObject({ ok: false, status: 413 });
  });

  it("limits chunked requests without Content-Length", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode('{"note":"'));
      controller.enqueue(encoder.encode("x".repeat(100)));
      controller.close();
    } });
    const request = new Request("https://app.example.com/api", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readBoundedJson(request, 24)).toMatchObject({ ok: false, status: 413 });
  });

  it("accepts multilingual JSON within the limit and rejects malformed JSON", async () => {
    const request = (body: string) => new Request("https://app.example.com/api", { method: "POST", body });
    expect(await readBoundedJson(request('{"name":"ابو"}'))).toEqual({ ok: true, value: { name: "ابو" } });
    expect(await readBoundedJson(request("{"))).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects JSON-looking but unsupported media types", () => {
    expect(isJsonRequest(new Request("https://app.example.com", { headers: { "content-type": "application/jsonp" } }))).toBe(false);
  });

  it("accepts same-origin requests and rejects cross-origin requests", () => {
    expect(
      isSameOriginRequest(
        new Request("https://app.example.com/api/action", {
          headers: { origin: "https://app.example.com" }
        })
      )
    ).toBe(true);

    expect(
      isSameOriginRequest(
        new Request("https://app.example.com/api/action", {
          headers: { origin: "https://attacker.example" }
        })
      )
    ).toBe(false);
  });

  it("allows requests without Origin for server-to-server compatibility", () => {
    expect(isSameOriginRequest(new Request("https://app.example.com/api/action"))).toBe(true);
  });

  it("requires JSON content for JSON mutation endpoints", () => {
    expect(
      isJsonRequest(
        new Request("https://app.example.com/api/action", {
          headers: { "content-type": "application/json; charset=utf-8" }
        })
      )
    ).toBe(true);

    expect(
      isJsonRequest(
        new Request("https://app.example.com/api/action", {
          headers: { "content-type": "text/plain" }
        })
      )
    ).toBe(false);
  });
});
