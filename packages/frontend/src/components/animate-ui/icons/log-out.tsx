// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

// Hand-rolled animated variant of Lucide's `log-out` (no upstream animate-ui
// version). Native icon so it animates via a parent <AnimateIcon> context —
// e.g. the user dropdown's "Log out" row, wired exactly like TableActionMenu
// (AnimateIcon asChild + animate={animateMount} + animateOnHover/animateOnTap).
// The arrow slides out through the doorway and returns; the door stays put.
// One-shot (no infinite repeat) so it ends back at rest, which keeps the
// action-menu animate-reset invisible. Geometry is Lucide v0.522.0 verbatim.
// See docs/motion/ICON_ANIMATIONS.md.

type LogOutProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    arrow: {
      initial: { x: 0 },
      animate: {
        x: [0, 3, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LogOutProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <motion.g variants={variants.arrow} initial="initial" animate={controls}>
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </motion.g>
    </motion.svg>
  );
}

function LogOut(props: LogOutProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  LogOut,
  LogOut as LogOutIcon,
  type LogOutProps,
  type LogOutProps as LogOutIconProps,
};
