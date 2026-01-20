import clsx from "clsx";
import { useMemo, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { normalizeStringForSearch } from "../lib/markdown";
import type { Note, Project } from "../lib/types";
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

export function NoteList() {
  const notes = useHomebaseStore((s) => s.notes);
  const draftNote = useHomebaseStore((s) => s.draftNote);
  const selectedNoteId = useHomebaseStore((s) => s.selectedNoteId);
  const selectNote = useHomebaseStore((s) => s.selectNote);
  const archiveNote = useHomebaseStore((s) => s.archiveNote);
  const collection = useHomebaseStore((s) => s.collection);
  const searchQuery = useHomebaseStore((s) => s.searchQuery);
  const projects = useHomebaseStore((s) => s.projects);

  const visibleNotes = useMemo(() => {
    const base =
      collection.type === "archive"
        ? notes.filter((n) => n.kind === "archive")
        : notes.filter((n) => n.kind !== "archive");

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
      if (!q) return base;
      return base.filter((n) => n.searchText.includes(q));
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

  return (
    <section className="flex h-full w-80 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="text-sm font-semibold leading-none">
          {collection.type === "inbox"
            ? "Inbox"
            : collection.type === "all"
              ? "All notes"
              : collection.type === "folder"
                ? `Folder`
                : collection.type === "project"
                  ? "Project"
                  : collection.type === "archive"
                    ? "Archive"
                    : "Search"}
        </div>
        <div className="mt-1 text-xs text-neutral-500">{visibleNotes.length} notes</div>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleNotes.length === 0 && !showDraft ? (
          <div className="p-3 text-sm text-neutral-500">No notes.</div>
        ) : (
          <ul className="divide-y divide-neutral-900">
            {showDraft && draftNote ? (
              <li key={draftNote.id}>
                <button
                  type="button"
                  onClick={() => selectNote(draftNote.id)}
                  className={clsx(
                    "group flex w-full items-start gap-3 px-3 py-3 text-left",
                    draftNote.id === selectedNoteId ? "bg-neutral-900" : "hover:bg-neutral-900/60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-100">
                      {draftNote.title || "New note"}
                    </div>
                    <div className="mt-1 truncate text-xs text-neutral-500">Not saved</div>
                  </div>
                </button>
              </li>
            ) : null}
            {visibleNotes.map((note) => (
              <DraggableNoteRow
                key={note.id}
                note={note}
                selected={note.id === selectedNoteId}
                projects={projects}
                onSelect={(id) => selectNote(id)}
                onArchive={(id) => void archiveNote(id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DraggableNoteRow({
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

  return (
    <li>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(note.id);
          }
        }}
        onClick={() => onSelect(note.id)}
        className={clsx(
          "group flex w-full cursor-pointer select-none items-start gap-3 px-3 py-3 text-left",
          selected ? "bg-neutral-900" : "hover:bg-neutral-900/60",
          isDragging ? "opacity-60" : null,
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-neutral-100">
            {note.title || "New note"}
          </div>
          <div className="mt-1 truncate text-xs text-neutral-500">{note.relativePath}</div>
          {note.projects.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.projects.slice(0, 3).map((pid) => {
                const p = projects.find((x) => x.id === pid);
                return (
                  <span
                    key={pid}
                    className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-200"
                  >
                    {p?.name ?? "Project"}
                  </span>
                );
              })}
              {note.projects.length > 3 ? (
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-200">
                  +{note.projects.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {note.kind !== "archive" ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onArchive(note.id);
            }}
            className="invisible rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 group-hover:visible"
            title="Archive"
          >
            Archive
          </button>
        ) : null}
      </div>
    </li>
  );
}
