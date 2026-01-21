import { invoke } from "@tauri-apps/api/core";

export type VaultInfo = {
  vaultPath: string;
  version: number;
};

export type VaultNoteKind = "inbox" | "daily" | "folder" | "project" | "archive" | "other";

export type VaultNoteEntry = {
  relativePath: string;
  kind: VaultNoteKind;
  mtimeMs: number;
  size: number;
};

export type CreateNoteResult = {
  id: string;
  relativePath: string;
  contents: string;
};

export type ProjectInfo = {
  id: string;
  name: string;
  status: string;
  created: string;
  modified: string;
  folderRelativePath: string;
};

export type UpdateProjectArgs = {
  id: string;
  name?: string;
  status?: string;
};

export async function vaultInit(): Promise<VaultInfo> {
  return await invoke("vault_init");
}

export async function vaultListNotes(opts: {
  includeArchived: boolean;
}): Promise<VaultNoteEntry[]> {
  return await invoke("vault_list_notes", { includeArchived: opts.includeArchived });
}

export async function vaultReadNote(relativePath: string): Promise<string> {
  return await invoke("vault_read_note", { relativePath });
}

export async function vaultWriteNote(opts: {
  relativePath: string;
  contents: string;
}): Promise<void> {
  await invoke("vault_write_note", opts);
}

export async function vaultCreateNoteInInbox(): Promise<CreateNoteResult> {
  return await invoke("vault_create_note_in_inbox");
}

export async function vaultCreateNote(opts?: { targetDir?: string }): Promise<CreateNoteResult> {
  return await invoke("vault_create_note", { targetDir: opts?.targetDir });
}

export async function vaultCreateNoteFromMarkdown(opts: {
  id: string;
  targetDir?: string;
  titleHint?: string;
  contents: string;
}): Promise<string> {
  return await invoke("vault_create_note_from_markdown", { args: opts });
}

export async function vaultCreateDailyNote(opts: {
  date: string;
  contents?: string;
}): Promise<string> {
  return await invoke("vault_create_daily_note", { args: opts });
}

export async function vaultArchiveNote(relativePath: string): Promise<string> {
  return await invoke("vault_archive_note", { relativePath });
}

export async function vaultMoveNote(opts: {
  relativePath: string;
  targetDir: string;
}): Promise<string> {
  return await invoke("vault_move_note", opts);
}

export async function vaultListFolders(): Promise<string[]> {
  return await invoke("vault_list_folders");
}

export async function vaultCreateFolder(relativePath: string): Promise<void> {
  await invoke("vault_create_folder", { relativePath });
}

export async function vaultRenameFolder(opts: {
  fromRelativePath: string;
  toName: string;
}): Promise<string> {
  return await invoke("vault_rename_folder", opts);
}

export async function vaultDeleteFolder(relativePath: string): Promise<void> {
  await invoke("vault_delete_folder", { relativePath });
}

export async function vaultListProjects(): Promise<ProjectInfo[]> {
  return await invoke("vault_list_projects");
}

export async function vaultCreateProject(name: string): Promise<ProjectInfo> {
  return await invoke("vault_create_project", { name });
}

export async function vaultUpdateProject(args: UpdateProjectArgs): Promise<ProjectInfo> {
  return await invoke("vault_update_project", { args });
}
