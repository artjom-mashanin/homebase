import type { VaultNoteKind } from "./vaultApi";
import type { NoteFrontmatter } from "./markdown";

export type NoteId = string;

export type Note = {
  id: NoteId;
  relativePath: string;
  kind: VaultNoteKind;
  title: string;
  created: string;
  modified: string;
  projects: string[];
  topics: string[];
  userPlaced: boolean;
  body: string;
  searchText: string;
  rawFrontmatter: NoteFrontmatter;
};

export type DraftNote = {
  id: NoteId;
  targetDir: string;
  kind: VaultNoteKind;
  title: string;
  created: string;
  modified: string;
  projects: string[];
  topics: string[];
  userPlaced: boolean;
  body: string;
  isPersisting: boolean;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  created: string;
  modified: string;
  folderRelativePath: string;
};

export type Collection =
  | { type: "daily" }
  | { type: "tasks" }
  | { type: "inbox" }
  | { type: "all" }
  | { type: "folder"; folderRelativePath: string }
  | { type: "project"; projectId: string }
  | { type: "archive" }
  | { type: "search" };
