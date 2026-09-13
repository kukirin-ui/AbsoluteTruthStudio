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
        Your work stays yours. Chats, projects, and entitlements live in this browser — not on our servers. A share
        link only encodes the snapshot you choose to copy.
      </p>
      <p>
        A run sends only the prompt and the recent turns needed to answer it to the model that serves your seat.
        With BYOK, that request goes to your own provider account. No sign-up is required to work, and you can
        delete any chat or project at any time.
      </p>
      <p>
        We do not sell personal data, and there are no third-party ad trackers in the studio. Provider keys you add
        are encrypted at rest and never shown back to the browser.
      </p>
    </SiteShell>
  );
}
