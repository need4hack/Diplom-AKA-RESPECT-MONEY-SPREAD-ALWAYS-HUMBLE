"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Currency,
  Languages,
  LogOut,
  Menu,
  User,
} from "lucide-react";
import Link from "next/link";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getNavLabel, NAV_ITEMS } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  CURRENCY_META,
  type CurrencyCode,
  type LanguageCode,
  usePreferences,
} from "@/contexts/PreferencesContext";

const PAGE_TITLES: Record<LanguageCode, Record<string, string>> = {
  ru: {
    "/": "Панель",
    "/portal": "Портал",
    "/bulk-search": "Массовый поиск",
    "/vehicle-region": "Сравнение регионов",
    "/backbone": "База Данных",
    "/users": "Пользователи",
    "/masters": "Справочники",
    "/vds": "VDS",
    "/login": "Вход",
  },
  en: {
    "/": "Dashboard",
    "/portal": "Portal",
    "/bulk-search": "Bulk Search",
    "/vehicle-region": "Vehicle Region",
    "/backbone": "Backbone",
    "/users": "Users",
    "/masters": "Masters",
    "/vds": "VDS",
    "/login": "Login",
  },
};

const TOPBAR_TEXT = {
  ru: {
    toggleMenu: "Открыть меню",
    navigationTitle: "Меню навигации",
    navigationDescription: "Основная навигация приложения.",
    signIn: "Войти",
    logout: "Выйти",
    language: "Язык",
    currency: "Валюта",
    russian: "Русский",
    english: "English",
  },
  en: {
    toggleMenu: "Toggle menu",
    navigationTitle: "Navigation Menu",
    navigationDescription: "Main application navigation.",
    signIn: "Sign in",
    logout: "Logout",
    language: "Language",
    currency: "Currency",
    russian: "Russian",
    english: "English",
  },
} as const;

export default function TopBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { language, currency, setLanguage, setCurrency } = usePreferences();
  const [open, setOpen] = useState(false);

  const title = PAGE_TITLES[language][pathname] ?? "CarSpecs";
  const text = TOPBAR_TEXT[language];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden">
              <Menu size={20} />
              <span className="sr-only">{text.toggleMenu}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] border-zinc-800 bg-zinc-950 p-0 text-zinc-300">
            <SheetTitle className="sr-only">{text.navigationTitle}</SheetTitle>
            <SheetDescription className="sr-only">
              {text.navigationDescription}
            </SheetDescription>
            <div className="flex h-14 items-center border-b border-zinc-800 px-6">
              <span className="text-lg font-bold uppercase tracking-wider text-white">
                carspecs
              </span>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                const localizedLabel = getNavLabel({ href, label, icon: Icon }, language);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span>{localizedLabel}</span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
          <SelectTrigger size="sm" className="h-8 w-[92px] sm:w-[128px]">
            <Languages className="size-4 text-muted-foreground" />
            <SelectValue placeholder={text.language} />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="ru">{text.russian}</SelectItem>
            <SelectItem value="en">{text.english}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
          <SelectTrigger size="sm" className="h-8 w-[92px] sm:w-[128px]">
            <Currency className="size-4 text-muted-foreground" />
            <SelectValue placeholder={text.currency} />
          </SelectTrigger>
          <SelectContent align="end">
            {(["AED", "USD", "RUB"] as CurrencyCode[]).map((code) => (
              <SelectItem key={code} value={code}>
                <span className="flex items-center gap-2">
                  <span className="min-w-6 text-muted-foreground">
                    {CURRENCY_META[code].symbol}
                  </span>
                  <span>{CURRENCY_META[code].shortLabel}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ThemeToggle />

        {user ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted">
                <User size={16} className="text-muted-foreground" />
              </div>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-foreground">{user.username}</p>
                <p className="text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={text.logout}
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.signIn}
          </Link>
        )}
      </div>
    </header>
  );
}
