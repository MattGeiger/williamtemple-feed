import * as React from "react"
import {
  Checkbox as AnimateCheckbox,
  CheckboxIndicator,
} from "@/components/animate-ui/primitives/radix/checkbox"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof AnimateCheckbox>
>(({ className, ...props }, ref) => (
  <AnimateCheckbox
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxIndicator className="h-4 w-4 text-current" />
  </AnimateCheckbox>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
