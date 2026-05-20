import * as React from "react"
import {
  Switch as AnimateSwitch,
  SwitchThumb,
} from "@/components/animate-ui/primitives/radix/switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof AnimateSwitch>
>(({ className, ...props }, ref) => (
  <AnimateSwitch
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchThumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0"
      )}
      pressedAnimation={{ scaleX: 1.18 }}
    />
  </AnimateSwitch>
))
Switch.displayName = "Switch"

export { Switch }
