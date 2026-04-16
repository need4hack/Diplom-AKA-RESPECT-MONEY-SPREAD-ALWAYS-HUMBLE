"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { getFallbackPath, isPathAccessible } from "@/lib/access";

const TEXT = {
  ru: {
    loading: "Проверяем доступ...",
    redirecting: "Перенаправляем в доступный раздел...",
  },
  en: {
    loading: "Checking access...",
    redirecting: "Redirecting to an allowed section...",
  },
} as const;

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = usePreferences();
  const text = TEXT[language];
  const canAccess = isPathAccessible(pathname, user?.role);

  useEffect(() => {
    if (loading || canAccess) {
      return;
    }

    router.replace(getFallbackPath(user?.role, Boolean(user)));
  }, [canAccess, loading, router, user]);

  if (loading && pathname !== "/login") {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{text.loading}</span>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>{text.redirecting}</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
