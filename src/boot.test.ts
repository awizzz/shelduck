import { afterEach, describe, expect, it, vi } from "vitest";
import script from "../public/boot.js?raw";

function boot(entries: Record<string, string>): Map<string, string> {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("localStorage", {
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  vi.stubGlobal("document", { documentElement: { style: { setProperty: () => {} }, dataset: {} } });
  vi.stubGlobal("location", { hash: "" });
  new Function(script)();
  return store;
}

describe("boot", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves what Nebula Terminal saved to Shelduck's names", () => {
    const store = boot({
      "nebula-terminal.preferences.v4": '{"fontSize":15}',
      "nebula-terminal.session.v3": '{"tabs":[]}',
      "nebula-terminal.update-dismissed": "2.11.0",
      unrelated: "kept",
    });
    expect(Object.fromEntries(store)).toEqual({
      "shelduck.preferences.v4": '{"fontSize":15}',
      "shelduck.session.v3": '{"tabs":[]}',
      "shelduck.update-dismissed": "2.11.0",
      unrelated: "kept",
    });
  });

  it("never replaces settings Shelduck already saved", () => {
    const store = boot({ "nebula-terminal.preferences.v4": "old", "shelduck.preferences.v4": "new" });
    expect(store.get("shelduck.preferences.v4")).toBe("new");
    expect(store.get("nebula-terminal.preferences.v4")).toBe("old");
  });
});
