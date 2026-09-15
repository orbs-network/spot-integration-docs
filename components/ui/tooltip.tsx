"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// shadcn/ui Tooltip, with the project's CSS styling and fullscreen portal support.
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    container?: React.ComponentProps<typeof TooltipPrimitive.Portal>["container"];
  }
>(({ className, sideOffset = 4, container, ...props }, ref) => (
  <TooltipPrimitive.Portal container={container}>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={["ui-tooltip-content", className].filter(Boolean).join(" ")}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
