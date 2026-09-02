"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useContainedWheelScroll<
  ElementType extends HTMLElement,
>(): RefObject<ElementType | null> {
  const scrollRef = useRef<ElementType>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const containWheel = (event: WheelEvent) => {
      if (event.ctrlKey || (!event.deltaX && !event.deltaY)) return;

      event.preventDefault();
      event.stopPropagation();

      const horizontalUnit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientWidth
            : 1;
      const verticalUnit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientHeight
            : 1;

      element.scrollBy({
        left: event.deltaX * horizontalUnit,
        top: event.deltaY * verticalUnit,
      });
    };

    element.addEventListener("wheel", containWheel, { passive: false });
    return () => element.removeEventListener("wheel", containWheel);
  }, []);

  return scrollRef;
}
