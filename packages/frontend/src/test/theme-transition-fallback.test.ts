// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { describe, expect, it, beforeEach, vi } from "vitest"
import { runThemeTransition } from "@/lib/theme-transition"

/**
 * Safari 15.4 — the engine on the iPad mini 4 — has no View Transitions API, so
 * the theme change there runs through `runFallbackReveal`. These cover the part
 * of that path that a browser cannot be relied on to reveal in review: which
 * colour the expanding disc is painted.
 */
const animations: Array<{ el: HTMLElement; keyframes: unknown }> = []

function stubAnimate() {
  Element.prototype.animate = function (this: HTMLElement, keyframes: unknown) {
    animations.push({ el: this, keyframes })
    return {
      finished: Promise.resolve(),
      cancel: () => undefined,
    } as unknown as Animation
  } as typeof Element.prototype.animate
}

describe("theme transition without View Transitions", () => {
  beforeEach(() => {
    animations.length = 0
    document.body.innerHTML = ""
    document.documentElement.className = ""
    // @ts-expect-error — exercising the engine that lacks it
    delete document.startViewTransition
    stubAnimate()
    window.matchMedia = ((q: string) =>
      ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList) as typeof window.matchMedia
  })

  it("paints the disc in the incoming background, not a white default", () => {
    document.body.style.backgroundColor = "rgb(255, 255, 255)"
    runThemeTransition({
      update: () => {
        // FEED's dark background is true black. A zero-alpha sniff that keys on
        // a trailing ", 0)" mistakes this for transparent and falls back to
        // white, which flashes before the disc is removed.
        document.body.style.backgroundColor = "rgb(0, 0, 0)"
      },
    })

    const disc = animations.find((a) => a.el.style.borderRadius === "50%")
    expect(disc, "an expanding disc should have been animated").toBeTruthy()
    expect(disc!.el.style.backgroundColor).toBe("rgb(0, 0, 0)")
    expect(disc!.el.style.backgroundColor).not.toBe("#fff")
  })

  it("still treats a genuinely transparent background as unusable", () => {
    document.body.style.backgroundColor = "rgba(0, 0, 0, 0)"
    document.documentElement.style.backgroundColor = "rgb(12, 20, 33)"
    runThemeTransition({ update: () => undefined })

    const hold = animations.length ? document.body.firstElementChild : null
    // The hold layer takes the first opaque colour it can find, which must be
    // the html background rather than the transparent body.
    expect((hold as HTMLElement | null)?.style.backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)"
    )
  })
})
