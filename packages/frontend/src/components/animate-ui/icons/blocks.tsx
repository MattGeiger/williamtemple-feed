'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type BlocksProps = IconProps<keyof typeof animations>;

// Registry version shipped malformed d="..." values for both paths; rewritten
// from authoritative Lucide v0.522.0 source. Animation: the small top-right
// block "snaps into" the L-shape from a slight diagonal offset.
const animations = {
  default: {
    floater: {
      initial: { x: 0, y: 0 },
      animate: {
        x: [2, 0],
        y: [-2, 0],
        transition: { duration: 0.45, ease: 'easeOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BlocksProps) {
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
      {/* L-shape (static) */}
      <path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" />
      {/* Top-right block snaps in from a diagonal offset */}
      <motion.rect
        x={14}
        y={2}
        width={8}
        height={8}
        rx={1}
        variants={variants.floater}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Blocks(props: BlocksProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Blocks,
  Blocks as BlocksIcon,
  type BlocksProps,
  type BlocksProps as BlocksIconProps,
};
