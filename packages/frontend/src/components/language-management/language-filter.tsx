import { Search } from "@/components/ui/icons";
import { Input } from "@/components/ui/input"
import { Language } from "@/types/language"

interface LanguageFilterProps {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function LanguageFilter({ 
  value,
  onValueChange,
  disabled
}: LanguageFilterProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Search languages..."
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="pl-8 w-full sm:w-auto sm:min-w-[200px] sm:max-w-sm"
      />
    </div>
  )
}