"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import {
  getNavItemsForRole,
  getNavLabel,
  isNavItemActive,
} from "@/components/layout/nav-config";

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

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

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { language } = usePreferences();
  const navItems = getNavItemsForRole(user?.role);

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      className={cn(
        "hidden h-screen sticky top-0 z-40 overflow-hidden border-r border-zinc-800 bg-zinc-950 text-zinc-300 md:flex md:flex-col"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4 shrink-0">
        <AnimatePresence mode="popLayout">
          {!collapsed && (
            <motion.span
              key="logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="whitespace-nowrap text-lg font-bold uppercase tracking-wider text-white"
            >
              carspecs
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            collapsed && "mx-auto"
          )}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = isNavItemActive(pathname, href);
          const localizedLabel = getNavLabel({ href, label, icon: Icon }, language);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center overflow-hidden whitespace-nowrap rounded-lg p-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
              )}
              title={collapsed ? localizedLabel : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon size={20} />
              </div>
              <motion.span
                initial={false}
                animate={collapsed ? "hide" : "show"}
                variants={textVariants}
                className="ml-3 truncate"
              >
                {localizedLabel}
              </motion.span>
            </Link>
          );
        })}
      </nav>

      <div className="flex min-h-[45px] items-center justify-center border-t border-zinc-800 px-4 py-3 shrink-0">
        <motion.p
          initial={false}
          animate={collapsed ? "hide" : "show"}
          variants={textVariants}
          className="whitespace-nowrap text-center text-[11px] text-zinc-600"
        >
          CarSpecs v2.0
        </motion.p>
      </div>
    </motion.aside>
  );
}
