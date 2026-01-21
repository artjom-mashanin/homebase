import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { CSSProperties, RefObject, ReactNode } from "react";
import {
  CheckSquare,
  ClipboardList,
  Flame,
  CalendarDays,
  Circle,
  Plus,
  GripVertical,
  MoreHorizontal,
  Calendar,
  Flag,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PanelHeader } from "@/components/ui/panel-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useHomebaseStore } from "../store/useHomebaseStore";
import {
  parseTaskInput,
  parseTasksFromMarkdown,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "../lib/tasks";
import { toLocalDateKey } from "../lib/dates";

type TaskItem = ReturnType<typeof parseTasksFromMarkdown>[number] & {
  noteId: string;
  noteTitle: string;
  noteProjects: string[];
};

export function TasksView({ onOpenNote }: { onOpenNote: (noteId: string) => void }) {
  const notes = useHomebaseStore((s) => s.notes);
  const projects = useHomebaseStore((s) => s.projects);
  const toggleTaskStatus = useHomebaseStore((s) => s.toggleTaskStatus);
  const updateTaskMeta = useHomebaseStore((s) => s.updateTaskMeta);
  const createTaskNote = useHomebaseStore((s) => s.createTaskNote);
  const updateTaskTitle = useHomebaseStore((s) => s.updateTaskTitle);
  const updateTaskOrderBatch = useHomebaseStore((s) => s.updateTaskOrderBatch);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [view, setView] = useState<"today" | "upcoming" | "inbox" | "overdue" | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority | "">("");
  const [newEvery, setNewEvery] = useState<TaskRecurrence | "">("");
  const [quickAddDetailsOpen, setQuickAddDetailsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const todayKey = toLocalDateKey(new Date());

  const tasks = useMemo(() => {
    const activeNotes = notes.filter((n) => n.kind !== "archive");
    return activeNotes.flatMap((note) =>
      parseTasksFromMarkdown(note.body).map((task) => ({
        ...task,
        noteId: note.id,
        noteTitle: note.title || "New note",
        noteProjects: note.projects,
      })),
    );
  }, [notes]);

  const filteredTasks = useMemo(() => {
    const effectiveStatus: "all" | TaskStatus = showCompleted ? "all" : "todo";
    const effectiveDue: "all" | "today" | "overdue" | "upcoming" | "none" =
      view === "today"
        ? "today"
        : view === "overdue"
          ? "overdue"
          : view === "upcoming"
            ? "upcoming"
            : view === "inbox"
              ? "none"
              : "all";

    return tasks.filter((task) => {
      if (effectiveStatus !== "all" && task.status !== effectiveStatus) return false;
      if (projectFilter !== "all" && !task.noteProjects.includes(projectFilter)) return false;

      if (effectiveDue !== "all") {
        if (effectiveDue === "none") return !task.due;
        if (!task.due) return false;
        if (effectiveDue === "today") return task.due === todayKey;
        if (effectiveDue === "overdue") return task.due < todayKey;
        if (effectiveDue === "upcoming") return task.due > todayKey;
      }

      return true;
    });
  }, [projectFilter, showCompleted, tasks, todayKey, view]);

  const orderedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    sorted.sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return a.title.localeCompare(b.title);
    });
    return sorted;
  }, [filteredTasks]);

  const groupedTasks = useMemo(() => {
    if (projectFilter !== "all") return [{ id: projectFilter, label: "Project", tasks: orderedTasks }];
    const map = new Map<string, TaskItem[]>();
    for (const task of orderedTasks) {
      const groupId = task.noteProjects[0] ?? "inbox";
      if (!map.has(groupId)) map.set(groupId, []);
      map.get(groupId)!.push(task);
    }
    const groups = Array.from(map.entries()).map(([id, list]) => {
      if (id === "inbox") return { id, label: "Inbox", tasks: list };
      const project = projects.find((p) => p.id === id);
      return { id, label: project?.name ?? "Project", tasks: list };
    });
    groups.sort((a, b) => a.label.localeCompare(b.label));
    return groups;
  }, [orderedTasks, projectFilter, projects]);

  const dueTodayCount = tasks.filter((t) => t.status === "todo" && t.due === todayKey).length;
  const overdueCount = tasks.filter((t) => t.status === "todo" && t.due && t.due < todayKey).length;

  const applyView = (next: typeof view) => setView(next);

  const resolveGroupId = useCallback(
    (task: TaskItem) => {
      if (projectFilter !== "all") return projectFilter;
      return task.noteProjects[0] ?? "inbox";
    },
    [projectFilter],
  );

  const handleAddTask = useCallback(() => {
    const parsed = parseTaskInput(newTitle, projects);
    const finalTitle = parsed.title || newTitle.trim();
    if (!finalTitle) return;
    void createTaskNote({
      title: finalTitle,
      due: (newDue || parsed.due) ?? null,
      priority: (newPriority || parsed.priority) ?? null,
      every: (newEvery || parsed.every) ?? null,
      projectId:
        parsed.projectId || (projectFilter !== "all" ? projectFilter : null),
    });
    setNewTitle("");
    setNewDue("");
    setNewPriority("");
    setNewEvery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [createTaskNote, newDue, newEvery, newPriority, newTitle, projectFilter, projects]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);

      if (isEditable) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over) return;
      const activeId = String(event.active.id);
      const overId = String(event.over.id);
      if (activeId === overId) return;

      const activeTask = orderedTasks.find((t) => `${t.noteId}:${t.id}` === activeId);
      const overTask = orderedTasks.find((t) => `${t.noteId}:${t.id}` === overId);
      if (!activeTask || !overTask) return;
      const currentGroupId = resolveGroupId(activeTask);
      const overGroupId = resolveGroupId(overTask);
      if (currentGroupId !== overGroupId) return;

      const current = orderedTasks.filter((task) => resolveGroupId(task) === currentGroupId);
      const fromIndex = current.findIndex((t) => `${t.noteId}:${t.id}` === activeId);
      const toIndex = current.findIndex((t) => `${t.noteId}:${t.id}` === overId);
      if (fromIndex < 0 || toIndex < 0) return;

      const nextOrder = arrayMove(current, fromIndex, toIndex).map((task, idx) => ({
        noteId: task.noteId,
        taskId: task.id,
        order: (idx + 1) * 1000,
      }));

      void updateTaskOrderBatch(nextOrder);
    },
    [orderedTasks, resolveGroupId, updateTaskOrderBatch],
  );

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <PanelHeader className="gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold leading-none">
            <ClipboardList className="size-4 text-muted-foreground" />
            Tasks
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="size-3.5" />
            {dueTodayCount} due today
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Flame className="size-3.5" />
            {overdueCount} overdue
          </Badge>
        </div>
      </PanelHeader>

      <div className="border-b border-border px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <TabButton active={view === "today"} onClick={() => applyView("today")}>
              Today
            </TabButton>
            <TabButton active={view === "upcoming"} onClick={() => applyView("upcoming")}>
              Upcoming
            </TabButton>
            <TabButton active={view === "overdue"} onClick={() => applyView("overdue")}>
              Overdue
            </TabButton>
            <TabButton active={view === "inbox"} onClick={() => applyView("inbox")}>
              Inbox
            </TabButton>
            <TabButton active={view === "all"} onClick={() => applyView("all")}>
              All
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showCompleted ? "secondary" : "ghost"}
              onClick={() => setShowCompleted((v) => !v)}
              className="h-8"
              title="Toggle completed tasks"
            >
              <CheckSquare className="size-4" />
              Done
            </Button>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-8 w-[180px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects
                  .slice()
                  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <QuickAddRow
          inputRef={inputRef}
          value={newTitle}
          onChange={setNewTitle}
          onSubmit={handleAddTask}
          onClear={() => {
            setNewTitle("");
            setNewDue("");
            setNewPriority("");
            setNewEvery("");
          }}
          parsed={parseTaskInput(newTitle, projects)}
          detailsOpen={quickAddDetailsOpen}
          onToggleDetails={() => setQuickAddDetailsOpen((v) => !v)}
          manualDue={newDue}
          onManualDueChange={setNewDue}
          manualPriority={newPriority}
          onManualPriorityChange={setNewPriority}
          manualEvery={newEvery}
          onManualEveryChange={setNewEvery}
        />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {orderedTasks.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No tasks yet.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="p-4 space-y-5">
              {groupedTasks.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                      {group.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{group.tasks.length}</div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border bg-card/30">
                    {group.tasks.map((task) => (
                      <DraggableTaskRow
                        key={`${task.noteId}-${task.id}`}
                        task={task}
                        onToggle={(next) => void toggleTaskStatus(task.noteId, task.id, next)}
                        onUpdateMeta={(patch) => void updateTaskMeta(task.noteId, task.id, patch)}
                        onOpenNote={() => onOpenNote(task.noteId)}
                        todayKey={todayKey}
                        onStartEdit={() => {
                          setEditingTaskId(`${task.noteId}:${task.id}`);
                          setEditingValue(task.title);
                        }}
                        editing={editingTaskId === `${task.noteId}:${task.id}`}
                        editingValue={editingValue}
                        onEditingChange={setEditingValue}
                        onCommitEdit={() => {
                          if (!editingTaskId) return;
                          const [noteId, taskId] = editingTaskId.split(":");
                          const title = editingValue.trim();
                          if (title) {
                            void updateTaskTitle(noteId, taskId, title);
                          }
                          setEditingTaskId(null);
                          setEditingValue("");
                        }}
                        onCancelEdit={() => {
                          setEditingTaskId(null);
                          setEditingValue("");
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DndContext>
        )}
      </ScrollArea>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-1 py-2 text-sm text-muted-foreground hover:text-foreground",
        active && "text-foreground",
      )}
    >
      <span className={cn(active && "font-semibold")}>{children}</span>
      {active && <span className="absolute inset-x-0 -bottom-2 h-0.5 rounded-full bg-primary" />}
    </button>
  );
}

function QuickAddRow({
  inputRef,
  value,
  onChange,
  onSubmit,
  onClear,
  parsed,
  detailsOpen,
  onToggleDetails,
  manualDue,
  onManualDueChange,
  manualPriority,
  onManualPriorityChange,
  manualEvery,
  onManualEveryChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  parsed: ReturnType<typeof parseTaskInput>;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  manualDue: string;
  onManualDueChange: (value: string) => void;
  manualPriority: TaskPriority | "";
  onManualPriorityChange: (value: TaskPriority | "") => void;
  manualEvery: TaskRecurrence | "";
  onManualEveryChange: (value: TaskRecurrence | "") => void;
}) {
  const chips: Array<{ label: string; icon?: ReactNode }> = [];
  if (parsed.due) chips.push({ label: parsed.due, icon: <Calendar className="size-3.5" /> });
  if (parsed.priority) chips.push({ label: parsed.priority.toUpperCase(), icon: <Flag className="size-3.5" /> });
  if (parsed.every) chips.push({ label: parsed.every, icon: <CalendarDays className="size-3.5" /> });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/20">
          <Plus className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Add a task… (try: tomorrow p2 #project every week)"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onClear();
              }
            }}
          />
          <Button size="sm" onClick={onSubmit} className="h-8" disabled={!value.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggleDetails} className="h-8">
            Details
          </Button>
        </div>
      </div>

      {(detailsOpen || chips.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Badge key={chip.label} variant="secondary" className="gap-1 rounded-full">
              {chip.icon}
              {chip.label}
            </Badge>
          ))}

          {detailsOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={manualDue}
                onChange={(e) => onManualDueChange(e.target.value)}
                className="h-8 w-[150px]"
              />
              <Select
                value={manualPriority || "none"}
                onValueChange={(v) =>
                  onManualPriorityChange(v === "none" ? "" : (v as TaskPriority))
                }
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={manualEvery || "none"}
                onValueChange={(v) =>
                  onManualEveryChange(v === "none" ? "" : (v as TaskRecurrence))
                }
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Repeat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            Press <kbd className="rounded border border-border bg-muted px-1 py-0.5">/</kbd> or{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5">⌘K</kbd> to focus
          </div>
        </div>
      )}
    </div>
  );
}

function DraggableTaskRow({
  task,
  onToggle,
  onUpdateMeta,
  onOpenNote,
  todayKey,
  onStartEdit,
  editing,
  editingValue,
  onEditingChange,
  onCommitEdit,
  onCancelEdit,
}: {
  task: TaskItem;
  onToggle: (status: TaskStatus) => void;
  onUpdateMeta: (patch: {
    due?: string | null;
    priority?: TaskPriority | null;
    every?: TaskRecurrence | null;
  }) => void;
  onOpenNote: () => void;
  todayKey: string;
  onStartEdit: () => void;
  editing: boolean;
  editingValue: string;
  onEditingChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
}) {
  const dragId = `${task.noteId}:${task.id}`;
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dragId });
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-3 py-2",
        "border-b border-border last:border-b-0",
        isOver && "bg-primary/5",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className={cn(
          "rounded p-1 text-muted-foreground hover:text-foreground",
          "opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      <button
        type="button"
        onClick={() => onToggle(task.status === "done" ? "todo" : "done")}
        className={cn(
          "rounded-full border p-1",
          task.status === "done" ? "border-primary bg-primary/10" : "border-border",
        )}
        aria-label={task.status === "done" ? "Mark as todo" : "Mark as done"}
      >
        {task.status === "done" ? (
          <CheckSquare className="size-4 text-primary" />
        ) : (
          <Circle className="size-4 text-muted-foreground" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={editingValue}
            onChange={(e) => onEditingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommitEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            onBlur={onCommitEdit}
            className="h-8 text-sm"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            className={cn(
              "w-full truncate text-left text-sm",
              task.status === "done" ? "text-muted-foreground line-through" : "text-foreground",
            )}
            title={task.title}
          >
            {task.title}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenNote}
          className={cn(
            "mt-0.5 block max-w-full truncate text-xs text-muted-foreground hover:text-foreground",
            "opacity-0 group-hover:opacity-100",
          )}
          title={task.noteTitle}
        >
          {task.noteTitle}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {task.priority ? (
          <span
            className={cn("size-2 rounded-full", priorityDotClass(task.priority))}
            title={`Priority: ${task.priority}`}
          />
        ) : null}

        {task.every ? (
          <Badge variant="secondary" className="hidden rounded-full sm:inline-flex">
            {task.every}
          </Badge>
        ) : null}

        {task.due ? (
          <DuePicker due={task.due} onChange={(next) => onUpdateMeta({ due: next })} />
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "hidden cursor-pointer select-none rounded-full text-muted-foreground sm:inline-flex",
              "opacity-0 group-hover:opacity-100",
            )}
            onClick={() => onUpdateMeta({ due: todayKey })}
            title="Set due today"
          >
            <Calendar className="mr-1 size-3.5" />
            Due
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "rounded p-1 text-muted-foreground hover:text-foreground",
                "opacity-0 group-hover:opacity-100 focus:opacity-100",
              )}
              aria-label="Task actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{task.title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenNote}>Open note</DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Calendar className="size-4" />
                Due date
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onUpdateMeta({ due: todayKey })}>Today</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    onUpdateMeta({ due: toLocalDateKey(d) });
                  }}
                >
                  Tomorrow
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    onUpdateMeta({ due: toLocalDateKey(d) });
                  }}
                >
                  Next week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ due: null })}>Clear</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Flag className="size-4" />
                Priority
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onUpdateMeta({ priority: "urgent" })}>Urgent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ priority: "high" })}>High</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ priority: "medium" })}>Medium</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ priority: "low" })}>Low</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ priority: null })}>Clear</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CalendarDays className="size-4" />
                Repeat
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onUpdateMeta({ every: "daily" })}>Daily</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ every: "weekly" })}>Weekly</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ every: "monthly" })}>Monthly</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMeta({ every: null })}>No repeat</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function DuePicker({
  due,
  onChange,
}: {
  due: string;
  onChange: (next: string | null) => void;
}) {
  const label = formatDateKeyLabel(due);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant="secondary" className="cursor-pointer select-none rounded-full">
          <Calendar className="mr-1 size-3.5" />
          {label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Due date</div>
          <Input type="date" value={due} onChange={(e) => onChange(e.target.value || null)} className="h-9" />
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={() => onChange(toLocalDateKey(new Date()))} className="h-8">
              Today
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                onChange(toLocalDateKey(d));
              }}
              className="h-8"
            >
              Tomorrow
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="h-8">
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatDateKeyLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function priorityDotClass(priority: TaskPriority): string {
  if (priority === "urgent") return "bg-red-500";
  if (priority === "high") return "bg-orange-500";
  if (priority === "medium") return "bg-yellow-500";
  return "bg-blue-500";
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const clone = [...items];
  const [item] = clone.splice(from, 1);
  clone.splice(to, 0, item);
  return clone;
}
