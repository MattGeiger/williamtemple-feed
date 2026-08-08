// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from "react";
import { Check, ChevronsUpDown } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { foodIcons, getIconComponent, iconsByCategory, DEFAULT_ICON, ICON_CATEGORY_LABELS, IconCategory } from "@/lib/food-icons";

interface IconSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function IconSelector({ value, onChange, disabled = false }: IconSelectorProps) {
  const [open, setOpen] = React.useState(false);
  // `pets` was defined but missing here, so its icons never appeared. `outdoor`
  // is still omitted deliberately — surfacing bikes and tents is a separate
  // product decision, not part of adding animals.
  const categoryOrder: IconCategory[] = ['food', 'drink', 'health', 'household', 'clothing', 'pets', 'other'];

  const getDisplayContent = () => {
    const icon = foodIcons.find(i => i.value === value);
    if (icon) {
      const IconComponent = icon.component;
      return (
        <>
          <IconComponent className="mr-2 h-4 w-4" />
          <span>{icon.label}</span>
        </>
      );
    }
    return <span>Select icon...</span>;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            {getDisplayContent()}
          </div>
          <ChevronsUpDown className="opacity-50 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px] z-50" align="start" sideOffset={5}>
        <Command>
          <CommandInput placeholder="Search icons..." className="h-9" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No icon found.</CommandEmpty>
            {categoryOrder.map((category) => (
              <CommandGroup
                key={category}
                heading={ICON_CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)}
              >
                {iconsByCategory[category]?.map((icon) => {
                  const Icon = icon.component;
                  return (
                    <CommandItem
                      key={icon.value}
                      value={icon.value}
                      onSelect={(currentValue) => {
                        console.log('Selected icon:', currentValue);
                        // Stop the component from clearing value when selected twice
                        if (currentValue === value) return;
                        onChange(currentValue);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center">
                        <Icon className="mr-2 h-4 w-4" />
                        {icon.label}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === icon.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
