import { create } from "zustand";

import {
  vaultArchiveNote,
  vaultCreateFolder,
  vaultCreateDailyNote,
  vaultCreateNoteFromMarkdown,
  vaultCreateProject,
  vaultDeleteFolder,
  vaultInit,
  vaultListFolders,
  vaultListNotes,
  vaultListProjects,
  vaultMoveNote,
  vaultReadNote,
  vaultRenameFolder,
  vaultUpdateProject,
  vaultWriteNote,
  type UpdateProjectArgs,
  type VaultNoteEntry,
} from "../lib/vaultApi";
import {
  getTitleFromBody,
  isMeaningfulBody,
  normalizeStringForSearch,
  nowIso,
  parseNoteFile,
  stringifyNoteFile,
} from "../lib/markdown";
import type { Collection, DraftNote, Note, NoteId, Project } from "../lib/types";
import {
  buildTaskLine,
  toggleTaskStatusWithRecurrence,
  updateTaskMetadata,
  updateTaskTitle,
} from "../lib/tasks";

type UpdateNoteMetaPatch = {
  projects?: string[];
  topics?: string[];
  userPlaced?: boolean;
};

type HomebaseState = {
  isBooting: boolean;
  vaultPath: string | null;
  vaultVersion: number | null;
  notes: Note[];
  draftNote: DraftNote | null;
  folders: string[];
  projects: Project[];
  selectedNoteId: NoteId | null;
  collection: Collection;
  searchQuery: string;
  lastError: string | null;

  init: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setCollection: (collection: Collection) => void;
  setSearchQuery: (value: string) => void;
  clearError: () => void;

  selectNote: (noteId: NoteId) => void;
  createNote: () => NoteId;
  saveNoteBody: (noteId: NoteId, body: string) => Promise<void>;
  saveDraftBody: (body: string) => void;
  updateNoteMeta: (noteId: NoteId, patch: UpdateNoteMetaPatch) => Promise<void>;
  archiveNote: (noteId: NoteId) => Promise<void>;
  moveNote: (noteId: NoteId, targetDir: string) => Promise<void>;
  saveDailyBody: (dateKey: string, body: string) => Promise<void>;
  toggleTaskStatus: (noteId: NoteId, taskId: string, status: "todo" | "done") => Promise<void>;
  updateTaskMeta: (
    noteId: NoteId,
    taskId: string,
    patch: {
      due?: string | null;
      priority?: "low" | "medium" | "high" | "urgent" | null;
      every?: "daily" | "weekly" | "monthly" | null;
      order?: number | null;
    },
  ) => Promise<void>;
  updateTaskTitle: (noteId: NoteId, taskId: string, title: string) => Promise<void>;
  updateTaskOrderBatch: (items: { noteId: NoteId; taskId: string; order: number }[]) => Promise<void>;
  createTaskNote: (args: {
    title: string;
    due?: string | null;
    priority?: "low" | "medium" | "high" | "urgent" | null;
    every?: "daily" | "weekly" | "monthly" | null;
    projectId?: string | null;
  }) => Promise<void>;

  createFolder: (relativePath: string) => Promise<void>;
  renameFolder: (fromRelativePath: string, toName: string) => Promise<void>;
  deleteFolder: (relativePath: string) => Promise<void>;

  createProject: (name: string) => Promise<void>;
  updateProject: (args: UpdateProjectArgs) => Promise<void>;
};

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function coerceIsoString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}

function noteKindFromRelativePath(relativePath: string): Note["kind"] {
  if (relativePath.startsWith("notes/inbox/")) return "inbox";
  if (relativePath.startsWith("notes/daily/")) return "daily";
  if (relativePath.startsWith("notes/archive/")) return "archive";
  if (relativePath.startsWith("notes/projects/")) return "project";
  if (relativePath.startsWith("notes/folders/")) return "folder";
  return "other";
}

function noteKindFromTargetDir(targetDir: string): DraftNote["kind"] {
  if (targetDir.startsWith("notes/inbox")) return "inbox";
  if (targetDir.startsWith("notes/daily")) return "daily";
  if (targetDir.startsWith("notes/projects")) return "project";
  if (targetDir.startsWith("notes/folders")) return "folder";
  return "other";
}

function buildNoteFromFile(entry: VaultNoteEntry, fileMarkdown: string): Note | null {
  const parsed = parseNoteFile(fileMarkdown);
  const id = typeof parsed.frontmatter.id === "string" ? parsed.frontmatter.id : null;
  if (!id) return null;

  const created = coerceIsoString(parsed.frontmatter.created) ?? nowIso();
  const modified = coerceIsoString(parsed.frontmatter.modified) ?? nowIso();

  const projects = coerceStringArray(parsed.frontmatter.projects);
  const topics = coerceStringArray(parsed.frontmatter.topics);
  const userPlaced = parsed.frontmatter.user_placed === true;
  const title = getTitleFromBody(parsed.body);

  const searchText = normalizeStringForSearch([title, parsed.body].join("\n"));

  return {
    id,
    relativePath: entry.relativePath,
    kind: noteKindFromRelativePath(entry.relativePath),
    title,
    created,
    modified,
    projects,
    topics,
    userPlaced,
    body: parsed.body,
    searchText,
    rawFrontmatter: parsed.frontmatter,
  };
}

export const useHomebaseStore = create<HomebaseState>((set, get) => ({
  isBooting: true,
  vaultPath: null,
  vaultVersion: null,
  notes: [],
  draftNote: null,
  folders: [],
  projects: [],
  selectedNoteId: null,
  collection: { type: "daily" },
  searchQuery: "",
  lastError: null,

  init: async () => {
    set({ isBooting: true, lastError: null });
    try {
      const info = await vaultInit();
      set({ vaultPath: info.vaultPath, vaultVersion: info.version });
      await get().refreshAll();
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isBooting: false });
    }
  },

  refreshAll: async () => {
    try {
      const [entries, folders, projects] = await Promise.all([
        vaultListNotes({ includeArchived: true }),
        vaultListFolders(),
        vaultListProjects(),
      ]);

      const notesWithContent = await Promise.all(
        entries.map(async (entry) => {
          const markdown = await vaultReadNote(entry.relativePath);
          return buildNoteFromFile(entry, markdown);
        }),
      );

      const notes = notesWithContent.filter((n): n is Note => n !== null);
      notes.sort((a, b) => b.modified.localeCompare(a.modified));

      set({
        notes,
        folders,
        projects,
      });

      const currentSelected = get().selectedNoteId;
      const draft = get().draftNote;
      const stillExists =
        (currentSelected && notes.some((n) => n.id === currentSelected)) ||
        (draft && currentSelected === draft.id);
      if (!stillExists) {
        set({ selectedNoteId: notes[0]?.id ?? null });
      }
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  setCollection: (collection) => set({ collection }),

  setSearchQuery: (value) => {
    const trimmed = value.trimStart();
    set({
      searchQuery: trimmed,
      collection: trimmed
        ? { type: "search" }
        : get().collection.type === "search"
          ? { type: "daily" }
          : get().collection,
    });
  },

  clearError: () => set({ lastError: null }),

  selectNote: (noteId) => {
    const draft = get().draftNote;
    if (draft && get().selectedNoteId === draft.id && noteId !== draft.id) {
      if (!draft.isPersisting && !isMeaningfulBody(draft.body)) {
        set({ draftNote: null });
      }
    }
    set({ selectedNoteId: noteId });
  },

  createNote: () => {
    const currentCollection = get().collection;
    const projects = get().projects;
    let targetDir = "notes/inbox";
    if (currentCollection.type === "folder") targetDir = currentCollection.folderRelativePath;
    if (currentCollection.type === "project") {
      const project = projects.find((p) => p.id === currentCollection.projectId);
      if (project) targetDir = project.folderRelativePath;
    }
    if (currentCollection.type === "daily" || currentCollection.type === "tasks") {
      targetDir = "notes/inbox";
    }

    const existingDraft = get().draftNote;
    if (existingDraft) {
      if (isMeaningfulBody(existingDraft.body) || existingDraft.isPersisting) {
        set({ selectedNoteId: existingDraft.id });
        return existingDraft.id;
      }
      set({ draftNote: null });
    }

    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const now = nowIso();
    const userPlaced = !targetDir.startsWith("notes/inbox");
    const draft: DraftNote = {
      id,
      targetDir,
      kind: noteKindFromTargetDir(targetDir),
      title: "",
      created: now,
      modified: now,
      projects: [],
      topics: [],
      userPlaced,
      body: "",
      isPersisting: false,
    };

    set({ draftNote: draft, selectedNoteId: id, searchQuery: "" });
    return id;
  },

  saveNoteBody: async (noteId, body) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;

    const modified = nowIso();
    const title = getTitleFromBody(body);
    const searchText = normalizeStringForSearch([title, body].join("\n"));

    const frontmatter = {
      ...(note.rawFrontmatter ?? {}),
      id: note.id,
      created: note.created,
      modified,
      projects: note.projects,
      topics: note.topics,
      user_placed: note.userPlaced,
    } as Record<string, unknown>;
    const full = stringifyNoteFile(frontmatter, body);

    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === noteId
          ? { ...n, body, modified, title, searchText, rawFrontmatter: frontmatter }
          : n,
      ),
    }));

    try {
      await vaultWriteNote({ relativePath: note.relativePath, contents: full });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  saveDraftBody: (body) => {
    const draft = get().draftNote;
    if (!draft) return;
    if (get().selectedNoteId !== draft.id) return;

    const modified = nowIso();
    const title = getTitleFromBody(body);

    set({
      draftNote: {
        ...draft,
        body,
        modified,
        title,
      },
    });

    if (!isMeaningfulBody(body)) return;
    if (draft.isPersisting) return;

    set({
      draftNote: {
        ...draft,
        body,
        modified,
        title,
        isPersisting: true,
      },
    });

    const initialContents = stringifyNoteFile(
      {
        id: draft.id,
        created: draft.created,
        modified,
        projects: draft.projects,
        topics: draft.topics,
        user_placed: draft.userPlaced,
      },
      body,
    );

    void (async () => {
      try {
        const relativePath = await vaultCreateNoteFromMarkdown({
          id: draft.id,
          targetDir: draft.targetDir,
          titleHint: title,
          contents: initialContents,
        });

        const latestDraft = get().draftNote;
        const finalBody =
          latestDraft && latestDraft.id === draft.id ? latestDraft.body : body;
        const finalModified =
          latestDraft && latestDraft.id === draft.id ? latestDraft.modified : modified;
        const finalTitle = getTitleFromBody(finalBody);

        const finalFrontmatter = {
          id: draft.id,
          created: draft.created,
          modified: finalModified,
          projects: draft.projects,
          topics: draft.topics,
          user_placed: draft.userPlaced,
        } as Record<string, unknown>;
        const finalContents = stringifyNoteFile(finalFrontmatter, finalBody);
        await vaultWriteNote({ relativePath, contents: finalContents });

        const note: Note = {
          id: draft.id,
          relativePath,
          kind: noteKindFromRelativePath(relativePath),
          title: finalTitle,
          created: draft.created,
          modified: finalModified,
          projects: draft.projects,
          topics: draft.topics,
          userPlaced: draft.userPlaced,
          body: finalBody,
          searchText: normalizeStringForSearch([finalTitle, finalBody].join("\n")),
          rawFrontmatter: finalFrontmatter,
        };

        set((state) => ({
          notes: [note, ...state.notes],
          draftNote: null,
        }));
      } catch (err) {
        set((state) => ({
          lastError: err instanceof Error ? err.message : String(err),
          draftNote: state.draftNote ? { ...state.draftNote, isPersisting: false } : state.draftNote,
        }));
      }
    })();
  },

  updateNoteMeta: async (noteId, patch) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;

    const projects = patch.projects ?? note.projects;
    const topics = patch.topics ?? note.topics;
    const userPlaced = patch.userPlaced ?? note.userPlaced;
    const modified = nowIso();

    const frontmatter = {
      ...(note.rawFrontmatter ?? {}),
      id: note.id,
      created: note.created,
      modified,
      projects,
      topics,
      user_placed: userPlaced,
    } as Record<string, unknown>;
    const full = stringifyNoteFile(frontmatter, note.body);

    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === noteId
          ? { ...n, projects, topics, userPlaced, modified, rawFrontmatter: frontmatter }
          : n,
      ),
    }));

    try {
      await vaultWriteNote({ relativePath: note.relativePath, contents: full });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  archiveNote: async (noteId) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;

    try {
      const newRelativePath = await vaultArchiveNote(note.relativePath);
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId
            ? { ...n, relativePath: newRelativePath, kind: "archive" }
            : n,
        ),
        selectedNoteId:
          state.selectedNoteId === noteId
            ? state.notes.find((n) => n.id !== noteId && n.kind !== "archive")?.id ?? null
            : state.selectedNoteId,
      }));
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  moveNote: async (noteId, targetDir) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;

    try {
      const newRelativePath = await vaultMoveNote({
        relativePath: note.relativePath,
        targetDir,
      });

      const nextKind = noteKindFromRelativePath(newRelativePath);
      const shouldUserPlace = !newRelativePath.startsWith("notes/inbox/");

      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId
            ? { ...n, relativePath: newRelativePath, kind: nextKind, userPlaced: shouldUserPlace }
            : n,
        ),
      }));

      if (shouldUserPlace !== note.userPlaced) {
        await get().updateNoteMeta(noteId, { userPlaced: shouldUserPlace });
      }
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  saveDailyBody: async (dateKey, body) => {
    const relPath = `notes/daily/${dateKey}.md`;
    const existing = get().notes.find((n) => n.relativePath === relPath);

    if (!existing) {
      if (!isMeaningfulBody(body)) return;
      try {
        const relativePath = await vaultCreateDailyNote({
          date: dateKey,
          contents: body,
        });
        const markdown = await vaultReadNote(relativePath);
        const note = buildNoteFromFile(
          { relativePath, kind: "daily", mtimeMs: Date.now(), size: markdown.length },
          markdown,
        );
        if (!note) return;
        set((state) => ({
          notes: [note, ...state.notes].sort((a, b) => b.modified.localeCompare(a.modified)),
        }));
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    await get().saveNoteBody(existing.id, body);
  },

  toggleTaskStatus: async (noteId, taskId, status) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;
    const nextBody = toggleTaskStatusWithRecurrence(note.body, taskId, status);
    await get().saveNoteBody(noteId, nextBody);
  },

  updateTaskMeta: async (noteId, taskId, patch) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;
    const nextBody = updateTaskMetadata(note.body, taskId, patch);
    await get().saveNoteBody(noteId, nextBody);
  },

  updateTaskTitle: async (noteId, taskId, title) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;
    const nextBody = updateTaskTitle(note.body, taskId, title);
    await get().saveNoteBody(noteId, nextBody);
  },

  updateTaskOrderBatch: async (items) => {
    const notes = get().notes;
    const grouped = new Map<NoteId, { taskId: string; order: number }[]>();
    for (const item of items) {
      if (!grouped.has(item.noteId)) grouped.set(item.noteId, []);
      grouped.get(item.noteId)!.push({ taskId: item.taskId, order: item.order });
    }

    for (const [noteId, updates] of grouped.entries()) {
      const note = notes.find((n) => n.id === noteId);
      if (!note) continue;
      let nextBody = note.body;
      for (const update of updates) {
        nextBody = updateTaskMetadata(nextBody, update.taskId, { order: update.order });
      }
      await get().saveNoteBody(noteId, nextBody);
    }
  },

  createTaskNote: async ({ title, due, priority, every, projectId }) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const now = nowIso();
    const projects = projectId ? [projectId] : [];
    const task = buildTaskLine(title, {
      id,
      due: due ?? undefined,
      priority: priority ?? undefined,
      every: every ?? undefined,
      done: false,
    });

    const frontmatter = {
      id,
      created: now,
      modified: now,
      projects,
      topics: [],
      user_placed: false,
    } as Record<string, unknown>;

    const body = `${task.line}\n`;
    const contents = stringifyNoteFile(frontmatter, body);

    try {
      const relativePath = await vaultCreateNoteFromMarkdown({
        id,
        targetDir: "notes/inbox",
        titleHint: title,
        contents,
      });

      const note: Note = {
        id,
        relativePath,
        kind: noteKindFromRelativePath(relativePath),
        title: getTitleFromBody(body),
        created: now,
        modified: now,
        projects,
        topics: [],
        userPlaced: false,
        body,
        searchText: normalizeStringForSearch([getTitleFromBody(body), body].join("\n")),
        rawFrontmatter: frontmatter,
      };

      set((state) => ({
        notes: [note, ...state.notes].sort((a, b) => b.modified.localeCompare(a.modified)),
      }));
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  createFolder: async (relativePath) => {
    try {
      await vaultCreateFolder(relativePath);
      const folders = await vaultListFolders();
      set({ folders });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  renameFolder: async (fromRelativePath, toName) => {
    try {
      await vaultRenameFolder({ fromRelativePath, toName });
      await get().refreshAll();
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  deleteFolder: async (relativePath) => {
    try {
      await vaultDeleteFolder(relativePath);
      await get().refreshAll();
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  createProject: async (name) => {
    try {
      const project = await vaultCreateProject(name);
      set((state) => ({
        projects: [
          ...state.projects,
          {
            id: project.id,
            name: project.name,
            status: project.status,
            created: project.created,
            modified: project.modified,
            folderRelativePath: project.folderRelativePath,
          },
        ].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      }));
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  updateProject: async (args) => {
    try {
      const updated = await vaultUpdateProject(args);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === updated.id
            ? {
                id: updated.id,
                name: updated.name,
                status: updated.status,
                created: updated.created,
                modified: updated.modified,
                folderRelativePath: updated.folderRelativePath,
              }
            : p,
        ),
      }));
      await get().refreshAll();
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },
}));
