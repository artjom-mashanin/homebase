import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type NoteFrontmatter = Record<string, unknown>;

export type ParsedNoteFile = {
  frontmatter: NoteFrontmatter;
  body: string;
};

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

function coerceFrontmatter(value: unknown): NoteFrontmatter {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function parseNoteFile(markdown: string): ParsedNoteFile {
  const raw = stripBom(markdown ?? "");
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }

  const yamlText = match[1] ?? "";
  let parsed: unknown = {};
  try {
    parsed = parseYaml(yamlText);
  } catch {
    parsed = {};
  }

  const body = raw.slice(match[0].length);
  return {
    frontmatter: coerceFrontmatter(parsed),
    body,
  };
}

export function stringifyNoteFile(frontmatter: NoteFrontmatter, body: string): string {
  const yamlText = stringifyYaml(frontmatter ?? {}).trimEnd();
  return `---\n${yamlText}\n---\n\n${body ?? ""}`.replace(/\n{3,}$/g, "\n\n");
}

function stripLeadingMarkdown(line: string): string {
  let out = line.replace(/^\s+/, "");
  out = out.replace(/^#+\s+/, "");
  out = out.replace(/^>\s+/, "");
  out = out.replace(/^[-*+]\s+\[[ xX]\]\s*/, "");
  out = out.replace(/^[-*+]\s+/, "");
  out = out.replace(/^\d+\.\s+/, "");
  out = out.replace(/#task:[a-zA-Z0-9_-]+/g, "");
  out = out.replace(/@due(?:\(|:)\d{4}-\d{2}-\d{2}\)?/g, "");
  out = out.replace(/@priority(?:\(|:)(low|medium|high|urgent)\)?/gi, "");
  out = out.replace(/@every(?:\(|:)(daily|weekly|monthly)\)?/gi, "");
  out = out.replace(/@order(?:\(|:)\d+\)?/gi, "");
  out = out.replace(/[`*_~]/g, "");
  return out.trim();
}

export function getTitleFromBody(body: string): string {
  const lines = (body ?? "").split(/\r?\n/);
  for (const raw of lines) {
    const cleaned = stripLeadingMarkdown(raw);
    if (!cleaned) continue;
    return cleaned.length > 80 ? `${cleaned.slice(0, 80).trimEnd()}…` : cleaned;
  }
  return "";
}

export function isMeaningfulBody(body: string): boolean {
  const lines = (body ?? "").split(/\r?\n/);
  for (const raw of lines) {
    const cleaned = stripLeadingMarkdown(raw);
    if (cleaned.length > 0) return true;
  }
  return false;
}

export function normalizeStringForSearch(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function nowIso(): string {
  return new Date().toISOString();
}
