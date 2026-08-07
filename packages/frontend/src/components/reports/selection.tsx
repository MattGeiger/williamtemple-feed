// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

"use client";

/**
 * ZEV-style report selection mode (Reports initiative §3).
 *
 * Selection order becomes PDF/CSV order and persists across all five
 * Reports tabs. Eligible cards wiggle (staggered; static under reduced
 * motion); selected cards stop and show a ring + checkmark + order number.
 * Enter/Space toggles a card; nested controls become inert only while
 * selecting. The provider enforces the 8-card cap client-side (the server
 * enforces it again).
 */

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { messageService } from "@/services/message";
import { MAX_REPORT_SELECTION } from "@/types/reports";

interface ReportSelectionContextValue {
  isSelecting: boolean;
  selectedIds: string[];
  /**
   * Each card's own controls, frozen when selection began.
   *
   * Some cards carry state the page-level filters do not describe — a search
   * box, a donor filter, a year picker. A report must reproduce what was on
   * screen, so that state travels with the request.
   *
   * Frozen at `startSelecting`, not read at generate time: the modal offers no
   * filter controls, so the run must mean what the page showed when the user
   * chose to make a report. Changing a card's filter afterwards would otherwise
   * silently rewrite a selection already made.
   */
  cardOptions: Record<string, unknown>;
  /** Cards publish their current controls here; cheap, and never re-renders. */
  registerOptions: (cardId: string, options: unknown) => void;
  startSelecting: () => void;
  cancelSelecting: () => void;
  toggleCard: (cardId: string) => void;
  moveCard: (cardId: string, direction: -1 | 1) => void;
  removeCard: (cardId: string) => void;
  clearSelection: () => void;
  applySelection: (cardIds: string[]) => void;
}

/** Stable empty array: a new literal each render would churn dependent effects. */
const EMPTY_SELECTION: string[] = [];

const ReportSelectionContext =
  React.createContext<ReportSelectionContextValue | null>(null);

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

/**
 * Selection state, or `null` outside a provider.
 *
 * `SelectableBlock` uses this rather than the throwing hook: selection is an
 * enhancement, so wrapping a card in it must never decide whether the page
 * renders. Twelve Analytics tests mount the procurement workspace directly,
 * with no report context, and a page has no business crashing because a
 * reporting feature is absent.
 */
export function useOptionalReportSelection(): ReportSelectionContextValue | null {
  return React.useContext(ReportSelectionContext);
}

/** Selection state, required. For the toolbar and modal, which cannot work without it. */
export function useReportSelection(): ReportSelectionContextValue {
  const context = React.useContext(ReportSelectionContext);
  if (!context) {
    throw new Error(
      "useReportSelection must be used within a ReportSelectionProvider"
    );
  }
  return context;
}

export function ReportSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [cardOptions, setCardOptions] = React.useState<Record<string, unknown>>({});
  // A ref, not state: cards write on every render, and storing this in state
  // would loop. Only the snapshot taken at startSelecting becomes state.
  const liveOptions = React.useRef<Record<string, unknown>>({});
  const registerOptions = React.useCallback((cardId: string, options: unknown) => {
    liveOptions.current[cardId] = options;
  }, []);

  const value = React.useMemo<ReportSelectionContextValue>(
    () => ({
      isSelecting,
      selectedIds,
      startSelecting: () => {
        setCardOptions({ ...liveOptions.current });
        setIsSelecting(true);
      },
      cardOptions,
      registerOptions,
      cancelSelecting: () => {
        setIsSelecting(false);
        setSelectedIds([]);
      },
      toggleCard: (cardId) => {
        setSelectedIds((current) => {
          if (current.includes(cardId)) {
            return current.filter((id) => id !== cardId);
          }
          if (current.length >= MAX_REPORT_SELECTION) {
            messageService.error(
              `Reports can include at most ${MAX_REPORT_SELECTION} blocks. Remove one before adding another.`
            );
            return current;
          }
          return [...current, cardId];
        });
      },
      moveCard: (cardId, direction) => {
        setSelectedIds((current) => {
          const index = current.indexOf(cardId);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= current.length) {
            return current;
          }
          const next = [...current];
          [next[index], next[target]] = [next[target], next[index]];
          return next;
        });
      },
      removeCard: (cardId) =>
        setSelectedIds((current) => current.filter((id) => id !== cardId)),
      clearSelection: () => setSelectedIds([]),
      applySelection: (cardIds) => {
        setSelectedIds(cardIds.slice(0, MAX_REPORT_SELECTION));
        setIsSelecting(true);
      },
    }),
    [isSelecting, selectedIds, cardOptions, registerOptions]
  );

  return (
    <ReportSelectionContext.Provider value={value}>
      {children}
    </ReportSelectionContext.Provider>
  );
}

/**
 * Wraps one selectable report block. `variant="table"` keeps the ring/check
 * state without wiggling the whole table.
 */
export function SelectableBlock({
  cardId,
  children,
  variant = "card",
  className,
  options,
}: {
  cardId: string;
  children: React.ReactNode;
  variant?: "card" | "table";
  className?: string;
  /** This card's own controls, when it has any the page filters do not cover. */
  options?: unknown;
}) {
  const selection = useOptionalReportSelection();
  const registerOptions = selection?.registerOptions;
  // Published during render rather than in an effect: startSelecting can fire
  // before an effect has flushed, and a stale snapshot is the whole failure
  // mode this exists to prevent.
  if (registerOptions && options !== undefined) registerOptions(cardId, options);
  const isSelecting = selection?.isSelecting ?? false;
  const selectedIds = selection?.selectedIds ?? EMPTY_SELECTION;
  const toggleCard = selection?.toggleCard;
  const contentRef = React.useRef<HTMLDivElement>(null);
  const selectedIndex = selectedIds.indexOf(cardId);
  const isSelected = selectedIndex >= 0;
  const wiggleHash = Math.abs(hashString(cardId));

  // Nested controls (export buttons, table paging, chart tooltips) become
  // inert only during selection so the card itself is one big target.
  // React 18 has no `inert` prop; set the property imperatively.
  React.useEffect(() => {
    const node = contentRef.current as
      | (HTMLDivElement & { inert: boolean })
      | null;
    if (node) node.inert = isSelecting;
  }, [isSelecting]);

  // The wrapper becomes the grid item wherever a card sits in a grid, so it
  // must hand its stretched height down. Without this the card keeps its own
  // content height and the taller sibling leaves a gap beneath it — 56px under
  // Procurement Channels when Acquisition Mix ran longer. `h-full` is inert
  // outside a stretching parent, so this costs nothing elsewhere.
  if (!isSelecting) {
    return (
      <div className={cn("min-w-0 h-full [&>*]:h-full", className)}>{children}</div>
    );
  }

  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      aria-label={`Select report block ${cardId}`}
      tabIndex={0}
      onClick={() => toggleCard?.(cardId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleCard?.(cardId);
        }
      }}
      className={cn(
        // Same height passthrough as above, so entering selection mode does
        // not change the layout it is selecting from.
        "relative min-w-0 h-full [&>*]:h-full cursor-pointer rounded-lg outline-hidden",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "card" && !isSelected && "report-selectable",
        isSelected &&
          "report-selectable-selected ring-2 ring-primary ring-offset-2 ring-offset-background",
        className
      )}
      style={
        variant === "card" && !isSelected
          ? ({
              // Match ZEV's rapid, organic selection motion: short loops
              // with small per-card duration and start-time differences.
              "--report-wiggle-delay": `${(wiggleHash % 6) * 60}ms`,
              "--report-wiggle-duration": `${
                820 + (wiggleHash % 5) * 75
              }ms`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {isSelected && (
        <span className="absolute -right-2 -top-2 z-10 flex items-center gap-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {selectedIndex + 1}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </span>
        </span>
      )}
      <div ref={contentRef} className="min-w-0">{children}</div>
    </div>
  );
}
