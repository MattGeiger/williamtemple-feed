// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, MouseEvent } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

// Hand-rolled animated variant of Lucide's `globe-lock`. There is no
// upstream animate-ui version, so this composes two motion ideas borrowed
// from existing self-animating icons:
//   - globe lines trace in (path-length sweep, à la the Dribbble icon)
//   - the lock bobs and tips (transform loop, à la the Folder-Lock icon)
// Geometry is Lucide v0.522.0 `globe-lock` verbatim so it stays visually
// identical to the static icon at rest. See docs/motion/ICON_ANIMATIONS.md.

export interface GlobeLockIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface GlobeLockIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

// Globe outline + meridian + equator: draw on with a path-length sweep.
const LINE_VARIANTS: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
    pathOffset: 0,
    transition: { duration: 0.4, opacity: { duration: 0.1 } },
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [1, 0],
    transition: { duration: 0.6, ease: "linear", opacity: { duration: 0.1 } },
  },
};

// Lock body + shackle: stay drawn, but bob up and tip side to side while
// hovered. transformOrigin sits at the lock's center (Lucide places the lock
// at x14–22 / y4–11).
const LOCK_VARIANTS: Variants = {
  normal: { y: 0, rotate: 0 },
  animate: {
    y: [0, -1.4, 0],
    rotate: [0, -4, 3, 0],
    transition: {
      duration: 0.7,
      ease: "easeInOut",
      repeat: Number.POSITIVE_INFINITY,
    },
  },
};

const GlobeLockIcon = forwardRef<GlobeLockIconHandle, GlobeLockIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const lineControls = useAnimation();
    const lockControls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => {
          lineControls.start("animate");
          lockControls.start("animate");
        },
        stopAnimation: () => {
          lineControls.start("normal");
          lockControls.start("normal");
        },
      };
    });

    const handleMouseEnter = useCallback(
      (event: MouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(event);
        } else {
          lineControls.start("animate");
          lockControls.start("animate");
        }
      },
      [lineControls, lockControls, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (event: MouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(event);
        } else {
          lineControls.start("normal");
          lockControls.start("normal");
        }
      },
      [lineControls, lockControls, onMouseLeave],
    );

    return (
      <span
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          // className lands on the glyph so consumers (e.g. the toolbar's
          // `h-4 w-4 mr-2`) size and space the icon exactly like a bare
          // Lucide / animate-ui icon.
          className={cn(className)}
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            animate={lineControls}
            d="M15.686 15A14.5 14.5 0 0 1 12 22a14.5 14.5 0 0 1 0-20 10 10 0 1 0 9.542 13"
            initial="normal"
            variants={LINE_VARIANTS}
          />
          <motion.path
            animate={lineControls}
            d="M2 12h8.5"
            initial="normal"
            variants={LINE_VARIANTS}
          />
          <motion.g
            animate={lockControls}
            initial="normal"
            style={{ transformOrigin: "18px 8px" }}
            variants={LOCK_VARIANTS}
          >
            <path d="M20 6V4a2 2 0 1 0-4 0v2" />
            <rect width="8" height="5" x="14" y="6" rx="1" />
          </motion.g>
        </svg>
      </span>
    );
  },
);

GlobeLockIcon.displayName = "GlobeLockIcon";

export { GlobeLockIcon };
