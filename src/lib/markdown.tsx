import type { ReactNode } from "react";

function escapeSplit(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token === "\n") {
      nodes.push(<br key={key++} />);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded-sm bg-elevated px-1 py-px font-mono text-[0.85em] text-indigo-glow"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-medium text-fg">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-glow underline decoration-emerald/40 underline-offset-2 transition-[color] duration-150 hover:text-emerald"
          >
            {link[1]}
          </a>,
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const chunk = blocks[i] ?? "";
    if (i % 2 === 1) {
      const nl = chunk.indexOf("\n");
      const code = nl >= 0 ? chunk.slice(nl + 1) : chunk;
      const lang = nl >= 0 ? chunk.slice(0, nl).trim() : "";
      out.push(
        <pre
          key={i}
          className="my-3 overflow-x-auto rounded-lg bg-bg p-3 font-mono text-xs leading-relaxed text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.06)]"
        >
          {lang ? <div className="mb-2 text-[10px] uppercase tracking-wider text-subtle">{lang}</div> : null}
          <code>{code.replace(/\n$/, "")}</code>
        </pre>,
      );
    } else {
      const paras = chunk.split(/\n{2,}/);
      paras.forEach((p, pi) => {
        const trimmed = p.trim();
        if (!trimmed) return;
        if (trimmed.startsWith("- ")) {
          const items = trimmed.split(/\n- /).map((s) => s.replace(/^- /, ""));
          out.push(
            <ul key={`${i}-${pi}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg">
              {items.map((item, ii) => (
                <li key={ii}>{escapeSplit(item)}</li>
              ))}
            </ul>,
          );
          return;
        }
        out.push(
          <p key={`${i}-${pi}`} className="my-2 text-sm leading-relaxed text-fg">
            {escapeSplit(trimmed)}
          </p>,
        );
      });
    }
  }
  return <div className="min-w-0">{out}</div>;
}
