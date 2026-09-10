"use client";

import { ChevronDown } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";

export function CategoryAccordion({
  children,
  className,
  description,
  selected = false,
  title,
}: {
  children: ReactNode;
  className: string;
  description?: string;
  selected?: boolean;
  title: string;
}) {
  const animationRef = useRef<Animation | null>(null);
  const targetOpenRef = useRef(true);

  useEffect(() => () => animationRef.current?.cancel(), []);

  function toggleCategory(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const summary = event.currentTarget;
    const container = summary.parentElement as HTMLDetailsElement;
    const content = container.querySelector<HTMLElement>(".category-content");
    if (!content) return;

    const expanded = !(animationRef.current ? targetOpenRef.current : container.open);
    const startHeight = container.getBoundingClientRect().height;
    animationRef.current?.cancel();
    animationRef.current = null;
    targetOpenRef.current = expanded;
    delete container.dataset.collapsing;
    container.style.overflow = "";
    content.inert = false;

    if (event.detail === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      container.open = expanded;
      return;
    }

    container.open = true;
    if (!expanded) container.dataset.collapsing = "true";
    content.inert = !expanded;
    const style = getComputedStyle(container);
    const borderHeight = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const endHeight = summary.getBoundingClientRect().height + borderHeight
      + (expanded ? content.getBoundingClientRect().height : -parseFloat(getComputedStyle(summary).borderBottomWidth));
    container.style.overflow = "hidden";

    const animation = container.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
    );
    animationRef.current = animation;
    animation.onfinish = () => {
      container.open = expanded;
      container.style.overflow = "";
      delete container.dataset.collapsing;
      content.inert = false;
      animation.cancel();
      animationRef.current = null;
    };
  }

  return (
    <details className={`category-accordion ${className}${selected ? " category-selected" : ""}`} open>
      <summary className="category-summary" onClick={toggleCategory}>
        <h2 className="category-summary-copy">
          {title}
          {description ? <span>{description}</span> : null}
        </h2>
        <ChevronDown aria-hidden="true" className="category-chevron" size={18} />
      </summary>
      <div className="category-content">{children}</div>
    </details>
  );
}
