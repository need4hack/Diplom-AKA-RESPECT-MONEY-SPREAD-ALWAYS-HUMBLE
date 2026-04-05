"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Info,
  Search,
  Globe,
  FileText,
  Users,
  Settings,
  Barcode,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

/* ─── nav definition ──────────────────────────────────────── */

export const NAV_ITEMS = [
  { href: "/",               label: "Dashboard",      icon: LayoutDashboard },
  { href: "/portal",         label: "Portal",         icon: Info },
  { href: "/bulk-search",    label: "Bulk Search",    icon: Search },
  { href: "/vehicle-region", label: "Vehicle Region", icon: Globe },
  { href: "/backbone",       label: "Backbone",       icon: FileText },
  { href: "/users",          label: "Users",          icon: Users },
  { href: "/masters",        label: "Masters",        icon: Settings },
  { href: "/vds",            label: "VDS",            icon: Barcode },
];

/* ─── animation config ────────────────────────────────────── */

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64; // w-16

const sidebarVariants = {
  expanded: {
    width: EXPANDED_WIDTH,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  collapsed: {
    width: COLLAPSED_WIDTH,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

const textVariants = {
  show: {
    opacity: 1,
    x: 0,
    display: "inline-block",
    transition: { type: "spring" as const, stiffness: 300, damping: 30, delay: 0.05 },
  },
  hide: {
    opacity: 0,
    x: -8,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    transitionEnd: { display: "none" },
  },
};

/* ─── component ───────────────────────────────────────────── */

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      className={cn(
        "hidden md:flex flex-col bg-zinc-950 text-zinc-300",
        "border-r border-zinc-800 h-screen sticky top-0 z-40 overflow-hidden"
      )}
    >
      {/* Logo + toggle */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800 shrink-0">
        <AnimatePresence mode="popLayout">
          {!collapsed && (
            <motion.span
              key="logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="text-lg font-bold tracking-wider text-white uppercase whitespace-nowrap"
            >
              carspecs
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white shrink-0",
            collapsed && "mx-auto" // Centers the hamburger horizontally
          )}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center p-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap overflow-hidden",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
              )}
              title={collapsed ? label : undefined}
            >
              <div className="w-8 h-8 flex shrink-0 items-center justify-center">
                <Icon size={20} />
              </div>
              <motion.span
                initial={false}
                animate={collapsed ? "hide" : "show"}
                variants={textVariants}
                className="truncate ml-3"
              >
                {label}
              </motion.span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom — version badge */}
      <div className="px-4 py-3 border-t border-zinc-800 shrink-0 flex items-center justify-center min-h-[45px]">
        <motion.p
          initial={false}
          animate={collapsed ? "hide" : "show"}
          variants={textVariants}
          className="text-[11px] text-zinc-600 text-center whitespace-nowrap"
        >
          CarSpecs v2.0
        </motion.p>
      </div>
    </motion.aside>
  );
}
