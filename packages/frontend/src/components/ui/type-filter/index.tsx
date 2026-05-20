import * as React from "react"
import { ChevronDown } from "@/components/ui/icons";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TranslationType } from "@/types/translation"

const TRANSLATION_TYPES: TranslationType[] = ['Category', 'FoodItem', 'Custom', 'Generated']

interface TypeFilterProps {
  selectedTypes: TranslationType[]
  onTypeChange: (types: TranslationType[]) => void
  className?: string
}

export function TypeFilter({ selectedTypes, onTypeChange, className }: TypeFilterProps) {
  const toggleType = (type: TranslationType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type]
    onTypeChange(newTypes.length ? newTypes : TRANSLATION_TYPES)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("h-8", className)}
          data-testid="type-filter-button"
        >
          Types <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        {TRANSLATION_TYPES.map((type) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={selectedTypes.includes(type)}
            onCheckedChange={() => toggleType(type)}
          >
            {type === 'FoodItem' ? 'Food Item' : 
             type === 'Generated' ? 'Generated (Document)' : 
             type}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}