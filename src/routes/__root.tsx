import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppErrorComponent } from "@/lib/error-component";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Absolute Truth Studio";
const BOOT = `(function(){try{var crashed=sessionStorage.getItem("ats-crash")==="1";function wipe(prefix){var keys=[];for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(k&&k.indexOf(prefix)===0)keys.push(k);}for(var x=0;x<keys.length;x++)localStorage.removeItem(keys[x]);}wipe("ats-studio-v3");wipe("ats-studio-v4");if(crashed){wipe("ats-studio");}else{try{var raw=localStorage.getItem("ats-studio-v5");if(raw&&raw.length>900000)localStorage.removeItem("ats-studio-v5");}catch(e){wipe("ats-studio");}}sessionStorage.setItem("ats-crash","1");window.addEventListener("load",function(){setTimeout(function(){sessionStorage.removeItem("ats-crash");},5000);});}catch(e){}})();`;

export const Route = createRootRoute({
  errorComponent: AppErrorComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Absolute Truth Studio — four specialists that hand you the product: a verified answer, a still, a clip, or a running app.",
      },
      { name: "theme-color", content: "#020617" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&family=Syne:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Outlet />
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#111b2e",
                  border: "1px solid #243044",
                  color: "#e8eef8",
                },
              }}
            />
          </TooltipProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
