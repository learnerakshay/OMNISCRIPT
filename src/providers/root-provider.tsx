import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { Sparkles, Key, ExternalLink, Settings, ShieldCheck } from "lucide-react";
import { QueryProvider } from "./query-provider";
import { ToastProvider } from "./toast-provider";
import { AccentProvider } from "./accent-provider";
import { SettingsProvider } from "./settings-provider";

interface RootProviderProps {
  children: ReactNode;
}

// Retrieve Clerk publishable key from environment variables
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function RootProvider({ children }: RootProviderProps) {
  // Render the setup guide only when Vite did not provide a publishable key.
  const isKeyMissing = !clerkPublishableKey?.trim();

  if (isKeyMissing) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col justify-between selection:bg-zinc-900 selection:text-zinc-50 font-sans">
        {/* Header */}
        <header className="border-b border-zinc-200/85 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-medium tracking-tight text-lg text-zinc-900">
                OMNISCRIPT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500 font-semibold uppercase tracking-wider">
                Setup Required
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-6 py-12 md:py-20">
          <div className="max-w-xl w-full bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-full blur-3xl opacity-80 -mr-8 -mt-8"></div>
            
            <div className="space-y-3 relative">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                <Key className="w-6 h-6 text-amber-600" />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-950">
                Configure Clerk Authentication
              </h1>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Milestone 03 establishes user authentication via Clerk. To activate user session features, route protection, and database synchronization, please link your Clerk keys.
              </p>
            </div>

            <div className="border-t border-b border-zinc-100 py-5 space-y-4 relative">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Configuration Steps
              </h3>
              
              <div className="space-y-3.5">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-700 shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p className="font-medium text-zinc-900">Get keys from Clerk Dashboard</p>
                    <p>
                      Go to{" "}
                      <a 
                        href="https://dashboard.clerk.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-zinc-900 underline font-medium inline-flex items-center gap-0.5"
                      >
                        dashboard.clerk.com <ExternalLink className="w-3 h-3" />
                      </a>{" "}
                      and copy your <strong>Publishable Key</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-700 shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p className="font-medium text-zinc-900">Add to Secrets Panel</p>
                    <p>
                      Open the <strong>Settings</strong> or <strong>Secrets</strong> panel in AI Studio and add:
                    </p>
                    <code className="block bg-zinc-50 border border-zinc-200/60 p-2 rounded text-[10px] font-mono text-zinc-800 break-all select-all">
                      VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
                    </code>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-700 shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p className="font-medium text-zinc-900">Reload Application</p>
                    <p>The applet will automatically reload and unlock user logins securely.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-[11px] text-zinc-500 font-medium">
                Secrets are fully encrypted and kept safely server-side.
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-200/60 bg-white/30 py-6">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <div>
              © {new Date().getFullYear()} OMNISCRIPT. All rights reserved.
            </div>
            <div className="flex gap-4">
              <span>TypeScript 5.8</span>
              <span>•</span>
              <span>Clerk Auth v5</span>
              <span>•</span>
              <span>Prisma ORM</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryProvider>
        <AccentProvider>
          <SettingsProvider>
            <ToastProvider>{children}</ToastProvider>
          </SettingsProvider>
        </AccentProvider>
      </QueryProvider>
    </ClerkProvider>
  );
}
