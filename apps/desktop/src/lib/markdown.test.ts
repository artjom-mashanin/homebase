import { describe, expect, it } from "vitest";

import { getTitleFromBody, isMeaningfulBody, parseNoteFile, stringifyNoteFile } from "./markdown";

describe("markdown helpers", () => {
  it("parses YAML frontmatter and body", () => {
    const raw = `---\nid: test\ncreated: 2026-01-01T00:00:00Z\nmodified: 2026-01-01T00:00:00Z\nprojects: [p1]\n---\n\n# Hello\n\nBody`;
    const parsed = parseNoteFile(raw);
    expect(parsed.frontmatter.id).toBe("test");
    expect(parsed.frontmatter.projects).toEqual(["p1"]);
    expect(parsed.body).toContain("# Hello");
  });

  it("stringifies note file with frontmatter", () => {
    const out = stringifyNoteFile(
      {
        id: "abc",
        created: "2026-01-01T00:00:00Z",
        modified: "2026-01-02T00:00:00Z",
        projects: [],
        topics: ["one", "two"],
        user_placed: false,
      },
      "# Title\n\nText",
    );
    expect(out).toContain("id: abc");
    expect(out).toContain("topics:");
    expect(out).toContain("# Title");
  });

  it("extracts title from first H1", () => {
    expect(getTitleFromBody("# One\n\nTwo")).toBe("One");
    expect(getTitleFromBody("   # One\n\nTwo")).toBe("One");
    expect(getTitleFromBody("- item\n- two")).toBe("item");
    expect(getTitleFromBody("")).toBe("");
  });

  it("detects meaningful body", () => {
    expect(isMeaningfulBody("")).toBe(false);
    expect(isMeaningfulBody("\n\n")).toBe(false);
    expect(isMeaningfulBody("- [ ] ")).toBe(false);
    expect(isMeaningfulBody("- [ ] do it")).toBe(true);
    expect(isMeaningfulBody("# Title")).toBe(true);
  });
});
