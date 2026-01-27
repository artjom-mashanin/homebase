import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const LAYOUT_STORAGE_KEYS = {
  sidebarWidth: "homebase.layout.sidebarWidth",
  listWidth: "homebase.layout.listWidth",
} as const;

const DEFAULT_LAYOUT = {
  sidebarWidth: 260,
  listWidth: 360,
  handleWidth: 6,
  minSidebar: 220,
  minList: 280,
  minMain: 420,
  maxSidebar: 420,
  maxList: 520,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readStoredNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [layoutWidth, setLayoutWidth] = useState<number>(0);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    readStoredNumber(LAYOUT_STORAGE_KEYS.sidebarWidth, DEFAULT_LAYOUT.sidebarWidth),
  );
  const [listWidth, setListWidth] = useState<number>(() =>
    readStoredNumber(LAYOUT_STORAGE_KEYS.listWidth, DEFAULT_LAYOUT.listWidth),
  );

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

  useEffect(() => {
    if (!layoutRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setLayoutWidth(rect.width);
    });
    ro.observe(layoutRef.current);
    return () => ro.disconnect();
  }, []);

  const isSinglePane = collection.type === "daily" || collection.type === "tasks";

  const sidebarMax = useMemo(() => {
    if (!layoutWidth) return DEFAULT_LAYOUT.maxSidebar;
    const handles = isSinglePane ? DEFAULT_LAYOUT.handleWidth : DEFAULT_LAYOUT.handleWidth * 2;
    const reserved = isSinglePane ? DEFAULT_LAYOUT.minMain : DEFAULT_LAYOUT.minList + DEFAULT_LAYOUT.minMain;
    const max = layoutWidth - handles - reserved;
    return clamp(max, DEFAULT_LAYOUT.minSidebar, DEFAULT_LAYOUT.maxSidebar);
  }, [isSinglePane, layoutWidth]);

  const listMax = useMemo(() => {
    if (isSinglePane) return DEFAULT_LAYOUT.maxList;
    if (!layoutWidth) return DEFAULT_LAYOUT.maxList;
    const handles = DEFAULT_LAYOUT.handleWidth * 2;
    const max = layoutWidth - handles - sidebarWidth - DEFAULT_LAYOUT.minMain;
    return clamp(max, DEFAULT_LAYOUT.minList, DEFAULT_LAYOUT.maxList);
  }, [isSinglePane, layoutWidth, sidebarWidth]);

  useEffect(() => {
    setSidebarWidth((w) => clamp(w, DEFAULT_LAYOUT.minSidebar, sidebarMax));
  }, [sidebarMax]);

  useEffect(() => {
    if (isSinglePane) return;
    setListWidth((w) => clamp(w, DEFAULT_LAYOUT.minList, listMax));
  }, [isSinglePane, listMax]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEYS.sidebarWidth, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEYS.listWidth, String(listWidth));
  }, [listWidth]);

  const beginResize = useCallback(
    (
      event: React.PointerEvent,
      opts: {
        axis: "sidebar" | "list";
      },
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = opts.axis === "sidebar" ? sidebarWidth : listWidth;
      const cursorBefore = document.body.style.cursor;
      const userSelectBefore = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        if (opts.axis === "sidebar") {
          setSidebarWidth(clamp(startWidth + delta, DEFAULT_LAYOUT.minSidebar, sidebarMax));
          return;
        }
        setListWidth(clamp(startWidth + delta, DEFAULT_LAYOUT.minList, listMax));
      };

      const onUp = () => {
        document.body.style.cursor = cursorBefore;
        document.body.style.userSelect = userSelectBefore;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [listMax, listWidth, sidebarMax, sidebarWidth],
  );

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
            <div
              ref={layoutRef}
              className="grid h-full min-h-0 min-w-0 flex-1 overflow-hidden"
              style={{
                gridTemplateColumns: isSinglePane
                  ? `${sidebarWidth}px ${DEFAULT_LAYOUT.handleWidth}px minmax(0, 1fr)`
                  : `${sidebarWidth}px ${DEFAULT_LAYOUT.handleWidth}px ${listWidth}px ${DEFAULT_LAYOUT.handleWidth}px minmax(0, 1fr)`,
              }}
            >
              <Sidebar />
              <ColumnResizeHandle
                ariaLabel="Resize sidebar"
                onPointerDown={(e) => beginResize(e, { axis: "sidebar" })}
                onDoubleClick={() => setSidebarWidth(DEFAULT_LAYOUT.sidebarWidth)}
              />

              {collection.type === "daily" ? (
                <DailyView onOpenNote={openOverlayNote} onNewNote={openNewNoteOverlay} />
              ) : collection.type === "tasks" ? (
                <TasksView onOpenNote={openOverlayNote} />
              ) : (
                <>
                  <NoteList />
                  <ColumnResizeHandle
                    ariaLabel="Resize note list"
                    onPointerDown={(e) => beginResize(e, { axis: "list" })}
                    onDoubleClick={() => setListWidth(DEFAULT_LAYOUT.listWidth)}
                  />
                  <NoteEditor />
                </>
              )}
            </div>
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

function ColumnResizeHandle({
  ariaLabel,
  onPointerDown,
  onDoubleClick,
}: {
  ariaLabel: string;
  onPointerDown: (event: React.PointerEvent) => void;
  onDoubleClick?: () => void;
}) {
  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="group relative h-full cursor-col-resize select-none bg-transparent"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-primary/0 group-hover:bg-primary/20 transition-colors" />
    </div>
  );
}
