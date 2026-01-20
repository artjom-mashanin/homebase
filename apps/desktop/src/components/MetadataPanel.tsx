import { useEffect, useMemo, useState } from "react";
import { Folder, ChevronDown, X, Plus, Copy, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatDateTime, formatRelativeDateTime } from "../lib/dates";
import type { Note, Project } from "../lib/types";

function foldersToOptions(folderPaths: string[]) {
  return folderPaths
    .filter((p) => p.startsWith("notes/folders/"))
    .sort()
    .map((p) => ({
      value: p,
      label: p.replace(/^notes\/folders\/?/, "") || "(root)",
    }));
}

function getFriendlyLocation(relativePath: string): string {
  if (relativePath.startsWith("notes/inbox/")) {
    return "Inbox";
  }
  if (relativePath.startsWith("notes/archive/")) {
    return "Archive";
  }
  if (relativePath.startsWith("notes/folders/")) {
    const parts = relativePath.replace("notes/folders/", "").split("/");
    // Remove the filename
    parts.pop();
    return parts.join("/") || "Folders root";
  }
  return relativePath;
}

export function MetadataPanel({
  note,
  folders,
  projects,
  onUpdateMeta,
  onMove,
}: {
  note: Note;
  folders: string[];
  projects: Project[];
  onUpdateMeta: (patch: { projects?: string[]; topics?: string[] }) => void;
  onMove: (targetDir: string) => void;
}) {
  const moveOptions = useMemo(() => {
    const folderOptions = foldersToOptions(folders);
    const projectOptions = projects
      .slice()
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((p) => ({ value: p.folderRelativePath, label: p.name }));

    return [
      { value: "notes/inbox", label: "Inbox" },
      ...folderOptions,
      ...projectOptions.map((o) => ({ ...o, label: `${o.label} (project)` })),
    ];
  }, [folders, projects]);

  const currentMoveValue = useMemo(() => {
    const matches = moveOptions.filter((o) => note.relativePath.startsWith(`${o.value}/`));
    matches.sort((a, b) => b.value.length - a.value.length);
    return matches[0]?.value ?? "notes/inbox";
  }, [moveOptions, note.relativePath]);

  const [topicsDraft, setTopicsDraft] = useState(note.topics.join(", "));
  useEffect(() => setTopicsDraft(note.topics.join(", ")), [note.id, note.topics]);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const copyNoteId = async () => {
    await navigator.clipboard.writeText(note.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const assignedProjects = projects.filter((p) => note.projects.includes(p.id));
  const unassignedProjects = projects.filter((p) => !note.projects.includes(p.id));

  return (
    <aside className="flex h-full w-72 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold leading-none">Details</div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Location */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Location
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Folder className="size-4 text-muted-foreground" />
              {getFriendlyLocation(note.relativePath)}
            </div>
          </div>

          <Separator />

          {/* Move To */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Move To
            </div>
            <Select value={currentMoveValue} onValueChange={onMove}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {moveOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Projects */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Projects
            </div>
            {assignedProjects.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignedProjects.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => {
                        const next = note.projects.filter((id) => id !== p.id);
                        onUpdateMeta({ projects: next });
                      }}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">No projects assigned.</p>
            )}

            {unassignedProjects.length > 0 && (
              <Select
                value=""
                onValueChange={(projectId) => {
                  const next = [...note.projects, projectId];
                  onUpdateMeta({ projects: next });
                }}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="size-3.5" />
                    Add project
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {unassignedProjects
                    .slice()
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.status === "archived" && (
                          <span className="ml-2 text-xs text-muted-foreground">(archived)</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Topics */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Topics
            </div>
            {note.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {note.topics.map((topic) => (
                  <Badge key={topic} variant="outline" className="gap-1 pr-1">
                    {topic}
                    <button
                      type="button"
                      onClick={() => {
                        const next = note.topics.filter((t) => t !== topic);
                        onUpdateMeta({ topics: next });
                      }}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              value={topicsDraft}
              onChange={(e) => setTopicsDraft(e.currentTarget.value)}
              onBlur={() => {
                const next = topicsDraft
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                onUpdateMeta({ topics: next });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = topicsDraft
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  onUpdateMeta({ topics: next });
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Add topics (comma-separated)"
              className="text-sm"
            />
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Dates
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(note.created)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modified</span>
                <span>{formatRelativeDateTime(note.modified)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Advanced (Collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              Advanced
              <ChevronDown
                className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
              />
            </button>
            {advancedOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Note ID</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">
                      {note.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void copyNoteId()}
                      className="size-7"
                    >
                      {copiedId ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Placement</div>
                  <div className="text-sm">
                    {note.userPlaced ? "User-placed" : "Inbox / AI-managed"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Full Path</div>
                  <code className="block truncate rounded bg-muted px-2 py-1 text-xs font-mono">
                    {note.relativePath}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
