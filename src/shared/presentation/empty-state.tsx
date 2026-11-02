import type { ReactNode } from "react";

/** What a list shows when it has nothing: an icon, one line, and what to do about it. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground [&>svg]:size-6">
        {icon}
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}
