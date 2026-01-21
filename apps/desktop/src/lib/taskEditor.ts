import type { Editor } from "@tiptap/react";
import { createTaskId } from "./tasks";

export function canConvertCurrentTaskItem(editor: Editor): boolean {
  const info = getTaskItemInfo(editor);
  if (!info) return false;
  return !/#task:[a-zA-Z0-9_-]+/.test(info.text);
}

export function convertCurrentTaskItemToTask(editor: Editor): boolean {
  const info = getTaskItemInfo(editor);
  if (!info) return false;
  if (/#task:[a-zA-Z0-9_-]+/.test(info.text)) return false;

  const id = createTaskId();
  const marker = `#task:${id}`;

  if (!info.text.trim()) {
    const content = `New task ${marker}`;
    editor.commands.insertContentAt({ from: info.start, to: info.end }, content);
    editor.commands.setTextSelection(info.start + "New task".length);
    return true;
  }

  const suffix = info.text.endsWith(" ") ? marker : ` ${marker}`;
  editor.commands.insertContentAt(info.end, suffix);
  return true;
}

type EditorViewLike = {
  state: {
    selection: any;
    schema: { text: (text: string) => any };
    tr: { replaceWith: (from: number, to: number, node: any) => any };
  };
  dispatch: (tr: any) => void;
};

export function handleSpaceToConvertTask(view: EditorViewLike, event: KeyboardEvent) {
  if (event.key !== " ") return false;
  const info = getTaskItemInfoFromState(view.state);
  if (!info) return false;
  if (info.text.trim().length > 0) return false;
  event.preventDefault();
  const id = createTaskId();
  const content = `New task #task:${id}`;
  const tr = view.state.tr.replaceWith(info.start, info.end, view.state.schema.text(content));
  view.dispatch(tr);
  return true;
}

function getTaskItemInfo(editor: Editor): {
  start: number;
  end: number;
  text: string;
} | null {
  const { state } = editor;
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "taskItem") {
      const start = $from.before(depth) + 1;
      const end = start + node.content.size;
      return {
        start,
        end,
        text: node.textContent,
      };
    }
  }
  return null;
}

function getTaskItemInfoFromState(state: { selection: any }): {
  start: number;
  end: number;
  text: string;
} | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "taskItem") {
      const start = $from.before(depth) + 1;
      const end = start + node.content.size;
      return {
        start,
        end,
        text: node.textContent,
      };
    }
  }
  return null;
}
