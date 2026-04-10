"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Menu } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { NAV_ITEMS } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useState } from "react";

/* ─── map route → page name ───────────────────────────────── */

const PAGE_TITLES: Record<string, string> = {
  "/":               "Dashboard",
  "/portal":         "Portal",
  "/bulk-search":    "Bulk Search",
  "/vehicle-region": "Vehicle Region",
  "/backbone":       "Backbone",
  "/users":          "Users",
  "/masters":        "Masters",
  "/vds":            "VDS",
  "/login":          "Login",
};

/* ─── component ───────────────────────────────────────────── */

export default function TopBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const title = PAGE_TITLES[pathname] ?? "CarSpecs";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden">
              <Menu size={20} />
              <span className="sr-only">Toggle Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-zinc-950 border-zinc-800 text-zinc-300">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Main application navigation for dashboard and admin sections.
            </SheetDescription>
            <div className="flex items-center px-6 h-14 border-b border-zinc-800">
              <span className="text-lg font-bold tracking-wider text-white uppercase">
                carspecs
              </span>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Page title */}
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>

      {/* User area */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user ? (
          <>
            {/* Avatar circle */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                <User size={16} className="text-muted-foreground" />
              </div>
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-sm font-medium text-foreground">{user.username}</p>
                <p className="text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
