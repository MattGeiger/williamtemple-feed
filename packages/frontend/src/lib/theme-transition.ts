// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { flushSync } from "react-dom"

interface ThemeTransitionOptions {
  trigger?: HTMLElement | null
  update: () => void
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

function getTransitionOrigin(trigger?: HTMLElement | null) {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 }
  }

  if (!trigger) {
    return {
      x: window.innerWidth - 56,
      y: 56,
    }
  }

  const rect = trigger.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

export async function runThemeTransition({
  trigger,
  update,
}: ThemeTransitionOptions) {
  if (typeof document === "undefined") {
    update()
    return
  }

  const supportsViewTransition =
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function"

  if (!supportsViewTransition || prefersReducedMotion()) {
    flushSync(update)
    return
  }

  const origin = getTransitionOrigin(trigger)
  const maxX = Math.max(origin.x, window.innerWidth - origin.x)
  const maxY = Math.max(origin.y, window.innerHeight - origin.y)
  const endRadius = Math.hypot(maxX, maxY)

  const transition = document.startViewTransition(() => {
    flushSync(update)
  })

  try {
    await transition.ready

    const animation = document.documentElement.animate(
      {
        clipPath: [
          `circle(20px at ${origin.x}px ${origin.y}px)`,
          `circle(${endRadius}px at ${origin.x}px ${origin.y}px)`,
        ],
      },
      {
        duration: 600,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        pseudoElement: "::view-transition-new(root)",
      } as KeyframeAnimationOptions & { pseudoElement: string }
    )

    void animation.finished.catch(() => undefined)
  } catch {
    // Keep the theme change even if the custom reveal cannot be animated.
  }
}
