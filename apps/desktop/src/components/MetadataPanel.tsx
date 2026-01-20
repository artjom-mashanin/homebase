import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import type { Note, Project } from "../lib/types";

function foldersToOptions(folderPaths: string[]) {
  return folderPaths
    .filter((p) => p.startsWith("notes/folders/"))
    .sort()
    .map((p) => ({
      value: p,
      label: p.replace(/^notes\/folders\/?/, "") || "(root)",
    }));
}

export function MetadataPanel({
  note,
  folders,
  projects,
  onUpdateMeta,
  onMove,
}: {
  note: Note;
  folders: string[];
  projects: Project[];
  onUpdateMeta: (patch: { projects?: string[]; topics?: string[] }) => void;
  onMove: (targetDir: string) => void;
}) {
  const moveOptions = useMemo(() => {
    const folderOptions = foldersToOptions(folders);
    const projectOptions = projects
      .slice()
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((p) => ({ value: p.folderRelativePath, label: `📁 ${p.name}` }));

    return [
      { value: "notes/inbox", label: "Inbox" },
      ...folderOptions.map((o) => ({ ...o, label: `📁 ${o.label}` })),
      ...projectOptions,
    ];
  }, [folders, projects]);

  const currentMoveValue = useMemo(() => {
    const matches = moveOptions.filter((o) => note.relativePath.startsWith(`${o.value}/`));
    matches.sort((a, b) => b.value.length - a.value.length);
    return matches[0]?.value ?? "notes/inbox";
  }, [moveOptions, note.relativePath]);

  const [topicsDraft, setTopicsDraft] = useState(note.topics.join(", "));
  useEffect(() => setTopicsDraft(note.topics.join(", ")), [note.id, note.topics]);

  return (
    <aside className="flex h-full w-72 flex-col border-l border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="text-sm font-semibold leading-none">Metadata</div>
        <div className="mt-1 text-xs text-neutral-500">Note ID: {note.id}</div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Location
            </div>
            <div className="mt-1 text-xs text-neutral-300">{note.relativePath}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Move Note
            </div>
            <select
              className="mt-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-700"
              value={currentMoveValue}
              onChange={(e) => onMove(e.currentTarget.value)}
            >
              {moveOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-neutral-500">
              Moving out of Inbox marks the note as user-placed.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Projects
            </div>
            <div className="mt-2 space-y-1">
              {projects.length === 0 ? (
                <div className="text-xs text-neutral-500">No projects yet.</div>
              ) : (
                projects
                  .slice()
                  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((p) => {
                    const checked = note.projects.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={clsx(
                          "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm",
                          "hover:bg-neutral-900",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.currentTarget.checked
                              ? [...note.projects, p.id]
                              : note.projects.filter((id) => id !== p.id);
                            onUpdateMeta({ projects: next });
                          }}
                        />
                        <span className="truncate">{p.name}</span>
                        {p.status === "archived" ? (
                          <span className="ml-auto rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-400">
                            archived
                          </span>
                        ) : null}
                      </label>
                    );
                  })
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Topics
            </div>
            <input
              value={topicsDraft}
              onChange={(e) => setTopicsDraft(e.currentTarget.value)}
              onBlur={() => {
                const next = topicsDraft
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                onUpdateMeta({ topics: next });
              }}
              placeholder="e.g. product, planning"
              className="mt-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-400">Created</div>
              <div className="mt-1 text-neutral-300">{note.created}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-400">Modified</div>
              <div className="mt-1 text-neutral-300">{note.modified}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Placement
            </div>
            <div className="mt-1 text-xs text-neutral-300">
              {note.userPlaced ? "User-placed" : "Inbox / AI-managed"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
