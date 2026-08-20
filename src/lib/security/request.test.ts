import { describe, expect, it } from "vitest";
import { isJsonRequest, isSameOriginRequest } from "./request";

describe("mutation request guards", () => {
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
