import type * as React from "react";

import { BotIcon } from "@/components/animate-ui/icons/bot";
import { ClipboardListIcon } from "@/components/animate-ui/icons/clipboard-list";
import { GaugeIcon } from "@/components/animate-ui/icons/gauge";
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
