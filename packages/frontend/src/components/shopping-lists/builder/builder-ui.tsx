// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Presentational building blocks for the Shopping List Builder chrome
 * (insert panel, canvas toolbar, inspector). They hold no builder state:
 * every value and handler comes from `ShoppingListBuilder.tsx`.
 *
 * The inspector follows the property-panel convention shared by document and
 * design tools: a label on the left, its control on the right, grouped under
 * short section headings. That halves the height of the old stacked
 * label-over-input forms, which is what lets one scroll replace two tabs.
 */

import * as React from 'react';
import { ChevronRight } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { cn } from '@/lib/utils';

/** A titled group of inspector controls, optionally collapsible. */
export function InspectorSection({
  title,
  action,
  children,
  collapsible = false,
  open = true,
  onOpenChange,
  className,
  testId,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  testId?: string;
}) {
  const heading = (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </span>
  );

  if (!collapsible) {
    return (
      <section data-testid={testId} className={cn('space-y-2.5 border-t pt-3 first:border-t-0 first:pt-0', className)}>
        <div className="flex min-h-6 items-center justify-between gap-2">
          {heading}
          {action}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      data-testid={testId}
      className={cn('border-t pt-3 first:border-t-0 first:pt-0', className)}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <CollapsibleTrigger className="group flex flex-1 items-center gap-1 rounded-sm text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight
            size={12}
            className="shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
          />
          {heading}
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="space-y-2.5 pt-2.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** One inspector line: label on the left, control on the right. */
export function FieldRow({
  label,
  htmlFor,
  children,
  className,
  controlClassName,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  controlClassName?: string;
}) {
  return (
    <div className={cn('flex min-h-8 items-center justify-between gap-3', className)}>
      <Label htmlFor={htmlFor} className="min-w-0 shrink text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className={cn('flex w-[58%] shrink-0 items-center justify-end gap-1.5', controlClassName)}>
        {children}
      </div>
    </div>
  );
}

/** An on/off option. The whole row is the label, so the hit target is wide. */
export function SwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
  indent = false,
  testId,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
  testId?: string;
}) {
  return (
    <div className={cn('flex min-h-7 items-center justify-between gap-3', indent && 'pl-3')}>
      <Label
        htmlFor={id}
        className={cn(
          'min-w-0 flex-1 cursor-pointer text-xs font-normal',
          disabled ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {label}
      </Label>
      <Switch
        id={id}
        data-testid={testId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Accessible name when `label` is an icon. */
  ariaLabel?: string;
  disabled?: boolean;
  /**
   * Why this option cannot be chosen right now. A locked option stays
   * visible and muted, and explains itself in a tooltip on hover, focus or
   * click -- unlike `disabled`, which says nothing.
   */
  lockedReason?: string;
  testId?: string;
}

/**
 * A segmented option that is locked, with the reason in a tooltip. It is not
 * `disabled`: a disabled button gets no pointer events, so it could never
 * show why. Selecting it is refused by `Segmented` instead.
 */
function LockedSegmentItem({ value, label, ariaLabel, reason, testId }: {
  value: string;
  label: React.ReactNode;
  ariaLabel?: string;
  reason: string;
  testId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          value={value}
          aria-label={ariaLabel}
          aria-disabled="true"
          data-locked="true"
          data-testid={testId}
          className="cursor-not-allowed opacity-45 hover:text-muted-foreground"
          // Radix closes a tooltip on pointer-down; reopen it so a click on
          // a locked option answers "why not?" too.
          onClick={() => window.setTimeout(() => setOpen(true), 0)}
        >
          {label}
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px] text-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One-click choice between a few mutually exclusive options. Replaces the
 * two-click `Select` for choices small enough to show all at once.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  testId,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SegmentedOption<T>>;
  ariaLabel: string;
  className?: string;
  testId?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Radix lets a single group be cleared by re-pressing the active item;
      // these are required choices, so an empty value is ignored.
      onValueChange={(next) => {
        if (!next) return;
        if (options.some((option) => option.value === next && option.lockedReason)) return;
        onChange(next as T);
      }}
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn('w-full', className)}
    >
      {options.map((option) => (option.lockedReason ? (
        <LockedSegmentItem
          key={option.value}
          value={option.value}
          label={option.label}
          ariaLabel={option.ariaLabel}
          reason={option.lockedReason}
          testId={option.testId}
        />
      ) : (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          data-testid={option.testId}
        >
          {option.label}
        </ToggleGroupItem>
      )))}
    </ToggleGroup>
  );
}

/** Icon-only button with a tooltip that doubles as its accessible name. */
export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    shortcut?: string;
    onClick?: () => void;
    disabled?: boolean;
    pressed?: boolean;
    variant?: 'ghost' | 'outline';
    className?: string;
    children: React.ReactNode;
    testId?: string;
    tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>
>(({
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  variant = 'ghost',
  className,
  children,
  testId,
  tooltipSide = 'bottom',
  ...rest
}, ref) => (
  <Tooltip>
    {/*
      The tooltip anchors to a wrapper span, not the button. Nesting
      TooltipTrigger(asChild) > AnimateIcon(asChild) > Button lets the
      trigger's slotted onClick replace the button's own, so the click never
      reaches the handler. The span also keeps the tooltip on a disabled button.
    */}
    <TooltipTrigger asChild>
      <span className="inline-flex shrink-0">
      <AnimateIcon asChild animateOnHover animateOnTap>
        <Button
          ref={ref}
          type="button"
          variant={variant}
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          data-testid={testId}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'h-8 w-8 shrink-0',
            pressed && 'bg-accent text-accent-foreground',
            className,
          )}
          {...rest}
        >
          {children}
        </Button>
      </AnimateIcon>
      </span>
    </TooltipTrigger>
    <TooltipContent side={tooltipSide} className="flex items-center gap-2">
      <span>{label}</span>
      {shortcut && <kbd className="rounded border px-1 font-sans text-[10px] opacity-80">{shortcut}</kbd>}
    </TooltipContent>
  </Tooltip>
));
ToolbarButton.displayName = 'ToolbarButton';

/**
 * Compact numeric input with an inline unit/axis prefix (`X`, `W`, …), the
 * property-panel idiom for geometry. Four of them fit in the space the old
 * panel used for one labelled field.
 */
export function GeometryInput({
  id,
  prefix,
  label,
  value,
  onChange,
  disabled,
  step,
  testId,
}: {
  id: string;
  prefix: string;
  label: string;
  value: number | string;
  onChange: (raw: string) => void;
  disabled?: boolean;
  step?: string;
  testId?: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground"
      >
        {prefix}
      </span>
      <Input
        id={id}
        data-testid={testId}
        type="number"
        step={step}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn('h-8 pr-2 text-xs md:text-xs', prefix.length > 1 ? 'pl-[46px]' : 'pl-7')}
      />
    </div>
  );
}

/** Small uppercase label that heads a list inside the insert panel. */
export function PanelHeading({
  children,
  count,
  action,
}: {
  children: React.ReactNode;
  count?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
        {count != null && <span className="truncate text-[11px] text-muted-foreground/80">{count}</span>}
      </div>
      {action}
    </div>
  );
}
