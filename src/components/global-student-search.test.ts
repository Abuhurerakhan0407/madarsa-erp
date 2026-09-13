import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = await readFile(new URL("./global-student-search.tsx", import.meta.url), "utf8");

describe("global student search accessibility contract", () => {
  it("exposes combobox state and active-option semantics", () => {
    expect(source).toContain('role="combobox"');
    expect(source).toContain('aria-expanded={open}');
    expect(source).toContain('aria-controls={LISTBOX_ID}');
    expect(source).toContain('aria-activedescendant={activeId}');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain('aria-selected={index === activeIndex}');
  });

  it("supports keyboard navigation and dismissal", () => {
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key === "Enter"');
  });

  it("does not turn request failures into an empty-result message", () => {
    expect(source).toContain('if (!response.ok) throw new Error');
    expect(source).toContain('setError(true)');
    expect(source).toContain('role="alert"');
    expect(source).toContain('setRetryNonce((value) => value + 1)');
  });
});
