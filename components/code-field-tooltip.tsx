"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CodeFieldTooltip({ name, description }: { name: string; description: string }) {
  const [container, setContainer] = useState<Element | null>(null);

  useEffect(() => {
    const updateContainer = () => setContainer(document.fullscreenElement);
    document.addEventListener("fullscreenchange", updateContainer);
    return () => document.removeEventListener("fullscreenchange", updateContainer);
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="code-field-trigger">{name}</button>
      </TooltipTrigger>
      <TooltipContent
        container={container}
        className="code-field-tooltip"
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
      >
        <strong>{name}</strong>
        <span>{description}</span>
      </TooltipContent>
    </Tooltip>
  );
}
