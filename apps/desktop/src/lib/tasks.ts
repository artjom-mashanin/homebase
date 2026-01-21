export type TaskStatus = "todo" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskRecurrence = "daily" | "weekly" | "monthly";

export type ParsedTask = {
  id: string;
  title: string;
  status: TaskStatus;
  due?: string;
  priority?: TaskPriority;
  every?: TaskRecurrence;
  order?: number;
  line: number;
  raw: string;
};

const TASK_LINE_RE = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/;
const TASK_ID_RE = /#task:([a-zA-Z0-9_-]+)/;
const TASK_DUE_RE = /@due(?:\(|:)(\d{4}-\d{2}-\d{2})\)?/;
const TASK_PRIORITY_RE = /@priority(?:\(|:)(low|medium|high|urgent)\)?/i;
const TASK_EVERY_RE = /@every(?:\(|:)(daily|weekly|monthly)\)?/i;
const TASK_ORDER_RE = /@order(?:\(|:)(\d+)\)?/i;

export function createTaskId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
}

export function buildTaskLine(
  title: string,
  opts?: {
    id?: string;
    due?: string | null;
    priority?: TaskPriority | null;
    every?: TaskRecurrence | null;
    order?: number | null;
    done?: boolean;
    extras?: string[];
  },
): { id: string; line: string } {
  const id = opts?.id ?? createTaskId();
  const safeTitle = title.trim() ? title.trim() : "New task";
  const status = opts?.done ? "x" : " ";
  const parts = [`- [${status}] ${safeTitle}`];
  if (opts?.extras?.length) parts.push(opts.extras.join(" "));
  parts.push(`#task:${id}`);
  if (opts?.due) parts.push(`@due(${opts.due})`);
  if (opts?.priority) parts.push(`@priority(${opts.priority})`);
  if (opts?.every) parts.push(`@every(${opts.every})`);
  if (opts?.order !== undefined && opts?.order !== null) parts.push(`@order(${opts.order})`);
  return { id, line: parts.join(" ") };
}

export function parseTasksFromMarkdown(markdown: string): ParsedTask[] {
  const lines = (markdown ?? "").split(/\r?\n/);
  const out: ParsedTask[] = [];

  lines.forEach((line, index) => {
    const match = line.match(TASK_LINE_RE);
    if (!match) return;

    const status = match[1]?.toLowerCase() === "x" ? "done" : "todo";
    const text = match[2] ?? "";
    const idMatch = text.match(TASK_ID_RE);
    if (!idMatch) return;

    const dueMatch = text.match(TASK_DUE_RE);
    const priorityMatch = text.match(TASK_PRIORITY_RE);
    const everyMatch = text.match(TASK_EVERY_RE);
    const orderMatch = text.match(TASK_ORDER_RE);

    const title = stripTaskMetadata(text);

    out.push({
      id: idMatch[1],
      title,
      status,
      due: dueMatch?.[1],
      priority: priorityMatch?.[1]?.toLowerCase() as TaskPriority | undefined,
      every: everyMatch?.[1]?.toLowerCase() as TaskRecurrence | undefined,
      order: orderMatch ? Number(orderMatch[1]) : undefined,
      line: index,
      raw: line,
    });
  });

  return out;
}

export function stripTaskMetadata(text: string): string {
  return text
    .replace(TASK_ID_RE, "")
    .replace(TASK_DUE_RE, "")
    .replace(TASK_PRIORITY_RE, "")
    .replace(TASK_EVERY_RE, "")
    .replace(TASK_ORDER_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function updateTaskStatus(markdown: string, taskId: string, status: TaskStatus): string {
  return updateTaskLine(markdown, taskId, (line) => {
    if (!TASK_LINE_RE.test(line)) return line;
    return line.replace(/\[( |x|X)\]/, status === "done" ? "[x]" : "[ ]");
  });
}

export function updateTaskMetadata(
  markdown: string,
  taskId: string,
  patch: {
    due?: string | null;
    priority?: TaskPriority | null;
    every?: TaskRecurrence | null;
    order?: number | null;
  },
): string {
  return updateTaskLine(markdown, taskId, (line) => {
    let updated = line;
    if (patch.due !== undefined) {
      if (patch.due) {
        if (TASK_DUE_RE.test(updated)) {
          updated = updated.replace(TASK_DUE_RE, `@due(${patch.due})`);
        } else {
          updated = `${updated} @due(${patch.due})`;
        }
      } else {
        updated = updated.replace(TASK_DUE_RE, "").replace(/\s{2,}/g, " ").trimEnd();
      }
    }

    if (patch.priority !== undefined) {
      if (patch.priority) {
        if (TASK_PRIORITY_RE.test(updated)) {
          updated = updated.replace(TASK_PRIORITY_RE, `@priority(${patch.priority})`);
        } else {
          updated = `${updated} @priority(${patch.priority})`;
        }
      } else {
        updated = updated.replace(TASK_PRIORITY_RE, "").replace(/\s{2,}/g, " ").trimEnd();
      }
    }

    if (patch.every !== undefined) {
      if (patch.every) {
        if (TASK_EVERY_RE.test(updated)) {
          updated = updated.replace(TASK_EVERY_RE, `@every(${patch.every})`);
        } else {
          updated = `${updated} @every(${patch.every})`;
        }
      } else {
        updated = updated.replace(TASK_EVERY_RE, "").replace(/\s{2,}/g, " ").trimEnd();
      }
    }

    if (patch.order !== undefined) {
      if (patch.order !== null) {
        if (TASK_ORDER_RE.test(updated)) {
          updated = updated.replace(TASK_ORDER_RE, `@order(${patch.order})`);
        } else {
          updated = `${updated} @order(${patch.order})`;
        }
      } else {
        updated = updated.replace(TASK_ORDER_RE, "").replace(/\s{2,}/g, " ").trimEnd();
      }
    }

    return updated;
  });
}

export function updateTaskTitle(markdown: string, taskId: string, nextTitle: string): string {
  return updateTaskLine(markdown, taskId, (line) => {
    const match = line.match(TASK_LINE_RE);
    if (!match) return line;
    const status = match[1]?.toLowerCase() === "x";
    const text = match[2] ?? "";
    const meta = extractTaskMetadata(text);
    return buildTaskLine(nextTitle, {
      id: meta.id ?? taskId,
      due: meta.due,
      priority: meta.priority,
      every: meta.every,
      order: meta.order,
      done: status,
      extras: meta.extras,
    }).line;
  });
}

export function toggleTaskStatusWithRecurrence(
  markdown: string,
  taskId: string,
  status: TaskStatus,
): string {
  const tasks = parseTasksFromMarkdown(markdown);
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return updateTaskStatus(markdown, taskId, status);

  if (status !== "done") {
    return updateTaskStatus(markdown, taskId, status);
  }

  if (!target.every) {
    return updateTaskStatus(markdown, taskId, "done");
  }

  const nextDue = shiftDueDate(target.due ?? new Date().toISOString().slice(0, 10), target.every);
  let updated = updateTaskMetadata(markdown, taskId, { due: nextDue });
  updated = updateTaskStatus(updated, taskId, "todo");
  return updated;
}

export function parseTaskInput(
  rawInput: string,
  projects: { id: string; name: string }[],
): {
  title: string;
  due?: string | null;
  priority?: TaskPriority | null;
  every?: TaskRecurrence | null;
  projectId?: string | null;
} {
  let input = rawInput.trim();
  if (!input) return { title: "" };

  let due: string | null = null;
  let priority: TaskPriority | null = null;
  let every: TaskRecurrence | null = null;
  let projectId: string | null = null;

  const lower = input.toLowerCase();
  const now = new Date();

  const dueMatchers: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/\btoday\b/i, () => toDateKey(now)],
    [/\btomorrow\b/i, () => toDateKey(addDays(now, 1))],
    [/\bnext week\b/i, () => toDateKey(addDays(now, 7))],
    [/\bnext month\b/i, () => toDateKey(addMonths(now, 1))],
    [/\bin (\d+) days\b/i, (m) => toDateKey(addDays(now, Number(m[1])))],
    [/\bin (\d+) weeks\b/i, (m) => toDateKey(addDays(now, Number(m[1]) * 7))],
  ];

  for (const [re, fn] of dueMatchers) {
    const match = input.match(re);
    if (match) {
      due = fn(match);
      input = input.replace(re, "").trim();
      break;
    }
  }

  const priorityMatch = input.match(/\bp([1-4])\b/i);
  if (priorityMatch) {
    const map: Record<string, TaskPriority> = {
      "1": "urgent",
      "2": "high",
      "3": "medium",
      "4": "low",
    };
    priority = map[priorityMatch[1]] ?? null;
    input = input.replace(priorityMatch[0], "").trim();
  }

  const everyMatch = input.match(/\bevery (day|week|month)\b/i);
  if (everyMatch) {
    every = normalizeEvery(everyMatch[1]);
    input = input.replace(everyMatch[0], "").trim();
  } else if (lower.includes("daily")) {
    every = "daily";
    input = input.replace(/\bdaily\b/i, "").trim();
  } else if (lower.includes("weekly")) {
    every = "weekly";
    input = input.replace(/\bweekly\b/i, "").trim();
  } else if (lower.includes("monthly")) {
    every = "monthly";
    input = input.replace(/\bmonthly\b/i, "").trim();
  }

  const projectTokenMatch = input.match(/#([\w-]+)/);
  if (projectTokenMatch) {
    const token = projectTokenMatch[1].toLowerCase();
    const project = projects.find((p) => slugify(p.name) === token);
    if (project) {
      projectId = project.id;
      input = input.replace(projectTokenMatch[0], "").trim();
    }
  }

  return { title: input.trim(), due, priority, every, projectId };
}

function extractTaskMetadata(text: string): {
  id?: string;
  due?: string;
  priority?: TaskPriority;
  every?: TaskRecurrence;
  order?: number;
  extras: string[];
} {
  const tokens = text.split(/\s+/).filter(Boolean);
  let id: string | undefined;
  let due: string | undefined;
  let priority: TaskPriority | undefined;
  let every: TaskRecurrence | undefined;
  let order: number | undefined;
  const extras: string[] = [];

  for (const token of tokens) {
    if (TASK_ID_RE.test(token)) {
      const match = token.match(TASK_ID_RE);
      id = match?.[1];
      continue;
    }
    if (TASK_DUE_RE.test(token)) {
      const match = token.match(TASK_DUE_RE);
      due = match?.[1];
      continue;
    }
    if (TASK_PRIORITY_RE.test(token)) {
      const match = token.match(TASK_PRIORITY_RE);
      priority = match?.[1]?.toLowerCase() as TaskPriority;
      continue;
    }
    if (TASK_EVERY_RE.test(token)) {
      const match = token.match(TASK_EVERY_RE);
      every = match?.[1]?.toLowerCase() as TaskRecurrence;
      continue;
    }
    if (TASK_ORDER_RE.test(token)) {
      const match = token.match(TASK_ORDER_RE);
      order = match ? Number(match[1]) : undefined;
      continue;
    }
    extras.push(token);
  }

  return { id, due, priority, every, order, extras };
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function normalizeEvery(value: string): TaskRecurrence {
  if (value.toLowerCase().startsWith("day")) return "daily";
  if (value.toLowerCase().startsWith("week")) return "weekly";
  return "monthly";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shiftDueDate(dateKey: string, every: TaskRecurrence): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const base = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (every === "daily") return toDateKey(addDays(base, 1));
  if (every === "weekly") return toDateKey(addDays(base, 7));
  return toDateKey(addMonths(base, 1));
}

function updateTaskLine(
  markdown: string,
  taskId: string,
  updater: (line: string) => string,
): string {
  const lines = (markdown ?? "").split(/\r?\n/);
  const updated = lines.map((line) => {
    if (!line.includes(`#task:${taskId}`)) return line;
    return updater(line);
  });
  return updated.join("\n");
}
