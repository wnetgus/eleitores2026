import React from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  actions?: React.ReactNode[];
}

export function EmptyState({ icon = "📭", title, description, action, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <h3 className="text-white/70 font-medium text-lg mb-1">{title}</h3>
      {description && <p className="text-white/30 text-sm text-center max-w-md mb-4">{description}</p>}
      {action && (
        <a
          href={action.href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-all border border-emerald-500/20"
        >
          {action.label}
        </a>
      )}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          {actions.map((node, i) => (
            <React.Fragment key={i}>{node}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
