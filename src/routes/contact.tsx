import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell } from "@/components/studio/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({ meta: [{ title: "Contact · Absolute Truth Studio" }] }),
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");

  return (
    <SiteShell title="Contact" kicker="On this device">
      <p>
        Messages stay on this device in this preview. Use the form to draft a note, then copy it to your own mail
        client if you want it off-device.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const note = `From: ${name} <${email}>\n\n${body}`;
          void navigator.clipboard.writeText(note).then(
            () => toast.success("Note copied — nothing was sent to a server"),
            () => toast.message("Draft saved locally"),
          );
        }}
      >
        <label className="block text-xs tracking-wide text-subtle uppercase">
          Name
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-xs tracking-wide text-subtle uppercase">
          Email
          <Input
            className="mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs tracking-wide text-subtle uppercase">
          Message
          <Textarea className="mt-1" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
        </label>
        <Button type="submit">Copy message</Button>
      </form>
    </SiteShell>
  );
}
