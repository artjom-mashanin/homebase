import { useMemo, useState, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Calendar, ArrowUpRight, ClipboardList, CalendarDays, Flame } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelHeader } from "@/components/ui/panel-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useHomebaseStore } from "../store/useHomebaseStore";
import type { Note } from "../lib/types";
import { formatLongDate, toLocalDateKey } from "../lib/dates";
import { getMarkdownExtensions } from "../lib/editor";
import { parseTasksFromMarkdown } from "../lib/tasks";
import { handleSpaceToConvertTask } from "../lib/taskEditor";

type DayGroup = {
  dateKey: string;
  dailyNote?: Note;
  createdNotes: Note[];
  modifiedNotes: Note[];
};

function getDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function daysBetween(a: string, b: string) {
  const dateA = getDateFromKey(a);
  const dateB = getDateFromKey(b);
  const diff = dateB.getTime() - dateA.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function DailyView({
  onOpenNote,
  onNewNote,
}: {
  onOpenNote: (noteId: string) => void;
  onNewNote: () => void;
}) {
  const notes = useHomebaseStore((s) => s.notes);
  const saveDailyBody = useHomebaseStore((s) => s.saveDailyBody);

  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [jumpDate, setJumpDate] = useState("");
  const [showDueList, setShowDueList] = useState(false);
  const [showOverdueList, setShowOverdueList] = useState(false);

  const todayKey = toLocalDateKey(new Date());

  const dailyNotes = useMemo(() => notes.filter((n) => n.kind === "daily"), [notes]);
  const activeNotes = useMemo(
    () => notes.filter((n) => n.kind !== "archive" && n.kind !== "daily"),
    [notes],
  );

  const dayGroups = useMemo(() => {
    const map = new Map<string, DayGroup>();

    const ensure = (dateKey: string) => {
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          dailyNote: undefined,
          createdNotes: [],
          modifiedNotes: [],
        });
      }
      return map.get(dateKey)!;
    };

    ensure(todayKey);
    if (jumpDate && jumpDate.length === 10) {
      ensure(jumpDate);
    }

    for (const daily of dailyNotes) {
      const dateKey = daily.relativePath.replace("notes/daily/", "").replace(/\.md$/, "");
      ensure(dateKey).dailyNote = daily;
    }

    for (const note of activeNotes) {
      const createdKey = toLocalDateKey(note.created);
      const modifiedKey = toLocalDateKey(note.modified);

      ensure(createdKey).createdNotes.push(note);
      if (modifiedKey !== createdKey) {
        ensure(modifiedKey).modifiedNotes.push(note);
      }
    }

    let days = Array.from(map.values());
    days.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    if (range !== "all") {
      const limit = range === "7" ? 7 : 30;
      days = days.filter(
        (day) =>
          daysBetween(day.dateKey, todayKey) <= limit - 1 ||
          (jumpDate && day.dateKey === jumpDate),
      );
    }

    return days;
  }, [activeNotes, dailyNotes, jumpDate, range, todayKey]);

  const tasksSummary = useMemo(() => {
    const taskNotes = notes.filter((n) => n.kind !== "archive");
    const tasks = taskNotes.flatMap((note) =>
      parseTasksFromMarkdown(note.body).map((task) => ({
        ...task,
        noteId: note.id,
        noteTitle: note.title || "New note",
      })),
    );
    const dueToday = tasks.filter(
      (t) => t.status === "todo" && t.due === todayKey,
    );
    const overdue = tasks.filter(
      (t) => t.status === "todo" && t.due && t.due < todayKey,
    );
    return { dueToday, overdue };
  }, [notes, todayKey]);

  const handleJump = () => {
    if (!jumpDate) return;
    const el = document.getElementById(`daily-${jumpDate}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <PanelHeader className="gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold leading-none">
            <Calendar className="size-4 text-muted-foreground" />
            Daily
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatLongDate(getDateFromKey(todayKey))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onNewNote();
            }}
          >
            New note
          </Button>
          <Button
            variant={range === "7" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange("7")}
          >
            7d
          </Button>
          <Button
            variant={range === "30" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange("30")}
          >
            30d
          </Button>
          <Button
            variant={range === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange("all")}
          >
            All
          </Button>
          <div className="ml-2 flex items-center gap-2">
            <Input
              type="date"
              value={jumpDate}
              onChange={(e) => setJumpDate(e.target.value)}
              className="h-8 w-[150px]"
            />
            <Button variant="ghost" size="sm" onClick={handleJump}>
              Jump
            </Button>
          </div>
        </div>
      </PanelHeader>

      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <PillButton
              icon={CalendarDays}
              label="Due today"
              count={tasksSummary.dueToday.length}
              active={showDueList}
              tone="primary"
              onClick={() => setShowDueList((prev) => !prev)}
            />
            <PillButton
              icon={Flame}
              label="Overdue"
              count={tasksSummary.overdue.length}
              active={showOverdueList}
              tone="danger"
              onClick={() => setShowOverdueList((prev) => !prev)}
            />
          </div>

          {showDueList && (
            <TaskQuickList
              title="Due today"
              tasks={tasksSummary.dueToday}
              onOpenNote={onOpenNote}
            />
          )}
          {showOverdueList && (
            <TaskQuickList
              title="Overdue"
              tasks={tasksSummary.overdue}
              onOpenNote={onOpenNote}
            />
          )}

          <div className="space-y-8">
            {dayGroups.map((day) => (
              <DaySection
                key={day.dateKey}
                day={day}
                todayKey={todayKey}
                onOpenNote={onOpenNote}
                onSaveDaily={saveDailyBody}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}

function PillButton({
  icon: Icon,
  label,
  count,
  active,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active?: boolean;
  tone?: "primary" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "bg-accent text-foreground" : "bg-transparent text-muted-foreground",
        tone === "primary" && "border-primary/30",
        tone === "danger" && "border-destructive/30",
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive",
        )}
      />
      <span>{label}</span>
      <span className="font-semibold text-foreground">{count}</span>
    </button>
  );
}

function TaskQuickList({
  title,
  tasks,
  onOpenNote,
}: {
  title: string;
  tasks: { id: string; title: string; noteId: string }[];
  onOpenNote: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 space-y-1">
        {tasks.slice(0, 4).map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenNote(task.noteId)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-accent/40"
          >
            <span className="truncate">{task.title}</span>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DaySection({
  day,
  todayKey,
  onOpenNote,
  onSaveDaily,
}: {
  day: DayGroup;
  todayKey: string;
  onOpenNote: (id: string) => void;
  onSaveDaily: (dateKey: string, body: string) => void;
}) {
  const isToday = day.dateKey === todayKey;
  const [showCreated, setShowCreated] = useState(false);
  const [showUpdated, setShowUpdated] = useState(false);

  return (
    <section id={`daily-${day.dateKey}`} className="space-y-4">
      <div className="sticky top-0 z-10 -mx-6 bg-background/85 px-6 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{formatLongDate(getDateFromKey(day.dateKey))}</h2>
          {isToday && <Badge variant="secondary">Today</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {day.createdNotes.length > 0 && (
            <PillButton
              icon={ClipboardList}
              label="Created"
              count={day.createdNotes.length}
              active={showCreated}
              onClick={() => setShowCreated((prev) => !prev)}
            />
          )}
          {day.modifiedNotes.length > 0 && (
            <PillButton
              icon={ClipboardList}
              label="Updated"
              count={day.modifiedNotes.length}
              active={showUpdated}
              onClick={() => setShowUpdated((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {showCreated && day.createdNotes.length > 0 && (
        <AttachmentSection title="Created" notes={day.createdNotes} onOpenNote={onOpenNote} />
      )}
      {showUpdated && day.modifiedNotes.length > 0 && (
        <AttachmentSection title="Updated" notes={day.modifiedNotes} onOpenNote={onOpenNote} />
      )}

      <DailyEditor
        note={day.dailyNote}
        dateKey={day.dateKey}
        onSave={onSaveDaily}
        placeholder={isToday ? "Write your day…" : ""}
      />
    </section>
  );
}

function AttachmentSection({
  title,
  notes,
  onOpenNote,
}: {
  title: string;
  notes: Note[];
  onOpenNote: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <ClipboardList className="size-3.5" />
        {title}
      </div>
      <div className="grid gap-2">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpenNote(note.id)}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors"
          >
            <span className="truncate font-medium">
              {note.title || "New note"}
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DailyEditor({
  note,
  dateKey,
  onSave,
  placeholder,
}: {
  note?: Note;
  dateKey: string;
  onSave: (dateKey: string, body: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(note?.body ?? "");

  useEffect(() => {
    setDraft(note?.body ?? "");
  }, [note?.id]);

  const editor = useEditor({
    extensions: getMarkdownExtensions(placeholder ?? ""),
    content: draft,
    editorProps: {
      attributes: {
        class:
          "prose min-h-[80px] max-w-none focus:outline-none prose-headings:font-semibold prose-a:text-primary prose-code:text-foreground",
      },
      handleKeyDown: (view, event) => {
        return handleSpaceToConvertTask(view, event);
      },
    },
    onUpdate: ({ editor }) => {
      const md = (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
      setDraft(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(draft);
  }, [editor, note?.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      onSave(dateKey, draft);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [dateKey, draft, onSave]);

  return (
    <div className="bg-transparent px-1 py-1">
      <EditorContent editor={editor} />
    </div>
  );
}
