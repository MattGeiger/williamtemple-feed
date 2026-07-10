// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import type * as React from "react";

import { BotIcon } from "@/components/animate-ui/icons/bot";
import { CircleHelpIcon } from "@/components/animate-ui/icons/circle-help";
import { ClipboardListIcon } from "@/components/animate-ui/icons/clipboard-list";
import { FileChartColumnIcon } from "@/components/animate-ui/icons/file-chart-column";
import { GaugeIcon } from "@/components/animate-ui/icons/gauge";
import { InfoIcon } from "@/components/animate-ui/icons/info";
import { BridgedAnimatedIcon } from "@/components/animate-ui/bridge";
import { AppleIcon } from "@/components/ui/apple";
import { FileTextIcon } from "@/components/ui/file-text";
import { GlobeIcon } from "@/components/ui/globe";
import { LanguagesIcon } from "@/components/ui/languages";
import { ShapesIcon } from "@/components/ui/shapes";

type NavIconProps = React.HTMLAttributes<HTMLElement>;

function animatedIconClassName(className?: string) {
  return className;
}

export function DashboardNavIcon({ className, ...props }: NavIconProps) {
  return (
    <GaugeIcon
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function ReportsNavIcon({ className, ...props }: NavIconProps) {
  return (
    <FileChartColumnIcon
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function CategoriesNavIcon({ className, ...props }: NavIconProps) {
  return (
    <BridgedAnimatedIcon
      icon={ShapesIcon}
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function FoodItemsNavIcon({ className, ...props }: NavIconProps) {
  return (
    <BridgedAnimatedIcon
      icon={AppleIcon}
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function LanguagesNavIcon({ className, ...props }: NavIconProps) {
  return (
    <BridgedAnimatedIcon
      icon={GlobeIcon}
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function TranslationsNavIcon({ className, ...props }: NavIconProps) {
  return (
    <BridgedAnimatedIcon
      icon={LanguagesIcon}
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function ShoppingListsNavIcon({ className, ...props }: NavIconProps) {
  return (
    <ClipboardListIcon
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function DocumentTranslatorNavIcon({
  className,
  ...props
}: NavIconProps) {
  return (
    <BridgedAnimatedIcon
      icon={FileTextIcon}
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function AIConfigurationNavIcon({ className, ...props }: NavIconProps) {
  return (
    <BotIcon
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function HelpNavIcon({ className, ...props }: NavIconProps) {
  return (
    <CircleHelpIcon
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}

export function AboutNavIcon({ className, ...props }: NavIconProps) {
  return (
    <InfoIcon
      size={16}
      className={animatedIconClassName(className)}
      {...props}
    />
  );
}
