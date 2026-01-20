import { useEffect, useMemo, useState } from "react";
import { Dialog } from "./Dialog";

export function PromptDialog({
  open,
  title,
  label,
  placeholder,
  initialValue,
  allowEmpty = false,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  allowEmpty?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue ?? "");
    setTouched(false);
  }, [initialValue, open]);

  const error = useMemo(() => {
    if (!touched) return null;
    if (!allowEmpty && !value.trim()) return "Required";
    return null;
  }, [allowEmpty, touched, value]);

  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      <div className="space-y-3">
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {label}
          </div>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            className="mt-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setTouched(true);
                const trimmed = value.trim();
                if (!allowEmpty && !trimmed) return;
                onConfirm(trimmed);
              }
            }}
          />
          {error ? <div className="mt-1 text-xs text-red-300">{error}</div> : null}
        </label>

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
            onClick={() => {
              setTouched(true);
              const trimmed = value.trim();
              if (!allowEmpty && !trimmed) return;
              onConfirm(trimmed);
            }}
            className="rounded bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
