"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type LanguageCode = "ru" | "en";
export type CurrencyCode = "AED" | "USD" | "RUB";

const STORAGE_KEYS = {
  language: "app-language",
  currency: "app-currency",
} as const;

const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  AED: 1,
  USD: 1 / 3.6725,
  RUB: 20.6926,
};

export const CURRENCY_META = {
  AED: {
    symbol: "د.إ",
    shortLabel: "AED",
    label: {
      ru: "Дирхамы ОАЭ",
      en: "UAE Dirhams",
    },
  },
  USD: {
    symbol: "$",
    shortLabel: "USD",
    label: {
      ru: "Доллары США",
      en: "US Dollars",
    },
  },
  RUB: {
    symbol: "₽",
    shortLabel: "RUB",
    label: {
      ru: "Российские рубли",
      en: "Russian Rubles",
    },
  },
} as const;

type PreferencesContextValue = {
  language: LanguageCode;
  currency: CurrencyCode;
  setLanguage: (value: LanguageCode) => void;
  setCurrency: (value: CurrencyCode) => void;
  formatAedPrice: (value: number) => string;
  convertFromAed: (value: number) => number;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === "ru" || value === "en";
}

function isCurrencyCode(value: string | null): value is CurrencyCode {
  return value === "AED" || value === "USD" || value === "RUB";
}

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "ru";
  }

  const savedLanguage = window.localStorage.getItem(STORAGE_KEYS.language);
  return isLanguageCode(savedLanguage) ? savedLanguage : "ru";
}

function getInitialCurrency(): CurrencyCode {
  if (typeof window === "undefined") {
    return "AED";
  }

  const savedCurrency = window.localStorage.getItem(STORAGE_KEYS.currency);
  return isCurrencyCode(savedCurrency) ? savedCurrency : "AED";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>(getInitialLanguage);
  const [currency, setCurrency] = useState<CurrencyCode>(getInitialCurrency);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.language, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.currency, currency);
  }, [currency]);

  const value = useMemo<PreferencesContextValue>(() => {
    const convertFromAed = (amount: number) => amount * EXCHANGE_RATES[currency];

    const formatAedPrice = (amount: number) => {
      const locale = language === "ru" ? "ru-RU" : "en-US";

      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(convertFromAed(amount));
    };

    return {
      language,
      currency,
      setLanguage,
      setCurrency,
      formatAedPrice,
      convertFromAed,
    };
  }, [currency, language]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }

  return context;
}
