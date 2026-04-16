"use client";

import { usePathname } from "next/navigation";
import AccessGate from "@/components/layout/AccessGate";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalHistoryProvider } from "@/contexts/PortalHistoryContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { Toaster } from "sonner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  return (
    <AuthProvider>
      <PreferencesProvider>
        <PortalHistoryProvider>
          {isAuthPage ? (
            <>{children}</>
          ) : (
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
                  <AccessGate>{children}</AccessGate>
                </main>
              </div>
            </div>
          )}
        </PortalHistoryProvider>
      </PreferencesProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </AuthProvider>
  );
}
