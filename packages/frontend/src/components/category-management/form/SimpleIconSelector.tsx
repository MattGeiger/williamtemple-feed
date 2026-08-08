// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from "react";
import { foodIcons, IconCategory, DEFAULT_ICON, ICON_CATEGORY_LABELS } from "@/lib/food-icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SimpleIconSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SimpleIconSelector({ value, onChange, disabled = false }: SimpleIconSelectorProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  
  // Group icons by category.
  //
  // `pets` was defined in food-icons.ts but missing here, so five icons were
  // unreachable. `outdoor` stays omitted deliberately — surfacing bikes and
  // tents is a separate product decision.
  const categories: IconCategory[] = ['food', 'drink', 'health', 'household', 'clothing', 'pets', 'other'];

  // Filter icons based on search term
  const filteredIcons = searchTerm 
    ? foodIcons.filter(icon => 
        icon.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        icon.value.toLowerCase().includes(searchTerm.toLowerCase()))
    : foodIcons;

  // Group filtered icons by category
  const groupedIcons = categories.map(category => {
    const icons = filteredIcons.filter(icon => icon.category === category);
    return { category, icons };
  }).filter(group => group.icons.length > 0);

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Search icons..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={disabled}
        className="mb-2"
      />
      
      <ScrollArea className="h-20 rounded-md border">
        <div className="p-4">
          {groupedIcons.map(group => (
            <div key={group.category} className="mb-4">
              <h4 className="mb-2 text-sm font-medium">
                {ICON_CATEGORY_LABELS[group.category] ??
                  group.category.charAt(0).toUpperCase() + group.category.slice(1)}
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {group.icons.map(icon => {
                  const IconComponent = icon.component;
                  const isSelected = value === icon.value;
                  
                  return (
                    <button
                    key={icon.value}
                    type="button"
                    onClick={() => onChange(icon.value)}
                    disabled={disabled}
                    className={`flex items-center justify-center p-1 rounded-md ${
                    isSelected 
                    ? 'bg-primary/10 ring-1 ring-primary' 
                    : 'hover:bg-accent'
                    }`}
                      title={icon.label}
                    >
                    <IconComponent className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredIcons.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">
              No icons found
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="flex items-center gap-2">
        <Label>Selected:</Label>
        {value ? (
          <div className="flex items-center gap-1">
            {(() => {
              const selectedIcon = foodIcons.find(i => i.value === value);
              if (selectedIcon) {
                const IconComponent = selectedIcon.component;
                return (
                  <>
                    <IconComponent className="h-4 w-4" />
                    <span>{selectedIcon.label}</span>
                  </>
                );
              }
              return <span>None</span>;
            })()}
          </div>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </div>
    </div>
  );
}
