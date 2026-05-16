import type { ComponentType, ReactNode } from "react";

// Standard empty state. Used wherever a list / surface has nothing to show.
// Centered icon + heading + description + optional action.

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: IconComponent;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-6 px-4">
      {Icon && (
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 bg-zinc-800/60 border border-zinc-800">
          <Icon size={18} className="text-zinc-500" />
        </div>
      )}
      <p className="text-sm font-semibold text-zinc-300 mb-1">{title}</p>
      {description && <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
