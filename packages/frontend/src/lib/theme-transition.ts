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
  const width = window.innerWidth
  const height = window.innerHeight
  const maxX = Math.max(origin.x, width - origin.x)
  const maxY = Math.max(origin.y, height - origin.y)
  const endRadius = Math.hypot(maxX, maxY)

  // The reveal is expressed in PERCENTAGES, not pixels, and this is load
  // bearing.
  //
  // `clip-path` on `::view-transition-new(root)` resolves against that
  // pseudo-element's own box, not the viewport. Those happen to coincide only
  // while the browser sizes the snapshot in CSS pixels. Chrome 150 on a
  // 2× display placed a pixel origin at roughly half its intended fraction
  // across — a button 92% of the way to the right rendered as though it were
  // at 46%, i.e. top centre — while Chromium 148 on the same display and
  // Safari both honoured it. Diagnostics from the affected browser confirmed
  // FEED was requesting the correct coordinates and the browser drew them
  // elsewhere, so the origin cannot be trusted to a fixed pixel box.
  //
  // Percentages resolve proportionally against whatever box the browser uses,
  // so the origin tracks the button regardless of how the snapshot is scaled.
  // A percentage radius resolves against sqrt(w² + h²) / sqrt(2), so the end
  // radius is converted through that reference rather than guessed — the
  // reveal keeps the exact pacing it had.
  const radiusReference = Math.hypot(width, height) / Math.SQRT2
  const originX = (origin.x / width) * 100
  const originY = (origin.y / height) * 100
  const startRadius = (20 / radiusReference) * 100
  const endRadiusPercent = (endRadius / radiusReference) * 100

  const transition = document.startViewTransition(() => {
    flushSync(update)
  })

  try {
    await transition.ready

    const animation = document.documentElement.animate(
      {
        clipPath: [
          `circle(${startRadius}% at ${originX}% ${originY}%)`,
          `circle(${endRadiusPercent}% at ${originX}% ${originY}%)`,
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
