import { useMemo, useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  Inbox,
  FileText,
  Archive,
  Folder,
  Target,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArchiveIcon,
  ArchiveRestore,
  FolderOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useHomebaseStore } from "../store/useHomebaseStore";
import type { Collection, Project } from "../lib/types";

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
  icon: Icon,
  active,
  onClick,
  droppableId,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active || isOver
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
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

// Inline editable input for creating folders/projects
function InlineCreateInput({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <div className="px-2 py-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={handleSubmit}
      />
    </div>
  );
}

// Inline editable input for renaming
function InlineRenameInput({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="h-7 text-sm"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={handleSubmit}
    />
  );
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

  // Inline creation states
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Inline rename states
  const [renamingFolder, setRenamingFolder] = useState<{ path: string; name: string } | null>(null);
  const [renamingProject, setRenamingProject] = useState<{ id: string; name: string } | null>(null);

  // Delete confirmation states
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [archiveProjectConfirm, setArchiveProjectConfirm] = useState<{
    id: string;
    name: string;
    nextStatus: string;
  } | null>(null);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold leading-none">
            <div className="flex size-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              H
            </div>
            Homebase
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{vaultPath ?? ""}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!vaultPath) return;
            void openPath(vaultPath);
          }}
          className="h-7 text-xs"
        >
          <FolderOpen className="size-3.5" />
          Open
        </Button>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-3">
        <Button onClick={() => createNote()} className="w-full">
          <Plus className="size-4" />
          New note
        </Button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search..."
            className="pl-8"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 space-y-1">
        <DroppableNavButton
          label="Inbox"
          icon={Inbox}
          active={isCollectionActive(collection, { type: "inbox" })}
          onClick={() => setCollection({ type: "inbox" })}
          droppableId="drop:inbox"
        />
        <DroppableNavButton
          label="All notes"
          icon={FileText}
          active={isCollectionActive(collection, { type: "all" })}
          onClick={() => setCollection({ type: "all" })}
        />
        <DroppableNavButton
          label="Archive"
          icon={Archive}
          active={isCollectionActive(collection, { type: "archive" })}
          onClick={() => setCollection({ type: "archive" })}
          droppableId="drop:archive"
        />
      </div>

      {/* Folders & Projects */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        {/* Folders Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Folders
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              onClick={() => setIsCreatingFolder(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="mt-2 space-y-0.5">
            {folderTree.length === 0 && !isCreatingFolder ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">No folders yet.</div>
            ) : (
              folderTree.map((node) => (
                <FolderRow
                  key={node.fullPath}
                  node={node}
                  depth={0}
                  activeCollection={collection}
                  setCollection={setCollection}
                  renamingFolder={renamingFolder}
                  onStartRename={(path, name) => setRenamingFolder({ path, name })}
                  onRename={(path, newName) => {
                    void renameFolder(path, newName);
                    setRenamingFolder(null);
                  }}
                  onCancelRename={() => setRenamingFolder(null)}
                  onDelete={(path, name) => setDeleteFolderConfirm({ path, name })}
                />
              ))
            )}
            {isCreatingFolder && (
              <InlineCreateInput
                placeholder="folder-name"
                onSubmit={(value) => {
                  const rel = value.startsWith("notes/folders/")
                    ? value
                    : `notes/folders/${value}`;
                  void createFolder(rel);
                  setIsCreatingFolder(false);
                }}
                onCancel={() => setIsCreatingFolder(false)}
              />
            )}
          </div>
        </div>

        {/* Projects Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Projects
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              onClick={() => setIsCreatingProject(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="mt-2 space-y-0.5">
            {projects.length === 0 && !isCreatingProject ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">No projects yet.</div>
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
                    renamingProject={renamingProject}
                    onStartRename={() => setRenamingProject({ id: p.id, name: p.name })}
                    onRename={(newName) => {
                      void updateProject({ id: p.id, name: newName });
                      setRenamingProject(null);
                    }}
                    onCancelRename={() => setRenamingProject(null)}
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
            {isCreatingProject && (
              <InlineCreateInput
                placeholder="Project name"
                onSubmit={(value) => {
                  void createProject(value);
                  setIsCreatingProject(false);
                }}
                onCancel={() => setIsCreatingProject(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Delete Folder Confirmation */}
      <AlertDialog
        open={!!deleteFolderConfirm}
        onOpenChange={(open) => !open && setDeleteFolderConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteFolderConfirm?.name}"? Folder must be empty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteFolderConfirm) return;
                void deleteFolder(deleteFolderConfirm.path);
                setDeleteFolderConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Project Confirmation */}
      <AlertDialog
        open={!!archiveProjectConfirm}
        onOpenChange={(open) => !open && setArchiveProjectConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveProjectConfirm?.nextStatus === "archived"
                ? "Archive project"
                : "Unarchive project"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveProjectConfirm?.nextStatus === "archived" ? "Archive" : "Unarchive"} "
              {archiveProjectConfirm?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!archiveProjectConfirm) return;
                void updateProject({
                  id: archiveProjectConfirm.id,
                  status: archiveProjectConfirm.nextStatus,
                });
                setArchiveProjectConfirm(null);
              }}
            >
              {archiveProjectConfirm?.nextStatus === "archived" ? "Archive" : "Unarchive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function FolderRow({
  node,
  depth,
  activeCollection,
  setCollection,
  renamingFolder,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  node: FolderNode;
  depth: number;
  activeCollection: Collection;
  setCollection: (c: Collection) => void;
  renamingFolder: { path: string; name: string } | null;
  onStartRename: (path: string, name: string) => void;
  onRename: (path: string, newName: string) => void;
  onCancelRename: () => void;
  onDelete: (path: string, name: string) => void;
}) {
  const isActive =
    activeCollection.type === "folder" && activeCollection.folderRelativePath === node.fullPath;
  const isRenaming = renamingFolder?.path === node.fullPath;

  const { isOver, setNodeRef } = useDroppable({
    id: `drop:folder:${node.fullPath}`,
  });

  return (
    <div>
      <div
        ref={setNodeRef}
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pr-1 text-sm transition-colors",
          isActive || isOver
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <Folder className="size-4 shrink-0" />

        {isRenaming ? (
          <div className="flex-1 min-w-0">
            <InlineRenameInput
              initialValue={node.name}
              onSubmit={(newName) => onRename(node.fullPath, newName)}
              onCancel={onCancelRename}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex-1 truncate text-left"
              onClick={() => setCollection({ type: "folder", folderRelativePath: node.fullPath })}
            >
              {node.name}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStartRename(node.fullPath, node.name)}>
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(node.fullPath, node.name)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {node.children.length > 0 ? (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <FolderRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              activeCollection={activeCollection}
              setCollection={setCollection}
              renamingFolder={renamingFolder}
              onStartRename={onStartRename}
              onRename={onRename}
              onCancelRename={onCancelRename}
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
  renamingProject,
  onStartRename,
  onRename,
  onCancelRename,
  onToggleArchive,
}: {
  project: Project;
  active: boolean;
  onClick: () => void;
  renamingProject: { id: string; name: string } | null;
  onStartRename: () => void;
  onRename: (newName: string) => void;
  onCancelRename: () => void;
  onToggleArchive: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `drop:project:${project.id}` });
  const isRenaming = renamingProject?.id === project.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
        active || isOver
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Target className="size-4 shrink-0" />

      {isRenaming ? (
        <div className="flex-1 min-w-0">
          <InlineRenameInput
            initialValue={project.name}
            onSubmit={onRename}
            onCancel={onCancelRename}
          />
        </div>
      ) : (
        <>
          <button type="button" className="flex-1 truncate text-left" onClick={onClick}>
            {project.name}
          </button>

          {project.status === "archived" && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              archived
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartRename}>
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleArchive}>
                {project.status === "archived" ? (
                  <>
                    <ArchiveRestore className="size-4" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <ArchiveIcon className="size-4" />
                    Archive
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
