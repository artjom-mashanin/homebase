import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { Sidebar } from "./components/Sidebar";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { useHomebaseStore } from "./store/useHomebaseStore";
import { formatRelativeDate, extractSnippet } from "./lib/dates";
import { DailyView } from "./components/DailyView";
import { TasksView } from "./components/TasksView";

function App() {
  const init = useHomebaseStore((s) => s.init);
  const isBooting = useHomebaseStore((s) => s.isBooting);
  const lastError = useHomebaseStore((s) => s.lastError);
  const clearError = useHomebaseStore((s) => s.clearError);
  const notes = useHomebaseStore((s) => s.notes);
  const projects = useHomebaseStore((s) => s.projects);
  const moveNote = useHomebaseStore((s) => s.moveNote);
  const archiveNote = useHomebaseStore((s) => s.archiveNote);
  const updateNoteMeta = useHomebaseStore((s) => s.updateNoteMeta);
  const collection = useHomebaseStore((s) => s.collection);
  const selectNote = useHomebaseStore((s) => s.selectNote);
  const createNote = useHomebaseStore((s) => s.createNote);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return null;
    return {
      title: note.title || "New note",
      snippet: extractSnippet(note.body, 80),
      date: formatRelativeDate(note.modified),
    };
  }, [activeNoteId, notes]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveNoteId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const noteId = String(event.active.id);
      const overId = event.over?.id ? String(event.over.id) : null;
      setActiveNoteId(null);
      if (!overId) return;

      if (overId === "drop:archive") {
        void archiveNote(noteId);
        return;
      }

      if (overId === "drop:inbox") {
        void moveNote(noteId, "notes/inbox");
        return;
      }

      if (overId.startsWith("drop:folder:")) {
        const targetDir = overId.slice("drop:folder:".length);
        void moveNote(noteId, targetDir);
        return;
      }

      if (overId.startsWith("drop:project:")) {
        const projectId = overId.slice("drop:project:".length);
        const project = projects.find((p) => p.id === projectId);
        if (!project) return;

        const currentNote = notes.find((n) => n.id === noteId);
        const nextProjects =
          currentNote && !currentNote.projects.includes(projectId)
            ? [...currentNote.projects, projectId]
            : currentNote?.projects ?? [];

        void (async () => {
          await moveNote(noteId, project.folderRelativePath);
          if (currentNote && nextProjects !== currentNote.projects) {
            await updateNoteMeta(noteId, { projects: nextProjects });
          }
        })();
      }
    },
    [archiveNote, moveNote, notes, projects, updateNoteMeta],
  );

  const onDragCancel = useCallback(() => setActiveNoteId(null), []);

  const [overlayNoteId, setOverlayNoteId] = useState<string | null>(null);

  const openOverlayNote = useCallback(
    (noteId: string) => {
      setOverlayNoteId(noteId);
      selectNote(noteId);
    },
    [selectNote],
  );

  const openNewNoteOverlay = useCallback(() => {
    const noteId = createNote();
    setOverlayNoteId(noteId);
  }, [createNote]);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      {isBooting ? (
        <div className="flex h-full items-center justify-center text-sm text-neutral-500">
          Initializing vault…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex h-full min-h-0 min-w-0 overflow-hidden">
            <Sidebar />
            {collection.type === "daily" ? (
              <DailyView onOpenNote={openOverlayNote} onNewNote={openNewNoteOverlay} />
            ) : collection.type === "tasks" ? (
              <TasksView onOpenNote={openOverlayNote} />
            ) : (
              <>
                <NoteList />
                <NoteEditor />
              </>
            )}
          </div>

          <DragOverlay>
            {activeNote ? (
              <div className="w-72 rounded-lg border border-primary/50 bg-card p-3 shadow-xl">
                <h3 className="truncate text-sm font-medium">{activeNote.title}</h3>
                {activeNote.snippet && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {activeNote.snippet}
                  </p>
                )}
                <div className="mt-2 text-xs text-muted-foreground">{activeNote.date}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {(collection.type === "daily" || collection.type === "tasks") && (
        <Dialog
          open={!!overlayNoteId}
          onOpenChange={(open) => !open && setOverlayNoteId(null)}
        >
          <DialogContent className="max-w-4xl h-[80vh] p-0">
            <NoteEditor />
          </DialogContent>
        </Dialog>
      )}

      {lastError ? (
        <div className="fixed bottom-4 right-4 max-w-md rounded border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-100 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">Error</div>
              <div className="mt-1 break-words text-xs opacity-90">{lastError}</div>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="rounded px-2 py-1 text-xs hover:bg-red-900/40"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
