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

/**
 * The circular reveal without the View Transitions API.
 *
 * `document.startViewTransition` is absent on Safari 15.4 — the engine on the
 * iPad mini 4 — so the theme change there was correct but instantaneous. This
 * reproduces the same sweep using only `transform` and `opacity`, which every
 * engine FEED runs on animates on the compositor.
 *
 * The API's whole job is snapshotting the old frame for us; without it we have
 * to hold that frame ourselves. So: cover the screen in the OUTGOING
 * background, flip the theme underneath where it cannot be seen, then grow a
 * disc of the INCOMING background from the trigger. The disc is read after the
 * flip rather than predicted, which keeps this independent of which theme is
 * arriving — "system" resolves to whatever it resolves to.
 *
 * Scaling a border-radius disc is used rather than animating `clip-path`,
 * which older WebKit will not interpolate.
 */
let fallbackRunning = false

function runFallbackReveal(
  origin: { x: number; y: number },
  endRadius: number,
  update: () => void
) {
  const read = (el: Element | null) =>
    el ? getComputedStyle(el).backgroundColor : ""

  // Only a genuinely zero ALPHA disqualifies a colour. Sniffing for a trailing
  // ", 0)" instead would also reject `rgb(0, 0, 0)` — and FEED's dark theme
  // background is true black, so the disc would have been painted white on
  // every switch into dark and flashed before it was removed.
  const opaque = (c: string) => {
    if (!c || c === "transparent") return false
    const fn = /^rgba?\(([^)]+)\)$/.exec(c)
    if (!fn) return true // oklch(), color(), lab(): a painted colour
    const parts = fn[1].split(/[,/]/).map((part) => part.trim())
    return parts.length < 4 || parseFloat(parts[3]) !== 0
  }

  const outgoing =
    [read(document.body), read(document.documentElement)].find(opaque) ?? "#fff"

  const layer = (color: string) => {
    const el = document.createElement("div")
    el.style.cssText =
      "position:fixed;pointer-events:none;margin:0;padding:0;" +
      "will-change:transform,opacity;"
    el.style.background = color
    document.body.appendChild(el)
    return el
  }

  // Holds the outgoing frame so the class flip underneath is never visible.
  const hold = layer(outgoing)
  hold.style.inset = "0"
  hold.style.zIndex = "2147483646"

  flushSync(update)

  const incoming =
    [read(document.body), read(document.documentElement)].find(opaque) ?? "#fff"

  const size = endRadius * 2
  const disc = layer(incoming)
  disc.style.left = `${origin.x - endRadius}px`
  disc.style.top = `${origin.y - endRadius}px`
  disc.style.width = `${size}px`
  disc.style.height = `${size}px`
  disc.style.borderRadius = "50%"
  disc.style.zIndex = "2147483647"
  disc.style.transform = "scale(0)"

  const cleanup = () => {
    hold.remove()
    disc.remove()
    fallbackRunning = false
  }

  const sweep = disc.animate(
    { transform: ["scale(0)", "scale(1)"] },
    // Matches the View Transitions path's easing; shorter, because this sweep
    // carries a flat colour rather than a snapshot of the outgoing UI and so
    // has less to look at while it travels.
    { duration: 700, easing: "cubic-bezier(0.64, 0, 0.36, 1)", fill: "forwards" }
  )

  sweep.finished
    .then(() => {
      // The disc now matches the real background exactly, so dropping the hold
      // reveals nothing; fading the disc lets the incoming UI arrive rather
      // than snap.
      hold.remove()
      const settle = disc.animate(
        { opacity: [1, 0] },
        { duration: 260, easing: "ease-out", fill: "forwards" }
      )
      return settle.finished
    })
    .then(cleanup, cleanup)
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

  if (prefersReducedMotion()) {
    flushSync(update)
    return
  }

  const origin = getTransitionOrigin(trigger)
  const width = window.innerWidth
  const height = window.innerHeight
  const maxX = Math.max(origin.x, width - origin.x)
  const maxY = Math.max(origin.y, height - origin.y)
  const endRadius = Math.hypot(maxX, maxY)

  if (!supportsViewTransition) {
    if (fallbackRunning || typeof document.body?.animate !== "function") {
      flushSync(update)
      return
    }
    fallbackRunning = true
    try {
      runFallbackReveal(origin, endRadius, update)
    } catch {
      fallbackRunning = false
      flushSync(update)
    }
    return
  }

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
  // geometry is equivalent to the pixel form it replaced, not an approximation
  // of it.
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
        // A symmetric ease-in-out S-curve — reflecting it through (0.5, 0.5)
        // maps (0.64, 0) onto (0.36, 1), so the acceleration in mirrors the
        // deceleration out exactly. It is effectively easeInOutCubic, whose
        // canonical form is cubic-bezier(0.65, 0, 0.35, 1).
        //
        // Chosen over the previous 600ms ease-out (cubic-bezier(0.22, 1, 0.36,
        // 1)) for how it renders on 60Hz displays: that curve spent most of its
        // travel in the first handful of frames, which reads as a jump on a
        // 16.7ms frame budget. At 1200ms the sweep has ~72 frames to cover, and
        // the symmetric curve spreads the movement across them instead of
        // front-loading it.
        //
        // This is a deliberate feel choice, not a derived value — retune it
        // freely, but check it on a 60Hz panel rather than only on 120Hz.
        duration: 1200,
        easing: "cubic-bezier(0.64, 0, 0.36, 1)",
        pseudoElement: "::view-transition-new(root)",
      } as KeyframeAnimationOptions & { pseudoElement: string }
    )

    void animation.finished.catch(() => undefined)
  } catch {
    // Keep the theme change even if the custom reveal cannot be animated.
  }
}
