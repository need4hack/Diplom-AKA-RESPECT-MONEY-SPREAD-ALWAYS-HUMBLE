"use client";

import type { LucideIcon } from "lucide-react";
import {
  Barcode,
  FileClock,
  FileText,
  Globe,
  Info,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { LanguageCode } from "@/contexts/PreferencesContext";
import { isPrivilegedRole } from "@/lib/access";

export type AppNavItem = {
  href: string;
  label: Record<LanguageCode, string>;
  icon: LucideIcon;
};

const ADMIN_NAV_ITEMS: AppNavItem[] = [
  {
    href: "/",
    label: { ru: "Панель", en: "Dashboard" },
    icon: LayoutDashboard,
  },
  {
    href: "/portal",
    label: { ru: "Портал", en: "Portal" },
    icon: Info,
  },
  {
    href: "/bulk-search",
    label: { ru: "Массовый поиск", en: "Bulk Search" },
    icon: Search,
  },
  {
    href: "/vehicle-region",
    label: { ru: "Регионы", en: "Vehicle Region" },
    icon: Globe,
  },
  {
    href: "/backbone",
    label: { ru: "База Данных", en: "Backbone" },
    icon: FileText,
  },
  {
    href: "/users",
    label: { ru: "Пользователи", en: "Users" },
    icon: Users,
  },
  {
    href: "/masters",
    label: { ru: "Справочники", en: "Masters" },
    icon: Settings,
  },
  {
    href: "/vds",
    label: { ru: "VDS", en: "VDS" },
    icon: Barcode,
  },
];

const USER_NAV_ITEMS: AppNavItem[] = [
  {
    href: "/",
    label: { ru: "Кабинет", en: "Workspace" },
    icon: LayoutDashboard,
  },
  {
    href: "/portal",
    label: { ru: "Портал", en: "Portal" },
    icon: Info,
  },
  {
    href: "/responses",
    label: { ru: "Мои отчёты", en: "My Reports" },
    icon: FileClock,
  },
];

const STATIC_TITLES: Record<string, Record<LanguageCode, string>> = {
  "/login": { ru: "Вход", en: "Login" },
  "/responses": { ru: "Мои отчёты", en: "My Reports" },
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getNavItemsForRole(role?: string | null) {
  return isPrivilegedRole(role) ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
}

export function getNavLabel(item: AppNavItem, language: LanguageCode) {
  return item.label[language];
}

export function getPageTitle(
  pathname: string,
  language: LanguageCode,
  role?: string | null
) {
  const matchedItem = getNavItemsForRole(role).find((item) => isActivePath(pathname, item.href));
  if (matchedItem) {
    return matchedItem.label[language];
  }

  return STATIC_TITLES[pathname]?.[language] ?? "CarSpecs";
}

export function isNavItemActive(pathname: string, href: string) {
  return isActivePath(pathname, href);
}
