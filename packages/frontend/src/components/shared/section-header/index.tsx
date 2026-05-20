import type { ComponentType } from "react";

// Accepts Lucide ForwardRefExoticComponent icons, animate-ui native icons,
// and imperative-ref icons. We don't pass any icon-specific props beyond
// className/size, but icon components accept many more props with their
// own shapes, so the slot uses `ComponentType<any>` rather than narrowing
// to a stricter shape that would reject valid icons via prop variance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SectionHeaderIcon = ComponentType<any>;

interface SectionHeaderProps {
  title: string
  description: string
  icon: SectionHeaderIcon
}

export function SectionHeader({ title, description, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-4">
        <Icon className="h-6 w-6 mt-1 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight break-words">{title}</h2>
          <p className="text-sm text-muted-foreground break-words whitespace-normal">{description}</p>
        </div>
      </div>
    </div>
  )
}
