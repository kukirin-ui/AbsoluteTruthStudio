import type { AgentId, AgentMemory } from "@/lib/types";
import { SEAT_META, SEAT_ORDER, seatedItem, type Roster } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";

export function MemoryDrawer({
  open,
  onOpenChange,
  memory,
  roster,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memory: AgentMemory;
  roster: Roster;
  onChange: (id: AgentId, text: string) => void;
}) {
  const [active, setActive] = useState<AgentId>("architect");
  const value = memory[active] ?? "";
  const seated = seatedItem(roster, active);
  const meta = SEAT_META[active];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Agent memory" className="left-auto right-0 w-[min(100%,28rem)]">
        <p className="mb-4 text-sm text-muted">
          Standing instructions per tab specialist, up to 4,000 characters. Applied on every turn. Persist with
          Manual Save — not on every keystroke.
        </p>
        <div className="mb-3 flex flex-wrap gap-1">
          {SEAT_ORDER.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={active === id ? "default" : "ghost"}
              onClick={() => setActive(id)}
            >
              {seatedItem(roster, id).name}
            </Button>
          ))}
        </div>
        <p className="mb-2 text-xs tracking-wide text-subtle uppercase">
          {seated.name} · {meta.label}
        </p>
        <Textarea
          value={value}
          maxLength={4000}
          rows={12}
          onChange={(e) => onChange(active, e.target.value)}
          placeholder={`What should ${seated.name} always remember? Tone, constraints, brand rules, banned claims…`}
        />
        <p className="mt-2 text-right font-mono text-[11px] text-subtle tabular-nums">{value.length} / 4000</p>
      </SheetContent>
    </Sheet>
  );
}
