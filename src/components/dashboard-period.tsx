"use client";

import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { PERIOD_OPTIONS, type Period } from "@/lib/deal-list";

type Props = { period: Period; from: string; to: string };

export function DashboardPeriod({ period, from, to }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const go = (next: { period?: Period; from?: string; to?: string }) => {
    const p = { period, from, to, ...next };
    const sp = new URLSearchParams();
    if (p.period !== "all") sp.set("period", p.period);
    if (p.period === "custom") {
      if (p.from) sp.set("from", p.from);
      if (p.to) sp.set("to", p.to);
    }
    const s = sp.toString();
    router.replace(pathname + (s ? `?${s}` : ""), { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        className="w-36"
        value={period}
        onChange={(e) => go({ period: e.target.value as Period })}
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {period === "custom" && (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="Дата начала"
            className="h-8 w-36"
            value={from}
            onChange={(e) => go({ from: e.target.value })}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="Дата конца"
            className="h-8 w-36"
            value={to}
            onChange={(e) => go({ to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
