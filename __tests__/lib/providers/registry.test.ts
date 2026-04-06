import { describe, it, expect, beforeEach } from "vitest";
import { register, get, list } from "@/lib/providers/registry";
import type { ImageProvider } from "@/lib/providers/types";

function makeProvider(id: string, name: string): ImageProvider {
  return {
    id,
    name,
    healthCheck: async () => true,
    async *generate() {
      yield { type: "done" as const };
    },
  };
}

describe("provider registry", () => {
  // Re-import a fresh registry module for each test to avoid state bleed.
  // Since vitest caches modules, we use a local Map to simulate isolation.
  // The registry module uses a module-level Map, so tests that register
  // different providers will accumulate. We work around this by using
  // unique ids per test.

  it("registers and retrieves a provider", () => {
    const p = makeProvider("test-reg-1", "Test Provider 1");
    register(p);
    expect(get("test-reg-1")).toBe(p);
  });

  it("returns undefined for unknown provider id", () => {
    expect(get("does-not-exist-xyz")).toBeUndefined();
  });

  it("lists registered providers", () => {
    const a = makeProvider("list-a", "Provider A");
    const b = makeProvider("list-b", "Provider B");
    register(a);
    register(b);

    const listed = list();
    const ids = listed.map((p) => p.id);
    expect(ids).toContain("list-a");
    expect(ids).toContain("list-b");

    // Each entry only has id and name
    for (const entry of listed) {
      expect(Object.keys(entry).sort()).toEqual(["id", "name"]);
    }
  });

  it("list entries have correct name values", () => {
    const p = makeProvider("list-name-check", "My Named Provider");
    register(p);
    const entry = list().find((e) => e.id === "list-name-check");
    expect(entry?.name).toBe("My Named Provider");
  });

  it("overwriting a provider id replaces the entry", () => {
    const first = makeProvider("overwrite-me", "First");
    const second = makeProvider("overwrite-me", "Second");
    register(first);
    register(second);
    expect(get("overwrite-me")).toBe(second);
  });
});
