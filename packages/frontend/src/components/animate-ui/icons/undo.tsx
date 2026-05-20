'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  IconWrapper,
  useAnimateIconContext,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type UndoProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    arrow: {
      initial: { translateX: 0, translateY: 0, rotate: 0 },
      animate: {
        translateX: [0, 2, 0],
        translateY: [0, -1.5, 0],
        rotate: [0, 12, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
    arc: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [1, 0.8, 1],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: UndoProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M3 7v6h6" variants={variants.arrow} initial="initial" animate={controls} />
      <motion.path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" variants={variants.arc} initial="initial" animate={controls} />
    </motion.svg>
  );
}

function Undo(props: UndoProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Undo, Undo as UndoIcon, type UndoProps, type UndoProps as UndoIconProps };
