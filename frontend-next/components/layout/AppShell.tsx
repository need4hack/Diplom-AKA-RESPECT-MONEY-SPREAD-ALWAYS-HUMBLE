"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

/**
 * Client-side shell that wraps every page with:
 *  - AuthProvider (global auth state)
 *  - Sidebar + TopBar (hidden on /login)
 *  - Toaster (toast notifications)
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  return (
    <AuthProvider>
      {isAuthPage ? (
        /* Login page — full-screen, no sidebar */
        <>{children}</>
      ) : (
        /* App pages — sidebar + topbar + content */
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto p-6 bg-zinc-50">
              {children}
            </main>
          </div>
        </div>
      )}
      <Toaster position="bottom-right" richColors closeButton />
    </AuthProvider>
  );
}
