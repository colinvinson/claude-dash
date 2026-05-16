import type { ReactNode } from "react";
import { TYPE } from "@/lib/design-tokens";

// Standard form field label. Pair with FormInput. Use the `optional` flag
// to surface a subtle "(optional)" suffix without rolling it manually.

export default function FormLabel({
  children,
  optional = false,
  className = "",
  htmlFor,
}: {
  children: ReactNode;
  optional?: boolean;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`${TYPE.label} mb-1 block ${className}`}>
      {children}
      {optional && <span className="ml-1 text-zinc-600 normal-case tracking-normal">(optional)</span>}
    </label>
  );
}
