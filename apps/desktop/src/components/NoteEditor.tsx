import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Link2,
  Check,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { MetadataPanel } from "./MetadataPanel";
import { useHomebaseStore } from "../store/useHomebaseStore";
import { formatRelativeDateTime } from "../lib/dates";

export function NoteEditor() {
  const notes = useHomebaseStore((s) => s.notes);
  const draftNote = useHomebaseStore((s) => s.draftNote);
  const selectedNoteId = useHomebaseStore((s) => s.selectedNoteId);
  const saveNoteBody = useHomebaseStore((s) => s.saveNoteBody);
  const saveDraftBody = useHomebaseStore((s) => s.saveDraftBody);
  const updateNoteMeta = useHomebaseStore((s) => s.updateNoteMeta);
  const moveNote = useHomebaseStore((s) => s.moveNote);
  const folders = useHomebaseStore((s) => s.folders);
  const projects = useHomebaseStore((s) => s.projects);

  const note = useMemo(() => {
    const persisted = notes.find((n) => n.id === selectedNoteId);
    if (persisted) return { type: "persisted" as const, note: persisted };
    if (draftNote && draftNote.id === selectedNoteId)
      return { type: "draft" as const, note: draftNote };
    return null;
  }, [draftNote, notes, selectedNoteId]);

  const [draft, setDraft] = useState(note?.note.body ?? "");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  useEffect(() => setDraft(note?.note.body ?? ""), [note?.note.id]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Placeholder.configure({
        placeholder: "Start typing...",
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: draft,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none focus:outline-none prose-headings:font-semibold prose-a:text-primary prose-code:text-foreground",
      },
    },
    onUpdate: ({ editor }) => {
      const md = (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
      setDraft(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (!note) {
      editor.commands.setContent("");
      return;
    }
    editor.commands.setContent(note.note.body);
    editor.commands.focus("end");
  }, [editor, note?.note.id]);

  useEffect(() => {
    if (!note) return;
    setSaveStatus("saving");
    const handle = window.setTimeout(() => {
      if (note.type === "draft") {
        saveDraftBody(draft);
      } else {
        void saveNoteBody(note.note.id, draft);
      }
      setSaveStatus("saved");
    }, 500);
    return () => window.clearTimeout(handle);
  }, [draft, note?.note.id, note?.type, saveDraftBody, saveNoteBody]);

  if (!note) {
    return (
      <section className="flex h-full flex-1 items-center justify-center bg-background text-muted-foreground">
        No note selected.
      </section>
    );
  }

  const formattedDate =
    note.type === "draft" ? "Not saved" : formatRelativeDateTime(note.note.modified);

  return (
    <section className="flex h-full flex-1 bg-background">
      <div className="flex h-full flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{note.note.title || "New note"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{formattedDate}</div>
          </div>
          <div className="flex items-center gap-2">
            <EditorToolbar editor={editor} />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {saveStatus === "saving" ? (
                "Saving..."
              ) : (
                <>
                  <Check className="size-3.5 text-green-500" />
                  Saved
                </>
              )}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto px-6 py-6">
          <EditorContent editor={editor} />
        </div>
      </div>

      {note.type === "persisted" ? (
        <MetadataPanel
          note={note.note}
          folders={folders}
          projects={projects}
          onUpdateMeta={(patch) => void updateNoteMeta(note.note.id, patch)}
          onMove={(targetDir) => void moveNote(note.note.id, targetDir)}
        />
      ) : null}
    </section>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "size-8",
            active && "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 text-muted-foreground">({shortcut})</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  if (!editor) return null;

  const openLinkDialog = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkValue(previousUrl ?? "");
    setLinkDialogOpen(true);
  };

  const handleLinkSubmit = () => {
    setLinkDialogOpen(false);
    if (!linkValue) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: linkValue }).run();
  };

  return (
    <>
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          shortcut="⌘B"
          active={editor.isActive("bold")}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          shortcut="⌘I"
          active={editor.isActive("italic")}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Strikethrough"
          shortcut="⌘⇧S"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          icon={List}
          label="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={CheckSquare}
          label="Task List"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          icon={Link2}
          label="Link"
          shortcut="⌘K"
          active={editor.isActive("link")}
          onClick={openLinkDialog}
        />
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="https://example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLinkSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to remove the link.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLinkSubmit}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
