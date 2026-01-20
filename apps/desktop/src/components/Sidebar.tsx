import { useMemo, useState } from "react";
import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { openPath } from "@tauri-apps/plugin-opener";

import { useHomebaseStore } from "../store/useHomebaseStore";
import type { Collection, Project } from "../lib/types";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { PromptDialog } from "./dialogs/PromptDialog";

type FolderNode = {
  name: string;
  fullPath: string;
  children: FolderNode[];
};

function buildFolderTree(folderPaths: string[]): FolderNode[] {
  type WorkingNode = {
    name: string;
    fullPath: string;
    children: Record<string, WorkingNode>;
  };

  const root: Record<string, WorkingNode> = {};

  for (const fullPath of folderPaths) {
    const parts = fullPath.replace(/^notes\/folders\/?/, "").split("/").filter(Boolean);
    let cursor = root;
    let currentPath = "notes/folders";
    for (const part of parts) {
      currentPath = `${currentPath}/${part}`;
      cursor[part] ??= { name: part, fullPath: currentPath, children: {} };
      cursor = cursor[part].children;
    }
  }

  const toArray = (map: Record<string, WorkingNode>): FolderNode[] => {
    return Object.values(map)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({
        name: node.name,
        fullPath: node.fullPath,
        children: toArray(node.children),
      }));
  };

  return toArray(root);
}

function DroppableNavButton({
  label,
  active,
  onClick,
  droppableId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  droppableId?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId ?? `noop:${label}`,
    disabled: !droppableId,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      ref={setNodeRef}
      className={clsx(
        "w-full rounded px-2 py-1 text-left text-sm",
        active || isOver
          ? "bg-neutral-800 text-neutral-50"
          : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-50",
      )}
    >
      {label}
    </button>
  );
}

function isCollectionActive(current: Collection, target: Collection): boolean {
  if (current.type !== target.type) return false;
  if (current.type === "folder" && target.type === "folder") {
    return current.folderRelativePath === target.folderRelativePath;
  }
  if (current.type === "project" && target.type === "project") {
    return current.projectId === target.projectId;
  }
  return true;
}

export function Sidebar() {
  const vaultPath = useHomebaseStore((s) => s.vaultPath);
  const collection = useHomebaseStore((s) => s.collection);
  const setCollection = useHomebaseStore((s) => s.setCollection);
  const createNote = useHomebaseStore((s) => s.createNote);
  const searchQuery = useHomebaseStore((s) => s.searchQuery);
  const setSearchQuery = useHomebaseStore((s) => s.setSearchQuery);
  const folders = useHomebaseStore((s) => s.folders);
  const createFolder = useHomebaseStore((s) => s.createFolder);
  const renameFolder = useHomebaseStore((s) => s.renameFolder);
  const deleteFolder = useHomebaseStore((s) => s.deleteFolder);
  const projects = useHomebaseStore((s) => s.projects);
  const createProject = useHomebaseStore((s) => s.createProject);
  const updateProject = useHomebaseStore((s) => s.updateProject);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderOpen, setRenameFolderOpen] = useState<null | { path: string; name: string }>(
    null,
  );
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<null | { path: string; name: string }>(
    null,
  );

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [renameProjectOpen, setRenameProjectOpen] = useState<null | { id: string; name: string }>(
    null,
  );
  const [archiveProjectConfirm, setArchiveProjectConfirm] = useState<null | { id: string; name: string; nextStatus: string }>(
    null,
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-none">Homebase</div>
          <div className="mt-1 truncate text-xs text-neutral-400">{vaultPath ?? ""}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!vaultPath) return;
            void openPath(vaultPath);
          }}
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
        >
          Open
        </button>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => createNote()}
          className="w-full rounded bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          New note
        </button>

        <div className="mt-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search…"
            className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700"
          />
        </div>

        <div className="mt-3 space-y-1">
          <DroppableNavButton
            label="Inbox"
            active={isCollectionActive(collection, { type: "inbox" })}
            onClick={() => setCollection({ type: "inbox" })}
            droppableId="drop:inbox"
          />
          <DroppableNavButton
            label="All notes"
            active={isCollectionActive(collection, { type: "all" })}
            onClick={() => setCollection({ type: "all" })}
          />
          <DroppableNavButton
            label="Archive"
            active={isCollectionActive(collection, { type: "archive" })}
            onClick={() => setCollection({ type: "archive" })}
            droppableId="drop:archive"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Folders
            </div>
            <button
              type="button"
              onClick={() => setCreateFolderOpen(true)}
              className="rounded px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
            >
              +
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {folderTree.length === 0 ? (
              <div className="text-xs text-neutral-500">No folders yet.</div>
            ) : (
              folderTree.map((node) => (
                <FolderRow
                  key={node.fullPath}
                  node={node}
                  depth={0}
                  activeCollection={collection}
                  setCollection={setCollection}
                  onRename={(path, name) => setRenameFolderOpen({ path, name })}
                  onDelete={(path, name) => setDeleteFolderConfirm({ path, name })}
                />
              ))
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Projects
            </div>
            <button
              type="button"
              onClick={() => setCreateProjectOpen(true)}
              className="rounded px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
            >
              +
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {projects.length === 0 ? (
              <div className="text-xs text-neutral-500">No projects yet.</div>
            ) : (
              projects
                .slice()
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                .map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    active={isCollectionActive(collection, { type: "project", projectId: p.id })}
                    onClick={() => setCollection({ type: "project", projectId: p.id })}
                    onRename={() => setRenameProjectOpen({ id: p.id, name: p.name })}
                    onToggleArchive={() =>
                      setArchiveProjectConfirm({
                        id: p.id,
                        name: p.name,
                        nextStatus: p.status === "archived" ? "active" : "archived",
                      })
                    }
                  />
                ))
            )}
          </div>
        </div>
      </div>

      <PromptDialog
        open={createFolderOpen}
        title="New folder"
        label="Folder path"
        placeholder="e.g. work or personal/journal"
        confirmLabel="Create"
        onCancel={() => setCreateFolderOpen(false)}
        onConfirm={(value) => {
          const rel = value.startsWith("notes/folders/") ? value : `notes/folders/${value}`;
          void createFolder(rel);
          setCreateFolderOpen(false);
        }}
      />

      <PromptDialog
        open={!!renameFolderOpen}
        title="Rename folder"
        label="New folder name"
        placeholder="e.g. work"
        initialValue={renameFolderOpen?.name ?? ""}
        confirmLabel="Rename"
        onCancel={() => setRenameFolderOpen(null)}
        onConfirm={(value) => {
          if (!renameFolderOpen) return;
          void renameFolder(renameFolderOpen.path, value);
          setRenameFolderOpen(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteFolderConfirm}
        title="Delete folder"
        description={
          deleteFolderConfirm
            ? `Delete "${deleteFolderConfirm.name}"? Folder must be empty.`
            : undefined
        }
        confirmLabel="Delete"
        dangerous
        onCancel={() => setDeleteFolderConfirm(null)}
        onConfirm={() => {
          if (!deleteFolderConfirm) return;
          void deleteFolder(deleteFolderConfirm.path);
          setDeleteFolderConfirm(null);
        }}
      />

      <PromptDialog
        open={createProjectOpen}
        title="New project"
        label="Project name"
        placeholder="e.g. Homebase"
        confirmLabel="Create"
        onCancel={() => setCreateProjectOpen(false)}
        onConfirm={(value) => {
          void createProject(value);
          setCreateProjectOpen(false);
        }}
      />

      <PromptDialog
        open={!!renameProjectOpen}
        title="Rename project"
        label="New project name"
        placeholder="e.g. Homebase"
        initialValue={renameProjectOpen?.name ?? ""}
        confirmLabel="Rename"
        onCancel={() => setRenameProjectOpen(null)}
        onConfirm={(value) => {
          if (!renameProjectOpen) return;
          void updateProject({ id: renameProjectOpen.id, name: value });
          setRenameProjectOpen(null);
        }}
      />

      <ConfirmDialog
        open={!!archiveProjectConfirm}
        title={
          archiveProjectConfirm?.nextStatus === "archived" ? "Archive project" : "Unarchive project"
        }
        description={
          archiveProjectConfirm
            ? `${archiveProjectConfirm.nextStatus === "archived" ? "Archive" : "Unarchive"} "${archiveProjectConfirm.name}"?`
            : undefined
        }
        confirmLabel={archiveProjectConfirm?.nextStatus === "archived" ? "Archive" : "Unarchive"}
        onCancel={() => setArchiveProjectConfirm(null)}
        onConfirm={() => {
          if (!archiveProjectConfirm) return;
          void updateProject({ id: archiveProjectConfirm.id, status: archiveProjectConfirm.nextStatus });
          setArchiveProjectConfirm(null);
        }}
      />
    </aside>
  );
}

function FolderRow({
  node,
  depth,
  activeCollection,
  setCollection,
  onRename,
  onDelete,
}: {
  node: FolderNode;
  depth: number;
  activeCollection: Collection;
  setCollection: (c: Collection) => void;
  onRename: (path: string, name: string) => void;
  onDelete: (path: string, name: string) => void;
}) {
  const isActive =
    activeCollection.type === "folder" && activeCollection.folderRelativePath === node.fullPath;

  const { isOver, setNodeRef } = useDroppable({
    id: `drop:folder:${node.fullPath}`,
  });

  return (
    <div>
      <div
        ref={setNodeRef}
        className={clsx(
          "group flex items-center gap-2 rounded px-2 py-1 text-sm",
          isActive || isOver
            ? "bg-neutral-800 text-neutral-50"
            : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-50",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <button
          type="button"
          className="flex-1 truncate text-left"
          onClick={() => setCollection({ type: "folder", folderRelativePath: node.fullPath })}
        >
          {node.name}
        </button>
        <button
          type="button"
          onClick={() => onRename(node.fullPath, node.name)}
          className="hidden rounded px-1 text-xs text-neutral-300 hover:bg-neutral-700 group-hover:block"
          title="Rename"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.fullPath, node.name)}
          className="hidden rounded px-1 text-xs text-neutral-300 hover:bg-neutral-700 group-hover:block"
          title="Delete"
        >
          ⌫
        </button>
      </div>

      {node.children.length > 0 ? (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <FolderRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              activeCollection={activeCollection}
              setCollection={setCollection}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectRow({
  project,
  active,
  onClick,
  onRename,
  onToggleArchive,
}: {
  project: Project;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onToggleArchive: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `drop:project:${project.id}` });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "group flex items-center gap-2 rounded px-2 py-1 text-sm",
        active || isOver
          ? "bg-neutral-800 text-neutral-50"
          : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-50",
      )}
    >
      <button type="button" className="flex-1 truncate text-left" onClick={onClick}>
        {project.name}
      </button>
      <button
        type="button"
        onClick={onRename}
        className="hidden rounded px-1 text-xs text-neutral-300 hover:bg-neutral-700 group-hover:block"
        title="Rename"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={onToggleArchive}
        className="hidden rounded px-1 text-xs text-neutral-300 hover:bg-neutral-700 group-hover:block"
        title={project.status === "archived" ? "Unarchive" : "Archive"}
      >
        {project.status === "archived" ? "↩" : "⤵"}
      </button>
    </div>
  );
}

