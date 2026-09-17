import type { AgentMemory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";

/**
 * The 8 base agents. No sub-versions. 
 * These are the "real" agents available for BYOK and Memory.
 */
const AGENT_TABS = [
  { id: "claude", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "grok", name: "Grok" },
  { id: "gemini", name: "Gemini" },
  { id: "mistral", name: "Mistral" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "qwen", name: "Qwen" },
  { id: "muse", name: "Muse Spark" },
] as const;

export function MemoryDrawer({
  open,
  onOpenChange,
  memory,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memory: AgentMemory;
  onChange: (id: string, text: string) => void;
}) {
  const [active, setActive] = useState<string>("claude");
  const activeTab = AGENT_TABS.find((a) => a.id === active) || AGENT_TABS[0];
  
  // Cast memory to Record<string, string> to allow any agent ID as key
  const memoryRecord = memory as unknown as Record<string, string>;
  const value = memoryRecord[active] ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Agent memory" className="left-auto right-0 w-[min(100%,28rem)]">
        <p className="mb-4 text-sm text-muted">
          Standing instructions per agent, up to 4,000 characters. Applied on every turn. Persist with
          Manual Save — not on every keystroke.
        </p>
        
        {/* 8 Agent Tabs */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {AGENT_TABS.map((agent) => (
            <Button
              key={agent.id}
              type="button"
              size="sm"
              variant={active === agent.id ? "default" : "ghost"}
              onClick={() => setActive(agent.id)}
              className="text-xs"
            >
              {agent.name}
            </Button>
          ))}
        </div>

        <p className="mb-2 text-xs tracking-wide text-subtle uppercase">
          {activeTab.name} · Base Agent
        </p>
        
        <Textarea
          value={value}
          maxLength={4000}
          rows={12}
          onChange={(e) => onChange(active, e.target.value)}
          placeholder={`What should ${activeTab.name} always remember? Tone, constraints, brand rules, banned claims…`}
        />
        
        <p className="mt-2 text-right font-mono text-[11px] text-subtle tabular-nums">
          {value.length} / 4000
        </p>
      </SheetContent>
    </Sheet>
  );
}