import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelHeader({ children, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-[56px] shrink-0 items-center justify-between gap-2 border-b border-border px-4",
        className
      )}
    >
      {children}
    </div>
  );
}
