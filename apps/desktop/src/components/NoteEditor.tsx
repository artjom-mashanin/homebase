import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useEffect, useMemo, useState } from "react";

import { MetadataPanel } from "./MetadataPanel";
import { PromptDialog } from "./dialogs/PromptDialog";
import { useHomebaseStore } from "../store/useHomebaseStore";

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

  const note = useMemo(
    () => {
      const persisted = notes.find((n) => n.id === selectedNoteId);
      if (persisted) return { type: "persisted" as const, note: persisted };
      if (draftNote && draftNote.id === selectedNoteId) return { type: "draft" as const, note: draftNote };
      return null;
    },
    [draftNote, notes, selectedNoteId],
  );

  const [draft, setDraft] = useState(note?.note.body ?? "");
  useEffect(() => setDraft(note?.note.body ?? ""), [note?.note.id]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Placeholder.configure({
        placeholder: "Start typing…",
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
          "prose prose-invert max-w-none focus:outline-none prose-headings:font-semibold prose-a:text-blue-400 prose-code:text-neutral-200",
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
    const handle = window.setTimeout(() => {
      if (note.type === "draft") {
        saveDraftBody(draft);
      } else {
        void saveNoteBody(note.note.id, draft);
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [draft, note?.note.id, note?.type, saveDraftBody, saveNoteBody]);

  if (!note) {
    return (
      <section className="flex h-full flex-1 items-center justify-center bg-neutral-950 text-neutral-500">
        No note selected.
      </section>
    );
  }

  return (
    <section className="flex h-full flex-1 bg-neutral-950">
      <div className="flex h-full flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{note.note.title || "New note"}</div>
            <div className="mt-1 text-xs text-neutral-500">{note.note.modified}</div>
          </div>
          <div className="flex items-center gap-2">
            <EditorToolbar editor={editor} />
            <div className="ml-2 text-xs text-neutral-500">
              {note.type === "draft" ? "Not saved" : "Autosave"}
            </div>
          </div>
        </div>
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

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn =
    "rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900 disabled:opacity-40";

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInitialValue, setLinkInitialValue] = useState("");

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          ☐ Task
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            const previousUrl = editor.getAttributes("link").href as string | undefined;
            setLinkInitialValue(previousUrl ?? "");
            setLinkDialogOpen(true);
          }}
        >
          Link
        </button>
      </div>

      <PromptDialog
        open={linkDialogOpen}
        title="Link"
        label="URL (leave empty to remove)"
        placeholder="https://example.com"
        allowEmpty
        initialValue={linkInitialValue}
        confirmLabel="Apply"
        onCancel={() => setLinkDialogOpen(false)}
        onConfirm={(value) => {
          setLinkDialogOpen(false);
          if (!value) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
        }}
      />
    </>
  );
}
