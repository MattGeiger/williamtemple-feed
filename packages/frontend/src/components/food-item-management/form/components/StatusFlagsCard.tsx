import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { StatusFlagsGroup } from "./StatusFlagsGroup"
import { useStatusFlags } from "@/hooks/food-item/form/flags"
import { StatusFlags } from "@/types/food-item"

interface StatusFlagsCardProps {
  initialFlags?: StatusFlags
  onFlagsChange?: (flags: StatusFlags) => void
  disabled?: boolean
  className?: string
}

export function StatusFlagsCard({
  initialFlags,
  onFlagsChange,
  disabled = false,
  className
}: StatusFlagsCardProps) {
  const {
    flags,
    handleFlagChange,
    getStatusInfo
  } = useStatusFlags(initialFlags);

  // Notify parent component of changes
  React.useEffect(() => {
    onFlagsChange?.(flags);
  }, [flags, onFlagsChange]);

  return (
    <Card className={`bg-card text-card-foreground ${className || ''}`}>
      <CardContent className="pt-6">
        <StatusFlagsGroup
          value={flags}
          onChange={handleFlagChange}
          disabled={disabled}
          variant="inline"
        />
      </CardContent>
    </Card>
  );
}