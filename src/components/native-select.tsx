import * as React from "react";
import { cn } from "@/lib/utils";

// Нативный select в стилях shadcn-инпута: без сюрпризов в формах и на мобильных.
export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "border-input h-8 w-full min-w-0 appearance-none rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}
