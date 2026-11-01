"use client";

import { Fragment, useLayoutEffect, useState, type ComponentType, type ReactNode } from "react";

/**
 * With Cache Components, Next.js keeps the last screens mounted but hidden (React Activity), so a
 * form left half filled, or saved, would come back as it was. Every visit starts clean instead
 * (D31): when the screen is hidden, what is inside is mounted again from scratch.
 */
export function ResetOnLeave({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  // The cleanup runs when Activity hides the screen; on a real unmount the update is dropped.
  useLayoutEffect(() => () => setVisit((current) => current + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}

/** The component, starting clean on every visit to its screen. */
export function resetOnLeave<Props extends object>(Component: ComponentType<Props>): ComponentType<Props> {
  function Fresh(props: Props) {
    return (
      <ResetOnLeave>
        <Component {...props} />
      </ResetOnLeave>
    );
  }
  Fresh.displayName = `ResetOnLeave(${Component.displayName ?? Component.name})`;
  return Fresh;
}
