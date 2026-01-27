import { useMemo, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Inbox, FileText, Archive as ArchiveIcon, Folder, Target, Archive, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/ui/panel-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeStringForSearch } from "../lib/markdown";
import { formatRelativeDate, extractSnippet } from "../lib/dates";
import type { Note, Project, Collection } from "../lib/types";
import { useHomebaseStore } from "../store/useHomebaseStore";

function noteMatchesFolder(note: Note, folderRelativePath: string): boolean {
  const prefix = folderRelativePath.endsWith("/") ? folderRelativePath : `${folderRelativePath}/`;
  return note.relativePath.startsWith(prefix);
}

function noteMatchesProject(note: Note, project: Project): boolean {
  if (note.projects.includes(project.id)) return true;
  const prefix = project.folderRelativePath.endsWith("/")
    ? project.folderRelativePath
    : `${project.folderRelativePath}/`;
  return note.relativePath.startsWith(prefix);
}

function getCollectionDisplay(collection: Collection, projects: Project[]): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
} {
  switch (collection.type) {
    case "inbox":
      return { icon: Inbox, label: "Inbox" };
    case "all":
      return { icon: FileText, label: "All notes" };
    case "archive":
      return { icon: ArchiveIcon, label: "Archive" };
    case "folder": {
      const folderName = collection.folderRelativePath.split("/").pop() || "Folder";
      return { icon: Folder, label: folderName };
    }
    case "project": {
      const project = projects.find((p) => p.id === collection.projectId);
      return { icon: Target, label: project?.name || "Project" };
    }
    case "search":
      return { icon: FileText, label: "Search results" };
    default:
      return { icon: FileText, label: "Notes" };
  }
}

export function NoteList({ className }: { className?: string }) {
  const notes = useHomebaseStore((s) => s.notes);
  const draftNote = useHomebaseStore((s) => s.draftNote);
  const selectedNoteId = useHomebaseStore((s) => s.selectedNoteId);
  const selectNote = useHomebaseStore((s) => s.selectNote);
  const archiveNote = useHomebaseStore((s) => s.archiveNote);
  const createNote = useHomebaseStore((s) => s.createNote);
  const collection = useHomebaseStore((s) => s.collection);
  const searchQuery = useHomebaseStore((s) => s.searchQuery);
  const projects = useHomebaseStore((s) => s.projects);

  const visibleNotes = useMemo(() => {
    const nonArchive = notes.filter((n) => n.kind !== "archive");
    const base =
      collection.type === "archive"
        ? notes.filter((n) => n.kind === "archive")
        : nonArchive.filter((n) => n.kind !== "daily");

    if (collection.type === "inbox") return base.filter((n) => n.kind === "inbox");
    if (collection.type === "all") return base;
    if (collection.type === "folder")
      return base.filter((n) => noteMatchesFolder(n, collection.folderRelativePath));
    if (collection.type === "project") {
      const project = projects.find((p) => p.id === collection.projectId);
      if (!project) return [];
      return base.filter((n) => noteMatchesProject(n, project));
    }
    if (collection.type === "search") {
      const q = normalizeStringForSearch(searchQuery);
      if (!q) return nonArchive;
      return nonArchive.filter((n) => n.searchText.includes(q));
    }
    return base;
  }, [collection, notes, projects, searchQuery]);

  const showDraft = useMemo(() => {
    if (!draftNote) return false;
    if (collection.type === "archive") return false;
    if (collection.type === "inbox") return draftNote.kind === "inbox";
    if (collection.type === "all") return true;
    if (collection.type === "folder") return draftNote.targetDir === collection.folderRelativePath;
    if (collection.type === "project") {
      const project = projects.find((p) => p.id === collection.projectId);
      return draftNote.targetDir === project?.folderRelativePath;
    }
    if (collection.type === "search") return false;
    return false;
  }, [collection, draftNote, projects]);

  const { icon: CollectionIcon, label: collectionLabel } = getCollectionDisplay(
    collection,
    projects
  );

  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background",
        className,
      )}
    >
      {/* Header */}
      <PanelHeader>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold leading-none">
            <CollectionIcon className="size-4 text-muted-foreground" />
            {collectionLabel}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}
          </div>
        </div>
        {collection.type !== "archive" && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={() => createNote()}
            title="New note"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </PanelHeader>

      {/* Notes List */}
      <ScrollArea className="flex-1 min-h-0">
        {visibleNotes.length === 0 && !showDraft ? (
          <div className="p-4 text-sm text-muted-foreground">No notes.</div>
        ) : (
          <div className="w-full min-w-0 p-2 space-y-1">
            {showDraft && draftNote ? (
              <NoteCard
                key={draftNote.id}
                title={draftNote.title || "New note"}
                snippet=""
                date="Not saved"
                projectBadges={[]}
                selected={draftNote.id === selectedNoteId}
                isArchived={false}
                isDraft
                onClick={() => selectNote(draftNote.id)}
                onArchive={() => {}}
              />
            ) : null}
            {visibleNotes.map((note) => (
              <DraggableNoteCard
                key={note.id}
                note={note}
                selected={note.id === selectedNoteId}
                projects={projects}
                onSelect={(id) => selectNote(id)}
                onArchive={(id) => void archiveNote(id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

function NoteCard({
  title,
  snippet,
  date,
  projectBadges,
  selected,
  isArchived,
  isDraft,
  onClick,
  onArchive,
}: {
  title: string;
  snippet: string;
  date: string;
  projectBadges: { id: string; name: string }[];
  selected: boolean;
  isArchived: boolean;
  isDraft?: boolean;
  onClick: () => void;
  onArchive: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all",
        selected
          ? "border-primary/50 bg-accent shadow-sm"
          : "border-transparent hover:border-border hover:bg-accent/50",
      )}
    >
      {/* Title */}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</h3>
        {!isArchived && !isDraft && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-muted"
            title="Archive"
          >
            <Archive className="size-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Snippet */}
      {snippet && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{snippet}</p>
      )}

      {/* Footer: Date + Project Badges */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">{date}</span>
        {projectBadges.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {projectBadges.slice(0, 2).map((p) => (
              <Badge key={p.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                {p.name}
              </Badge>
            ))}
            {projectBadges.length > 2 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{projectBadges.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function DraggableNoteCard({
  note,
  selected,
  projects,
  onSelect,
  onArchive,
}: {
  note: Note;
  selected: boolean;
  projects: Project[];
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    touchAction: "none",
  };

  const projectBadges = note.projects
    .map((pid) => {
      const p = projects.find((x) => x.id === pid);
      return p ? { id: p.id, name: p.name } : null;
    })
    .filter((p): p is { id: string; name: string } => p !== null);

  const snippet = extractSnippet(note.body, 80);
  const relativeDate = formatRelativeDate(note.modified);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 ring-2 ring-primary/30"
      )}
    >
      <NoteCard
        title={note.title || "New note"}
        snippet={snippet}
        date={relativeDate}
        projectBadges={projectBadges}
        selected={selected}
        isArchived={note.kind === "archive"}
        onClick={() => onSelect(note.id)}
        onArchive={() => onArchive(note.id)}
      />
    </div>
  );
}
