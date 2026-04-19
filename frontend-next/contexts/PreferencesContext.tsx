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

type MoneyFxInstance = {
  convert: (value: number, options: { from: string; to: string }) => number;
  rates: Record<string, number>;
  base: string;
};

declare global {
  interface Window {
    fx?: MoneyFxInstance;
  }
}

const DEFAULT_LANGUAGE: LanguageCode = "ru";
const DEFAULT_CURRENCY: CurrencyCode = "AED";

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
  exchangeRateSource: "live-cbr" | "fallback";
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
  return DEFAULT_LANGUAGE;
}

function getInitialCurrency(): CurrencyCode {
  return DEFAULT_CURRENCY;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>(getInitialLanguage);
  const [currency, setCurrency] = useState<CurrencyCode>(getInitialCurrency);
  const [storageReady, setStorageReady] = useState(false);
  const [fxReady, setFxReady] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const savedLanguage = window.localStorage.getItem(STORAGE_KEYS.language);
      const savedCurrency = window.localStorage.getItem(STORAGE_KEYS.currency);

      if (isLanguageCode(savedLanguage)) {
        setLanguage(savedLanguage);
      }

      if (isCurrencyCode(savedCurrency)) {
        setCurrency(savedCurrency);
      }

      setStorageReady(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    if (!storageReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.language, language);
  }, [language, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.currency, currency);
  }, [currency, storageReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    function loadMoneyJsLibrary() {
      return new Promise<void>((resolve, reject) => {
        if (typeof window.fx?.convert === "function") {
          resolve();
          return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>(
          'script[data-carspecs-moneyjs="true"]',
        );

        if (existingScript) {
          if (
            existingScript.dataset.loaded === "true" ||
            typeof window.fx?.convert === "function"
          ) {
            resolve();
            return;
          }

          existingScript.addEventListener("load", () => resolve(), { once: true });
          existingScript.addEventListener(
            "error",
            () => reject(new Error("Failed to load money.js library.")),
            { once: true },
          );
          return;
        }

        const script = document.createElement("script");
        script.src = "https://openexchangerates.github.io/money.js/money.min.js";
        script.async = true;
        script.dataset.carspecsMoneyjs = "true";
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded = "true";
            resolve();
          },
          { once: true },
        );
        script.addEventListener(
          "error",
          () => reject(new Error("Failed to load money.js library.")),
          { once: true },
        );
        document.body.appendChild(script);
      });
    }

    async function initializeLiveRates() {
      try {
        await loadMoneyJsLibrary();

        const response = await fetch("https://www.cbr-xml-daily.ru/latest.js", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch rates: ${response.status}`);
        }

        const data = (await response.json()) as {
          base?: string;
          rates?: Record<string, number>;
        };

        if (
          cancelled ||
          typeof window.fx?.convert !== "function" ||
          typeof data.base !== "string" ||
          !data.rates
        ) {
          return;
        }

        window.fx.rates = data.rates;
        window.fx.base = data.base;
        setFxReady(true);
      } catch {
        if (!cancelled) {
          setFxReady(false);
        }
      }
    }

    void initializeLiveRates();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<PreferencesContextValue>(() => {
    const convertFromAed = (amount: number) => {
      if (currency === "AED") {
        return amount;
      }

      if (typeof window !== "undefined" && fxReady && typeof window.fx?.convert === "function") {
        try {
          const converted = window.fx.convert(amount, { from: "AED", to: currency });
          if (Number.isFinite(converted)) {
            return converted;
          }
        } catch {
          // Fall back to static rates below when the external script is unavailable.
        }
      }

      return amount * EXCHANGE_RATES[currency];
    };

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
      exchangeRateSource: fxReady ? "live-cbr" : "fallback",
      setLanguage,
      setCurrency,
      formatAedPrice,
      convertFromAed,
    };
  }, [currency, fxReady, language]);

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
