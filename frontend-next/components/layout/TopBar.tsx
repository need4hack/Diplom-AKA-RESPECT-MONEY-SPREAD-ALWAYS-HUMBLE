"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Menu } from "lucide-react";
import Link from "next/link";
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
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-zinc-200">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 transition-colors">
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
        <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
      </div>

      {/* User area */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {/* Avatar circle */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200">
                <User size={16} className="text-zinc-600" />
              </div>
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-sm font-medium text-zinc-900">{user.username}</p>
                <p className="text-[11px] text-zinc-500">{user.email}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors ml-1"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
