import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "cn";
import { Input } from "./ui/input";

/** A list's search box, with the magnifier inside. */
export function SearchInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input type="search" className="bg-card pl-9" {...props} />
    </div>
  );
}
