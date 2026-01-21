import { describe, expect, it } from "vitest";

import {
  buildTaskLine,
  createTaskId,
  parseTasksFromMarkdown,
  parseTaskInput,
  stripTaskMetadata,
  updateTaskMetadata,
  updateTaskStatus,
} from "./tasks";

describe("tasks helpers", () => {
  it("parses tasks with ids and metadata", () => {
    const md = [
      "- [ ] Call Alex #task:abc123 @due(2026-01-22) @priority(high) @every(weekly) @order(2000)",
      "- [x] Done item #task:done1",
      "- [ ] Regular checkbox",
    ].join("\n");

    const tasks = parseTasksFromMarkdown(md);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe("abc123");
    expect(tasks[0].due).toBe("2026-01-22");
    expect(tasks[0].priority).toBe("high");
    expect(tasks[0].every).toBe("weekly");
    expect(tasks[0].order).toBe(2000);
    expect(tasks[0].status).toBe("todo");
    expect(tasks[0].title).toBe("Call Alex");
    expect(tasks[1].status).toBe("done");
  });

  it("strips task metadata cleanly", () => {
    expect(
      stripTaskMetadata("Ship it #task:abc @due(2026-01-01) @every(daily) @order(1000)"),
    ).toBe("Ship it");
  });

  it("updates task status", () => {
    const md = "- [ ] Task #task:abc";
    const updated = updateTaskStatus(md, "abc", "done");
    expect(updated).toContain("[x]");
  });

  it("updates task metadata", () => {
    const md = "- [ ] Task #task:abc";
    const updated = updateTaskMetadata(md, "abc", { due: "2026-01-30", priority: "low" });
    expect(updated).toContain("@due(2026-01-30)");
    expect(updated).toContain("@priority(low)");
  });

  it("builds a task line with id", () => {
    const id = createTaskId();
    const built = buildTaskLine("Ship", {
      id,
      due: "2026-02-01",
      priority: "high",
      every: "monthly",
      order: 3000,
    });
    expect(built.id).toBe(id);
    expect(built.line).toContain(`#task:${id}`);
    expect(built.line).toContain("@due(2026-02-01)");
    expect(built.line).toContain("@priority(high)");
    expect(built.line).toContain("@every(monthly)");
    expect(built.line).toContain("@order(3000)");
  });

  it("parses task input tokens", () => {
    const projects = [{ id: "p1", name: "Home Base" }];
    const parsed = parseTaskInput("Pay rent tomorrow p1 #home-base every week", projects);
    expect(parsed.title).toBe("Pay rent");
    expect(parsed.due).toBeTruthy();
    expect(parsed.priority).toBe("urgent");
    expect(parsed.projectId).toBe("p1");
    expect(parsed.every).toBe("weekly");
  });
});
