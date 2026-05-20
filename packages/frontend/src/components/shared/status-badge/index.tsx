import { cn } from "@/lib/utils"

export type StatusType = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  status: StatusType;
  className?: string;
}

export function StatusBadge({ 
  label, 
  status,
  className 
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "px-2 py-1 rounded-full text-xs font-medium border",
        {
          'success': 'bg-[hsl(var(--status-success-bg))] border-[hsl(var(--status-success-border))] text-[hsl(var(--status-success-text))]',
          'warning': 'bg-[hsl(var(--status-warning-bg))] border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))]',
          'danger': 'bg-[hsl(var(--status-danger-bg))] border-[hsl(var(--status-danger-border))] text-[hsl(var(--status-danger-text))]',
          'neutral': 'bg-[hsl(var(--status-neutral-bg))] border-[hsl(var(--status-neutral-border))] text-[hsl(var(--status-neutral-text))]',
        }[status],
        className
      )}
    >
      {label}
    </span>
  );
}