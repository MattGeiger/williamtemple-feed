// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { MoonIcon } from "@/components/animate-ui/icons/moon"
import { SunIcon } from "@/components/animate-ui/icons/sun"
import { SunMoonIcon } from "@/components/animate-ui/icons/sun-moon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { runThemeTransition } from "@/lib/theme-transition"
import { cn } from "@/lib/utils"

type ThemeSelection = "light" | "dark" | "system"

const THEME_SWITCHER_TRIGGER_ID = "theme-switcher-trigger"

const appearanceOptions: Array<{
  value: ThemeSelection
  label: string
  icon: React.ComponentType<{
    className?: string
    size?: number
    animateOnHover?: boolean | string
    animateOnTap?: boolean | string
    animateOnView?: boolean | string
    style?: React.CSSProperties
  }>
}> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: SunMoonIcon },
]

function isThemeSelection(value: string | undefined): value is ThemeSelection {
  return value === "light" || value === "dark" || value === "system"
}

function ThemeIcon({
  theme,
  resolvedTheme,
  className,
}: {
  theme: ThemeSelection
  resolvedTheme?: string
  className?: string
}) {
  if (theme === "system") {
    return (
      <AnimateIcon animateOnHover animateOnTap>
        <SunMoonIcon size={16} className={className} />
      </AnimateIcon>
    )
  }

  if (resolvedTheme === "dark" || theme === "dark") {
    return (
      <AnimateIcon animateOnHover="balancing" animateOnTap>
        <MoonIcon size={16} className={className} />
      </AnimateIcon>
    )
  }

  return (
    <AnimateIcon animateOnHover animateOnTap>
      <SunIcon size={16} className={className} />
    </AnimateIcon>
  )
}

function AnimatedOptionIcon({
  icon: Icon,
  replayKey,
  index,
}: {
  icon: (typeof appearanceOptions)[number]["icon"]
  replayKey: number
  index: number
}) {
  // No inline animateOn* — IconWrapper would treat them as overrides and
  // create its own context, ignoring the parent <AnimateIcon asChild>.
  // With overrides stripped, the icon inherits from the wrapping
  // AnimateIcon and plays its unique animation on parent-row mount/hover/tap.
  return (
    <Icon
      key={replayKey}
      size={16}
      className="mr-2 h-4 w-4"
      style={{ "--feed-icon-motion-delay": `${index * 50}ms` } as React.CSSProperties}
    />
  )
}

export function ThemeSwitcher() {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const { theme, resolvedTheme, setTheme } = useTheme()
  const selectedTheme = isThemeSelection(theme) ? theme : "system"
  const [iconReplayCounts, setIconReplayCounts] = React.useState<
    Record<ThemeSelection, number>
  >({
    light: 0,
    dark: 0,
    system: 0,
  })

  const replayIcon = (value: ThemeSelection) => {
    setIconReplayCounts((current) => ({
      ...current,
      [value]: current[value] + 1,
    }))
  }

  const handleThemeChange = (nextTheme: string) => {
    if (!isThemeSelection(nextTheme) || selectedTheme === nextTheme) {
      return
    }

    void runThemeTransition({
      trigger: triggerRef.current,
      update: () => setTheme(nextTheme),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          id={THEME_SWITCHER_TRIGGER_ID}
          variant="outline"
          size="icon"
          className={cn(
            "relative h-10 w-10 rounded-full border-border/70 bg-background/72 shadow-sm backdrop-blur-md transition-colors",
            "hover:bg-background/90 supports-backdrop-filter:bg-background/58"
          )}
        >
          <ThemeIcon
            theme={selectedTheme}
            resolvedTheme={resolvedTheme}
            className="h-4 w-4"
          />
          <span className="sr-only">Theme options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-2xl border-border/70 bg-background/40 p-2 shadow-xl backdrop-blur-[14px] backdrop-saturate-150 supports-backdrop-filter:bg-background/40"
      >
        <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedTheme}
          onValueChange={handleThemeChange}
        >
          {appearanceOptions.map((option, index) => (
            <AnimateIcon
              key={option.value}
              asChild
              animate
              animateOnHover
              animateOnTap
            >
              <DropdownMenuRadioItem
                value={option.value}
                className="gap-2 rounded-lg py-2 pr-2"
                data-feed-no-icon-motion="true"
                onPointerEnter={() => replayIcon(option.value)}
                onFocus={() => replayIcon(option.value)}
              >
                <AnimatedOptionIcon
                  icon={option.icon}
                  replayKey={iconReplayCounts[option.value]}
                  index={index}
                />
                {option.label}
              </DropdownMenuRadioItem>
            </AnimateIcon>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
