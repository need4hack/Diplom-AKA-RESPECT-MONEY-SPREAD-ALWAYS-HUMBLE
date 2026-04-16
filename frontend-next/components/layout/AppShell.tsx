"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { Toaster } from "sonner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  return (
    <AuthProvider>
      <PreferencesProvider>
        {isAuthPage ? (
          <>{children}</>
        ) : (
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
                {children}
              </main>
            </div>
          </div>
        )}
      </PreferencesProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </AuthProvider>
  );
}
