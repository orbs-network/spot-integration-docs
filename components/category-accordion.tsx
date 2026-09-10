import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

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
  return (
    <details className={`category-accordion ${className}${selected ? " category-selected" : ""}`} open>
      <summary className="category-summary">
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
