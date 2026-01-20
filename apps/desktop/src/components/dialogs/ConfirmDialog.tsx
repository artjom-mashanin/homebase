import { Dialog } from "./Dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  dangerous,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      <div className="space-y-4">
        {description ? <div className="text-sm text-neutral-300">{description}</div> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              dangerous
                ? "rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                : "rounded bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

