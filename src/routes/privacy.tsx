import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({ meta: [{ title: "Privacy · Absolute Truth Studio" }] }),
});

function PrivacyPage() {
  return (
    <SiteShell title="Privacy" kicker="On-device by design">
      <p>
        Absolute Truth Studio does not persist chats, projects, or billing entitlements on a server. Saved work lives
        in this browser. Share links encode a snapshot you choose to copy.
      </p>
      <p>
        Mesh requests send only the prompt and recent turns needed to answer. Image and video renders send only
        the Imagine brief. No account is required. You can delete any chat or project from the library at any
        time.
      </p>
      <p>We do not sell personal data. There are no third-party ad trackers in the studio shell.</p>
    </SiteShell>
  );
}
