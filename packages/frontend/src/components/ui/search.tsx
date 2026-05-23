// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

// Imperative-ref animated variant of Lucide's `search` (the search-input
// adornment). Path-draw: the glass traces on, then the handle. Driven by the
// surrounding search field via a ref (page load + parent hover + parent
// click), so the icon itself keeps `pointer-events-none`. Geometry is Lucide
// v0.522.0 `search` verbatim. See docs/motion/ICON_ANIMATIONS.md.

export interface SearchIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface SearchIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const VARIANTS: Variants = {
  normal: { pathLength: 1, opacity: 1 },
  animate: (i: number) => ({
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      delay: i * 0.2,
      duration: 0.45,
      ease: "easeOut",
      opacity: { duration: 0.1 },
    },
  }),
};

const SearchIcon = forwardRef<SearchIconHandle, SearchIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) onMouseEnter?.(e);
        else controls.start("animate");
      },
      [controls, onMouseEnter],
    );
    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) onMouseLeave?.(e);
        else controls.start("normal");
      },
      [controls, onMouseLeave],
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
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
          <motion.circle
            animate={controls}
            custom={0}
            cx="11"
            cy="11"
            initial="normal"
            r="8"
            variants={VARIANTS}
          />
          <motion.path
            animate={controls}
            custom={1}
            d="m21 21-4.34-4.34"
            initial="normal"
            variants={VARIANTS}
          />
        </svg>
      </div>
    );
  },
);

SearchIcon.displayName = "SearchIcon";

export { SearchIcon };
