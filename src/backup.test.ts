import { describe, expect, it } from "vitest";
import { backupDocument, readBackup } from "./backup";
import { defaultPreferences } from "./preferences";

describe("backups", () => {
  it("bring the settings and workspaces back, but keep this PC's sync file", () => {
    const preferences = { ...defaultPreferences, fontSize: 17, syncFile: "D:\\OneDrive\\shelduck.json" };
    const workspace = { id: "w", name: "Shop", savedAt: 1, snapshot: { version: 3 as const, activeTabIndex: 0, tabs: [] } };
    const backup = readBackup(backupDocument(preferences, [workspace], 42));
    expect(backup.savedAt).toBe(42);
    expect(backup.workspaces).toEqual([workspace]);
    const restored = backup.preferences({ ...defaultPreferences, syncFile: "" });
    expect(restored.fontSize).toBe(17);
    expect(restored.syncFile).toBe("");
  });

  it("open backups written by Nebula Terminal", () => {
    const former = JSON.stringify({ app: "nebula-terminal", kind: "backup", version: 1, savedAt: 7, preferences: { fontSize: 18, defaultProfileId: "nebula" }, workspaces: [] });
    const restored = readBackup(former).preferences(defaultPreferences);
    expect([restored.fontSize, restored.defaultProfileId]).toEqual([18, "shelduck"]);
  });

  it("refuse other files", () => {
    expect(() => readBackup("not json")).toThrow("isn't a Shelduck backup");
    expect(() => readBackup(JSON.stringify({ app: "shelduck", kind: "theme" }))).toThrow();
  });
});
