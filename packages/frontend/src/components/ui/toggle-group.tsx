// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Shadcn ToggleGroup over the Radix primitive (shipped in the `radix-ui`
 * umbrella package the project already depends on — no new dependency).
 *
 * Styled to match `TabsList` so a segmented choice and a tab strip read as
 * the same family. Use it for a small set of mutually exclusive options
 * (`type="single"`) or independent on/off formatting toggles
 * (`type="multiple"`) where a `Select` would cost two clicks for one choice.
 */
const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-8 items-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground",
      className,
    )}
    {...props}
  />
))
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex h-full min-w-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors",
      "hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
