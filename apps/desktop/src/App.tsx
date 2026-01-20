import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

import { Sidebar } from "./components/Sidebar";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { useHomebaseStore } from "./store/useHomebaseStore";

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNoteTitle = useMemo(() => {
    if (!activeNoteId) return null;
    return notes.find((n) => n.id === activeNoteId)?.title || "New note";
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

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="h-full">
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
          <div className="flex h-full">
            <Sidebar />
            <NoteList />
            <NoteEditor />
          </div>

          <DragOverlay>
            {activeNoteTitle ? (
              <div className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 shadow-lg">
                {activeNoteTitle}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
